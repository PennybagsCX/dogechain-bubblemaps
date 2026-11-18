// Deploy T09ProofToken to DogeOS Chikyū (6281971) with ethers v6 ContractFactory.
// forge --broadcast silently dry-runs on this chain, so broadcasting happens here and the
// hash is verified against the RPC + blockscout afterwards. Never prints the private key.
import { JsonRpcProvider, Wallet, ContractFactory, formatEther, formatUnits } from "ethers";
import { readFileSync, writeFileSync } from "node:fs";
import os from "node:os";

const RPC = "https://rpc.testnet.dogeos.com/";
const CHAIN_ID = 6281971;
const KEYFILE = `${os.homedir()}/.chikyu-deployer/deployer.json`;
const ABI = JSON.parse(readFileSync("./T09ProofToken.abi", "utf8"));
const BYTECODE = "0x" + readFileSync("./T09ProofToken.bin", "utf8").trim();
const SUPPLY = 1_000_000n * 10n ** 18n; // 1,000,000 T09P

function loadKey(path) {
  const raw = readFileSync(path, "utf8");
  const m = raw.match(/0x[0-9a-fA-F]{64}/);
  if (!m) throw new Error("no 32-byte key in " + path);
  return m[0];
}

const provider = new JsonRpcProvider(RPC, CHAIN_ID, { staticNetwork: true });
const wallet = new Wallet(loadKey(KEYFILE), provider);
const net = await provider.getNetwork();
if (Number(net.chainId) !== CHAIN_ID) throw new Error("wrong chain " + net.chainId);

const factory = new ContractFactory(ABI, BYTECODE, wallet);
const deployTxReq = await factory.getDeployTransaction(SUPPLY);
const estimate = await provider.estimateGas({ ...deployTxReq, from: wallet.address });
const gasLimit = (estimate * 105n) / 100n;

const balBefore = await provider.getBalance(wallet.address);
console.log(JSON.stringify({
  step: "preflight",
  chainId: Number(net.chainId),
  deployer: wallet.address,
  initcodeBytes: (BYTECODE.length - 2) / 2,
  estimateGas: estimate.toString(),
  gasLimit: gasLimit.toString(),
  balanceBefore_DOGE: formatEther(balBefore),
}, null, 2));

const tx = await factory.deploy(SUPPLY, { gasLimit, gasPrice: 1_000_000_000n });
console.log(JSON.stringify({ step: "broadcast", hash: tx.hash, nonce: tx.nonce, gasPrice: tx.gasPrice?.toString() }, null, 2));
const rc = await tx.wait();
const balAfter = await provider.getBalance(wallet.address);
const token = await rc.contractAddress;
const code = await provider.getCode(token);
const c = new (await import("ethers")).Contract(token, ABI, provider);
const [name, symbol, decimals, totalSupply, balDeployer] = await Promise.all([
  c.name(), c.symbol(), c.decimals(), c.totalSupply(), c.balanceOf(wallet.address),
]);

const debit = balBefore - balAfter;
const out = {
  step: "deployed",
  chainId: Number(net.chainId),
  deployer: wallet.address,
  token,
  hash: tx.hash,
  block: rc.blockNumber,
  status: rc.status,
  gasUsed: rc.gasUsed.toString(),
  gasLimit: gasLimit.toString(),
  effectiveGasPrice: rc.effectiveGasPrice?.toString() ?? null,
  declaredCost_wei: (rc.gasUsed * 1_000_000_000n).toString(),
  realDebit_wei: debit.toString(),
  realDebit_DOGE: formatEther(debit),
  realDebit_ratio_to_declared: Number(debit) / Number(rc.gasUsed * 1_000_000_000n),
  balanceBefore_DOGE: formatEther(balBefore),
  balanceAfter_DOGE: formatEther(balAfter),
  codeBytes: (code.length - 2) / 2,
  onchain: { name, symbol, decimals: Number(decimals), totalSupply: formatUnits(totalSupply, 18), deployerBalance: formatUnits(balDeployer, 18) },
};
console.log(JSON.stringify(out, null, 2));
writeFileSync("./deploy-result.json", JSON.stringify(out, null, 2));
