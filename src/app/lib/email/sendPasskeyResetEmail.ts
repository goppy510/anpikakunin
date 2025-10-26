import nodemailer from "nodemailer";

interface SendPasskeyResetEmailParams {
  toEmail: string;
  token: string;
}

export async function sendPasskeyResetEmail({
  toEmail,
  token,
}: SendPasskeyResetEmailParams): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "465"),
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  const resetUrl = `${process.env.NEXT_PUBLIC_ORIGIN}/passkey-reset?token=${token}`;

  const mailOptions = {
    from: process.env.SMTP_FROM_EMAIL || "noreply@anpikakunin.xyz",
    to: toEmail,
    subject: "パスキー再登録のご案内 - 安否確認システム",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .container {
            background-color: #f9fafb;
            border-radius: 8px;
            padding: 30px;
            margin: 20px 0;
          }
          .button {
            display: inline-block;
            background-color: #2563eb;
            color: white;
            text-decoration: none;
            padding: 12px 24px;
            border-radius: 6px;
            margin: 20px 0;
          }
          .footer {
            color: #6b7280;
            font-size: 14px;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
          }
          .warning {
            background-color: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 12px;
            margin: 20px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>パスキー再登録のご案内</h2>
          <p>パスキーの再登録リクエストを受け付けました。</p>
          <p>以下のボタンをクリックして、新しいパスキーを登録してください。</p>

          <a href="${resetUrl}" class="button">パスキーを再登録する</a>

          <div class="warning">
            <strong>⚠️ 重要な注意事項</strong>
            <ul>
              <li>このリンクは<strong>24時間</strong>有効です</li>
              <li>再登録すると、既存のパスキーはすべて削除されます</li>
              <li>このメールに心当たりがない場合は、無視してください</li>
            </ul>
          </div>

          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            リンクが機能しない場合は、以下のURLをコピーしてブラウザに貼り付けてください：<br>
            <code style="background-color: #e5e7eb; padding: 4px 8px; border-radius: 4px; font-size: 12px; word-break: break-all;">
              ${resetUrl}
            </code>
          </p>
        </div>

        <div class="footer">
          <p>安否確認システム</p>
          <p>このメールは自動送信されています。返信しないでください。</p>
        </div>
      </body>
      </html>
    `,
    text: `
パスキー再登録のご案内

パスキーの再登録リクエストを受け付けました。
以下のリンクから新しいパスキーを登録してください。

${resetUrl}

重要な注意事項:
- このリンクは24時間有効です
- 再登録すると、既存のパスキーはすべて削除されます
- このメールに心当たりがない場合は、無視してください

---
安否確認システム
このメールは自動送信されています。返信しないでください。
    `,
  };

  await transporter.sendMail(mailOptions);
}
