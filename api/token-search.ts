/**
 * Token Search Proxy API
 *
 * Proxies token search requests to Blockscout Explorer API to bypass
 * browser CORS restrictions, particularly for Arc Browser mobile.
 *
 * GET /api/token-search?q=DOGE
 */

const BLOCKSCOUT_API_BASE = "https://explorer.dogechain.dog";
const CACHE_TTL = 300; // 5 minutes

export async function GET(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const query = url.searchParams.get("q");

    // Validate query parameter
    if (!query || query.length < 2) {
      return Response.json(
        {
          success: false,
          error: "Invalid query parameter. Must be at least 2 characters.",
          items: [],
        },
        { status: 400 }
      );
    }

    // Construct Blockscout API URL
    const targetUrl = `${BLOCKSCOUT_API_BASE}/tokens?type=JSON&query=${encodeURIComponent(query)}`;

    // Forward request to Blockscout API with browser-like headers
    const response = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "*/*",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (!response.ok) {
      return Response.json(
        {
          success: false,
          error: `Upstream API error: ${response.status}`,
          items: [],
        },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Add proxy metadata
    const responseData = {
      ...data,
      _proxy: {
        timestamp: new Date().toISOString(),
        query: query,
        cached: false,
      },
    };

    // Return response with caching headers
    return Response.json(responseData, {
      headers: {
        "Cache-Control": `public, s-maxage=${CACHE_TTL}, stale-while-revalidate=600`,
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        items: [],
      },
      { status: 500 }
    );
  }
}

// Handle OPTIONS preflight requests for CORS
export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
