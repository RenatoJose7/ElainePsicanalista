const encoder = new TextEncoder();
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character]));

function constantTimeEqual(first, second) {
  if (first.length !== second.length) return false;
  let difference = 0;
  for (let index = 0; index < first.length; index += 1) difference |= first.charCodeAt(index) ^ second.charCodeAt(index);
  return difference === 0;
}

async function validSignature(request, dataId, secret) {
  const signature = request.headers.get("x-signature") || "";
  const requestId = request.headers.get("x-request-id") || "";
  const parts = Object.fromEntries(signature.split(",").map((item) => item.trim().split("=", 2)));
  if (!parts.ts || !parts.v1 || !requestId || !dataId || !secret) return false;
  const manifest = `id:${dataId};request-id:${requestId};ts:${parts.ts};`;
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(manifest)));
  const calculated = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return constantTimeEqual(calculated, parts.v1);
}

function whatsappLink(env, customerName) {
  const number = String(env.WHATSAPP_NUMBER || "").replace(/\D/g, "");
  if (number.length < 10) return "";
  const text = encodeURIComponent(`Olá, Elainne! Sou ${customerName} e tenho uma dúvida sobre meu agendamento.`);
  return `https://wa.me/${number}?text=${text}`;
}

function emailTemplate({ title, intro, details, actionUrl, actionText }) {
  const action = actionUrl ? `<p style="margin:28px 0 8px"><a href="${actionUrl}" style="display:inline-block;border-radius:999px;background:#30201b;color:#ffffff;padding:14px 22px;font:700 14px Arial,sans-serif;text-decoration:none">${actionText}</a></p>` : "";
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f7f2ec;color:#2f2522;font-family:Arial,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="padding:32px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;background:#fffdf9;border:1px solid #e9ddd2;border-radius:18px;overflow:hidden"><tr><td style="background:#30201b;padding:26px 30px;color:#fff"><div style="font-size:12px;letter-spacing:1.8px;text-transform:uppercase;color:#e7c8b9">Elainne Andrade</div><h1 style="margin:8px 0 0;font:600 34px Georgia,serif;color:#fff">${title}</h1></td></tr><tr><td style="padding:30px"><p style="margin:0 0 20px;font-size:16px;line-height:1.6">${intro}</p><div style="padding:18px 20px;border-radius:12px;background:#f6eee7;font-size:14px;line-height:1.7">${details}</div>${action}<p style="margin:28px 0 0;color:#786d67;font-size:12px;line-height:1.5">Este e-mail foi enviado automaticamente após a confirmação do pagamento.</p></td></tr></table></td></tr></table></body></html>`;
}

async function sendEmail(env, to, subject, html, key) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": key },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: [to], subject, html })
  });
  if (!response.ok) throw new Error("Nao foi possivel enviar o e-mail de confirmacao.");
}

async function releaseFailedPayment(env, orderId) {
  const now = new Date().toISOString();
  await env.ORDERS.batch([
    env.ORDERS.prepare("DELETE FROM appointment_slots WHERE order_id = ? AND status = 'held'").bind(orderId),
    env.ORDERS.prepare("UPDATE orders SET status = 'cancelled', updated_at = ? WHERE id = ? AND status = 'pending'").bind(now, orderId)
  ]);
}

export async function onRequestPost(context) {
  const body = await context.request.json().catch(() => ({}));
  const paymentId = new URL(context.request.url).searchParams.get("data.id") || body.data?.id;
  if (!await validSignature(context.request, paymentId, context.env.MERCADO_PAGO_WEBHOOK_SECRET)) return new Response("Unauthorized", { status: 401 });
  if (body.type && body.type !== "payment") return new Response("OK");

  const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, { headers: { Authorization: `Bearer ${context.env.MERCADO_PAGO_ACCESS_TOKEN}` } });
  const payment = await paymentResponse.json();
  if (!paymentResponse.ok || !payment.external_reference) return new Response("OK");
  const order = await context.env.ORDERS.prepare("SELECT * FROM orders WHERE payment_reference = ?").bind(payment.external_reference).first();
  if (!order) return new Response("OK");

  if (["rejected", "cancelled", "refunded", "charged_back"].includes(payment.status)) {
    await releaseFailedPayment(context.env, order.id);
    return new Response("OK");
  }
  if (payment.status !== "approved") return new Response("OK");

  if (order.status !== "pending" && order.status !== "approved") {
    await context.env.ORDERS.prepare("UPDATE orders SET status = 'payment_review', paid_at = ?, updated_at = ? WHERE id = ?").bind(new Date().toISOString(), new Date().toISOString(), order.id).run();
    return new Response("OK");
  }

  const now = new Date().toISOString();
  await context.env.ORDERS.batch([
    context.env.ORDERS.prepare("UPDATE orders SET status = 'approved', paid_at = ?, updated_at = ? WHERE id = ?").bind(now, now, order.id),
    context.env.ORDERS.prepare("UPDATE appointment_slots SET status = 'confirmed', expires_at = NULL WHERE order_id = ?").bind(order.id)
  ]);
  if (order.email_sent_at) return new Response("OK");

  const schedules = JSON.parse(order.schedules_json).map((slot, index) => `<li>Sessão ${index + 1}: ${escapeHtml(slot.texto)}</li>`).join("");
  const service = order.service_type === "casal" ? "Terapia de casal" : "Terapia individual";
  const total = (order.total_cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const patientDetails = `<strong>Atendimento:</strong> ${service}<br><strong>Horários:</strong><ul style="margin:8px 0;padding-left:18px">${schedules}</ul><strong>Total:</strong> ${total}`;
  const ownerDetails = `<strong>Paciente:</strong> ${escapeHtml(order.customer_name)}<br><strong>E-mail:</strong> ${escapeHtml(order.customer_email)}<br><strong>Atendimento:</strong> ${service}<br><strong>Total:</strong> ${total}<ul style="margin:8px 0;padding-left:18px">${schedules}</ul>`;
  await Promise.all([
    sendEmail(context.env, order.customer_email, "Pagamento confirmado | Elainne Andrade", emailTemplate({ title: "Pagamento confirmado", intro: `Olá, ${escapeHtml(order.customer_name)}. Seu pagamento foi aprovado e seu horário está confirmado.`, details: patientDetails, actionUrl: whatsappLink(context.env, order.customer_name), actionText: "Falar no WhatsApp" }), `order-${order.id}-patient`),
    sendEmail(context.env, context.env.EMAIL_OWNER_TO, "Novo agendamento confirmado", emailTemplate({ title: "Novo agendamento", intro: "Um novo pagamento foi confirmado no site.", details: ownerDetails }), `order-${order.id}-owner`)
  ]);
  await context.env.ORDERS.prepare("UPDATE orders SET email_sent_at = ?, updated_at = ? WHERE id = ?").bind(new Date().toISOString(), new Date().toISOString(), order.id).run();
  return new Response("OK");
}
