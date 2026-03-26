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
  console.log(`[search-product-image][${requestId}] start`);

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return problem(401, "Unauthorized", "Missing or invalid authorization header", requestId);
    }

    const body = await req.json();
    const { query } = body;

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return problem(400, "Bad Request", "query is required (non-empty string)", requestId);
    }

    const serpApiKey = Deno.env.get("SERPAPI_KEY");
    if (!serpApiKey) {
      return problem(503, "Service Unavailable", "Image search is not configured (SERPAPI_KEY missing)", requestId);
    }

    const searchQuery = encodeURIComponent(`${query.trim()} product photo`);
    const serpUrl = `https://serpapi.com/search.json?engine=google_images&q=${searchQuery}&num=8&safe=active&api_key=${serpApiKey}`;

    console.log(`[search-product-image][${requestId}] searching: ${query.trim()}`);

    const serpResponse = await fetch(serpUrl);
    if (!serpResponse.ok) {
      const errBody = await serpResponse.text();
      console.error(`[search-product-image][${requestId}] SerpAPI error: ${serpResponse.status} ${errBody}`);
      return problem(502, "Upstream Error", `Image search failed: ${serpResponse.status}`, requestId);
    }

    const serpData = await serpResponse.json();
    const imagesResults = serpData.images_results || [];

    const results = imagesResults.slice(0, 8).map((img: Record<string, string>) => ({
      title: img.title || "",
      imageUrl: img.original || img.thumbnail || "",
      thumbnailUrl: img.thumbnail || "",
      sourceUrl: img.link || img.source || "",
    }));

    console.log(`[search-product-image][${requestId}] success, ${results.length} results`);

    return new Response(
      JSON.stringify({ data: { results } }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error(`[search-product-image][${requestId}] error:`, err);
    return problem(500, "Internal Error", err instanceof Error ? err.message : "Unknown error", requestId);
  }
});
