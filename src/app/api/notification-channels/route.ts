import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";
import { decrypt } from "@/app/lib/security/encryption";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId");

    if (!workspaceId) {
      return NextResponse.json(
        { error: "workspaceId is required" },
        { status: 400 }
      );
    }

    // Slack Workspace IDから内部IDを取得
    const workspace = await prisma.slackWorkspace.findUnique({
      where: { workspaceId },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 }
      );
    }

    // notification_channelsテーブルから取得
    let channels = await prisma.notificationChannel.findMany({
      where: {
        workspaceRef: workspace.id, // 内部UUIDを使用
        isActive: true,
      },
      orderBy: {
        channelName: "asc",
      },
    });

    // フォールバック: テーブルが空の場合はSlack APIから取得して保存
    if (channels.length === 0) {
      const botToken = decrypt({
        ciphertext: workspace.botTokenCiphertext,
        iv: workspace.botTokenIv,
        authTag: workspace.botTokenTag,
      });

      // Slack APIから全チャンネルを取得（ページネーション対応）
      const allChannels: any[] = [];
      let cursor: string | undefined = undefined;

      do {
        const url = new URL("https://slack.com/api/conversations.list");
        url.searchParams.set("limit", "200"); // 1ページあたり最大200件
        url.searchParams.set("types", "public_channel"); // パブリックチャンネルのみ
        if (cursor) {
          url.searchParams.set("cursor", cursor);
        }

        const slackResponse = await fetch(url.toString(), {
          headers: {
            Authorization: `Bearer ${botToken}`,
          },
        });

        const slackData = await slackResponse.json();

        if (slackData.ok && slackData.channels) {
          allChannels.push(...slackData.channels);
          cursor = slackData.response_metadata?.next_cursor;
        } else {
          break;
        }
      } while (cursor);

      if (allChannels.length > 0) {
        // DBに保存（workspace.id = 内部UUIDを使用）
        await Promise.all(
          allChannels.map((ch: any) =>
            prisma.notificationChannel.upsert({
              where: {
                workspaceRef_channelId_purpose: {
                  workspaceRef: workspace.id, // 内部UUIDを使用
                  channelId: ch.id,
                  purpose: "general",
                },
              },
              create: {
                workspaceRef: workspace.id, // 内部UUIDを使用
                channelId: ch.id,
                channelName: ch.name,
                purpose: "general",
                isActive: true,
              },
              update: {
                channelName: ch.name,
                isActive: true,
              },
            })
          )
        );

        // 再取得
        channels = await prisma.notificationChannel.findMany({
          where: {
            workspaceRef: workspace.id, // 内部UUIDを使用
            isActive: true,
          },
          orderBy: {
            channelName: "asc",
          },
        });
      }
    }

    // フロントエンドが期待する形式に変換
    const formattedChannels = channels.map((ch) => ({
      id: ch.channelId,
      name: ch.channelName,
      isPrivate: false,
    }));

    return NextResponse.json({
      channels: formattedChannels,
    });
  } catch (error: any) {
    console.error("Error fetching notification channels:", error);
    return NextResponse.json(
      { error: "Failed to fetch channels", details: error.message },
      { status: 500 }
    );
  }
}
