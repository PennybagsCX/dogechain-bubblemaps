/**
 * Get Diagnostic Logs API Endpoint
 * Retrieves stored diagnostic logs for analysis
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { createClient } from "@vercel/kv";

const kv = createClient({
  url: process.env.KV_URL || "",
  token: process.env.KV_REST_API_URL || "",
});

const LOG_PREFIX = "diagnostic_log:";
const LOG_INDEX = "diagnostic_log_index";

export async function GET(req: Request): Promise<Response> {
  try {
    // Parse query parameters from request URL
    let sessionId: string | null = null;
    let limit = 50;
    let offset = 0;

    // Try to get URL from request or construct from headers
    const requestUrl = req.url;
    if (requestUrl) {
      try {
        const url = new URL(requestUrl);
        sessionId = url.searchParams.get("sessionId");
        limit = parseInt(url.searchParams.get("limit") || "50");
        offset = parseInt(url.searchParams.get("offset") || "0");
      } catch {
        // URL parsing failed, use defaults
      }
    }

    const logs: any[] = [];

    if (sessionId) {
      // Get specific session
      const keys = await kv.keys(`${LOG_PREFIX}${sessionId}*`);

      for (const key of keys) {
        const data = await kv.get(key);
        if (data) {
          logs.push(JSON.parse(data as string));
        }
      }
    } else {
      // Get recent logs
      const keys = await kv.zrange(LOG_INDEX, -limit - offset, -offset - 1, {
        rev: true,
      });

      for (const key of keys) {
        const data = await kv.get(key as string);
        if (data) {
          logs.push(JSON.parse(data as string));
        }
      }
    }

    return Response.json({
      success: true,
      count: logs.length,
      logs,
    });
  } catch (error) {
    console.error("[Diagnostics] Error retrieving logs:", error);

    return Response.json(
      {
        success: false,
        message: "Failed to retrieve logs",
        error: error instanceof Error ? error.message : "Unknown error",
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
