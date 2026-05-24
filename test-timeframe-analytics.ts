/**
 * Wallet Activity Analytics Timeframe Testing Script
 *
 * Run this script to test all timeframes and identify data issues:
 * npx tsx test-timeframe-analytics.ts <TOKEN_ADDRESS>
 *
 * It will:
 * 1. Test all 5 time ranges (1h, 24h, 7d, 30d, all)
 * 2. Log what data is fetched/cached
 * 3. Identify missing or inconsistent data
 * 4. Report performance metrics
 */

import { fetchTokenHolders } from "./services/dataService";
import { fetchWalletActivityStats } from "./services/walletActivityService";
import { loadWalletActivityCache, loadAllTransactionsCache } from "./services/db";
import { Token, AssetType, TimeRange } from "./types";

// ANSI color codes for console output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};

interface TestResult {
  timeRange: string;
  success: boolean;
  duration: number;
  cached: boolean;
  stats: any;
  issues: string[];
}

interface TestSummary {
  tokenAddress: string;
  totalDuration: number;
  results: TestResult[];
  overallIssues: string[];
}

function log(color: keyof typeof colors, message: string) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title: string) {
  console.log(`\n${colors.bright}${colors.cyan}${"=".repeat(60)}`);
  console.log(`${title}`);
  console.log(`${"=".repeat(60)}${colors.reset}\n`);
}

function logTimeRange(range: string) {
  console.log(
    `\n${colors.bright}${colors.yellow}Testing Time Range: ${range.toUpperCase()}${colors.reset}`
  );
}

async function testTimeRange(
  token: Token,
  wallets: any[],
  timeRange: TimeRange
): Promise<TestResult> {
  const startTime = Date.now();
  const issues: string[] = [];
  let cached = false;
  let stats = null;
  let success = false;

  logTimeRange(timeRange);

  // Check cache before fetch
  const cachedData = await loadWalletActivityCache(token.address, timeRange);
  if (cachedData) {
    cached = true;
    log("green", `  ✓ Cache HIT before fetch (${timeRange})`);
  } else {
    log("gray", `  ✗ Cache miss - will fetch from API`);
  }

  // Check all transactions cache
  const allTxCache = await loadAllTransactionsCache(token.address);
  if (allTxCache) {
    const remainingTTL = Math.round((allTxCache.expiresAt - Date.now()) / 1000);
    log("blue", `  ✓ All transactions cache available (${remainingTTL}s remaining)`);
  } else {
    log("gray", `  ✗ No all-transactions cache (expected for first run)`);
  }

  // Fetch analytics
  try {
    log("gray", `  Fetching analytics...`);
    stats = await fetchWalletActivityStats(token, wallets, timeRange, (msg) => {
      // Only log significant messages
      if (msg.includes("cache") || msg.includes("instant")) {
        log("cyan", `    → ${msg}`);
      }
    });

    if (!stats) {
      issues.push("No data returned");
      log("red", `  ✗ No data returned`);
    } else {
      success = true;
      const duration = Date.now() - startTime;

      // Analyze the returned data
      log("green", `  ✓ Successfully fetched in ${duration}ms`);

      // Check for data issues
      if (!stats.activityTimeline || stats.activityTimeline.length === 0) {
        issues.push("No activity timeline data");
        log("yellow", `  ⚠ No activity timeline data`);
      } else {
        log("gray", `    Timeline points: ${stats.activityTimeline.length}`);
      }

      if (!stats.flowPatterns || stats.flowPatterns.length === 0) {
        issues.push("No flow patterns data");
        log("yellow", `  ⚠ No flow patterns data`);
      } else {
        log("gray", `    Flow patterns: ${stats.flowPatterns.length}`);
      }

      // Check transaction counts
      const { totalTransactions, transactionTypes } = stats;
      log("gray", `    Total transactions: ${totalTransactions}`);
      log(
        "gray",
        `    Buys: ${transactionTypes.buys}, Sells: ${transactionTypes.sells}, Transfers: ${transactionTypes.transfers}`
      );

      // Verify timeline data has buy/sell counts
      let timelineWithBuySells = 0;
      stats.activityTimeline.forEach((point: any) => {
        if (point.buys > 0 || point.sells > 0) {
          timelineWithBuySells++;
        }
      });

      if (timelineWithBuySells === 0 && totalTransactions > 0) {
        issues.push("Timeline has no buy/sell data despite having transactions");
        log("red", `  ✗ Timeline missing buy/sell breakdown!`);
      } else {
        log(
          "gray",
          `    Timeline with buy/sell data: ${timelineWithBuySells}/${stats.activityTimeline.length} points`
        );
      }

      // Check top buyers/sellers
      if (stats.topBuyers.length === 0) {
        issues.push("No top buyers data");
        log("yellow", `  ⚠ No top buyers`);
      } else {
        log("gray", `    Top buyers: ${stats.topBuyers.length}`);
        // Check first buyer for volume
        if (stats.topBuyers[0]?.totalBuyVolume === 0) {
          issues.push(`Top buyer has 0 buy volume: ${stats.topBuyers[0]?.walletAddress}`);
          log("red", `  ✗ Top buyer #1 has 0 buy volume!`);
        }
      }

      if (stats.topSellers.length === 0) {
        issues.push("No top sellers data");
        log("yellow", `  ⚠ No top sellers`);
      } else {
        log("gray", `    Top sellers: ${stats.topSellers.length}`);
        // Check first seller for volume
        if (stats.topSellers[0]?.totalSellVolume === 0) {
          issues.push(`Top seller has 0 sell volume: ${stats.topSellers[0]?.walletAddress}`);
          log("red", `  ✗ Top seller #1 has 0 sell volume!`);
        }
      }
    }
  } catch (error) {
    issues.push(`Error: ${error}`);
    log("red", `  ✗ Error: ${error}`);
  }

  const duration = Date.now() - startTime;

  return {
    timeRange,
    success,
    duration,
    cached,
    stats,
    issues,
  };
}

async function runFullTest(tokenAddress: string): Promise<TestSummary> {
  logSection("Wallet Activity Analytics - Timeframe Testing");

  // Create token object
  const token: Token = {
    address: tokenAddress,
    name: "Test Token",
    symbol: "TEST",
    type: AssetType.TOKEN,
    decimals: 18,
    totalSupply: 0,
  };

  log("blue", `Token Address: ${tokenAddress}`);
  log("blue", `Testing Time Ranges: 1h, 24h, 7d, 30d, all`);

  // Fetch holders first
  logSection("Step 1: Fetching Token Holders");
  const { wallets } = await fetchTokenHolders(token);
  log("green", `✓ Found ${wallets.length} token holders`);

  if (wallets.length === 0) {
    log("red", "✗ No token holders found - aborting test");
    return {
      tokenAddress,
      totalDuration: 0,
      results: [],
      overallIssues: ["No token holders found"],
    };
  }

  const TIME_RANGES = ["1h", "24h", "7d", "30d", "all"];
  const results: TestResult[] = [];
  const overallIssues: string[] = [];

  // Test each time range
  for (let i = 0; i < TIME_RANGES.length; i++) {
    const timeRange = TIME_RANGES[i] as TimeRange;
    const result = await testTimeRange(token, wallets, timeRange);
    results.push(result);

    // Collect overall issues
    if (!result.success) {
      overallIssues.push(`${timeRange}: Failed to fetch data`);
    }
    result.issues.forEach((issue) => {
      overallIssues.push(`${timeRange}: ${issue}`);
    });

    // Wait a bit between tests to avoid rate limiting
    if (i < TIME_RANGES.length - 1) {
      log("gray", "\n  Waiting 2 seconds before next test...\n");
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  return {
    tokenAddress,
    totalDuration,
    results,
    overallIssues,
  };
}

function printSummary(summary: TestSummary) {
  logSection("Test Results Summary");

  log("blue", `Total Test Duration: ${(summary.totalDuration / 1000).toFixed(2)} seconds`);
  log("blue", `Token: ${summary.tokenAddress}`);

  console.table(
    summary.results.map((r) => ({
      Range: r.timeRange,
      Success: r.success ? "✓" : "✗",
      Cached: r.cached ? "Yes" : "No",
      Duration: `${r.duration}ms`,
      Issues: r.issues.length > 0 ? r.issues.join("; ") : "None",
      Timeline: r.stats?.activityTimeline?.length || 0,
      "Buy/Sell": `${r.stats?.transactionTypes?.buys || 0}/${r.stats?.transactionTypes?.sells || 0}`,
      "Top Buyers": r.stats?.topBuyers?.length || 0,
      "Top Sellers": r.stats?.topSellers?.length || 0,
    }))
  );

  // Overall issues
  if (summary.overallIssues.length > 0) {
    logSection("Issues Found");
    summary.overallIssues.forEach((issue) => {
      log("red", `  ✗ ${issue}`);
    });
  } else {
    logSection("✓ All Tests Passed - No Issues Found");
  }

  // Performance analysis
  logSection("Performance Analysis");
  const cachedResults = summary.results.filter((r) => r.cached);
  const uncachedResults = summary.results.filter((r) => !r.cached);

  if (cachedResults.length > 0) {
    const avgCachedDuration =
      cachedResults.reduce((sum, r) => sum + r.duration, 0) / cachedResults.length;
    log(
      "green",
      `  ✓ Cached loads: ${cachedResults.length} (avg ${avgCachedDuration.toFixed(0)}ms)`
    );
  }

  if (uncachedResults.length > 0) {
    const avgUncachedDuration =
      uncachedResults.reduce((sum, r) => sum + r.duration, 0) / uncachedResults.length;
    log(
      "yellow",
      `  ⚠ Uncached loads: ${uncachedResults.length} (avg ${avgUncachedDuration.toFixed(0)}ms)`
    );
  }

  // Recommendations
  logSection("Recommendations");

  if (summary.overallIssues.length === 0) {
    log("green", "  ✓ All timeframes working correctly!");
  } else {
    log("yellow", "  ⚠ Issues detected - see above for details");
  }

  const allTimelineData = summary.results.every((r) => r.stats?.activityTimeline?.length > 0);
  if (!allTimelineData) {
    log("yellow", "  ⚠ Some timeframes missing timeline data - check transaction fetching");
  }

  const hasBuySells = summary.results.some(
    (r) => r.stats?.transactionTypes?.buys > 0 || r.stats?.transactionTypes?.sells > 0
  );
  if (!hasBuySells) {
    log("red", "  ✗ No buy/sell data detected - transaction classification may be broken");
  }

  const zeroVolumeBuyers = summary.results.filter(
    (r) => r.stats?.topBuyers?.[0]?.totalBuyVolume === 0
  );
  if (zeroVolumeBuyers.length > 0) {
    log(
      "red",
      `  ✗ Top buyers with 0 volume in: ${zeroVolumeBuyers.map((r) => r.timeRange).join(", ")}`
    );
  }
}

// Main execution
async function main() {
  // Default to DC token if no address provided
  const tokenAddress = process.argv[2] || "0x7B4328c127B85369D9f82ca0503B000D09CF9180";

  if (!tokenAddress) {
    console.error("Usage: npx tsx test-timeframe-analytics.ts <TOKEN_ADDRESS>");
    console.error(
      "\nExample: npx tsx test-timeframe-analytics.ts 0x1234567890abcdef1234567890abcdef12345678"
    );
    console.error("\nOr test with DC token:");
    console.error("  npm run test:timeframes");
    console.error(
      "  npx tsx test-timeframe-analytics.ts 0x7B4328c127B85369D9f82ca0503B000D09CF9180"
    );
    process.exit(1);
  }

  try {
    const summary = await runFullTest(tokenAddress);
    printSummary(summary);

    // Exit with error code if issues found
    if (summary.overallIssues.length > 0) {
      process.exit(1);
    }
  } catch (error) {
    log("red", `Fatal error: ${error}`);
    console.error(error);
    process.exit(1);
  }
}

main();
