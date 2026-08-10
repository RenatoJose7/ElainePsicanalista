import { onRequestPost as createCheckout } from "../functions/api/checkout-pro.js";
import { onRequestPost as receiveMercadoPagoWebhook } from "../functions/api/mercado-pago/webhook.js";

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const context = { request, env };

    if (url.pathname === "/api/checkout-pro") {
      if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);
      return createCheckout(context);
    }

    if (url.pathname === "/api/mercado-pago/webhook") {
      if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
      return receiveMercadoPagoWebhook(context);
    }

    return env.ASSETS.fetch(request);
  }
};
