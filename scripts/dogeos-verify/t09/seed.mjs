// Seed the deployed T09P token on Chikyū with real transfers from the operator's funded
// testnet keys. Records every hash + the real DOGE fee debit from balance deltas.
import { JsonRpcProvider, Wallet, Contract, formatEther, formatUnits, parseUnits } from "ethers";
import { readFileSync, writeFileSync } from "node:fs";
import os from "node:os";

const RPC = "https://rpc.testnet.dogeos.com/";
const TOKEN = "0x12525A2Ab363005D2Ad7D931B06B804bEbDeBc27";
const ABI = JSON.parse(readFileSync("./T09ProofToken.abi", "utf8"));
const KEYS = {
  deployer: `${os.homedir()}/.chikyu-deployer/deployer.json`,
  author: `${os.homedir()}/.chikyu-deployer/author.json`,
  forwarder: `${os.homedir()}/.chikyu-deployer/forwarder.json`,
  tipper: `${os.homedir()}/.chikyu-deployer/tipper.json`,
};
const load = (p) => readFileSync(p, "utf8").match(/0x[0-9a-fA-F]{64}/)[0];

const provider = new JsonRpcProvider(RPC, 6281971, { staticNetwork: true });
const w = {};
for (const [k, p] of Object.entries(KEYS)) w[k] = new Wallet(load(p), provider);
const token = new Contract(TOKEN, ABI, provider);
const log = [];

async function fee(hash) {
  const tx = await provider.getTransaction(hash);
  const rc = await provider.getTransactionReceipt(hash);
  const n = rc.blockNumber;
  const b0 = await provider.getBalance(tx.from, n - 1);
  const b1 = await provider.getBalance(tx.from, n);
  return {
    block: n, status: rc.status, gasUsed: rc.gasUsed.toString(),
    declaredCost_wei: (rc.gasUsed * (rc.gasPrice ?? 0n)).toString(),
    declaredCost_DOGE: formatEther(rc.gasUsed * (rc.gasPrice ?? 0n)),
    // fee only: subtract the value moved, or a DOGE transfer looks ~4x more expensive than it is
    realFee_wei: (b0 - b1 - tx.value).toString(), realFee_DOGE: formatEther(b0 - b1 - tx.value),
    ratio: rc.gasPrice ? Number(b0 - b1 - tx.value) / Number(rc.gasUsed * rc.gasPrice) : null,
  };
}

async function send(label, from, action) {
  const before = await provider.getBalance(w[from].address);
  const tx = await action();
  const rc = await tx.wait();
  const f = await fee(tx.hash);
  const rec = { label, from: w[from].address, hash: tx.hash, ...f,
    dogeBefore: formatEther(before), dogeAfter: formatEther(await provider.getBalance(w[from].address)) };
  log.push(rec);
  console.log(JSON.stringify(rec));
  return rec;
}

// 1. top the deployer back up from forwarder so it can pay for the three seed transfers
await send("doge forwarder->deployer 0.08", "forwarder", () =>
  w.forwarder.sendTransaction({ to: w.deployer.address, value: parseUnits("0.08", 18), gasLimit: 40000n, gasPrice: 1000000000n }));

// 2-4. seed three holders
const seed = (name, amount) => () =>
  new Contract(TOKEN, ABI, w.deployer).transfer(w[name].address, parseUnits(amount, 18), { gasLimit: 120000n, gasPrice: 1000000000n });
await send("token deployer->author 250000", "deployer", seed("author", "250000"));
await send("token deployer->forwarder 250000", "deployer", seed("forwarder", "250000"));
await send("token deployer->tipper 200000", "deployer", seed("tipper", "200000"));

// 5-7. holder-to-holder transfers so the graph has real edges (not a star)
const hop = (from, to, amount) => () =>
  new Contract(TOKEN, ABI, w[from]).transfer(w[to].address, parseUnits(amount, 18), { gasLimit: 120000n, gasPrice: 1000000000n });
await send("token author->tipper 60000", "author", hop("author", "tipper", "60000"));
await send("token tipper->forwarder 40000", "tipper", hop("tipper", "forwarder", "40000"));
await send("token forwarder->author 25000", "forwarder", hop("forwarder", "author", "25000"));

// final holder table straight from the contract
const holders = [];
for (const [k, wallet] of Object.entries(w)) {
  holders.push({ role: k, address: wallet.address, balance: formatUnits(await token.balanceOf(wallet.address), 18),
    doge: formatEther(await provider.getBalance(wallet.address)) });
}
const out = { token: TOKEN, chainId: 6281971, transfers: log, holders: holders.sort((a, b) => Number(b.balance) - Number(a.balance)) };
console.log("\n=== HOLDERS ===");
for (const h of out.holders) console.log(`${h.address}  ${h.balance} T09P  (${h.doge} DOGE)  role=${h.role}`);
writeFileSync("seed-result.json", JSON.stringify(out, null, 2));
