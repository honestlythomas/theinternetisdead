import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://theinternetisdead.org",
  "https://www.theinternetisdead.org",
]);

function isAllowedOrigin(origin: string): boolean {
  return allowedOrigins.has(origin) || /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(origin);
}

function getCorsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": isAllowedOrigin(origin) ? origin : "https://theinternetisdead.org",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function jsonResponse(request: Request, status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...getCorsHeaders(request),
      "Content-Type": "application/json",
    },
  });
}

function timingSafeEqual(value: string, expected: string): boolean {
  const encoder = new TextEncoder();
  const valueBytes = encoder.encode(value);
  const expectedBytes = encoder.encode(expected);
  const maxLength = Math.max(valueBytes.length, expectedBytes.length);
  let diff = valueBytes.length === expectedBytes.length ? 0 : 1;

  for (let index = 0; index < maxLength; index += 1) {
    diff |= (valueBytes[index] || 0) ^ (expectedBytes[index] || 0);
  }

  return diff === 0;
}

function normalizeRoom(value: unknown): string {
  const room = typeof value === "string" && value.trim() ? value.trim() : "index";
  return /^[a-z0-9_-]{1,80}$/i.test(room) ? room : "index";
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", {
      headers: getCorsHeaders(request),
    });
  }

  if (request.method !== "POST") {
    return jsonResponse(request, 405, { ok: false, error: "method_not_allowed" });
  }

  let body: { password?: unknown; room?: unknown };
  try {
    body = await request.json();
  } catch (_error) {
    return jsonResponse(request, 400, { ok: false, error: "invalid_request" });
  }

  const expectedPassword = Deno.env.get("CHAT_ADMIN_PASSWORD") || "";
  const providedPassword = typeof body.password === "string" ? body.password : "";
  if (!expectedPassword || !timingSafeEqual(providedPassword, expectedPassword)) {
    return jsonResponse(request, 401, { ok: false, error: "unauthorized" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(request, 500, { ok: false, error: "server_not_configured" });
  }

  const room = normalizeRoom(body.room);
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  });

  const { error } = await supabase
    .schema("public")
    .from("site_chat_messages")
    .delete()
    .eq("room", room);

  if (error) {
    return jsonResponse(request, 500, { ok: false, error: "delete_failed" });
  }

  return jsonResponse(request, 200, { ok: true, room });
});
