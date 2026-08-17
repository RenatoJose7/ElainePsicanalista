const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
});

export async function onRequestGet(context) {
  try {
    const now = new Date().toISOString();
    const result = await context.env.ORDERS.prepare(
      "SELECT slot_key FROM appointment_slots WHERE status = 'confirmed' OR (status = 'held' AND expires_at > ?)"
    ).bind(now).all();
    return json({ busySlots: result.results.map((row) => row.slot_key) });
  } catch {
    return json({ error: "Nao foi possivel consultar a agenda." }, 500);
  }
}
