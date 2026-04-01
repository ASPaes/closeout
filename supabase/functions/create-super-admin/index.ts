import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function errorResponse(status: number, title: string, detail: string, requestId: string) {
  return new Response(
    JSON.stringify({ type: "about:blank", title, status, detail, requestId }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/problem+json" } }
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const requestId = crypto.randomUUID().slice(0, 8);
  console.log(`[create-super-admin][${requestId}] start`);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return errorResponse(401, "Unauthorized", "Missing auth header", requestId);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller is owner
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return errorResponse(401, "Unauthorized", "Invalid token", requestId);

    const adminClient = createClient(supabaseUrl, serviceKey);

    const { data: callerRoles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "owner");

    if (!callerRoles || callerRoles.length === 0) {
      return errorResponse(403, "Forbidden", "Only owner can create super admins", requestId);
    }

    const body = await req.json();
    const { email, password, name, phone } = body;

    if (!email || !password || !name) {
      return errorResponse(400, "Bad Request", "email, password, name are required", requestId);
    }

    // Create user
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, phone: phone || null },
    });

    if (authError) {
      console.error(`[create-super-admin][${requestId}] auth create error`, authError);
      return errorResponse(400, "Auth Error", "Failed to create user: " + authError.message, requestId);
    }

    const newUserId = authData.user.id;

    // Assign super_admin role
    const { error: roleError } = await adminClient
      .from("user_roles")
      .insert({ user_id: newUserId, role: "super_admin" });

    if (roleError) {
      console.error(`[create-super-admin][${requestId}] role assign error`, roleError);
    }

    // Audit log
    await adminClient.from("audit_logs").insert({
      action: "super_admin.created",
      user_id: user.id,
      entity_type: "user",
      entity_id: newUserId,
      user_role: "owner",
      new_data: { email, name },
    });

    console.log(`[create-super-admin][${requestId}] success user=${newUserId}`);

    return new Response(
      JSON.stringify({ user_id: newUserId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error(`[create-super-admin][${requestId}] error`, err);
    return errorResponse(500, "Internal Error", String(err), requestId);
  }
});
