/**
 * 汎用メール送信ライブラリ
 */

import nodemailer from "nodemailer";

const FROM_EMAIL = process.env.SMTP_FROM_EMAIL || "noreply@anpikakunin.xyz";

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

export interface SendEmailParams {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

/**
 * 汎用メール送信関数
 */
export async function sendEmail({
  to,
  subject,
  text,
  html,
}: SendEmailParams): Promise<void> {
  // 開発環境ではコンソールにも出力
  if (process.env.NODE_ENV === "development") {
    console.log("=== 📧 メール送信 ===");
    console.log(`宛先: ${to}`);
    console.log(`件名: ${subject}`);
    console.log(`本文: ${text || html}`);
    console.log("===================\n");
  }

  await transporter.sendMail({
    from: FROM_EMAIL,
    to,
    subject,
    text,
    html,
  });
}
