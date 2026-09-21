import { cleanupExpiredHolds, onRequestPost as createCheckout } from "../functions/api/checkout-pro.js";
import { onRequestGet as getAvailability } from "../functions/api/availability.js";
import { onRequestPost as receiveMercadoPagoWebhook } from "../functions/api/mercado-pago/webhook.js";

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
});

const INTERNAL_PATHS = ["/functions/", "/src/", "/database/", "/.env", "/wrangler.jsonc", "/README.md", "/CLOUDFLARE_PAGES_SETUP.md"];

function secureAssetResponse(response) {
  const headers = new Headers(response.headers);
  headers.set("Content-Security-Policy", "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com data:; img-src 'self' data:; connect-src 'self' https://www.googletagmanager.com https://www.google-analytics.com https://region1.google-analytics.com; frame-src https://www.googletagmanager.com https://www.mercadopago.com;");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const context = { request, env };

    if (url.pathname === "/api/checkout-pro") {
      if (request.method !== "POST") return json({ error: "Metodo nao permitido." }, 405);
      return createCheckout(context);
    }

    if (url.pathname === "/api/availability") {
      if (request.method !== "GET") return json({ error: "Metodo nao permitido." }, 405);
      return getAvailability(context);
    }

    if (url.pathname === "/api/mercado-pago/webhook") {
      if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
      return receiveMercadoPagoWebhook(context);
    }

    if (INTERNAL_PATHS.some((path) => url.pathname === path || url.pathname.startsWith(path))) return new Response("Not Found", { status: 404 });
    return secureAssetResponse(await env.ASSETS.fetch(request));
  },

  async scheduled(controller, env, ctx) {
    ctx.waitUntil(cleanupExpiredHolds(env));
  }
};
