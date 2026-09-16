import "server-only";

/**
 * WhatsApp delivery layer (section 5). Two modes:
 *   • Cloud API (official) when WHATSAPP_CLOUD_TOKEN + WHATSAPP_PHONE_ID are set
 *     — sends a real message via Meta's Graph API.
 *   • wa.me link (MVP) otherwise — the caller opens a pre-filled chat.
 */

export function waLink(phone: string, message: string): string {
  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
}

export function cloudApiConfigured(): boolean {
  return !!(process.env.WHATSAPP_CLOUD_TOKEN && process.env.WHATSAPP_PHONE_ID);
}

export async function sendCloudMessage(
  phone: string,
  message: string
): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.WHATSAPP_CLOUD_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  if (!token || !phoneId) {
    return { ok: false, error: "Cloud API غير مضبوط" };
  }
  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${phoneId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: phone.replace(/\D/g, ""),
          type: "text",
          text: { body: message },
        }),
      }
    );
    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `HTTP ${res.status}: ${body.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "network error" };
  }
}
