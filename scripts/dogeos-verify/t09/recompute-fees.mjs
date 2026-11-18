// Recompute the seed fees correctly: debit - tx.value (a DOGE transfer's fee excludes the value moved).
// The first pass forgot to subtract value for the one DOGE transfer in the batch.
import { JsonRpcProvider, formatEther } from "ethers";
import { readFileSync, writeFileSync } from "node:fs";
const p = new JsonRpcProvider("https://rpc.testnet.dogeos.com/", 6281971, { staticNetwork: true });
const seed = JSON.parse(readFileSync("seed-result.json", "utf8"));
const deploy = JSON.parse(readFileSync("deploy-result.json", "utf8"));
async function refee(hash) {
  const tx = await p.getTransaction(hash);
  const rc = await p.getTransactionReceipt(hash);
  const n = rc.blockNumber;
  const b0 = await p.getBalance(tx.from, n - 1);
  const b1 = await p.getBalance(tx.from, n);
  const debit = b0 - b1;
  const fee = debit - tx.value; // fee only, value excluded
  return { block: n, gasUsed: rc.gasUsed.toString(), declared: rc.gasUsed * (rc.gasPrice ?? 0n),
    declaredDOGE: formatEther(rc.gasUsed * (rc.gasPrice ?? 0n)), value: tx.value.toString(),
    realRawDebit: debit.toString(), realFee: fee.toString(), realFeeDOGE: formatEther(fee),
    ratio: Number(fee) / Number(rc.gasUsed * (rc.gasPrice ?? 1n)), weiPerGas: (fee / rc.gasUsed).toString() };
}
for (const t of seed.transfers) {
  const r = await refee(t.hash);
  t.block = r.block; t.gasUsed = r.gasUsed; t.realFee_wei = r.realFee; t.realFee_DOGE = r.realFeeDOGE;
  t.realRawDebit_wei = r.realRawDebit; t.txValue_wei = r.value; t.declaredCost_wei = r.declared;
  t.declaredCost_DOGE = r.declaredDOGE; t.ratio = r.ratio; t.weiPerGas = r.weiPerGas;
  console.log(`${t.label.padEnd(40)} fee ${r.realFeeDOGE.padStart(20)} DOGE  ratio ${r.ratio.toFixed(0)}  wei/gas ${r.weiPerGas}`);
}
deploy.weiPerGas = deploy.realWeiPerGas;
writeFileSync("seed-result.json", JSON.stringify(seed, (k,v)=> typeof v==="bigint" ? v.toString() : v, 2));
const tot = seed.transfers.reduce((a, t) => a + Number(t.realFee_DOGE), 0);
console.log("seed fee total (excl. value)", tot.toFixed(18), "DOGE");
