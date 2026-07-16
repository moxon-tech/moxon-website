declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

type NotificationSettings = {
  enabled?: boolean;
  sharedRecipients?: unknown;
  contactRecipients?: unknown;
  recruitmentRecipients?: unknown;
};

type MessagePayload = {
  id?: string;
  type?: string;
  title?: string;
  name?: string;
  phone?: string;
  email?: string;
  company?: string;
  service?: string;
  message?: string;
  attachment?: string;
  attachmentData?: string;
  createdAt?: string;
  rawFields?: Record<string, unknown>;
};

type ContactMessageRow = {
  id: string;
  type?: string;
  title?: string;
  name?: string;
  phone?: string;
  email?: string;
  company?: string;
  service?: string;
  message?: string;
  attachment?: string;
  attachment_data?: string;
  created_at?: string;
  notified_at?: string | null;
  raw_fields?: Record<string, unknown>;
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8"
    }
  });

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const textValue = (value: unknown) => String(value ?? "").trim();

const normalizeRecipients = (value: unknown): string[] => {
  const raw = Array.isArray(value) ? value : String(value || "").split(/[\n,;]+/);
  return Array.from(
    new Set(
      raw
        .map((item) => String(item || "").trim())
        .filter((item) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item))
    )
  );
};

const readKeyFromJsonEnv = (name: string) => {
  const json = Deno.env.get(name);
  if (!json) return "";
  try {
    const keys = JSON.parse(json);
    return keys?.default ? String(keys.default) : "";
  } catch (_error) {
    return "";
  }
};

const getSupabaseApiKey = () =>
  readKeyFromJsonEnv("SUPABASE_SECRET_KEYS") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const getSupabaseRestConfig = () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const apiKey = getSupabaseApiKey();
  if (!supabaseUrl || !apiKey) {
    throw new Error("Missing Supabase server credentials");
  }
  return { supabaseUrl, apiKey };
};

const supabaseHeaders = (apiKey: string, extra: Record<string, string> = {}) => ({
  apikey: apiKey,
  Authorization: `Bearer ${apiKey}`,
  Accept: "application/json",
  ...extra
});

const mapContactMessage = (row: ContactMessageRow): MessagePayload => ({
  id: row.id,
  type: row.type || "contact",
  title: row.title || "",
  name: row.name || "",
  phone: row.phone || "",
  email: row.email || "",
  company: row.company || "",
  service: row.service || "",
  message: row.message || "",
  attachment: row.attachment || "",
  attachmentData: row.attachment_data || "",
  createdAt: row.created_at || "",
  rawFields: row.raw_fields || {}
});

const getContactMessage = async (messageId: string): Promise<ContactMessageRow | null> => {
  const { supabaseUrl, apiKey } = getSupabaseRestConfig();
  const response = await fetch(
    `${supabaseUrl}/rest/v1/contact_messages?id=eq.${encodeURIComponent(messageId)}&select=*&limit=1`,
    { headers: supabaseHeaders(apiKey) }
  );
  if (!response.ok) throw new Error(`Cannot load contact message: ${response.status}`);
  const rows = await response.json();
  return rows?.[0] || null;
};

const setNotificationClaim = async (messageId: string, notifiedAt: string | null) => {
  const { supabaseUrl, apiKey } = getSupabaseRestConfig();
  const notifiedFilter = notifiedAt ? "&notified_at=is.null" : "";
  const response = await fetch(
    `${supabaseUrl}/rest/v1/contact_messages?id=eq.${encodeURIComponent(messageId)}${notifiedFilter}`,
    {
      method: "PATCH",
      headers: supabaseHeaders(apiKey, {
        "Content-Type": "application/json",
        Prefer: "return=representation"
      }),
      body: JSON.stringify({ notified_at: notifiedAt })
    }
  );
  if (!response.ok) throw new Error(`Cannot update notification state: ${response.status}`);
  const rows = await response.json();
  return Array.isArray(rows) && rows.length > 0;
};

const getNotificationSettings = async (): Promise<NotificationSettings> => {
  const { supabaseUrl, apiKey } = getSupabaseRestConfig();

  const response = await fetch(
    `${supabaseUrl}/rest/v1/cms_sections?section_key=eq.notificationSettings&select=section_value&limit=1`,
    {
      headers: supabaseHeaders(apiKey)
    }
  );

  if (!response.ok) {
    throw new Error(`Cannot load notification settings: ${response.status}`);
  }

  const rows = await response.json();
  return rows?.[0]?.section_value || {};
};

const getRecipientsForType = (settings: NotificationSettings, type: string) => {
  if (settings.enabled === false) return [];

  const sharedRecipients = normalizeRecipients(settings.sharedRecipients);
  const typedRecipients =
    type === "application"
      ? normalizeRecipients(settings.recruitmentRecipients)
      : normalizeRecipients(settings.contactRecipients);

  return Array.from(new Set([...sharedRecipients, ...typedRecipients]));
};

const buildRows = (message: MessagePayload) => {
  const rows = [
    ["Họ tên", message.name],
    ["Số điện thoại", message.phone],
    ["Email", message.email],
    ["Công ty", message.company],
    [message.type === "application" ? "Vị trí ứng tuyển" : "Dịch vụ quan tâm", message.service],
    [message.type === "application" ? "Giới thiệu" : "Nội dung", message.message],
    ["Tệp đính kèm", message.attachment],
    ["Mã yêu cầu", message.id],
    ["Thời gian", message.createdAt]
  ];

  return rows
    .filter(([, value]) => textValue(value))
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#475569;font-weight:700;width:170px;">${escapeHtml(label)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#0f172a;">${escapeHtml(value)}</td>
        </tr>
      `
    )
    .join("");
};

const buildText = (message: MessagePayload, adminUrl: string) => {
  const label = message.type === "application" ? "Ứng tuyển mới" : "Liên hệ mới";
  return [
    `${label} từ website MOXON`,
    "",
    `Họ tên: ${textValue(message.name) || "-"}`,
    `Số điện thoại: ${textValue(message.phone) || "-"}`,
    `Email: ${textValue(message.email) || "-"}`,
    `Công ty: ${textValue(message.company) || "-"}`,
    `${message.type === "application" ? "Vị trí ứng tuyển" : "Dịch vụ quan tâm"}: ${textValue(message.service) || "-"}`,
    `${message.type === "application" ? "Giới thiệu" : "Nội dung"}: ${textValue(message.message) || "-"}`,
    `Tệp đính kèm: ${textValue(message.attachment) || "-"}`,
    `Mã yêu cầu: ${textValue(message.id) || "-"}`,
    "",
    `Xem trong admin: ${adminUrl}`
  ].join("\n");
};

const buildHtml = (message: MessagePayload, adminUrl: string) => {
  const isApplication = message.type === "application";
  const title = isApplication ? "Ứng tuyển mới từ website MOXON" : "Liên hệ mới từ website MOXON";
  return `
    <div style="font-family:Arial,sans-serif;background:#f8fafc;padding:24px;color:#0f172a;">
      <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
        <div style="padding:20px 24px;background:#0f172a;color:#ffffff;">
          <p style="margin:0 0 6px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#93c5fd;">MOXON Tech</p>
          <h1 style="margin:0;font-size:22px;line-height:1.35;">${escapeHtml(title)}</h1>
        </div>
        <div style="padding:20px 24px;">
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            ${buildRows(message)}
          </table>
          <p style="margin:20px 0 0;">
            <a href="${escapeHtml(adminUrl)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:10px 14px;border-radius:8px;font-weight:700;">Mở trang admin</a>
          </p>
        </div>
      </div>
    </div>
  `;
};

export default {
  async fetch(request: Request) {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const from = Deno.env.get("EMAIL_FROM") || "MOXON Tech <no-reply@mail.moxontech.vn>";
    const siteUrl = (Deno.env.get("SITE_URL") || "https://moxontech.vn").replace(/\/+$/, "");
    const adminUrl = `${siteUrl}/admin/dashboard.html`;

    if (!resendApiKey) {
      return jsonResponse({ error: "Missing RESEND_API_KEY" }, 500);
    }

    const payload = await request.json();
    const messageId = textValue(payload?.messageId);
    if (!/^(contact|application)-\d{10,20}$/.test(messageId)) {
      return jsonResponse({ error: "Invalid messageId" }, 400);
    }

    const messageRow = await getContactMessage(messageId);
    if (!messageRow) {
      return jsonResponse({ error: "Message not found" }, 404);
    }
    if (messageRow.notified_at) {
      return jsonResponse({ ok: true, skipped: true, reason: "Already notified" });
    }

    const message = mapContactMessage(messageRow);
    const type = message.type === "application" ? "application" : "contact";
    const settings = await getNotificationSettings();
    const recipients = getRecipientsForType(settings, type);

    if (!recipients.length) {
      return jsonResponse({ ok: true, skipped: true, reason: "No recipients configured" });
    }

    const claimedAt = new Date().toISOString();
    const claimed = await setNotificationClaim(messageId, claimedAt);
    if (!claimed) {
      return jsonResponse({ ok: true, skipped: true, reason: "Already notified" });
    }

    const subject =
      type === "application"
        ? `MOXON - Ứng tuyển mới${message.name ? ` từ ${message.name}` : ""}`
        : `MOXON - Liên hệ mới${message.name ? ` từ ${message.name}` : ""}`;

    let response: Response;
    try {
      response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from,
          to: recipients,
          subject,
          html: buildHtml({ ...message, type }, adminUrl),
          text: buildText({ ...message, type }, adminUrl),
          reply_to: message.email || undefined
        })
      });
    } catch (error) {
      await setNotificationClaim(messageId, null).catch(() => undefined);
      throw error;
    }

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("Resend error", response.status, result);
      await setNotificationClaim(messageId, null).catch(() => undefined);
      return jsonResponse({ error: "Cannot send email" }, 502);
    }

    return jsonResponse({ ok: true, id: result?.id || null, recipients: recipients.length });
  } catch (error) {
    console.error("notify-form-submission error", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
  }
};
