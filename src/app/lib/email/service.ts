/**
 * メール送信サービス（お名前.com SMTP）
 */

import nodemailer from "nodemailer";

const FROM_EMAIL = process.env.SMTP_FROM_EMAIL || "noreply@anpikakunin.xyz";
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:8080";
const IS_DEV = process.env.NODE_ENV === "development";

// お名前.com SMTPトランスポーター
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "mail1042.onamae.ne.jp",
  port: parseInt(process.env.SMTP_PORT || "465"),
  secure: process.env.SMTP_PORT === "465", // 465ならtrue、587ならfalse
  auth: {
    user: process.env.SMTP_USER || "noreply@anpikakunin.xyz",
    pass: process.env.SMTP_PASSWORD || "",
  },
});

export interface SendInvitationEmailParams {
  toEmail: string;
  inviterName: string;
  invitationToken: string;
}

/**
 * 招待メールを送信
 */
export async function sendInvitationEmail({
  toEmail,
  inviterName,
  invitationToken,
}: SendInvitationEmailParams): Promise<void> {
  const invitationLink = `${BASE_URL}/accept-invitation?token=${invitationToken}`;

  // コンソールにも出力（開発環境用バックアップ）
  console.log("=== 📧 招待メール ===");
  console.log(`宛先: ${toEmail}`);
  console.log(`招待者: ${inviterName}`);
  console.log(`招待リンク: ${invitationLink}`);
  console.log("=====================\n");

  const result = await transporter.sendMail({
    from: FROM_EMAIL,
    to: toEmail,
    subject: "【安否確認システム】招待のご案内",
    text: `
${inviterName} さんから、安否確認システムへの招待が届いています。

以下のリンクから、アカウントを作成してください：
${invitationLink}

このリンクは7日間有効です。

---
安否確認システム
    `.trim(),
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #f8f9fa; padding: 20px; border-radius: 8px;">
    <h2 style="color: #333;">安否確認システムへの招待</h2>
    <p><strong>${inviterName}</strong> さんから、安否確認システムへの招待が届いています。</p>
    <p>以下のボタンをクリックして、アカウントを作成してください：</p>
    <div style="margin: 30px 0;">
      <a href="${invitationLink}"
         style="display: inline-block; background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">
        アカウントを作成
      </a>
    </div>
    <p style="color: #666; font-size: 14px;">このリンクは7日間有効です。</p>
    <p style="color: #666; font-size: 14px;">リンクをクリックできない場合は、以下のURLをブラウザにコピー＆ペーストしてください：<br>
    <code style="background: #e9ecef; padding: 4px 8px; border-radius: 4px;">${invitationLink}</code></p>
  </div>
  <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #dee2e6; color: #6c757d; font-size: 12px;">
    <p>安否確認システム</p>
  </div>
</body>
</html>
    `.trim(),
  });

  console.log("📬 SMTP送信結果:", {
    messageId: result.messageId,
    accepted: result.accepted,
    rejected: result.rejected,
    response: result.response,
  });
}

export interface SendOtpEmailParams {
  toEmail: string;
  otpCode: string;
}

/**
 * OTPメールを送信
 */
export async function sendOtpEmail({
  toEmail,
  otpCode,
}: SendOtpEmailParams): Promise<void> {
  // コンソールにも出力（開発環境用バックアップ）
  console.log("=== 🔐 OTPコード ===");
  console.log(`宛先: ${toEmail}`);
  console.log(`認証コード: ${otpCode}`);
  console.log(`有効期限: 5分`);
  console.log("====================\n");

  const result = await transporter.sendMail({
    from: FROM_EMAIL,
    to: toEmail,
    subject: "【安否確認システム】ログイン認証コード",
    text: `
ログイン認証コード:

${otpCode}

このコードは5分間有効です。
第三者に共有しないでください。

---
安否確認システム
    `.trim(),
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #f8f9fa; padding: 20px; border-radius: 8px;">
    <h2 style="color: #333;">ログイン認証コード</h2>
    <p>以下の認証コードを入力してログインを完了してください：</p>
    <div style="margin: 30px 0; text-align: center;">
      <div style="display: inline-block; background: #007bff; color: white; padding: 20px 40px; font-size: 32px; font-weight: bold; letter-spacing: 8px; border-radius: 8px;">
        ${otpCode}
      </div>
    </div>
    <p style="color: #dc3545; font-weight: bold;">このコードは5分間有効です。</p>
    <p style="color: #666; font-size: 14px;">このコードを第三者に共有しないでください。</p>
  </div>
  <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #dee2e6; color: #6c757d; font-size: 12px;">
    <p>安否確認システム</p>
  </div>
</body>
</html>
    `.trim(),
  });

  console.log("📬 OTP SMTP送信結果:", {
    messageId: result.messageId,
    accepted: result.accepted,
    rejected: result.rejected,
    response: result.response,
  });
}
