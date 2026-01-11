/**
 * Dogechain Explorer Proxy API
 *
 * Proxies requests to Dogechain Explorer APIs to bypass CORS restrictions
 * This is needed because the explorer APIs don't have proper CORS headers
 */

const BLOCKSCOUT_API_BASE = "https://explorer.dogechain.dog";

export async function GET(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);

    // Get proxy parameters
    const module = url.searchParams.get("module");
    const action = url.searchParams.get("action");
    const path = url.searchParams.get("path");
    const contractAddress = url.searchParams.get("contractaddress");
    const address = url.searchParams.get("address");
    const page = url.searchParams.get("page");
    const offset = url.searchParams.get("offset");
    const limit = url.searchParams.get("limit");
    const sort = url.searchParams.get("sort");

    // Build target URL based on parameters
    let targetUrl = "";

    if (path) {
      // V2 API with path parameter
      targetUrl = `${BLOCKSCOUT_API_BASE}${path}`;
      // Add query parameters (except 'path')
      const searchParams = new URLSearchParams();
      for (const [key, value] of url.searchParams.entries()) {
        if (key !== "path") {
          searchParams.append(key, value);
        }
      }
      if (searchParams.toString()) {
        targetUrl += `?${searchParams.toString()}`;
      }
    } else if (module && action) {
      // V1 API with module/action
      targetUrl = `${BLOCKSCOUT_API_BASE}/api?module=${module}&action=${action}`;
      // Add additional parameters
      if (contractAddress) targetUrl += `&contractaddress=${contractAddress}`;
      if (address) targetUrl += `&address=${address}`;
      if (page) targetUrl += `&page=${page}`;
      if (offset) targetUrl += `&offset=${offset}`;
      if (sort) targetUrl += `&sort=${sort}`;
    } else {
      return Response.json(
        { error: "Missing required parameters: module/action or path" },
        { status: 400 }
      );
    }

    console.log("[Dogechain Proxy] Fetching:", targetUrl.replace(/\/api\?/, "/api?..."));

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
      console.error("[Dogechain Proxy] Blockscout returned:", response.status, response.statusText);
      return Response.json(
        { error: `Upstream API error: ${response.status} ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Add CORS headers and return
    return Response.json(data, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    });
  } catch (error) {
    console.error("[Dogechain Proxy] Error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
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
