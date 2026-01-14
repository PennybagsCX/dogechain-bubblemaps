/**
 * Diagnostic Logging API Endpoint
 * Receives and stores diagnostic logs from client applications
 */

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

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

    // Insert log into database
    await sql`
      INSERT INTO diagnostic_logs (
        session_id,
        timestamp,
        user_agent,
        platform,
        vendor,
        is_arc_mobile,
        is_arc,
        is_mobile,
        console_logs,
        token_searches,
        token_holder_fetches,
        errors,
        screen_resolution,
        viewport,
        network_status,
        language,
        url
      ) VALUES (
        ${data.sessionId},
        ${data.timestamp},
        ${data.userAgent || null},
        ${data.platform || null},
        ${data.vendor || null},
        ${data.isArcMobile || false},
        ${data.isArc || false},
        ${data.isMobile || false},
        ${JSON.stringify(data.consoleLogs || [])},
        ${JSON.stringify(data.tokenSearches || [])},
        ${JSON.stringify(data.tokenHolderFetches || [])},
        ${JSON.stringify(data.errors || [])},
        ${data.screenResolution || null},
        ${data.viewport || null},
        ${data.networkStatus || null},
        ${data.language || null},
        ${data.url || null}
      )
    `;

    // Clean up old logs (keep last 7 days)
    await sql`
      DELETE FROM diagnostic_logs
      WHERE received_at < NOW() - INTERVAL '7 days'
    `;

    return Response.json({
      success: true,
      message: "Logs received successfully",
      sessionId: data.sessionId,
    });
  } catch (error) {
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
