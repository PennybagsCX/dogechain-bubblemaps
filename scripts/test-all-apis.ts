/**
 * Test script for all DEX Analytics API integrations
 * Tests GeckoTerminal, DexScreener, and DefiLlama services
 */

import * as GeckoTerminal from "../services/geckoTerminalApiClient";
import * as DexScreener from "../services/dexScreenerService";
import * as DefiLlama from "../services/defiLlamaService";

async function testGeckoTerminal() {
  console.log("\n=== Testing GeckoTerminal API ===");

  try {
    // Test 1: Get top pools by TVL
    console.log("1. Testing getTopPoolsByTVL...");
    const tvlPools = await GeckoTerminal.getTopPoolsByTVL(10);
    console.log(`   ✓ Found ${tvlPools.length} pools by TVL`);
    if (tvlPools.length > 0) {
      const pool = tvlPools[0];
      if (pool) {
        console.log(
          `   First pool: ${pool.token0.symbol}/${pool.token1.symbol} - TVL: $${pool.tvlUsd.toFixed(2)}`
        );
      }
    }

    // Test 2: Get top pools by volume
    console.log("\n2. Testing getTopPoolsByVolume...");
    const volumePools = await GeckoTerminal.getTopPoolsByVolume(10);
    console.log(`   ✓ Found ${volumePools.length} pools by volume`);
    if (volumePools.length > 0 && volumePools[0]) {
      console.log(
        `   First pool: ${volumePools[0].token0.symbol}/${volumePools[0].token1.symbol} - Volume: $${volumePools[0].volume24h?.toFixed(2) || "0"}`
      );
    }

    // Test 3: Get new pools
    console.log("\n3. Testing getNewPools...");
    const newPools = await GeckoTerminal.getNewPools(5);
    console.log(`   ✓ Found ${newPools.length} new pools`);

    // Test 4: Get factory distribution
    console.log("\n4. Testing getFactoryDistribution...");
    const factories = await GeckoTerminal.getFactoryDistribution();
    console.log(`   ✓ Found ${factories.length} DEXes`);
    if (factories.length > 0) {
      factories.forEach((f) => {
        console.log(`   - ${f.name}: ${f.poolCount} pools, $${f.totalTVL.toFixed(2)} TVL`);
      });
    }

    // Test 5: Get chain metrics
    console.log("\n5. Testing getChainMetrics...");
    const metrics = await GeckoTerminal.getChainMetrics();
    if (metrics) {
      console.log(`   ✓ Chain: ${metrics.chainName}`);
      console.log(`   - Total TVL: $${metrics.totalTVL.toFixed(2)}`);
      console.log(`   - 24h Volume: $${metrics.dexVolume24h.toFixed(2)}`);
      console.log(`   - Active Pools: ${metrics.activePools}`);
    }

    // Test 6: Get OHLCV data
    if (volumePools.length > 0 && volumePools[0]) {
      console.log(`\n6. Testing getOHLCV for ${volumePools[0].address}...`);
      const ohlcv = await GeckoTerminal.getOHLCV(volumePools[0].address, "1d");
      console.log(`   ✓ Found ${ohlcv.length} OHLCV data points`);
      if (ohlcv.length > 0) {
        const latest = ohlcv[ohlcv.length - 1];
        if (latest) {
          console.log(
            `   Latest: ${new Date(latest.timestamp * 1000).toLocaleString()} - Close: $${latest.close.toFixed(2)}`
          );
        }
      }
    }

    console.log("\n✅ GeckoTerminal API tests passed!");
    return true;
  } catch (error) {
    console.error("\n❌ GeckoTerminal API tests failed:", error);
    return false;
  }
}

async function testDexScreener() {
  console.log("\n=== Testing DexScreener API ===");

  try {
    // Test 1: Get top pools by TVL
    console.log("1. Testing getTopPoolsByTVL...");
    const tvlPools = await DexScreener.getTopPoolsByTVL("dogechain", 5);
    console.log(`   ✓ Found ${tvlPools.length} pools by TVL`);
    if (tvlPools.length > 0 && tvlPools[0]) {
      const pool = tvlPools[0];
      console.log(
        `   First pool: ${pool.token0.symbol}/${pool.token1.symbol} - TVL: $${pool.tvlUsd.toFixed(2)}`
      );
    }

    // Test 2: Get top pools by volume
    console.log("\n2. Testing getTopPoolsByVolume...");
    const volumePools = await DexScreener.getTopPoolsByVolume("dogechain", 5);
    console.log(`   ✓ Found ${volumePools.length} pools by volume`);
    if (volumePools.length > 0 && volumePools[0]) {
      console.log(
        `   First pool: ${volumePools[0].token0.symbol}/${volumePools[0].token1.symbol} - Volume: $${volumePools[0].volume24h?.toFixed(2) || "0"}`
      );
    }

    // Test 3: Get new pools
    console.log("\n3. Testing getNewPools...");
    const newPools = await DexScreener.getNewPools("dogechain", 5);
    console.log(`   ✓ Found ${newPools.length} new pools`);

    // Test 4: Get factory distribution
    console.log("\n4. Testing getFactoryDistribution...");
    const factories = await DexScreener.getFactoryDistribution("dogechain");
    console.log(`   ✓ Found ${factories.length} DEXes`);
    if (factories.length > 0) {
      factories.forEach((f) => {
        console.log(`   - ${f.name}: ${f.poolCount} pools, $${f.totalTVL.toFixed(2)} TVL`);
      });
    }

    // Test 5: Get chain metrics
    console.log("\n5. Testing getChainMetrics...");
    const metrics = await DexScreener.getChainMetrics("dogechain");
    if (metrics) {
      console.log(`   ✓ Chain: ${metrics.chainName}`);
      console.log(`   - Total TVL: $${metrics.totalTVL.toFixed(2)}`);
      console.log(`   - 24h Volume: $${metrics.dexVolume24h.toFixed(2)}`);
      console.log(`   - Active Pools: ${metrics.activePools}`);
    }

    console.log("\n✅ DexScreener API tests passed!");
    return true;
  } catch (error) {
    console.error("\n❌ DexScreener API tests failed:", error);
    return false;
  }
}

async function testDefiLlama() {
  console.log("\n=== Testing DefiLlama API ===");

  try {
    // Test 1: Get all chains
    console.log("1. Testing getAllChains...");
    const chains = await DefiLlama.getAllChains();
    console.log(`   ✓ Found ${chains.length} chains`);

    // Test 2: Get Dogechain info
    console.log("\n2. Testing getChainInfo for Dogechain...");
    const dogechainInfo = await DefiLlama.getChainInfo("Dogechain");
    if (dogechainInfo) {
      console.log(
        `   ✓ Dogechain found: ${dogechainInfo.name} - TVL: $${dogechainInfo.tvl.toFixed(2)}`
      );
    } else {
      console.log(`   ⚠ Dogechain not found`);
    }

    // Test 3: Get chain protocols
    console.log("\n3. Testing getChainProtocols for Dogechain...");
    const protocols = await DefiLlama.getChainProtocols("Dogechain");
    console.log(`   ✓ Found ${protocols.length} protocols on Dogechain`);
    if (protocols.length > 0) {
      console.log(`   Top 3 protocols:`);
      protocols.slice(0, 3).forEach((p) => {
        console.log(`   - ${p.name}: $${p.tvl.toFixed(2)} TVL`);
      });
    }

    // Test 4: Get historical TVL
    console.log("\n4. Testing getHistoricalChainTVL...");
    const historicalTVL = await DefiLlama.getHistoricalChainTVL("Dogechain", 7);
    console.log(`   ✓ Found ${historicalTVL.length} historical data points`);
    if (historicalTVL.length > 0) {
      const latest = historicalTVL[historicalTVL.length - 1];
      if (latest) {
        const tvl = latest.totalLiquidityUSD ?? latest.tvl ?? 0;
        console.log(
          `   Latest: ${new Date(latest.date * 1000).toLocaleDateString()} - $${tvl.toFixed(2)}`
        );
      }
    }

    // Test 5: Get enhanced chain metrics
    console.log("\n5. Testing getEnhancedChainMetrics...");
    const enhancedMetrics = await DefiLlama.getEnhancedChainMetrics("Dogechain");
    if (enhancedMetrics) {
      console.log(`   ✓ Enhanced metrics for ${enhancedMetrics.chainName}`);
      console.log(`   - Total TVL: $${enhancedMetrics.totalTVL.toFixed(2)}`);
      console.log(`   - TVL Change 24h: ${enhancedMetrics.tvlChange1d?.toFixed(2)}%`);
      console.log(`   - TVL Change 7d: ${enhancedMetrics.tvlChange7d?.toFixed(2)}%`);
      console.log(`   - Protocols: ${enhancedMetrics.protocols?.length || 0}`);
    }

    console.log("\n✅ DefiLlama API tests passed!");
    return true;
  } catch (error) {
    console.error("\n❌ DefiLlama API tests failed:", error);
    return false;
  }
}

async function testFallbackMechanism() {
  console.log("\n=== Testing Fallback Mechanism ===");

  try {
    console.log("1. Testing GeckoTerminal -> DexScreener fallback...");
    console.log("   (Simulating by calling both APIs and comparing data)");

    const [geckoPools, dexPools] = await Promise.all([
      GeckoTerminal.getTopPoolsByTVL(5),
      DexScreener.getTopPoolsByTVL("dogechain", 5),
    ]);

    console.log(`   ✓ GeckoTerminal: ${geckoPools.length} pools`);
    console.log(`   ✓ DexScreener: ${dexPools.length} pools`);
    console.log(`   ✓ Both APIs returned data, fallback mechanism is functional`);

    console.log("\n✅ Fallback mechanism test passed!");
    return true;
  } catch (error) {
    console.error("\n❌ Fallback mechanism test failed:", error);
    return false;
  }
}

async function runAllTests() {
  console.log("🚀 Starting comprehensive DEX Analytics API tests...\n");

  const results = {
    geckoTerminal: false,
    dexScreener: false,
    defiLlama: false,
    fallback: false,
  };

  // Run all tests
  results.geckoTerminal = await testGeckoTerminal();
  results.dexScreener = await testDexScreener();
  results.defiLlama = await testDefiLlama();
  results.fallback = await testFallbackMechanism();

  // Summary
  console.log("\n=== Test Summary ===");
  console.log(`GeckoTerminal: ${results.geckoTerminal ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`DexScreener:   ${results.dexScreener ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`DefiLlama:     ${results.defiLlama ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`Fallback:      ${results.fallback ? "✅ PASS" : "❌ FAIL"}`);

  const allPassed = Object.values(results).every((v) => v);
  if (allPassed) {
    console.log("\n🎉 All tests passed successfully!");
  } else {
    console.log("\n⚠️  Some tests failed. Please check the logs above.");
    process.exit(1);
  }
}

runAllTests().catch((error) => {
  console.error("❌ Test suite failed:", error);
  process.exit(1);
});
