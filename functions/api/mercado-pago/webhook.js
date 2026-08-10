const encoder = new TextEncoder();
const text = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));

async function validSignature(request, dataId, secret) {
  const signature = request.headers.get("x-signature") || "";
  const requestId = request.headers.get("x-request-id") || "";
  const parts = Object.fromEntries(signature.split(",").map((item) => item.trim().split("=")));
  if (!parts.ts || !parts.v1 || !requestId || !dataId || !secret) return false;
  const manifest = `id:${dataId};request-id:${requestId};ts:${parts.ts};`;
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signatureBytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(manifest)));
  const calculated = Array.from(signatureBytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return calculated.length === parts.v1.length && crypto.subtle.timingSafeEqual ? crypto.subtle.timingSafeEqual(encoder.encode(calculated), encoder.encode(parts.v1)) : calculated === parts.v1;
}

async function sendEmail(env, to, subject, html, key) {
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": key }, body: JSON.stringify({ from: env.EMAIL_FROM, to: [to], subject, html }) });
  if (!response.ok) throw new Error("Não foi possível enviar o e-mail de confirmação.");
}

export async function onRequestPost(context) {
  const body = await context.request.json().catch(() => ({}));
  const paymentId = new URL(context.request.url).searchParams.get("data.id") || body.data?.id;
  if (!await validSignature(context.request, paymentId, context.env.MERCADO_PAGO_WEBHOOK_SECRET)) return new Response("Unauthorized", { status: 401 });
  if (body.type && body.type !== "payment") return new Response("OK");

  const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, { headers: { Authorization: `Bearer ${context.env.MERCADO_PAGO_ACCESS_TOKEN}` } });
  const payment = await paymentResponse.json();
  if (!paymentResponse.ok || payment.status !== "approved" || !payment.external_reference) return new Response("OK");
  const order = await context.env.ORDERS.prepare("SELECT * FROM orders WHERE payment_reference = ?").bind(payment.external_reference).first();
  if (!order) return new Response("OK");
  await context.env.ORDERS.prepare("UPDATE orders SET status = ? WHERE id = ?").bind(payment.status, order.id).run();
  if (order.email_sent_at) return new Response("OK");

  const schedules = JSON.parse(order.schedules_json).map((slot, index) => `<li>Sessão ${index + 1}: ${text(slot.texto)}</li>`).join("");
  const service = order.service_type === "casal" ? "Terapia de casal" : "Terapia individual";
  const total = (order.total_cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  await Promise.all([
    sendEmail(context.env, order.customer_email, "Pagamento confirmado | Elainne Andrade", `<h1>Pagamento confirmado</h1><p>Olá, ${text(order.customer_name)}.</p><p>Seu pagamento para <strong>${service}</strong> foi aprovado.</p><ul>${schedules}</ul><p>Total: <strong>${total}</strong></p>`, `order-${order.id}-patient`),
    sendEmail(context.env, context.env.EMAIL_OWNER_TO, "Novo agendamento confirmado", `<h1>Novo agendamento confirmado</h1><p><strong>Paciente:</strong> ${text(order.customer_name)} (${text(order.customer_email)})</p><p><strong>Serviço:</strong> ${service} — ${order.duration_minutes} min</p><ul>${schedules}</ul><p><strong>Total:</strong> ${total}</p>`, `order-${order.id}-owner`)
  ]);
  await context.env.ORDERS.prepare("UPDATE orders SET email_sent_at = ? WHERE id = ?").bind(new Date().toISOString(), order.id).run();
  return new Response("OK");
}
