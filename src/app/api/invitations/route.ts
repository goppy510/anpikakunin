import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/app/lib/auth/middleware";
import { prisma } from "@/app/lib/db/prisma";
import { sendInvitationEmail } from "@/app/lib/email/service";
import { UserRole } from "@prisma/client";
import crypto from "crypto";

/**
 * GET /api/invitations
 * 招待一覧取得
 *
 * GET /api/invitations?id=xxx
 * 招待キャンセル（DELETEメソッド）
 */
export async function GET(request: NextRequest) {
  const authCheck = await requirePermission(request, ["member:read"]);
  if (authCheck instanceof NextResponse) return authCheck;

  try {
    const invitations = await prisma.userInvitation.findMany({
      include: {
        inviter: {
          select: {
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      invitations: invitations.map((inv) => ({
        id: inv.id,
        email: inv.email,
        role: inv.role,
        token: inv.token,
        inviterEmail: inv.inviter.email,
        expiresAt: inv.expiresAt.toISOString(),
        acceptedAt: inv.acceptedAt?.toISOString() || null,
        createdAt: inv.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    // Silenced
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/invitations
 * メンバー招待
 */
export async function POST(request: NextRequest) {
  const authCheck = await requirePermission(request, ["member:invite"]);
  if (authCheck instanceof NextResponse) return authCheck;

  const inviterId = authCheck.user.id;

  try {
    const body = (await request.json()) as {
      email: string;
      role?: UserRole;
      workspaceRef: string; // ワークスペースIDは必須
      groupId: string; // グループIDは必須
    };

    // バリデーション
    if (!body.email || !body.email.includes("@")) {
      return NextResponse.json(
        { error: "有効なメールアドレスを入力してください" },
        { status: 400 }
      );
    }

    if (!body.workspaceRef) {
      return NextResponse.json(
        { error: "ワークスペースを選択してください" },
        { status: 400 }
      );
    }

    if (!body.groupId) {
      return NextResponse.json(
        { error: "グループを選択してください" },
        { status: 400 }
      );
    }

    // グループ情報を取得してisSystemを確認
    const group = await prisma.group.findUnique({
      where: { id: body.groupId },
      select: { id: true, isSystem: true },
    });

    if (!group) {
      return NextResponse.json(
        { error: "指定されたグループが見つかりません" },
        { status: 404 }
      );
    }

    // 権限チェック: システムグループへの招待はADMINのみ
    if (group.isSystem && authCheck.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "管理者グループへの招待は管理者のみ実行できます" },
        { status: 403 }
      );
    }

    // 既存ユーザーチェック
    const existingUser = await prisma.user.findUnique({
      where: { email: body.email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "このメールアドレスは既に登録されています" },
        { status: 409 }
      );
    }

    // 未承認招待チェック
    const existingInvitation = await prisma.userInvitation.findFirst({
      where: {
        email: body.email,
        acceptedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    if (existingInvitation) {
      return NextResponse.json(
        { error: "このメールアドレスには既に招待が送信されています" },
        { status: 409 }
      );
    }

    // 招待トークン生成（セキュアなランダム文字列）
    const token = crypto.randomBytes(32).toString("hex");

    // 有効期限: 7日後
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // 招待レコード作成
    const invitation = await prisma.userInvitation.create({
      data: {
        email: body.email,
        invitedBy: inviterId,
        workspaceRef: body.workspaceRef, // UIから受け取ったワークスペースIDを保存
        groupId: body.groupId, // グループIDを保存
        token,
        role: body.role || UserRole.EDITOR,
        expiresAt,
      },
      include: {
        inviter: {
          select: {
            email: true,
          },
        },
        group: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // 招待メール送信
    try {
      await sendInvitationEmail({
        toEmail: invitation.email,
        inviterName: invitation.inviter.email,
        invitationToken: invitation.token,
      });
    } catch (emailError) {
      // Silenced
      // メール送信失敗してもエラーにしない（招待レコードは作成済み）
    }

    // BASE_URLを取得（本番: https://anpikakunin.xyz、開発: http://localhost:8080）
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:8080";

    return NextResponse.json(
      {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        token: invitation.token,
        inviterEmail: invitation.inviter.email,
        expiresAt: invitation.expiresAt.toISOString(),
        createdAt: invitation.createdAt.toISOString(),
        invitationUrl: `${baseUrl}/accept-invitation?token=${invitation.token}`,
      },
      { status: 201 }
    );
  } catch (error) {
    // Silenced
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/invitations?id=xxx
 * 招待キャンセル
 */
export async function DELETE(request: NextRequest) {
  const authCheck = await requirePermission(request, ["member:invite"]);
  if (authCheck instanceof NextResponse) return authCheck;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "IDが指定されていません" },
        { status: 400 }
      );
    }

    await prisma.userInvitation.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    // Silenced

    if (error.code === "P2025") {
      return NextResponse.json(
        { error: "招待が見つかりません" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
