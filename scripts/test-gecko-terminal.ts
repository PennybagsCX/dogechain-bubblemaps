/**
 * Test script for GeckoTerminal API client
 */

import * as GeckoTerminal from "../services/geckoTerminalApiClient";

async function testGeckoTerminalClient() {
  console.log("Testing GeckoTerminal API Client...\n");

  // Test 1: Get top pools by TVL
  console.log("1. Testing getTopPoolsByTVL...");
  const tvlPools = await GeckoTerminal.getTopPoolsByTVL(5);
  console.log(`   ✓ Found ${tvlPools.length} pools by TVL`);
  if (tvlPools.length > 0 && tvlPools[0]) {
    const pool = tvlPools[0];
    console.log(
      `   First pool: ${pool.token0.symbol}/${pool.token1.symbol} - TVL: $${pool.tvlUsd.toFixed(2)}`
    );
  }

  // Test 2: Get top pools by volume
  console.log("\n2. Testing getTopPoolsByVolume...");
  const volumePools = await GeckoTerminal.getTopPoolsByVolume(5);
  console.log(`   ✓ Found ${volumePools.length} pools by volume`);
  if (volumePools.length > 0 && volumePools[0]) {
    const pool = volumePools[0];
    console.log(
      `   First pool: ${pool.token0.symbol}/${pool.token1.symbol} - 24h Volume: $${pool.volume24h?.toFixed(2) || "0"}`
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

  // Test 6: Get OHLCV data (if we have a pool)
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

  console.log("\n✅ All tests passed!");
}

testGeckoTerminalClient().catch((error) => {
  console.error("❌ Test failed:", error);
  process.exit(1);
});
