/**
 * Batch Discovery Submission Endpoint
 *
 * Vercel serverless function for accepting crowdsourced token discoveries.
 * Validates input, applies rate limiting, and queues for background validation.
 *
 * POST /api/discovery/batch
 */

import { NextRequest, NextResponse } from "next/server"; // For Next.js
// OR for Vite/Vercel:
// import type { VercelRequest, VercelResponse } from '@vercel/node';

import {
  BatchDiscoveryRequest,
  BatchDiscoveryResponse,
  RateLimitError,
  ValidationError,
} from "../../lib/types";

// =====================================================
// RATE LIMITING
// =====================================================

const RATE_LIMITS = {
  perHour: 100, // submissions per hour
  perDay: 1000, // submissions per day
};

/**
 * Check rate limit for contributor
 *
 * @param db - Database connection
 * @param contributorHash - Anonymous contributor hash
 * @returns True if rate limited
 */
async function checkRateLimit(
  db: any,
  contributorHash: string
): Promise<{ limited: boolean; error?: string }> {
  // Check hourly limit
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const hourCount = await db`
    SELECT COUNT(*) as count
    FROM discovery_submission_log
    WHERE contributor_hash = ${contributorHash}
    AND submitted_at > ${hourAgo}
  `;

  if (hourCount[0].count >= RATE_LIMITS.perHour) {
    return {
      limited: true,
      error: `Rate limit exceeded: ${RATE_LIMITS.perHour} submissions per hour`,
    };
  }

  // Check daily limit
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const dayCount = await db`
    SELECT COUNT(*) as count
    FROM discovery_submission_log
    WHERE contributor_hash = ${contributorHash}
    AND submitted_at > ${dayAgo}
  `;

  if (dayCount[0].count >= RATE_LIMITS.perDay) {
    return {
      limited: true,
      error: `Rate limit exceeded: ${RATE_LIMITS.perDay} submissions per day`,
    };
  }

  return { limited: false };
}

// =====================================================
// PRIORITY CALCULATION
// =====================================================

/**
 * Calculate validation priority for discovery
 *
 * Higher priority = validate first
 *
 * Scoring:
 * - Base: 5
 * - Wallet scan: +2
 * - Has holder count > 10: +1
 * - High confidence (> 0.8): +1
 * - Max: 10
 *
 * @param discovery - Token discovery
 * @returns Priority score (0-10)
 */
function calculatePriority(discovery: any): number {
  let priority = 5; // Base priority

  // Wallet scans have higher priority
  if (discovery.source === "wallet_scan") {
    priority += 2;
  }

  // Tokens with holder counts get priority boost
  if (discovery.holderCount && discovery.holderCount > 10) {
    priority += 1;
  }

  // High confidence submissions
  if (discovery.confidence && discovery.confidence > 0.8) {
    priority += 1;
  }

  return Math.min(10, priority);
}

// =====================================================
// REQUEST HANDLER
// =====================================================

/**
 * POST handler for batch discovery submission
 *
 * Steps:
 * 1. Parse and validate request body
 * 2. Check rate limits
 * 3. Validate discovery data
 * 4. Insert into validation queue
 * 5. Log submission
 * 6. Return response
 *
 * @param request - HTTP request
 * @returns HTTP response
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Parse request body
    const body: BatchDiscoveryRequest = await request.json();

    // Validate input
    if (!body.discoveries || !Array.isArray(body.discoveries)) {
      throw new ValidationError("Invalid discoveries array");
    }

    if (body.discoveries.length === 0) {
      throw new ValidationError("No discoveries provided");
    }

    if (body.discoveries.length > 100) {
      throw new ValidationError("Too many discoveries (max 100 per batch)");
    }

    if (!body.contributorHash) {
      throw new ValidationError("Missing contributor hash");
    }

    // Validate each discovery
    const errors: string[] = [];
    const validDiscoveries = body.discoveries.filter((d) => {
      // Check required fields
      if (!d.address || !d.name || !d.symbol) {
        errors.push(`Invalid discovery: missing required fields`);
        return false;
      }

      // Check address format
      if (!d.address.startsWith("0x") || d.address.length !== 42) {
        errors.push(`Invalid address: ${d.address}`);
        return false;
      }

      // Check source
      const validSources = ["wallet_scan", "whale_enumeration", "lp_detection", "user_submission"];
      if (!validSources.includes(d.source)) {
        errors.push(`Invalid source: ${d.source}`);
        return false;
      }

      // Check type
      if (d.type !== "TOKEN" && d.type !== "NFT") {
        errors.push(`Invalid type: ${d.type}`);
        return false;
      }

      return true;
    });

    if (validDiscoveries.length === 0) {
      throw new ValidationError("No valid discoveries to submit");
    }

    // Get database connection (note: implementation depends on your setup)
    // For Neon PostgreSQL with Vercel:
    // const { neon } = await import('@neondatabase/serverless');
    // const sql = neon(process.env.DATABASE_URL);
    // For this example, we'll assume db is available

    const db = await getDatabaseConnection();

    // Rate limiting
    const rateLimitCheck = await checkRateLimit(db, body.contributorHash);
    if (rateLimitCheck.limited) {
      throw new RateLimitError(rateLimitCheck.error);
    }

    // Batch insert into validation queue
    const values = validDiscoveries.map((d) => ({
      tokenAddress: d.address,
      source: d.source,
      metadata: {
        name: d.name,
        symbol: d.symbol,
        decimals: d.decimals,
        type: d.type,
        holderCount: d.holderCount,
      },
      priority: calculatePriority(d),
      contributorHash: body.contributorHash,
    }));

    // Insert all discoveries
    for (const value of values) {
      await db`
        INSERT INTO pending_validations (
          token_address, source, metadata, priority, contributor_hash
        ) VALUES (
          ${value.tokenAddress},
          ${value.source},
          ${JSON.stringify(value.metadata)},
          ${value.priority},
          ${value.contributorHash}
        )
        ON CONFLICT (token_address) DO UPDATE SET
          metadata = EXCLUDED.metadata,
          priority = GREATEST(pending_validations.priority, EXCLUDED.priority),
          submitted_at = CASE
            WHEN pending_validations.status = 'rejected' THEN NOW()
            ELSE pending_validations.submitted_at
          END
      `;
    }

    // Log submission
    await db`
      INSERT INTO discovery_submission_log (
        contributor_hash, submission_count, token_addresses, submitted_at, metadata
      ) VALUES (
        ${body.contributorHash},
        ${validDiscoveries.length},
        ${validDiscoveries.map((d) => d.address)},
        NOW(),
        ${JSON.stringify(body.metadata)}
      )
    `;

    // Return success response
    const response: BatchDiscoveryResponse = {
      success: true,
      queued: validDiscoveries.length,
      message: `Submitted ${validDiscoveries.length} discoveries for validation`,
      errors: errors.length > 0 ? errors : undefined,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    // Handle known error types
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 429 }
      );
    }

    if (error instanceof ValidationError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 400 }
      );
    }

    // Handle unknown errors
    console.error("[Discovery] Batch submission failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}

// =====================================================
// DATABASE CONNECTION
// =====================================================

/**
 * Get database connection
 * Implementation depends on your database setup
 *
 * @returns Database connection
 */
async function getDatabaseConnection() {
  // Example for Neon PostgreSQL:
  // const { neon } = await import('@neondatabase/serverless');
  // return neon(process.env.DATABASE_URL);

  // Placeholder - implement based on your setup
  throw new Error("Database connection not implemented");
}

// =====================================================
// EXPORTS
// =====================================================

// For Next.js App Router:
export { POST };

// For Vite/Vercel (as default export):
// export default async function handler(req: VercelRequest, res: VercelResponse) {
//   // Handle both GET and POST
//   if (req.method === 'POST') {
//     const request = req as any;
//     const response = await POST(request);
//     return res.status(response.status).json(response.body);
//   }
//   return res.status(405).json({ error: 'Method not allowed' });
// }
