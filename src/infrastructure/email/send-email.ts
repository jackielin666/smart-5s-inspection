/**
 * 寄信服務（Resend HTTP API）
 * 環境變數：
 * - RESEND_API_KEY：必要，未設定時跳過寄信（回 skipped）
 * - REPORT_EMAIL_TO：收件人，預設測試信箱
 * - REPORT_EMAIL_FROM：寄件人，預設 Resend 測試寄件位址（僅能寄給帳號本人信箱）
 */
export interface SendResult {
  ok: boolean;
  skipped?: boolean;
  error?: string;
}

export async function sendReportEmail(params: {
  subject: string;
  html: string;
  attachment?: { filename: string; content: Buffer };
}): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, skipped: true, error: 'RESEND_API_KEY 未設定，略過寄信' };

  const to = process.env.REPORT_EMAIL_TO ?? 'jackielin666@gmail.com';
  const from = process.env.REPORT_EMAIL_FROM ?? '5S巡檢系統 <onboarding@resend.dev>';

  const body: Record<string, unknown> = {
    from,
    to: [to],
    subject: params.subject,
    html: params.html,
  };
  if (params.attachment) {
    body.attachments = [
      { filename: params.attachment.filename, content: params.attachment.content.toString('base64') },
    ];
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, error: `HTTP ${res.status} ${text}`.slice(0, 300) };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'send failed' };
  }
}
