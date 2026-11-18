import { JsonRpcProvider, Contract, formatEther, formatUnits } from "ethers";
import { readFileSync, writeFileSync } from "node:fs";
const H="0x5a8a5ce80b12ce388a6e3cb8cddc654fffaca13399f71af5830a0fff85efa368";
const ABI=JSON.parse(readFileSync("./T09ProofToken.abi","utf8"));
const p=new JsonRpcProvider("https://rpc.testnet.dogeos.com/",6281971,{staticNetwork:true});
const tx=await p.getTransaction(H); const rc=await p.getTransactionReceipt(H);
const n=rc.blockNumber;
const b0=await p.getBalance(tx.from,n-1); const b1=await p.getBalance(tx.from,n);
const code=await p.getCode(rc.contractAddress);
const c=new Contract(rc.contractAddress,ABI,p);
const [name,symbol,decimals,totalSupply,bal]=await Promise.all([c.name(),c.symbol(),c.decimals(),c.totalSupply(),c.balanceOf(tx.from)]);
const debit=b0-b1;
const out={
  deployer:tx.from, token:rc.contractAddress, hash:H, block:n, status:rc.status,
  gasLimit:tx.gasLimit.toString(), gasUsed:rc.gasUsed.toString(),
  receiptEffectiveGasPrice: rc.gasPrice?.toString() ?? null,
  declaredCostAtReceiptPrice_wei: (rc.gasUsed*rc.gasPrice).toString(),
  declaredCostAtReceiptPrice_DOGE: formatEther(rc.gasUsed*rc.gasPrice),
  realBalanceDelta_wei: debit.toString(), realBalanceDelta_DOGE: formatEther(debit),
  realWeiPerGas: (debit/(rc.gasUsed)).toString(),
  ratio_real_to_receipt: Number(debit)/Number(rc.gasUsed*rc.gasPrice),
  balanceBefore_DOGE: formatEther(b0), balanceAfter_DOGE: formatEther(b1),
  codeBytes:(code.length-2)/2,
  onchain:{name,symbol,decimals:Number(decimals),totalSupply:formatUnits(totalSupply,18),deployerBalance:formatUnits(bal,18)}
};
console.log(JSON.stringify(out,null,2));
writeFileSync("deploy-result.json",JSON.stringify(out,null,2));
