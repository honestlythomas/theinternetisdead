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

function normalizeMaxMessages(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return 20;
  return Math.min(100, Math.max(1, Math.floor(parsed)));
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

  let body: { action?: unknown; maxMessages?: unknown; password?: unknown; room?: unknown };
  try {
    body = await request.json();
  } catch (_error) {
    return jsonResponse(request, 400, { ok: false, error: "invalid_request" });
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

  if (body.action === "prune") {
    const maxMessages = normalizeMaxMessages(body.maxMessages);
    const { data: staleRows, error: selectError } = await supabase
      .schema("public")
      .from("site_chat_messages")
      .select("id")
      .eq("room", room)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(maxMessages, 1000);

    if (selectError) {
      return jsonResponse(request, 500, { ok: false, error: "prune_select_failed" });
    }

    const staleIds = (staleRows || [])
      .map((row) => row && (typeof row.id === "string" || typeof row.id === "number") ? row.id : "")
      .filter((id) => id !== "");

    if (!staleIds.length) {
      return jsonResponse(request, 200, { ok: true, room, maxMessages, deleted: 0 });
    }

    const { error: pruneError } = await supabase
      .schema("public")
      .from("site_chat_messages")
      .delete()
      .in("id", staleIds);

    if (pruneError) {
      return jsonResponse(request, 500, { ok: false, error: "prune_delete_failed" });
    }

    return jsonResponse(request, 200, { ok: true, room, maxMessages, deleted: staleIds.length });
  }

  const expectedPassword = Deno.env.get("CHAT_ADMIN_PASSWORD") || "";
  const providedPassword = typeof body.password === "string" ? body.password : "";
  if (!expectedPassword || !timingSafeEqual(providedPassword, expectedPassword)) {
    return jsonResponse(request, 401, { ok: false, error: "unauthorized" });
  }

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
