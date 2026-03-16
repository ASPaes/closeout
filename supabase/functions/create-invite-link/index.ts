import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALL_ROLES = [
  "super_admin", "client_admin", "client_manager",
  "venue_manager", "event_manager", "event_organizer",
  "staff", "bar_staff", "waiter", "cashier", "consumer",
] as const;

const CLIENT_MANAGER_ALLOWED_ROLES = [
  "cashier", "bar_staff", "waiter", "staff",
  "venue_manager", "event_manager",
];

const InputSchema = z.object({
  email: z.string().email().optional(),
  roleName: z.enum(ALL_ROLES),
  clientId: z.string().uuid().optional(),
  venueId: z.string().uuid().optional(),
  eventId: z.string().uuid().optional(),
  expiresInMinutes: z.number().int().min(0).max(43200).default(1440),
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

    // Check caller roles
    const { data: callerRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role, client_id")
      .eq("user_id", user.id);

    const isSuperAdmin = callerRoles?.some((r: any) => r.role === "super_admin") ?? false;
    const clientManagerRole = callerRoles?.find((r: any) => r.role === "client_manager");
    const isClientManager = !!clientManagerRole;

    if (!isSuperAdmin && !isClientManager) {
      return problem(403, "Forbidden", "Only super_admin or client_manager can create invites", requestId);
    }

    const body = await req.json();
    const parsed = InputSchema.safeParse(body);
    if (!parsed.success) {
      return problem(422, "Validation Error", parsed.error.issues.map((i) => i.message).join("; "), requestId);
    }

    let input = parsed.data;

    // client_manager restrictions
    if (isClientManager && !isSuperAdmin) {
      // Force client_id to their own
      const managerClientId = clientManagerRole!.client_id;
      if (!managerClientId) {
        return problem(403, "Forbidden", "Client manager has no client scope", requestId);
      }
      input = { ...input, clientId: managerClientId };

      // Validate role is allowed
      if (!CLIENT_MANAGER_ALLOWED_ROLES.includes(input.roleName)) {
        return problem(403, "Forbidden", `Role "${input.roleName}" is not allowed for client_manager invites`, requestId);
      }
    }

    // Generate secure token (32 bytes = 64 hex chars)
    const tokenBytes = new Uint8Array(32);
    crypto.getRandomValues(tokenBytes);
    const token = Array.from(tokenBytes).map((b) => b.toString(16).padStart(2, "0")).join("");

    // SHA-256 hash
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(token));
    const tokenHash = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");

    const isLifetime = input.expiresInMinutes === 0;
    const expiresAt = isLifetime ? null : new Date(Date.now() + input.expiresInMinutes * 60 * 1000).toISOString();

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
      p_metadata: { email: input.email || null, role: input.roleName, client_id: input.clientId || null },
      p_new_data: { role: input.roleName, client_id: input.clientId, venue_id: input.venueId, event_id: input.eventId },
    });

    // Build invite URL
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
