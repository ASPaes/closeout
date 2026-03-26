import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decode as base64Decode } from "https://deno.land/std@0.224.0/encoding/base64.ts";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const requestId = crypto.randomUUID().slice(0, 8);
  console.log(`[upload-product-image][${requestId}] start`);

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return problem(401, "Unauthorized", "Missing or invalid authorization header", requestId);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // User client (RLS)
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return problem(401, "Unauthorized", "Invalid token", requestId);
    }
    const userId = claimsData.claims.sub as string;

    // Parse & validate body
    const body = await req.json();
    const { productId, fileBase64, mimeType, originalFileName } = body;

    if (!productId || typeof productId !== "string") {
      return problem(400, "Bad Request", "productId is required (uuid)", requestId);
    }
    if (!fileBase64 || typeof fileBase64 !== "string") {
      return problem(400, "Bad Request", "fileBase64 is required", requestId);
    }
    const allowedMimes = ["image/png", "image/jpeg", "image/webp"];
    if (!allowedMimes.includes(mimeType)) {
      return problem(400, "Bad Request", `mimeType must be one of: ${allowedMimes.join(", ")}`, requestId);
    }

    // Fetch product (RLS enforces permission)
    const { data: product, error: prodError } = await userClient
      .from("products")
      .select("id, name, client_id")
      .eq("id", productId)
      .single();

    if (prodError || !product) {
      return problem(403, "Forbidden", "Product not found or access denied", requestId);
    }

    // Decode file
    const fileBytes = base64Decode(fileBase64);

    // Compute SHA-256
    const hashBuffer = await crypto.subtle.digest("SHA-256", fileBytes);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const imageHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    const storagePath = `images/${imageHash}.webp`;

    // Admin client for storage + library writes
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Check if file already exists in storage
    const { data: existingFile } = await adminClient.storage
      .from("product-images")
      .list("images", { search: `${imageHash}.webp` });

    const alreadyExists = existingFile && existingFile.length > 0 && existingFile.some((f) => f.name === `${imageHash}.webp`);

    if (!alreadyExists) {
      const contentType = mimeType === "image/webp" ? "image/webp" : mimeType;
      const { error: uploadError } = await adminClient.storage
        .from("product-images")
        .upload(storagePath, fileBytes, {
          contentType,
          upsert: false,
        });

      if (uploadError && !uploadError.message?.includes("already exists")) {
        console.error(`[upload-product-image][${requestId}] upload error:`, uploadError);
        return problem(500, "Storage Error", uploadError.message, requestId);
      }
    }

    // Get normalized name
    const { data: normData } = await adminClient.rpc("normalize_product_name", {
      input: product.name,
    });
    const normalizedName = normData as string;

    // Upsert product_image_library
    const { error: libError } = await adminClient
      .from("product_image_library")
      .upsert(
        {
          normalized_name: normalizedName,
          image_path: storagePath,
          image_hash: imageHash,
          source_url: null,
        },
        { onConflict: "normalized_name" }
      );

    if (libError) {
      console.error(`[upload-product-image][${requestId}] library upsert error:`, libError);
      // Non-fatal: continue to update product
    }

    // Update product
    const { error: updateError } = await adminClient
      .from("products")
      .update({ image_path: storagePath, image_source: "upload" })
      .eq("id", productId);

    if (updateError) {
      console.error(`[upload-product-image][${requestId}] product update error:`, updateError);
      return problem(500, "Database Error", updateError.message, requestId);
    }

    // Build public URL
    const { data: publicUrlData } = adminClient.storage
      .from("product-images")
      .getPublicUrl(storagePath);

    console.log(`[upload-product-image][${requestId}] success hash=${imageHash}`);

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
    console.error(`[upload-product-image][${requestId}] error:`, err);
    return problem(500, "Internal Error", err instanceof Error ? err.message : "Unknown error", requestId);
  }
});
