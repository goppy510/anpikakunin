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
        ciphertext: Buffer.from(workspace.botTokenCiphertext).toString("base64"),
        iv: Buffer.from(workspace.botTokenIv).toString("base64"),
        authTag: Buffer.from(workspace.botTokenTag).toString("base64"),
      });

      // Slack APIからチャンネル一覧取得
      const slackResponse = await fetch("https://slack.com/api/conversations.list", {
        headers: {
          Authorization: `Bearer ${botToken}`,
        },
      });

      const slackData = await slackResponse.json();

      if (slackData.ok && slackData.channels) {
        // DBに保存（workspace.id = 内部UUIDを使用）
        await Promise.all(
          slackData.channels.map((ch: any) =>
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
