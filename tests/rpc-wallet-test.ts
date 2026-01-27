/**
 * Test file for RPC wallet transaction monitoring
 * This file demonstrates the usage of the new wallet monitoring methods
 */

import { DogechainRPCClient } from "../services/dogechainRPC";

async function testWalletTransactionMonitoring() {
  const rpcClient = new DogechainRPCClient();

  // Test 1: Get latest block
  console.log("Test 1: Getting latest block...");
  const latestBlock = await rpcClient.getLatestBlock();
  console.log(`Latest block: ${latestBlock.number}, timestamp: ${latestBlock.timestamp}`);

  // Test 2: Get wallet transactions (default range - last 1000 blocks)
  console.log("\nTest 2: Getting wallet transactions for default range...");
  const testWallet = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0"; // Example wallet
  const walletTxs = await rpcClient.getWalletTransactions(testWallet);
  console.log(`Found ${walletTxs.length} transactions for wallet`);

  // Test 3: Get wallet transactions with custom range
  console.log("\nTest 3: Getting wallet transactions with custom range...");
  const fromBlock = latestBlock.number - BigInt(100);
  const toBlock = latestBlock.number;
  const customRangeTxs = await rpcClient.getWalletTransactions(testWallet, {
    fromBlock,
    toBlock,
    maxResults: 50,
  });
  console.log(`Found ${customRangeTxs.length} transactions in custom range`);

  // Test 4: Get wallet transactions for specific token
  console.log("\nTest 4: Getting token-specific transactions...");
  const testToken = "0xb7ddc6414bf4f5515b52d8bdd69973ae205ff101"; // Example token
  const tokenTxs = await rpcClient.getWalletTokenTransactions(testWallet, testToken, {
    fromBlock,
    toBlock,
    maxResults: 20,
  });
  console.log(`Found ${tokenTxs.length} token-specific transactions`);

  // Test 5: Calculate optimal block ranges
  console.log("\nTest 5: Calculating optimal block ranges...");
  const ranges = rpcClient.calculateOptimalBlockRange(
    latestBlock.number - BigInt(15000),
    latestBlock.number
  );
  console.log(`Split into ${ranges.length} ranges:`);
  ranges.forEach((range, i) => {
    console.log(`  Range ${i + 1}: ${range.from} -> ${range.to} (${range.size} blocks)`);
  });

  // Test 6: Estimate blocks for timeframe
  console.log("\nTest 6: Estimating blocks for timeframe...");
  const minutes = 10;
  const estimatedBlocks = rpcClient.estimateBlocksForTimeframe(minutes);
  console.log(`Estimated ${estimatedBlocks} blocks for ${minutes} minutes`);

  console.log("\nAll tests completed successfully!");
}

// Run tests if executed directly
if (require.main === module) {
  testWalletTransactionMonitoring().catch(console.error);
}

export { testWalletTransactionMonitoring };
