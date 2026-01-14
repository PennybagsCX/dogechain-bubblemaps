import { GoogleGenAI } from "@google/genai";
import { Wallet, Transaction, AssetType } from "../types";

const MODEL_NAME = "gemini-3-flash-preview";

// Check if AI features are enabled (API key configured server-side)
const isAIEnabled = (): boolean => {
  // AI features require backend proxy - disabled for security
  return false;
};

const getAIUnavailableMessage = (): string => {
  return "AI features are currently disabled. Please configure the backend API proxy.";
};

// List of addresses that should be excluded from "Whale Risk" calculations
// 1. Null Address
// 2. Dead Address (Burn)
// 3. Dogechain Bridge
const INFRASTRUCTURE_ADDRESSES = [
  "0x0000000000000000000000000000000000000000",
  "0x000000000000000000000000000000000000dead",
  "0x352569c5392c81d2442d66608f4755b967420729",
];

export const createWalletChatSystemInstruction = (
  wallet: Wallet,
  transactions: Transaction[],
  tokenName: string,
  tokenSymbol: string,
  assetType: AssetType
): string => {
  const isNFT = assetType === AssetType.NFT;
  const unit = isNFT ? "NFTs" : tokenSymbol;
  const isGenericName = tokenName.toLowerCase().includes("unknown") || tokenName === "TOKEN";
  const displayName = isGenericName ? "this asset" : `"${tokenName}" (${tokenSymbol})`;

  const isInfrastructure = INFRASTRUCTURE_ADDRESSES.includes(wallet.address.toLowerCase());

  return `
    You are "DogeDetective", an expert blockchain analyst for the Dogechain network. 
    You are analyzing a specific wallet.
    
    CONTEXT DATA:
    - Asset: ${displayName}
    - Wallet Address: ${wallet.address}
    - Role: ${isInfrastructure ? "Infrastructure/Burn/Bridge" : wallet.isContract ? "Smart Contract / Liquidity Pool" : wallet.isWhale ? "Top Whale" : "Holder"}
    - Balance: ${wallet.balance.toLocaleString()} ${unit} (${wallet.percentage.toFixed(2)}% of total supply)
    - Recent Transactions (Last 10):
    ${
      transactions.length > 0
        ? transactions
            .slice(0, 10)
            .map(
              (t) =>
                `- ${new Date(t.timestamp).toLocaleDateString()}: ${t.from === wallet.address ? "SENT" : "RECEIVED"} ${t.value.toLocaleString()} ${unit} ${t.from === wallet.address ? "to " + t.to : "from " + t.from}`
            )
            .join("\n")
        : "No recent transactions available."
    }

    YOUR GOAL:
    Answer the user's questions about this specific wallet's behavior, risk level, and patterns.
    - Be concise.
    - If the address is 0x00...000 or 0x00...dead, explain it is a BURN address and represents permanently locked supply (Good thing).
    - If the wallet is a Contract, explain it might be a Liquidity Pool (DEX) or Staking contract, which is generally healthy for the ecosystem, unlike a personal whale.
    - Be skeptical and safety-oriented.
    - If the user asks about price prediction, refuse politely and focus on on-chain data.
    - Use emojis occasionally (🕵️‍♂️, 🐕, ⚠️).
  `;
};

export const sendChatToAI = async (
  history: { role: "user" | "model"; text: string }[],
  systemInstruction: string,
  newMessage: string
): Promise<string> => {
  if (!isAIEnabled()) {
    return getAIUnavailableMessage();
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

    const chatHistory = history.map((msg) => ({
      role: msg.role,
      parts: [{ text: msg.text }],
    }));

    const chat = ai.chats.create({
      model: MODEL_NAME,
      config: {
        systemInstruction: systemInstruction,
      },
      history: chatHistory,
    });

    const result = await chat.sendMessage({ message: newMessage });
    return result.text || "No response generated.";
  } catch (error) {
    // Error handled silently

    return "Sorry, I couldn't process that request right now.";
  }
};

export const analyzeWhaleBehavior = async (
  wallet: Wallet,
  transactions: Transaction[],
  tokenName: string,
  tokenSymbol: string,
  assetType: AssetType = AssetType.TOKEN
): Promise<string> => {
  if (!isAIEnabled()) {
    return getAIUnavailableMessage();
  }

  const isNFT = assetType === AssetType.NFT;
  const unit = isNFT ? "NFTs" : tokenSymbol;
  const isGenericName = tokenName.toLowerCase().includes("unknown") || tokenName === "TOKEN";
  const displayName = isGenericName ? "this asset" : `"${tokenName}"`;

  const prompt = `
    Analyze the behavior of this "Whale" wallet holding ${isGenericName ? "this asset" : `the ${isNFT ? "NFT Collection" : "Token"} ${displayName} (${tokenSymbol})`}.

    Wallet: ${wallet.address}
    Balance: ${wallet.balance.toLocaleString()} ${unit} (${wallet.percentage.toFixed(2)}% of supply)
    Is Contract: ${wallet.isContract}

    Recent Txs:
    ${transactions
      .slice(0, 10)
      .map(
        (t) =>
          `- ${t.from === wallet.address ? "SENT" : "RECEIVED"} ${t.value.toLocaleString()} ${unit} ${t.from === wallet.address ? "to " + t.to : "from " + t.from}`
      )
      .join("\n")}

    Provide a concise risk assessment (Low/Medium/High) and a 1-sentence summary of their intent (accumulating vs dumping).
    If it is a contract, note that it is likely a Liquidity Pool or Protocol.
  `;

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        systemInstruction: "You are a blockchain risk analyst.",
      },
    });
    return response.text || "Analysis unavailable.";
  } catch (error) {
    // Error handled silently

    return "Analysis unavailable.";
  }
};

export const generateTokenSummary = async (
  tokenName: string,
  topHolders: Wallet[],
  assetType: AssetType = AssetType.TOKEN
): Promise<string> => {
  if (!isAIEnabled()) {
    return getAIUnavailableMessage();
  }

  // 1. Separate Infrastructure (Burn/Bridge)
  const infraHolders = topHolders.filter((w) =>
    INFRASTRUCTURE_ADDRESSES.includes(w.address.toLowerCase())
  );

  // 2. Separate Contracts (Likely LP/DEX/Staking) from Real User Whales
  const contracts = topHolders.filter(
    (w) => w.isContract && !INFRASTRUCTURE_ADDRESSES.includes(w.address.toLowerCase())
  );
  const realWhales = topHolders.filter(
    (w) => !w.isContract && !INFRASTRUCTURE_ADDRESSES.includes(w.address.toLowerCase())
  );

  // Calculate Percentages
  const infraPercent = infraHolders.reduce((acc, curr) => acc + curr.percentage, 0);
  const lpPercent = contracts.reduce((acc, curr) => acc + curr.percentage, 0);
  const whalePercent = realWhales.reduce((acc, curr) => acc + curr.percentage, 0);

  const isNFT = assetType === AssetType.NFT;

  const prompt = `
      Analyze the live distribution of ${isNFT ? "NFT Collection" : "token"} "${tokenName}".

      DISTRIBUTION DATA:
      - Burned/Infrastructure: ${infraPercent.toFixed(2)}% (Locked/Safe)
      - Liquidity Pools / Contracts: ${lpPercent.toFixed(2)}% (Likely DEX Liquidity or Staking - Generally Good)
      - Real User Whales (Risk): ${whalePercent.toFixed(2)}% (Concentration in user wallets)

      INSTRUCTIONS:
      - Do NOT treat Liquidity Pools (Contracts) as "Centralization Risk". Treat them as available liquidity.
      - Focus risk assessment on the Real User Whales.
      - If Burn is high, mention it as deflationary.
      - Provide a short, 2-sentence summary about the ACTUAL centralization risk (User held vs Contract/Burned).
    `;

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        systemInstruction:
          "You are a blockchain risk analyst. You differentiate between locked/burned supply, liquidity pools, and dangerous user whales.",
      },
    });
    return response.text || "Summary unavailable.";
  } catch (error) {
    // Error handled silently

    return "Summary unavailable.";
  }
};
