import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
  console.log(`[create-client-with-manager][${requestId}] start`);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return errorResponse(401, "Unauthorized", "Missing auth header", requestId);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller is owner or super_admin
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
      .in("role", ["owner", "super_admin"]);

    if (!callerRoles || callerRoles.length === 0) {
      return errorResponse(403, "Forbidden", "Only owner or super_admin can activate clients", requestId);
    }

    const body = await req.json();
    const client_name = body?.client_name?.trim?.() ?? "";
    const client_email = body?.client_email?.trim?.() || null;
    const client_phone = body?.client_phone?.trim?.() || null;
    const client_document = body?.client_document?.trim?.() || null;
    const client_address = body?.client_address?.trim?.() || null;
    const owner_name = body?.owner_name?.trim?.() || null;
    const owner_cpf = body?.owner_cpf?.trim?.() || null;
    const owner_phone = body?.owner_phone?.trim?.() || null;
    const manager_email = body?.manager_email?.trim?.().toLowerCase?.() ?? "";
    const manager_password = body?.manager_password?.trim?.() ?? "";
    const manager_name = body?.manager_name?.trim?.() ?? "";
    const manager_phone = body?.manager_phone?.trim?.() || null;
    const pix_key = body?.pix_key?.trim?.() || null;
    const bank_code = body?.bank_code?.trim?.() || null;
    const bank_agency = body?.bank_agency?.trim?.() || null;
    const bank_account = body?.bank_account?.trim?.() || null;
    const bank_account_type = body?.bank_account_type?.trim?.() || "CONTA_CORRENTE";

    if (!client_name || !manager_email || !manager_password || !manager_name) {
      return errorResponse(400, "Bad Request", "client_name, manager_email, manager_password, manager_name are required", requestId);
    }

    // Generate unique slug from client name
    const baseSlug = client_name
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const slug = baseSlug + "-" + crypto.randomUUID().slice(0, 6);

    // 1. Create the client
    const { data: clientData, error: clientError } = await adminClient
      .from("clients")
      .insert({
        name: client_name,
        slug,
        email: client_email || null,
        phone: client_phone || null,
        document: client_document || null,
        address: client_address || null,
        owner_name: owner_name || null,
        owner_cpf: owner_cpf || null,
        owner_phone: owner_phone || null,
        pix_key: pix_key || null,
        bank_code: bank_code || null,
        bank_agency: bank_agency || null,
        bank_account: bank_account || null,
        bank_account_type: bank_account_type,
      })
      .select("id, slug")
      .single();

    if (clientError) {
      console.error(`[create-client-with-manager][${requestId}] client insert error`, clientError);
      return errorResponse(500, "Internal Error", "Failed to create client: " + clientError.message, requestId);
    }

    // 2. Create the manager user via auth.admin
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: manager_email,
      password: manager_password,
      email_confirm: true,
      user_metadata: { name: manager_name, phone: manager_phone || null },
    });

    if (authError) {
      console.error(`[create-client-with-manager][${requestId}] auth create error`, authError);
      // Rollback: delete client
      await adminClient.from("clients").delete().eq("id", clientData.id);
      return errorResponse(400, "Auth Error", "Failed to create manager user: " + authError.message, requestId);
    }

    const managerId = authData.user.id;

    // 3. Assign client_admin role
    const { error: roleError } = await adminClient
      .from("user_roles")
      .insert({ user_id: managerId, role: "client_admin", client_id: clientData.id });

    if (roleError) {
      console.error(`[create-client-with-manager][${requestId}] role assign error`, roleError);
    }

    // 4. Audit log
    await adminClient.from("audit_logs").insert({
      action: "client.activated",
      user_id: user.id,
      entity_type: "client",
      entity_id: clientData.id,
      user_role: callerRoles[0].role,
      new_data: { client_name, manager_email, manager_name },
    });

    console.log(`[create-client-with-manager][${requestId}] success client=${clientData.id} manager=${managerId}`);

    return new Response(
      JSON.stringify({ client_id: clientData.id, manager_id: managerId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error(`[create-client-with-manager][${requestId}] error`, err);
    return errorResponse(500, "Internal Error", String(err), requestId);
  }
});
