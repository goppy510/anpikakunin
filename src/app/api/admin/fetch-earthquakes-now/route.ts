import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { parseStringPromise } from "xml2js";
import {
  extractEarthquakeInfo,
  type TelegramItem,
  type EarthquakeInfo,
} from "@/app/lib/notification/dmdataExtractor";
import { getDmdataApiKey } from "@/app/lib/dmdata/credentials";

const DMDATA_API_BASE_URL = "https://api.dmdata.jp";

/**
 * DMData API /v1/{id} から返されるXMLをパースしてTelegramItem形式に変換
 */
async function parseXmlToTelegramItem(xmlString: string, meta: any): Promise<TelegramItem | null> {
  try {
    const parsed = await parseStringPromise(xmlString, {
      explicitArray: false,
      mergeAttrs: true,
    });

    const report = parsed.Report;
    const control = report.Control;
    const head = report.Head;

    return {
      id: meta.id,
      classification: meta.classification,
      head: {
        type: meta.head.type,
        author: meta.head.author,
        time: meta.head.time,
        designation: meta.head.designation,
        test: meta.head.test,
        eventID: head.EventID,
      },
      receivedTime: meta.receivedTime,
      xmlReport: {
        control: {
          Title: control.Title,
          DateTime: control.DateTime,
          Status: control.Status,
          EditorialOffice: control.EditorialOffice,
          PublishingOffice: control.PublishingOffice,
        },
        head: {
          Title: head.Title,
          ReportDateTime: head.ReportDateTime,
          TargetDateTime: head.TargetDateTime,
          EventID: head.EventID,
          InfoType: head.InfoType,
          Serial: head.Serial,
          InfoKind: head.InfoKind,
          InfoKindVersion: head.InfoKindVersion,
          Headline: head.Headline,
        },
        body: report.Body,
      },
    };
  } catch (error) {
    return null;
  }
}


/**
 * POST /api/admin/fetch-earthquakes-now
 * 動作確認用: DMData APIから直接地震情報を取得して表示（DB保存なし）
 */
export async function POST(request: NextRequest) {
  const DMDATA_API_KEY = await getDmdataApiKey();

  if (!DMDATA_API_KEY) {
    return NextResponse.json(
      { error: "DMDATA_API_KEY が設定されていません（データベースまたは環境変数に登録してください）" },
      { status: 500 }
    );
  }

  try {

    // VXSE51（震度速報）とVXSE53（震源・震度に関する情報）を並行取得
    const [vxse51Response, vxse53Response] = await Promise.all([
      axios.get(`${DMDATA_API_BASE_URL}/v2/telegram`, {
        params: {
          type: "VXSE51",
          limit: 10,
          key: DMDATA_API_KEY,
        },
        timeout: 30000,
      }),
      axios.get(`${DMDATA_API_BASE_URL}/v2/telegram`, {
        params: {
          type: "VXSE53",
          limit: 10,
          key: DMDATA_API_KEY,
        },
        timeout: 30000,
      }),
    ]);

    const vxse51Events = vxse51Response.data.items || [];
    const vxse53Events = vxse53Response.data.items || [];


    // eventIdでVXSE51とVXSE53をマッピング
    const vxse53Map = new Map<string, any>();
    for (const vxse53 of vxse53Events) {
      // VXSE53からeventIdを取得（詳細XMLを取得しないとeventIdが分からないため、まずメタデータのみ保存）
      vxse53Map.set(vxse53.id, vxse53);
    }


    const earthquakes: EarthquakeInfo[] = [];
    const processedEventIds = new Set<string>();

    // まずVXSE51（震度速報）を処理
    for (let i = 0; i < Math.min(10, vxse51Events.length); i++) {
      const meta = vxse51Events[i];
      if (!meta.url) {
        continue;
      }

      try {
        const detailResponse = await axios.get(meta.url, {
          params: {
            key: DMDATA_API_KEY,
          },
          timeout: 10000,
          responseType: 'text',  // XMLはテキストとして取得
        });

        const xmlString = detailResponse.data;

        // XMLをパースしてTelegramItem形式に変換
        const telegramItem = await parseXmlToTelegramItem(xmlString, meta);

        if (!telegramItem) {
          continue;
        }

        // TelegramItemから地震情報を抽出
        const info = extractEarthquakeInfo(telegramItem);

        if (info && info.maxIntensity) {
          // 震度3以上のみ処理
          const intensityNum = parseInt(info.maxIntensity.replace(/[^0-9]/g, ''));
          if (intensityNum >= 3) {

            // 対応するVXSE53を探す
            const matchingVxse53 = vxse53Events.find(v53 => {
              // eventIdは通常YYYYMMDDHHMMSS形式
              // VXSE51のeventIdと時刻が近いVXSE53を探す
              const timeDiff = Math.abs(
                new Date(v53.head.time).getTime() - new Date(meta.head.time).getTime()
              );
              // 5分以内のVXSE53を同じ地震と判定
              return timeDiff < 5 * 60 * 1000;
            });

            if (matchingVxse53) {
              try {
                // VXSE53の詳細を取得
                const vxse53Response = await axios.get(matchingVxse53.url, {
                  params: { key: DMDATA_API_KEY },
                  timeout: 10000,
                  responseType: 'text',
                });
                const vxse53Item = await parseXmlToTelegramItem(vxse53Response.data, matchingVxse53);
                if (vxse53Item) {
                  const vxse53Info = extractEarthquakeInfo(vxse53Item);
                  if (vxse53Info) {
                    // VXSE53の詳細情報をVXSE51にマージ
                    info.epicenter = vxse53Info.epicenter;
                    info.magnitude = vxse53Info.magnitude;
                    info.depth = vxse53Info.depth;
                    info.prefectureObservations = vxse53Info.prefectureObservations;
                  }
                }
              } catch (err: any) {
              }
            }

            processedEventIds.add(info.eventId);
            earthquakes.push(info);
          } else {
          }
        } else {
        }
      } catch (error: any) {
      }
    }


    // 発生時刻でソート（新しい順）
    earthquakes.sort((a, b) => {
      const timeA = a.occurrenceTime ? new Date(a.occurrenceTime).getTime() : 0;
      const timeB = b.occurrenceTime ? new Date(b.occurrenceTime).getTime() : 0;
      return timeB - timeA;
    });

    return NextResponse.json({
      success: true,
      vxse51: vxse51Events.length,
      vxse53: vxse53Events.length,
      earthquakes: earthquakes.map((eq) => ({
        eventId: eq.eventId,
        type: eq.type,
        title: eq.title,
        epicenter: eq.epicenter,
        magnitude: eq.magnitude,
        depth: eq.depth,
        maxIntensity: eq.maxIntensity,
        occurrenceTime: eq.occurrenceTime,
        arrivalTime: eq.arrivalTime,
        prefectureObservations: eq.prefectureObservations,
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "地震情報の取得に失敗しました",
        message: error.message,
      },
      { status: 500 }
    );
  }
}
