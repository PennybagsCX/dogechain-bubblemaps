// Vercel serverless function to proxy Dogechain API requests
// This fixes SSL certificate issues with Arc Browser for iOS
import type { VercelRequest, VercelResponse } from "@vercel/node";

const DOGECHAIN_API_BASE = "https://explorer.dogechain.dog";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Only allow GET requests
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Get the path from the query
    // If path starts with /v2, use V2 API, otherwise use V1
    const path = (req.query.path as string) || "";
    const isV2 = path.startsWith("/v2");

    // Remove the path from query params
    const { path: _, ...queryParams } = req.query as Record<string, string>;

    let targetUrl: string;

    if (isV2) {
      // V2 API: RESTful style
      // Remove /v2 prefix and get the endpoint
      const endpoint = path.substring(3); // Remove '/v2'
      targetUrl = `${DOGECHAIN_API_BASE}/api/v2${endpoint}`;
      if (Object.keys(queryParams).length > 0) {
        targetUrl += `?${new URLSearchParams(queryParams).toString()}`;
      }
    } else {
      // V1 API: module/action style
      const queryString = new URLSearchParams(queryParams).toString();
      targetUrl = `${DOGECHAIN_API_BASE}/api?${queryString}`;
    }

    // Forward the request to Dogechain API
    const response = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "User-Agent": "DogechainBubblemaps/1.0",
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      console.error(`Dogechain API returned ${response.status}: ${response.statusText}`);
      throw new Error(`Dogechain API returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // Return the response
    return res.status(200).json(data);
  } catch (error) {
    console.error("Proxy error:", error);
    return res.status(500).json({
      error: "Failed to fetch from Dogechain API",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
