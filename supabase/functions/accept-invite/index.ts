import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const InputSchema = z.object({
  token: z.string().min(1),
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
  console.log(`[accept-invite][${requestId}] start`);

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

    const body = await req.json();
    const parsed = InputSchema.safeParse(body);
    if (!parsed.success) {
      return problem(422, "Validation Error", "Token inválido.", requestId);
    }

    // Hash the token
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(parsed.data.token));
    const tokenHash = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");

    // Find the invite
    const { data: invite, error: findErr } = await supabaseAdmin
      .from("user_invites")
      .select("*")
      .eq("token_hash", tokenHash)
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (findErr || !invite) {
      console.log(`[accept-invite][${requestId}] invite not found or expired`, findErr);
      // Determine specific error
      const { data: anyInvite } = await supabaseAdmin
        .from("user_invites")
        .select("used_at, expires_at")
        .eq("token_hash", tokenHash)
        .single();

      if (!anyInvite) {
        return problem(404, "Not Found", "INVITE_NOT_FOUND", requestId);
      }
      if (anyInvite.used_at) {
        return problem(410, "Gone", "INVITE_ALREADY_USED", requestId);
      }
      if (new Date(anyInvite.expires_at) <= new Date()) {
        return problem(410, "Gone", "INVITE_EXPIRED", requestId);
      }
      return problem(404, "Not Found", "INVITE_NOT_FOUND", requestId);
    }

    // Check if user already has this exact role+scope
    const roleQuery = supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", user.id)
      .eq("role", invite.role);

    if (invite.client_id) roleQuery.eq("client_id", invite.client_id);
    else roleQuery.is("client_id", null);
    if (invite.venue_id) roleQuery.eq("venue_id", invite.venue_id);
    else roleQuery.is("venue_id", null);
    if (invite.event_id) roleQuery.eq("event_id", invite.event_id);
    else roleQuery.is("event_id", null);

    const { data: existing } = await roleQuery.limit(1);

    if (!existing || existing.length === 0) {
      // Insert user_roles
      const { error: insertErr } = await supabaseAdmin
        .from("user_roles")
        .insert({
          user_id: user.id,
          role: invite.role,
          client_id: invite.client_id || null,
          venue_id: invite.venue_id || null,
          event_id: invite.event_id || null,
        });

      if (insertErr) {
        console.error(`[accept-invite][${requestId}] insert role error`, insertErr);
        return problem(500, "Internal Error", "Falha ao atribuir papel.", requestId);
      }
    }

    // Mark invite as used
    const { error: updateErr } = await supabaseAdmin
      .from("user_invites")
      .update({ used_at: new Date().toISOString(), used_by: user.id })
      .eq("id", invite.id);

    if (updateErr) {
      console.error(`[accept-invite][${requestId}] update invite error`, updateErr);
    }

    // Audit log
    await supabaseAdmin.rpc("log_audit", {
      p_user_id: user.id,
      p_action: "user_invite_accepted",
      p_entity_type: "user_invite",
      p_entity_id: invite.id,
      p_metadata: { role: invite.role, invite_created_by: invite.created_by },
      p_new_data: { role: invite.role, client_id: invite.client_id, venue_id: invite.venue_id, event_id: invite.event_id },
    });

    console.log(`[accept-invite][${requestId}] success`);

    return new Response(
      JSON.stringify({ data: { role: invite.role, accepted: true } }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error(`[accept-invite][${requestId}] error`, err);
    return problem(500, "Internal Error", "Unexpected error", requestId);
  }
});
