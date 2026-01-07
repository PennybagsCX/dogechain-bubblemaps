/**
 * Validation Queue Processor
 *
 * Background validation system for crowdsourced token discoveries.
 * Validates tokens against Blockscout API and merges valid ones into the index.
 *
 * This is designed to be run as a cron job (every 5 minutes).
 */

import { TokenMetadata, ValidationResult, DiscoverySource } from "./types";

// =====================================================
// BLOCKSCOUT API CLIENT
// =====================================================

const BLOCKSCOUT_API_BASE = "https://explorer.dogechain.dog/api";

/**
 * Fetch token data from Blockscout API
 *
 * @param address - Token contract address
 * @returns Token metadata or null
 */
async function fetchTokenFromBlockscout(address: string): Promise<TokenMetadata | null> {
  try {
    // Try V2 API first
    const v2Url = `${BLOCKSCOUT_API_BASE}/v2/tokens/${address}`;
    const v2Response = await fetch(v2Url, {
      headers: {
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (v2Response.ok) {
      const data = await v2Response.json();
      if (data && data.address) {
        return {
          address: data.address,
          name: data.name || "Unknown Token",
          symbol: data.symbol || "TOKEN",
          decimals: data.decimals || 18,
          type: data.type === "ERC-721" ? "NFT" : "TOKEN",
          source: "blockscout_api",
          holderCount: data.holders_count,
          isVerified: true, // Blockscout verified
        };
      }
    }

    // Fallback to V1 API
    const v1Url = `${BLOCKSCOUT_API_BASE}?module=token&action=getToken&contractaddress=${address}`;
    const v1Response = await fetch(v1Url, {
      signal: AbortSignal.timeout(10000),
    });

    if (v1Response.ok) {
      const data = await v1Response.json();
      if (data && data.result && data.result.contractAddress) {
        return {
          address: data.result.contractAddress,
          name: data.result.tokenName || "Unknown Token",
          symbol: data.result.symbol || "TOKEN",
          decimals: parseInt(data.result.divisor) || 18,
          type: "TOKEN",
          source: "blockscout_api",
          isVerified: true,
        };
      }
    }

    return null;
  } catch (error) {
    console.error(`[Validation] Error fetching token ${address}:`, error);
    return null;
  }
}

// =====================================================
// VALIDATION CRITERIA
// =====================================================

/**
 * Validate token metadata quality
 *
 * Criteria:
 * - Has valid name (not "Unknown" or generic)
 * - Has valid symbol (not "TOKEN"/"NFT", length >= 2)
 * - Has decimals for tokens (NFTs exempt)
 * - Address format valid
 *
 * @param metadata - Token metadata
 * @returns True if valid
 */
function validateTokenQuality(metadata: TokenMetadata): boolean {
  // Check address format
  if (!metadata.address || !metadata.address.startsWith("0x") || metadata.address.length !== 42) {
    return false;
  }

  // Check name quality
  if (!metadata.name || metadata.name.length < 2) {
    return false;
  }

  // Reject generic names
  const genericNames = ["Unknown Token", "Unverified Token", "Token from", "Unknown NFT"];
  if (genericNames.some((generic) => metadata.name.startsWith(generic))) {
    return false;
  }

  // Check symbol quality
  if (!metadata.symbol || metadata.symbol.length < 2 || metadata.symbol.length > 20) {
    return false;
  }

  // Reject generic symbols
  if (metadata.symbol === "TOKEN" || metadata.symbol === "NFT") {
    return false;
  }

  // Check decimals for tokens (NFTs have 0)
  if (metadata.type === "TOKEN") {
    if (metadata.decimals === undefined || metadata.decimals < 0 || metadata.decimals > 18) {
      return false;
    }
  }

  return true;
}

// =====================================================
// VALIDATION LOGIC
// =====================================================

/**
 * Validate token against Blockscout API
 *
 * @param address - Token contract address
 * @param _source - Discovery source (unused, for future use)
 * @returns Validation result
 */
export async function validateToken(
  address: string,
  _source: DiscoverySource
): Promise<ValidationResult> {
  try {
    // Fetch from Blockscout
    const blockscoutData = await fetchTokenFromBlockscout(address);

    if (!blockscoutData) {
      return {
        address,
        isValid: false,
        errors: ["Token not found on Blockscout"],
      };
    }

    // Validate quality
    const isValid = validateTokenQuality(blockscoutData);

    if (!isValid) {
      return {
        address,
        isValid: false,
        errors: ["Token metadata does not meet quality standards"],
      };
    }

    return {
      address,
      isValid: true,
      metadata: blockscoutData,
    };
  } catch (error) {
    return {
      address,
      isValid: false,
      errors: [error instanceof Error ? error.message : "Unknown error"],
    };
  }
}

/**
 * Process validation queue (cron job)
 * Validates pending tokens against Blockscout API
 *
 * Algorithm:
 * 1. Fetch high-priority validations first
 * 2. Mark as validating
 * 3. Validate against Blockscout
 * 4. On success: Move to merged tokens, remove from queue
 * 5. On failure: Mark as rejected
 * 6. Track attempts
 *
 * @param db - Database connection (SQL)
 * @param batchSize - Number of validations to process (default: 50)
 * @returns Processing stats
 */
export async function processValidationQueue(
  db: any, // SQL client
  batchSize: number = 50
): Promise<{
  processed: number;
  validated: number;
  rejected: number;
  failed: number;
}> {
  console.log("[Validation] Starting queue processing...");

  // Fetch high-priority validations
  const pending = await db`
    SELECT id, token_address, source, metadata, priority, submitted_at
    FROM pending_validations
    WHERE status = 'pending'
    ORDER BY priority DESC, submitted_at ASC
    LIMIT ${batchSize}
  `;

  console.log(`[Validation] Processing ${pending.length} tokens`);

  let validated = 0;
  let rejected = 0;
  let failed = 0;

  for (const item of pending) {
    try {
      // Mark as validating
      await db`
        UPDATE pending_validations
        SET status = 'validating',
            validation_attempts = validation_attempts + 1,
            last_attempt_at = NOW()
        WHERE id = ${item.id}
      `;

      // Parse metadata
      const metadata =
        typeof item.metadata === "string" ? JSON.parse(item.metadata) : item.metadata;

      // Validate against Blockscout
      const result = await validateToken(item.token_address, metadata.source || item.source);

      if (result.isValid && result.metadata) {
        // Merge into main index
        await mergeValidatedToken(db, item.token_address, result.metadata, item);

        // Remove from queue
        await db`DELETE FROM pending_validations WHERE id = ${item.id}`;

        validated++;
        console.log(`[Validation] ✓ Validated: ${item.token_address}`);
      } else {
        // Mark as rejected
        await db`
          UPDATE pending_validations
          SET status = 'rejected'
          WHERE id = ${item.id}
        `;
        rejected++;
        console.log(
          `[Validation] ✗ Rejected: ${item.token_address} - ${result.errors?.join(", ")}`
        );
      }
    } catch (error) {
      console.error(`[Validation] Error validating ${item.token_address}:`, error);
      failed++;

      // Update attempt count but keep pending
      await db`
        UPDATE pending_validations
        SET validation_attempts = validation_attempts + 1,
            last_attempt_at = NOW()
        WHERE id = ${item.id}
      `;
    }
  }

  console.log(
    `[Validation] Complete: ${validated} validated, ${rejected} rejected, ${failed} failed`
  );

  return {
    processed: pending.length,
    validated,
    rejected,
    failed,
  };
}

/**
 * Merge validated token into main index
 *
 * @param db - Database connection
 * @param address - Token address
 * @param metadata - Validated metadata
 * @param queueItem - Original queue item
 */
async function mergeValidatedToken(
  db: any,
  address: string,
  metadata: TokenMetadata,
  queueItem: any
): Promise<void> {
  const metadata =
    typeof queueItem.metadata === "string" ? JSON.parse(queueItem.metadata) : queueItem.metadata;

  // Insert into crowdsourced token index
  await db`
    INSERT INTO crowdsourced_token_index (
      token_address, name, symbol, decimals, type, source,
      holder_count, is_verified, confidence_score,
      discovery_count, first_discovered_at, last_discovered_at, indexed_at
    ) VALUES (
      ${address},
      ${metadata.name},
      ${metadata.symbol},
      ${metadata.decimals},
      ${metadata.type},
      'wallet_scan_validated',
      ${metadata.holderCount},
      ${metadata.isVerified || true},
      0.9,
      1,
      NOW(),
      NOW(),
      NOW()
    )
    ON CONFLICT (token_address) DO UPDATE SET
      name = EXCLUDED.name,
      symbol = EXCLUDED.symbol,
      decimals = EXCLUDED.decimals,
      holder_count = EXCLUDED.holder_count,
      is_verified = EXCLUDED.is_verified,
      confidence_score = GREATEST(crowdsourced_token_index.confidence_score, 0.9),
      discovery_count = crowdsourced_token_index.discovery_count + 1,
      last_discovered_at = NOW(),
      indexed_at = NOW()
  `;

  // Log merge history
  await db`
    INSERT INTO token_merge_history (
      token_address, source, source_metadata, merged_metadata, confidence_score
    ) VALUES (
      ${address},
      ${queueItem.source},
      ${JSON.stringify(metadata)},
      ${JSON.stringify(metadata)},
      0.9
    )
  `;
}

// =====================================================
// QUEUE STATS
// =====================================================

/**
 * Get validation queue statistics
 *
 * @param db - Database connection
 * @returns Queue stats
 */
export async function getQueueStats(db: any): Promise<{
  pending: number;
  validating: number;
  avgPriority: number;
  oldestPending: Date | null;
}> {
  const result = await db`
    SELECT
      COUNT(*) FILTER (WHERE status = 'pending')::int as pending,
      COUNT(*) FILTER (WHERE status = 'validating')::int as validating,
      AVG(priority) FILTER (WHERE status = 'pending') as avg_priority,
      MIN(submitted_at) FILTER (WHERE status = 'pending') as oldest_pending
    FROM pending_validations
  `;

  return {
    pending: result[0]?.pending || 0,
    validating: result[0]?.validating || 0,
    avgPriority: parseFloat(result[0]?.avg_priority || "0"),
    oldestPending: result[0]?.oldest_pending || null,
  };
}
