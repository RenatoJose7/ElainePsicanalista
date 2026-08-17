const catalog = {
  individual: { 30: 39.90, 45: 59.90, 60: 75.90 },
  casal: { 60: 75.90 }
};
const HOLD_MINUTES = 15;
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
});

class BookingError extends Error {
  constructor(message, status = 400, code = "invalid_request") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const discountFor = (sessions) => ({ 1: 0, 2: 0.04, 3: 0.07, 4: 0.10 }[sessions] ?? null);
const pad = (value) => String(value).padStart(2, "0");
const timeText = (minutes) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
const slotKey = (dayId, minutes) => `${dayId}T${timeText(minutes)}`;

function weekday(dayId) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayId || "");
  if (!match) throw new BookingError("Data de atendimento invalida.");
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (Number.isNaN(date.getTime()) || date.getUTCFullYear() !== Number(match[1]) || date.getUTCMonth() !== Number(match[2]) - 1 || date.getUTCDate() !== Number(match[3])) throw new BookingError("Data de atendimento invalida.");
  return date.getUTCDay();
}

function slotTimestamp(dayId, minutes) {
  return new Date(`${dayId}T${timeText(minutes)}:00-03:00`).getTime();
}

function scheduleText(dayId, minutes) {
  const [year, month, day] = dayId.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekdayName = ["domingo", "segunda-feira", "terca-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sabado"][date.getUTCDay()];
  const monthName = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"][month - 1];
  return `${weekdayName}, ${day} de ${monthName}, ${timeText(minutes)}`;
}

function validateSchedules(inputSchedules, duration, sessions) {
  if (!Array.isArray(inputSchedules) || inputSchedules.length !== sessions) throw new BookingError("Escolha todos os horarios do pacote.");
  const now = Date.now();
  const usedSlots = new Set();
  let previousEnd = 0;

  return inputSchedules.map((input) => {
    const dayId = String(input?.dayId || "");
    const start = Number(input?.start);
    const day = weekday(dayId);
    const isSaturday = day === 6;
    const allowed = day >= 1 && day <= 5 ? { start: 19 * 60, end: 22 * 60 } : (isSaturday ? { start: 8 * 60, end: 12 * 60 } : null);
    if (!allowed || !Number.isInteger(start) || start % 15 !== 0 || start < allowed.start || start + duration > allowed.end) throw new BookingError("Horario de atendimento invalido.");

    const startAt = slotTimestamp(dayId, start);
    const endAt = slotTimestamp(dayId, start + duration);
    if (startAt <= now + 5 * 60 * 1000) throw new BookingError("Escolha um horario futuro.");
    if (previousEnd && startAt < previousEnd) throw new BookingError("As sessoes precisam estar em ordem cronologica.");
    previousEnd = endAt;

    const slots = [];
    for (let minute = start; minute < start + duration; minute += 15) {
      const key = slotKey(dayId, minute);
      if (usedSlots.has(key)) throw new BookingError("Os horarios do pacote nao podem se sobrepor.");
      usedSlots.add(key);
      slots.push(key);
    }
    return { dayId, start, end: start + duration, texto: scheduleText(dayId, start), slots };
  });
}

function validOrder(input) {
  const type = input?.type;
  if (type !== "individual" && type !== "casal") throw new BookingError("Servico invalido.");
  const duration = Number(input.duration);
  const sessions = Number(input.sessions);
  const unitPrice = catalog[type]?.[duration];
  const discount = discountFor(sessions);
  if (!unitPrice || discount === null) throw new BookingError("Servico ou pacote invalido.");
  if (!input.customer || typeof input.customer.name !== "string" || input.customer.name.trim().length < 3 || input.customer.name.trim().length > 120) throw new BookingError("Informe seu nome completo.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.customer.email || "") || input.customer.email.length > 254) throw new BookingError("Informe um e-mail valido.");
  const schedules = validateSchedules(input.schedules, duration, sessions);
  return {
    type,
    duration,
    sessions,
    total: Math.round(unitPrice * sessions * (1 - discount) * 100) / 100,
    customer: { name: input.customer.name.trim(), email: input.customer.email.trim(), phone: String(input.customer.phone || "").replace(/\D/g, "").slice(0, 15) },
    schedules
  };
}

export async function cleanupExpiredHolds(env) {
  const now = new Date().toISOString();
  await env.ORDERS.batch([
    env.ORDERS.prepare("DELETE FROM appointment_slots WHERE status = 'held' AND expires_at <= ?").bind(now),
    env.ORDERS.prepare("UPDATE orders SET status = 'expired', updated_at = ? WHERE status = 'pending' AND hold_expires_at <= ?").bind(now, now)
  ]);
}

async function releaseOrderHold(env, orderId, status = "checkout_failed") {
  const now = new Date().toISOString();
  await env.ORDERS.batch([
    env.ORDERS.prepare("DELETE FROM appointment_slots WHERE order_id = ? AND status = 'held'").bind(orderId),
    env.ORDERS.prepare("UPDATE orders SET status = ?, updated_at = ? WHERE id = ? AND status = 'pending'").bind(status, now, orderId)
  ]);
}

function slotConflict(error) {
  return /unique|constraint|primary key/i.test(String(error?.message || error));
}

export async function onRequestPost(context) {
  let orderId;
  try {
    const order = validOrder(await context.request.json());
    await cleanupExpiredHolds(context.env);

    orderId = crypto.randomUUID();
    const reference = `agendamento_${orderId}`;
    const now = new Date();
    const createdAt = now.toISOString();
    const holdExpiresAt = new Date(now.getTime() + HOLD_MINUTES * 60 * 1000).toISOString();
    const statements = [
      context.env.ORDERS.prepare(`INSERT INTO orders (id, payment_reference, status, customer_name, customer_email, customer_phone, service_type, duration_minutes, sessions, total_cents, schedules_json, hold_expires_at, created_at, updated_at) VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(orderId, reference, order.customer.name, order.customer.email, order.customer.phone, order.type, order.duration, order.sessions, Math.round(order.total * 100), JSON.stringify(order.schedules.map(({ slots, ...schedule }) => schedule)), holdExpiresAt, createdAt, createdAt),
      ...order.schedules.flatMap((schedule) => schedule.slots.map((key) => context.env.ORDERS.prepare("INSERT INTO appointment_slots (slot_key, order_id, status, expires_at, created_at) VALUES (?, ?, 'held', ?, ?)").bind(key, orderId, holdExpiresAt, createdAt)))
    ];

    try {
      await context.env.ORDERS.batch(statements);
    } catch (error) {
      if (slotConflict(error)) throw new BookingError("Este horario acabou de ser reservado. Escolha outro para continuar.", 409, "slot_taken");
      throw error;
    }

    const origin = new URL(context.request.url).origin;
    const title = order.type === "casal" ? "Terapia de casal" : "Terapia individual";
    const preference = {
      items: [{ id: `${order.type}-${order.duration}-${order.sessions}`, title: `${title} - ${order.sessions} sessao(oes) de ${order.duration} min`, quantity: 1, currency_id: "BRL", unit_price: order.total }],
      payer: { name: order.customer.name, email: order.customer.email, phone: { number: order.customer.phone } },
      external_reference: reference,
      back_urls: { success: `${origin}/agendamento.html`, pending: `${origin}/agendamento.html`, failure: `${origin}/agendamento.html` },
      auto_return: "approved",
      notification_url: `${origin}/api/mercado-pago/webhook`
    };
    const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: { Authorization: `Bearer ${context.env.MERCADO_PAGO_ACCESS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(preference)
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message || "Nao foi possivel iniciar o pagamento.");

    await context.env.ORDERS.prepare("UPDATE orders SET preference_id = ?, updated_at = ? WHERE id = ?").bind(payload.id, new Date().toISOString(), orderId).run();
    const checkoutUrl = context.env.MERCADO_PAGO_ENVIRONMENT === "production" ? payload.init_point : payload.sandbox_init_point;
    return json({ checkoutUrl, holdExpiresAt });
  } catch (error) {
    if (orderId && !(error instanceof BookingError)) await releaseOrderHold(context.env, orderId);
    return json({ error: error.message || "Nao foi possivel iniciar o pagamento.", code: error.code || "checkout_error" }, error.status || 400);
  }
}
