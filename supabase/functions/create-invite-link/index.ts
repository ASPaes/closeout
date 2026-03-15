import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const InputSchema = z.object({
  email: z.string().email().optional(),
  roleName: z.enum([
    "super_admin",
    "client_admin",
    "venue_manager",
    "event_manager",
    "event_organizer",
    "staff",
    "waiter",
    "cashier",
    "consumer",
  ]),
  clientId: z.string().uuid().optional(),
  venueId: z.string().uuid().optional(),
  eventId: z.string().uuid().optional(),
  expiresInMinutes: z.number().int().min(5).max(43200).default(1440),
});

function problem(status: number, title: string, detail: string, requestId: string) {
  return new Response(
    JSON.stringify({ type: "about:blank", title, status, detail, requestId }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/problem+json" } }
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const requestId = crypto.randomUUID().slice(0, 8);
  console.log(`[create-invite-link][${requestId}] start`);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return problem(401, "Unauthorized", "Missing auth header", requestId);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !user) return problem(401, "Unauthorized", "Invalid token", requestId);

    // Check super_admin
    const { data: roleCheck } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .limit(1);

    if (!roleCheck || roleCheck.length === 0) {
      return problem(403, "Forbidden", "Only super_admin can create invites", requestId);
    }

    const body = await req.json();
    const parsed = InputSchema.safeParse(body);
    if (!parsed.success) {
      return problem(422, "Validation Error", parsed.error.issues.map((i) => i.message).join("; "), requestId);
    }

    const input = parsed.data;

    // Generate secure token (32 bytes = 64 hex chars)
    const tokenBytes = new Uint8Array(32);
    crypto.getRandomValues(tokenBytes);
    const token = Array.from(tokenBytes).map((b) => b.toString(16).padStart(2, "0")).join("");

    // SHA-256 hash
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(token));
    const tokenHash = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");

    const expiresAt = new Date(Date.now() + input.expiresInMinutes * 60 * 1000).toISOString();

    const { data: invite, error: insertErr } = await supabaseAdmin
      .from("user_invites")
      .insert({
        created_by: user.id,
        email: input.email || null,
        role: input.roleName,
        client_id: input.clientId || null,
        venue_id: input.venueId || null,
        event_id: input.eventId || null,
        token_hash: tokenHash,
        expires_at: expiresAt,
      })
      .select("id")
      .single();

    if (insertErr) {
      console.error(`[create-invite-link][${requestId}] insert error`, insertErr);
      return problem(500, "Internal Error", "Failed to create invite", requestId);
    }

    // Audit log
    await supabaseAdmin.rpc("log_audit", {
      p_user_id: user.id,
      p_action: "user_invite_link_created",
      p_entity_type: "user_invite",
      p_entity_id: invite.id,
      p_metadata: { email: input.email || null, role: input.roleName },
      p_new_data: { role: input.roleName, client_id: input.clientId, venue_id: input.venueId, event_id: input.eventId },
    });

    // Build invite URL using Origin header or fallback
    const origin = req.headers.get("Origin") || req.headers.get("Referer")?.replace(/\/$/, "") || "https://closeout.lovable.app";
    const inviteUrl = `${origin}/invite?token=${token}`;

    console.log(`[create-invite-link][${requestId}] success`);

    return new Response(
      JSON.stringify({ data: { inviteUrl, expiresAt } }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error(`[create-invite-link][${requestId}] error`, err);
    return problem(500, "Internal Error", "Unexpected error", requestId);
  }
});
