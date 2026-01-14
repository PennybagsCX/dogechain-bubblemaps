/**
 * Get Diagnostic Logs API Endpoint
 * Retrieves stored diagnostic logs for analysis
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL ?? "");

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
      // Get specific session logs
      const sessionLogs = await sql`
        SELECT * FROM diagnostic_logs
        WHERE session_id = ${sessionId}
        ORDER BY timestamp DESC
      `;

      for (const log of sessionLogs) {
        logs.push(formatLog(log));
      }
    } else {
      // Get recent logs with pagination
      const recentLogs = await sql`
        SELECT * FROM diagnostic_logs
        ORDER BY timestamp DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `;

      for (const log of recentLogs) {
        logs.push(formatLog(log));
      }
    }

    return Response.json({
      success: true,
      count: logs.length,
      logs,
    });
  } catch (error) {
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

function formatLog(log: any): any {
  return {
    id: log.id,
    sessionId: log.session_id,
    timestamp: log.timestamp,
    userAgent: log.user_agent,
    platform: log.platform,
    vendor: log.vendor,
    isArcMobile: log.is_arc_mobile,
    isArc: log.is_arc,
    isMobile: log.is_mobile,
    consoleLogs: log.console_logs,
    tokenSearches: log.token_searches,
    tokenHolderFetches: log.token_holder_fetches,
    errors: log.errors,
    screenResolution: log.screen_resolution,
    viewport: log.viewport,
    networkStatus: log.network_status,
    language: log.language,
    url: log.url,
    receivedAt: log.received_at,
    createdAt: log.created_at,
  };
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
