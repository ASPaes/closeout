import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function problem(status: number, title: string, detail: string, requestId: string) {
  return new Response(
    JSON.stringify({ type: "about:blank", title, status, detail, requestId }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/problem+json" } }
  );
}

type EntityType = "product" | "combo" | "campaign";
const VALID_ENTITY_TYPES: EntityType[] = ["product", "combo", "campaign"];
const TABLE_MAP: Record<EntityType, string> = {
  product: "products",
  combo: "combos",
  campaign: "campaigns",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const requestId = crypto.randomUUID().slice(0, 8);
  console.log(`[attach-searched-product-image][${requestId}] start`);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return problem(401, "Unauthorized", "Missing or invalid authorization header", requestId);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: { user }, error: userError } = await adminClient.auth.getUser(token);
    if (userError || !user) {
      return problem(401, "Unauthorized", "Invalid token", requestId);
    }

    // Parse body
    const body = await req.json();
    const { imageUrl, sourceUrl } = body;

    // Backward compat: productId alone → entityType="product"
    const entityType: EntityType = body.entityType || "product";
    const entityId: string = body.entityId || body.productId;

    if (!VALID_ENTITY_TYPES.includes(entityType)) {
      return problem(400, "Bad Request", `entityType must be one of: ${VALID_ENTITY_TYPES.join(", ")}`, requestId);
    }
    if (!entityId || typeof entityId !== "string") {
      return problem(400, "Bad Request", "entityId (or productId) is required (uuid)", requestId);
    }
    if (!imageUrl || typeof imageUrl !== "string") {
      return problem(400, "Bad Request", "imageUrl is required", requestId);
    }

    const tableName = TABLE_MAP[entityType];

    // Verify entity access via RLS
    const { data: entity, error: entityError } = await userClient
      .from(tableName)
      .select("id, name, client_id")
      .eq("id", entityId)
      .single();

    if (entityError || !entity) {
      return problem(403, "Forbidden", `${entityType} not found or access denied`, requestId);
    }

    // Download image server-side
    console.log(`[attach-searched-product-image][${requestId}] downloading ${imageUrl}`);
    const imgResponse = await fetch(imageUrl, {
      headers: { "User-Agent": "CloseOut/1.0" },
    });

    if (!imgResponse.ok) {
      return problem(422, "Unprocessable", `Failed to download image: HTTP ${imgResponse.status}`, requestId);
    }

    const imgBytes = new Uint8Array(await imgResponse.arrayBuffer());

    if (imgBytes.length === 0) {
      return problem(422, "Unprocessable", "Downloaded image is empty", requestId);
    }

    if (imgBytes.length > 5 * 1024 * 1024) {
      return problem(422, "Unprocessable", "Image exceeds 5MB limit", requestId);
    }

    // SHA-256
    const hashBuffer = await crypto.subtle.digest("SHA-256", imgBytes);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const imageHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    const storagePath = `images/${imageHash}.webp`;

    // Check existence
    const { data: existingFile } = await adminClient.storage
      .from("product-images")
      .list("images", { search: `${imageHash}.webp` });

    const alreadyExists = existingFile && existingFile.length > 0 && existingFile.some((f) => f.name === `${imageHash}.webp`);

    if (!alreadyExists) {
      const contentType = imgResponse.headers.get("content-type") || "image/webp";

      const { error: uploadError } = await adminClient.storage
        .from("product-images")
        .upload(storagePath, imgBytes, {
          contentType,
          upsert: false,
        });

      if (uploadError && !uploadError.message?.includes("already exists")) {
        console.error(`[attach-searched-product-image][${requestId}] upload error:`, uploadError);
        return problem(500, "Storage Error", uploadError.message, requestId);
      }
    }

    // Normalized name for library deduplication
    const { data: normData } = await adminClient.rpc("normalize_product_name", {
      input: (entity as any).name,
    });
    const normalizedName = normData as string;

    // Upsert library
    const { error: libError } = await adminClient
      .from("product_image_library")
      .upsert(
        {
          normalized_name: normalizedName,
          image_path: storagePath,
          image_hash: imageHash,
          source_url: sourceUrl || imageUrl,
        },
        { onConflict: "normalized_name" }
      );

    if (libError) {
      console.error(`[attach-searched-product-image][${requestId}] library upsert error:`, libError);
    }

    // Update entity
    const { error: updateError } = await adminClient
      .from(tableName)
      .update({ image_path: storagePath, image_source: "search" })
      .eq("id", entityId);

    if (updateError) {
      console.error(`[attach-searched-product-image][${requestId}] ${tableName} update error:`, updateError);
      return problem(500, "Database Error", updateError.message, requestId);
    }

    const { data: publicUrlData } = adminClient.storage
      .from("product-images")
      .getPublicUrl(storagePath);

    console.log(`[attach-searched-product-image][${requestId}] success type=${entityType} hash=${imageHash}`);

    return new Response(
      JSON.stringify({
        data: {
          imagePath: storagePath,
          imageHash,
          publicUrl: publicUrlData.publicUrl,
          reused: alreadyExists,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error(`[attach-searched-product-image][${requestId}] error:`, err);
    return problem(500, "Internal Error", err instanceof Error ? err.message : "Unknown error", requestId);
  }
});
