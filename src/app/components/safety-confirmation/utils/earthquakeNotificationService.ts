import type { EventItem } from "@/app/components/monitor/types/EventItem";
import type { SafetyConfirmationConfig, NotificationConditions, SlackWorkspace } from "../types/SafetyConfirmationTypes";
import { SafetySettingsDatabase } from "./settingsDatabase";

/**
 * 地震通知サービス
 * WebSocketからの地震情報をトリガーに安否確認Slack通知を送信
 */
export class EarthquakeNotificationService {
  private static instance: EarthquakeNotificationService | null = null;
  private config: SafetyConfirmationConfig | null = null;
  private lastNotifiedEventId: string | null = null;

  private constructor() {}

  public static getInstance(): EarthquakeNotificationService {
    if (!this.instance) {
      this.instance = new EarthquakeNotificationService();
    }
    return this.instance;
  }

  /**
   * 設定を読み込み
   */
  public async loadConfig(): Promise<void> {
    try {
      this.config = await SafetySettingsDatabase.loadSettings();
      console.log("地震通知サービス: 設定を読み込みました");
      
      if (this.config) {
        console.log("ワークスペース数:", this.config.slack?.workspaces?.length || 0);
        this.config.slack?.workspaces?.forEach((ws, index) => {
          console.log(`ワークスペース${index + 1}: ${ws.name}`);
          console.log(`  有効: ${ws.isEnabled}`);
          console.log(`  BotToken: ${ws.botToken ? 'あり' : 'なし'}`);
          console.log(`  通知条件: ${ws.conditions ? 'あり' : 'なし'}`);
          if (ws.conditions) {
            console.log(`  最小震度: ${ws.conditions.minIntensity}`);
            console.log(`  対象都道府県: ${ws.conditions.targetPrefectures.length}件`);
          }
        });
      } else {
        console.log("設定が見つかりませんでした");
      }
    } catch (error) {
      console.error("地震通知サービス: 設定の読み込みに失敗:", error);
    }
  }

  /**
   * 地震イベントを処理し、必要に応じて通知を送信
   */
  public async processEarthquakeEvent(event: EventItem): Promise<void> {
    try {
      console.log("=== 地震通知サービス: イベント処理開始 ===");
      console.log("Event:", JSON.stringify(event, null, 2));
      console.log("Event maxInt:", event.maxInt);
      console.log("Event isTest:", event.isTest);
      console.log("Event eventId:", event.eventId);

      // 設定が読み込まれていない場合は読み込む
      if (!this.config) {
        await this.loadConfig();
      }

      // 設定がない場合は処理しない
      if (!this.config || !this.config.slack?.workspaces?.length) {
        console.log("地震通知サービス: 設定が未登録のため処理をスキップ");
        console.log("Config exists:", !!this.config);
        console.log("Workspaces count:", this.config?.slack?.workspaces?.length || 0);
        return;
      }

      console.log("地震通知サービス: 設定確認完了");
      console.log("Workspaces count:", this.config.slack.workspaces.length);

      // テストデータは除外
      if (event.isTest) {
        console.log("地震通知サービス: テストデータのため処理をスキップ");
        return;
      }

      // 同じイベントIDで既に通知済みの場合はスキップ
      if (this.lastNotifiedEventId === event.eventId) {
        console.log("地震通知サービス: 既に通知済みのイベントのためスキップ");
        return;
      }

      // 各ワークスペースの設定を確認して通知判定
      for (const workspace of this.config.slack.workspaces) {
        console.log(`=== ワークスペース処理: ${workspace.name} ===`);
        console.log(`isEnabled: ${workspace.isEnabled}`);
        console.log(`botToken exists: ${!!workspace.botToken}`);
        console.log(`conditions exists: ${!!workspace.conditions}`);
        
        if (!workspace.isEnabled || !workspace.botToken) {
          console.log(`ワークスペース ${workspace.name}: 無効またはBotToken未設定のためスキップ`);
          continue;
        }

        const conditions = workspace.conditions;
        if (conditions) {
          console.log(`通知条件:`, conditions);
          console.log(`最小震度設定: ${conditions.minIntensity}`);
          console.log(`対象都道府県数: ${conditions.targetPrefectures.length}`);
          
          const shouldNotify = this.shouldNotify(event, conditions);
          console.log(`通知判定結果: ${shouldNotify}`);
          
          if (shouldNotify) {
            console.log(`ワークスペース ${workspace.name}: 通知条件に一致、Slack通知を送信`);
            await this.sendSlackNotification(event, workspace);
            this.lastNotifiedEventId = event.eventId;
          } else {
            console.log(`ワークスペース ${workspace.name}: 通知条件に一致しないためスキップ`);
          }
        } else {
          console.log(`ワークスペース ${workspace.name}: 通知条件が未設定のためスキップ`);
        }
      }

      console.log("=== 地震通知サービス: イベント処理完了 ===");
    } catch (error) {
      console.error("地震通知サービス: イベント処理中にエラー:", error);
    }
  }

  /**
   * 通知すべきかどうかを判定
   */
  private shouldNotify(event: EventItem, conditions: NotificationConditions): boolean {
    console.log("通知判定開始:", { event, conditions });

    // 震度チェック
    const eventIntensity = this.getIntensityValue(event.maxInt || "");
    const minIntensity = conditions.minIntensity;
    
    console.log(`震度チェック: イベント震度=${eventIntensity}, 最小震度=${minIntensity}`);
    
    // 震度が未確定（"-"や0）の場合でも、マグニチュードで判定
    if (eventIntensity === 0 && (event.maxInt === "-" || !event.maxInt)) {
      console.log("震度未確定のため、マグニチュードで判定");
      
      // マグニチュード4.5以上なら通知対象とする（震度3相当）
      const magnitude = event.magnitude?.value;
      if (magnitude && magnitude >= 4.5) {
        console.log(`マグニチュード ${magnitude} ≥ 4.5 のため通知対象`);
        // マグニチュードベースの判定を続行
      } else {
        console.log(`マグニチュード ${magnitude} < 4.5 のため通知しない`);
        return false;
      }
    } else if (eventIntensity < minIntensity) {
      console.log("震度が条件を満たさないため通知しない");
      return false;
    }

    // 都道府県チェック（震源地名から判定）
    if (conditions.targetPrefectures.length > 0 && event.hypocenter?.name) {
      const isTargetArea = this.isTargetPrefecture(event.hypocenter.name, conditions.targetPrefectures);
      console.log(`都道府県チェック: 震源地=${event.hypocenter.name}, 対象エリア=${isTargetArea}`);
      
      if (!isTargetArea) {
        console.log("対象都道府県ではないため通知しない");
        return false;
      }
    }

    // 通知タイプチェック（現在は全て通知するが、将来的に細分化可能）
    console.log(`通知タイプ: ${conditions.notificationType}`);

    console.log("全ての条件を満たすため通知する");
    return true;
  }

  /**
   * 震度文字列を数値に変換
   */
  private getIntensityValue(intensity: string): number {
    if (!intensity || intensity === "-" || intensity === "不明") {
      console.log("震度が不明または未設定のため、震度0として判定");
      return 0;
    }
    
    const normalizedIntensity = intensity.trim();
    console.log(`震度変換: "${normalizedIntensity}"`);
    
    if (normalizedIntensity === "5弱" || normalizedIntensity === "5-") return 5.0;
    if (normalizedIntensity === "5強" || normalizedIntensity === "5+") return 5.5;
    if (normalizedIntensity === "6弱" || normalizedIntensity === "6-") return 6.0;
    if (normalizedIntensity === "6強" || normalizedIntensity === "6+") return 6.5;
    
    const numericValue = parseFloat(normalizedIntensity);
    const result = isNaN(numericValue) ? 0 : numericValue;
    console.log(`震度変換結果: ${normalizedIntensity} → ${result}`);
    return result;
  }

  /**
   * 震源地名が対象都道府県に含まれるかチェック
   */
  private isTargetPrefecture(hypocenterName: string, targetPrefectures: string[]): boolean {
    // 都道府県コードから都道府県名へのマッピング
    const prefectureMap: { [key: string]: string[] } = {
      "01": ["北海道"],
      "02": ["青森", "青森県"],
      "03": ["岩手", "岩手県"],
      "04": ["宮城", "宮城県"],
      "05": ["秋田", "秋田県"],
      "06": ["山形", "山形県"],
      "07": ["福島", "福島県"],
      "08": ["茨城", "茨城県"],
      "09": ["栃木", "栃木県"],
      "10": ["群馬", "群馬県"],
      "11": ["埼玉", "埼玉県"],
      "12": ["千葉", "千葉県"],
      "13": ["東京", "東京都", "東京23区", "多摩", "伊豆", "小笠原"],
      "14": ["神奈川", "神奈川県"],
      "15": ["新潟", "新潟県"],
      "16": ["富山", "富山県"],
      "17": ["石川", "石川県"],
      "18": ["福井", "福井県"],
      "19": ["山梨", "山梨県"],
      "20": ["長野", "長野県"],
      "21": ["岐阜", "岐阜県"],
      "22": ["静岡", "静岡県"],
      "23": ["愛知", "愛知県"],
      "24": ["三重", "三重県"],
      "25": ["滋賀", "滋賀県"],
      "26": ["京都", "京都府"],
      "27": ["大阪", "大阪府"],
      "28": ["兵庫", "兵庫県"],
      "29": ["奈良", "奈良県"],
      "30": ["和歌山", "和歌山県"],
      "31": ["鳥取", "鳥取県"],
      "32": ["島根", "島根県"],
      "33": ["岡山", "岡山県"],
      "34": ["広島", "広島県"],
      "35": ["山口", "山口県"],
      "36": ["徳島", "徳島県"],
      "37": ["香川", "香川県"],
      "38": ["愛媛", "愛媛県"],
      "39": ["高知", "高知県"],
      "40": ["福岡", "福岡県"],
      "41": ["佐賀", "佐賀県"],
      "42": ["長崎", "長崎県"],
      "43": ["熊本", "熊本県"],
      "44": ["大分", "大分県"],
      "45": ["宮崎", "宮崎県"],
      "46": ["鹿児島", "鹿児島県", "トカラ列島", "奄美"],
      "47": ["沖縄", "沖縄県", "先島諸島", "宮古島", "石垣島"]
    };

    // 対象都道府県のキーワードリストを作成
    const targetKeywords: string[] = [];
    for (const prefCode of targetPrefectures) {
      const keywords = prefectureMap[prefCode];
      if (keywords) {
        targetKeywords.push(...keywords);
      }
    }

    // 震源地名に対象都道府県のキーワードが含まれるかチェック
    console.log(`都道府県チェック: 震源地="${hypocenterName}"`);
    console.log(`対象キーワード: ${targetKeywords.join(", ")}`);
    
    const isMatch = targetKeywords.some(keyword => 
      hypocenterName.includes(keyword)
    );
    
    console.log(`都道府県マッチ結果: ${isMatch}`);
    return isMatch;
  }

  /**
   * Slack通知を送信
   */
  private async sendSlackNotification(event: EventItem, workspace: SlackWorkspace): Promise<void> {
    try {
      console.log(`Slack通知送信開始: ワークスペース=${workspace.name}`);

      // 本番用チャンネルを取得
      const productionChannels = this.config!.slack.channels.filter(
        ch => ch.workspaceId === workspace.id && 
             ch.channelType === "production" && 
             ch.channelId && 
             ch.channelId.trim() !== ""
      );

      if (productionChannels.length === 0) {
        console.log("本番用チャンネルが設定されていないため通知をスキップ");
        return;
      }

      // 通知メッセージを作成
      const notificationData = this.buildNotificationMessage(event, workspace);

      // 各本番用チャンネルに送信
      for (const channel of productionChannels) {
        console.log(`チャンネル ${channel.channelName} (${channel.channelId}) に通知送信`);
        
        const response = await fetch("/api/slack/send-message", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            botToken: workspace.botToken,
            channelId: channel.channelId,
            title: notificationData.title,
            message: notificationData.message,
            isTraining: false,
            departments: workspace.departments || []
          }),
        });

        const result = await response.json();
        
        if (result.success) {
          console.log(`✅ Slack通知送信成功: チャンネル=${channel.channelName}`);
        } else {
          console.error(`❌ Slack通知送信失敗: チャンネル=${channel.channelName}, エラー=${result.error}`);
        }
      }

      console.log("Slack通知送信完了");
    } catch (error) {
      console.error("Slack通知送信中にエラー:", error);
    }
  }

  /**
   * 通知メッセージを構築
   */
  private buildNotificationMessage(event: EventItem, workspace: SlackWorkspace): { title: string; message: string } {
    const template = workspace.template;
    
    // 基本的な地震情報
    const intensityText = event.maxInt && event.maxInt !== "-" ? `最大震度${event.maxInt}` : "震度調査中";
    const hypocenterText = event.hypocenter?.name ? `震源地: ${event.hypocenter.name}` : "震源地: 調査中";
    const magnitudeText = event.magnitude?.value ? `マグニチュード: M${event.magnitude.value}` : "";
    const depthText = event.hypocenter?.depth?.value ? `震源の深さ: 約${event.hypocenter.depth.value}km` : "";
    const timeText = event.originTime ? `発生時刻: ${new Date(event.originTime).toLocaleString("ja-JP")}` : "";

    // 確定状態の表示
    const statusText = event.isConfirmed ? "【確定情報】" : "【速報】";
    
    // タイトル（震度速報風の表現）
    const title = template?.title || `🚨 ${statusText}地震発生 - ${intensityText}`;

    // 震度速報風のメッセージ構築
    let bulletinMessage = "";
    
    // 震度情報の詳細表示
    if (event.maxInt && event.maxInt !== "-") {
      bulletinMessage += `震度${event.maxInt}を観測しました。\n`;
    } else if (event.magnitude?.value) {
      // 震度不明でもマグニチュードがある場合
      bulletinMessage += `地震が発生しました（震度は調査中）。\n`;
    }
    
    // 震源情報
    if (event.hypocenter?.name) {
      bulletinMessage += `震源地は${event.hypocenter.name}`;
      if (event.magnitude?.value) {
        bulletinMessage += `、マグニチュードは${event.magnitude.value}`;
      }
      if (event.hypocenter?.depth?.value) {
        bulletinMessage += `、震源の深さは約${event.hypocenter.depth.value}km`;
      }
      bulletinMessage += "と推定されます。\n";
    }
    
    // 発生時刻
    if (event.originTime) {
      const occurTime = new Date(event.originTime);
      bulletinMessage += `発生時刻は${occurTime.toLocaleString("ja-JP", {
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit"
      })}頃です。\n`;
    }
    
    // 安否確認の依頼
    bulletinMessage += `\n【安否確認のため、下記対応をお願いします】\n`;
    bulletinMessage += `各リーダー・上長の方は、自組織のメンバーの押下確認お願いします。\n`;
    bulletinMessage += `・無事な方は所属の絵文字を押してください\n`;
    bulletinMessage += `・救助などが必要な方は:sos:を押してください\n`;
    bulletinMessage += `・連続で通知された場合は最後の通知の絵文字を押してください\n`;
    bulletinMessage += `落ち着いて行動してください`;

    // カスタムメッセージがある場合は使用、なければ震度速報風メッセージ
    let message = template?.message || bulletinMessage;
    
    // 地震詳細情報を追加（テンプレートで有効化されている場合）
    if (template?.includeEventDetails) {
      const eventDetails = [
        `📍 ${hypocenterText}`,
        `📊 ${intensityText}`,
        timeText,
        magnitudeText,
        depthText
      ].filter(Boolean).join("\n");
      
      message += `\n\n**【地震情報詳細】**\n${eventDetails}`;
      
      // 確定/速報の区別
      message += `\n📋 情報種別: ${event.isConfirmed ? "確定情報" : "速報（続報の可能性があります）"}`;
    }

    // メンション追加
    const conditions = workspace.conditions;
    if (conditions?.enableMentions && conditions?.mentionTargets?.length > 0) {
      const mentions = conditions.mentionTargets.join(" ");
      message = `${mentions}\n\n${message}`;
    }

    return { title, message };
  }
}