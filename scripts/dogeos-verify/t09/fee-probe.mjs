// Fee probe: send one tiny DOGE transfer from the Chikyū deployer key and measure the
// REAL debit from balance deltas (receipts on this chain understate the fee by ~4-5 orders).
// Never prints the private key.
import { JsonRpcProvider, Wallet, parseEther, formatEther } from "ethers";
import { readFileSync } from "node:fs";
import os from "node:os";

const RPC = "https://rpc.testnet.dogeos.com/";
const KEYFILE = process.argv[2] ?? `${os.homedir()}/.chikyu-deployer/deployer.json`;
const TO = process.argv[3];
const VALUE = process.argv[4] ?? "0.001";
const GASPRICE_GWEI = process.argv[5] ?? "1";

function loadKey(path) {
  const raw = readFileSync(path, "utf8");
  const m = raw.match(/0x[0-9a-fA-F]{64}/);
  if (!m) throw new Error("no 32-byte key in " + path);
  return m[0];
}

const provider = new JsonRpcProvider(RPC, 6281971, { staticNetwork: true });
const wallet = new Wallet(loadKey(KEYFILE), provider);
const before = await provider.getBalance(wallet.address);

const fee = await provider.getFeeData();
console.log("feeData", { gasPrice: fee.gasPrice?.toString(), maxFee: fee.maxFeePerGas?.toString(), base: (await provider.getBlock("latest")).baseFeePerGas?.toString() });

const tx = await wallet.sendTransaction({
  to: TO,
  value: parseEther(VALUE),
  gasLimit: 30000n,
  gasPrice: BigInt(Math.round(Number(GASPRICE_GWEI) * 1e9)),
});
console.log("sent", tx.hash);
const rc = await tx.wait();
const after = await provider.getBalance(wallet.address);
const valueWei = parseEther(VALUE);
const debit = before - after - valueWei;
console.log(JSON.stringify({
  hash: tx.hash,
  block: rc.blockNumber,
  status: rc.status,
  gasUsed: rc.gasUsed.toString(),
  effectiveGasPrice: rc.effectiveGasPrice?.toString() ?? null,
  declaredCost_wei: (rc.gasUsed * (rc.effectiveGasPrice ?? 0n)).toString(),
  realDebit_wei: debit.toString(),
  realDebit_DOGE: formatEther(debit),
  ratio_real_to_declared: rc.effectiveGasPrice ? Number(debit) / Number(rc.gasUsed * rc.effectiveGasPrice) : null,
  sender: wallet.address,
  balanceBefore_DOGE: formatEther(before),
  balanceAfter_DOGE: formatEther(after),
}, null, 2));
