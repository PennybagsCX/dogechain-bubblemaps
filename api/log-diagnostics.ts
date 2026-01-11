/**
 * Diagnostic Logging API Endpoint
 * Receives and stores diagnostic logs from client applications
 */

/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { createClient } from "@vercel/kv";

// Initialize KV client for storing logs
const kv = createClient({
  url: process.env.KV_URL || "",
  token: process.env.KV_REST_API_URL || "",
});

const LOG_PREFIX = "diagnostic_log:";
const LOG_INDEX = "diagnostic_log_index";
const LOG_RETENTION_DAYS = 7;

interface LogEntry {
  data: any;
  receivedAt: string;
}

export async function POST(req: Request): Promise<Response> {
  try {
    const data = await req.json();

    // Validate required fields
    if (!data.sessionId || !data.timestamp) {
      return Response.json(
        {
          success: false,
          message: "Missing required fields: sessionId, timestamp",
        },
        { status: 400 }
      );
    }

    // Create log entry
    const logEntry: LogEntry = {
      data,
      receivedAt: new Date().toISOString(),
    };

    // Store in KV with TTL for auto-cleanup
    const key = `${LOG_PREFIX}${data.sessionId}_${data.timestamp}`;
    const ttl = LOG_RETENTION_DAYS * 24 * 60 * 60; // 7 days in seconds

    // Try to store in KV
    try {
      await kv.set(key, JSON.stringify(logEntry), { px: ttl });

      // Add to index for retrieval
      await kv.zadd(LOG_INDEX, {
        score: Date.now(),
        member: key,
      });

      // Clean up old entries from index (keep last 1000)
      const oldEntries = await kv.zrange(LOG_INDEX, 0, -1000);
      if (oldEntries.length > 1000) {
        // Remove oldest entries beyond 1000
        const toRemove = oldEntries.slice(0, oldEntries.length - 1000);
        for (const entry of toRemove) {
          await kv.zrem(LOG_INDEX, entry);
        }
      }

      console.log(`[Diagnostics] Logged session: ${data.sessionId}`);

      return Response.json({
        success: true,
        message: "Logs received successfully",
        sessionId: data.sessionId,
      });
    } catch {
      // If KV is not configured, log to console instead
      console.error("[Diagnostics] KV not available, logging to console:", logEntry);

      return Response.json({
        success: true,
        message: "Logs received (KV not configured, logged to console)",
        sessionId: data.sessionId,
      });
    }
  } catch (error) {
    console.error("[Diagnostics] Error processing logs:", error);

    return Response.json(
      {
        success: false,
        message: "Failed to process logs",
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
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
