const catalog = {
  individual: { 30: 39.90, 45: 59.90, 60: 75.90 },
  casal: { 60: 75.90 }
};
const discountFor = (sessions) => ({ 1: 0, 2: 0.04, 3: 0.07, 4: 0.10 }[sessions] ?? null);
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

function validOrder(input) {
  const type = input.type === "casal" ? "casal" : "individual";
  const duration = Number(input.duration), sessions = Number(input.sessions);
  const unitPrice = catalog[type]?.[duration], discount = discountFor(sessions);
  if (!unitPrice || discount === null) throw new Error("Serviço ou pacote inválido.");
  if (!input.customer || typeof input.customer.name !== "string" || input.customer.name.trim().length < 3) throw new Error("Informe seu nome completo.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.customer.email || "")) throw new Error("Informe um e-mail válido.");
  if (!Array.isArray(input.schedules) || input.schedules.length !== sessions) throw new Error("Escolha todos os horários do pacote.");
  return { type, duration, sessions, unitPrice, total: Math.round(unitPrice * sessions * (1 - discount) * 100) / 100, customer: input.customer, schedules: input.schedules };
}

export async function onRequestPost(context) {
  try {
    const order = validOrder(await context.request.json());
    const orderId = crypto.randomUUID();
    const reference = `agendamento_${orderId}`;
    const now = new Date().toISOString();
    await context.env.ORDERS.prepare(`INSERT INTO orders (id, payment_reference, status, customer_name, customer_email, customer_phone, service_type, duration_minutes, sessions, total_cents, schedules_json, created_at) VALUES (?, ?, 'created', ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(orderId, reference, order.customer.name.trim(), order.customer.email.trim(), String(order.customer.phone || ""), order.type, order.duration, order.sessions, Math.round(order.total * 100), JSON.stringify(order.schedules), now).run();

    const origin = new URL(context.request.url).origin;
    const title = order.type === "casal" ? "Terapia de casal" : "Terapia individual";
    const preference = {
      items: [{ id: `${order.type}-${order.duration}-${order.sessions}`, title: `${title} — ${order.sessions} sessão(ões) de ${order.duration} min`, quantity: 1, currency_id: "BRL", unit_price: order.total }],
      payer: { name: order.customer.name.trim(), email: order.customer.email.trim(), phone: { number: String(order.customer.phone || "").replace(/\D/g, "") } },
      external_reference: reference,
      back_urls: { success: `${origin}/agendamento.html?status=approved`, pending: `${origin}/agendamento.html?status=pending`, failure: `${origin}/agendamento.html?status=failure` },
      auto_return: "approved",
      notification_url: `${origin}/api/mercado-pago/webhook`
    };
    const response = await fetch("https://api.mercadopago.com/checkout/preferences", { method: "POST", headers: { Authorization: `Bearer ${context.env.MERCADO_PAGO_ACCESS_TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify(preference) });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message || "Não foi possível iniciar o pagamento.");
    await context.env.ORDERS.prepare("UPDATE orders SET preference_id = ? WHERE id = ?").bind(payload.id, orderId).run();
    const checkoutUrl = context.env.MERCADO_PAGO_ENVIRONMENT === "production" ? payload.init_point : payload.sandbox_init_point;
    return json({ checkoutUrl });
  } catch (error) {
    return json({ error: error.message || "Não foi possível iniciar o pagamento." }, 400);
  }
}
