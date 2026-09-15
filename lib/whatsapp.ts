/**
 * Sends the pre-approved WhatsApp template (image header + parent/child name
 * body params) via Meta's official WhatsApp Cloud API. Requires the template
 * to already be approved in WhatsApp Manager.
 */
export async function sendChildQrToWhatsApp(input: {
  phone: string;
  parentName: string;
  childName: string;
  qrImageUrl: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME;
  const templateLang = process.env.WHATSAPP_TEMPLATE_LANG || "en_US";

  if (!token || !phoneNumberId || !templateName) {
    return {
      ok: false,
      error:
        "WhatsApp is not configured (WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_TEMPLATE_NAME).",
    };
  }

  const to = input.phone.replace(/[^\d]/g, "");
  if (!to) return { ok: false, error: "This child has no parent phone number on file." };

  const body = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: templateName,
      language: { code: templateLang },
      components: [
        {
          type: "header",
          parameters: [{ type: "image", image: { link: input.qrImageUrl } }],
        },
        {
          type: "body",
          parameters: [
            { type: "text", text: input.parentName || "there" },
            { type: "text", text: input.childName || "your child" },
          ],
        },
      ],
    },
  };

  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data?.error?.message ?? "WhatsApp send failed." };
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "WhatsApp request failed." };
  }
}
