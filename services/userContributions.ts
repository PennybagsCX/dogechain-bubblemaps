/**
 * User Contributions Service
 *
 * Manages community-submitted tokens and metadata corrections.
 * Crowdsources token database expansion through user contributions.
 */

import { AssetType } from "../types";

// =====================================================
// TOKEN SUBMISSION
// =====================================================

export interface TokenSubmission {
  contractAddress: string;
  name: string;
  symbol: string;
  decimals: number;
  type: AssetType;
  contributorId: string; // Anonymous hash
  metadata?: {
    description?: string;
    website?: string;
    twitter?: string;
    telegram?: string;
    logoUrl?: string;
  };
}

/**
 * Submit a new token to the community database
 *
 * @param submission - Token submission data
 * @returns Success status
 */
export async function submitToken(submission: TokenSubmission): Promise<boolean> {
  try {
    // Validate submission
    if (!validateTokenSubmission(submission)) {
      throw new Error("Invalid token submission");
    }

    // Verify contract via Blockscout
    const verified = await verifyContract(submission.contractAddress);
    if (!verified) {
      throw new Error("Contract verification failed");
    }

    // Send to server
    const apiEndpoint = import.meta.env.VITE_ANALYTICS_API_ENDPOINT || "/api/contributions/submit";

    const response = await fetch(apiEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...submission,
        contributionType: "add_token",
        timestamp: Date.now(),
      }),
    });

    if (!response.ok && response.status !== 404) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return true;
  } catch {
    // Error handled silently

    return false;
  }
}

/**
 * Submit metadata correction for existing token
 */
export async function submitMetadataCorrection(
  contractAddress: string,
  corrections: {
    name?: string;
    symbol?: string;
    description?: string;
  }
): Promise<boolean> {
  try {
    const apiEndpoint = import.meta.env.VITE_ANALYTICS_API_ENDPOINT || "/api/contributions/submit";

    const response = await fetch(apiEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tokenAddress: contractAddress,
        contributionType: "fix_metadata",
        corrections,
        timestamp: Date.now(),
      }),
    });

    if (!response.ok && response.status !== 404) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return true;
  } catch {
    // Error handled silently

    return false;
  }
}

/**
 * Vote on metadata correction (crowdsourcing)
 */
export async function voteOnCorrection(
  contributionId: string,
  vote: "upvote" | "downvote"
): Promise<boolean> {
  try {
    const apiEndpoint = import.meta.env.VITE_ANALYTICS_API_ENDPOINT || "/api/contributions/vote";

    const response = await fetch(apiEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contributionId,
        vote,
        timestamp: Date.now(),
      }),
    });

    if (!response.ok && response.status !== 404) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return true;
  } catch {
    // Error handled silently

    return false;
  }
}

// =====================================================
// VERIFICATION
// =====================================================

/**
 * Verify contract exists via Blockscout API
 */
async function verifyContract(contractAddress: string): Promise<boolean> {
  try {
    const response = await fetch(
      `https://explorer.dogechain.dog/api/v2/smart-contracts/${contractAddress}`
    );

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    return !!(data && data.address);
  } catch {
    // Error handled silently

    return false;
  }
}

/**
 * Validate token submission data
 */
function validateTokenSubmission(submission: TokenSubmission): boolean {
  // Validate address format
  const addressRegex = /^0x[a-f0-9]{40}$/i;
  if (!addressRegex.test(submission.contractAddress)) {
    return false;
  }

  // Validate required fields
  if (
    !submission.name ||
    !submission.symbol ||
    submission.name.length > 100 ||
    submission.symbol.length > 20
  ) {
    return false;
  }

  // Validate decimals
  if (
    typeof submission.decimals !== "number" ||
    submission.decimals < 0 ||
    submission.decimals > 18
  ) {
    return false;
  }

  // Validate type
  if (submission.type !== AssetType.TOKEN && submission.type !== AssetType.NFT) {
    return false;
  }

  return true;
}

// =====================================================
// CONTRIBUTOR ID
// =====================================================

/**
 * Generate anonymous contributor ID
 * One-way hash of browser fingerprint
 */
export function generateContributorId(): string {
  // Simple hash of browser fingerprint (for demo purposes)
  // In production, use proper anonymous identifier
  const fingerprint = `${navigator.userAgent}-${navigator.language}-${screen.width}x${screen.height}`;

  // Simple hash function
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Return hex string
  return Math.abs(hash).toString(16).padStart(16, "0");
}
