import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  BrainCircuit,
  Check,
  Copy,
  Tag,
  User,
  X,
  Loader2,
  Network,
  Sparkles,
  Send,
  ShieldAlert,
  ExternalLink,
  ArrowUpDown,
} from "lucide-react";
import { Wallet, Transaction, AssetType, Connection } from "../types";
import { createWalletChatSystemInstruction, sendChatToAI } from "../services/geminiService";
import { fetchWalletTransactions, fetchTokenBalance } from "../services/dataService";
import { handleTouchStopPropagation } from "../utils/touchHandlers";
import { ConnectionDetailsView } from "./ConnectionDetailsView";

interface WalletSidebarProps {
  wallet: Wallet | null;
  connection: Connection | null; // NEW: connection details
  wallets: Wallet[]; // NEW: all wallets for looking up connected wallets
  tokenSymbol: string;
  tokenName: string;
  tokenAddress: string;
  assetType: AssetType;
  iconUrl?: string; // New: Icon URL
  tokenDecimals?: number; // New: To ensure correct balance parsing
  onClose: () => void;
  onCreateAlert: (config: { type: "WALLET" | "TOKEN" | "WHALE"; threshold?: number }) => void;
  onTraceConnections?: (wallet: Wallet) => Promise<void>;
}

interface ChatMessage {
  role: "user" | "model";
  text: string;
}

// Debounce utility for performance optimization
const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

export const WalletSidebar: React.FC<WalletSidebarProps> = (props: WalletSidebarProps) => {
  const {
    wallet,
    connection,
    wallets,
    tokenSymbol,
    tokenName,
    tokenAddress,
    assetType,
    iconUrl,
    tokenDecimals,
    onClose,
    onCreateAlert,
    onTraceConnections,
  } = props;
  const [_transactions, setTransactions] = useState<Transaction[]>([]);
  const [activeTab, setActiveTab] = useState<"details" | "txs">("details");
  const [copied, setCopied] = useState<boolean>(false);
  const [sourceCopied, setSourceCopied] = useState<boolean>(false);
  const [targetCopied, setTargetCopied] = useState<boolean>(false);
  const [isTracing, setIsTracing] = useState<boolean>(false);
  const [isTransactionsLoading, setIsTransactionsLoading] = useState<boolean>(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [directionFilter, setDirectionFilter] = useState<"ALL" | "IN" | "OUT">("ALL");
  const [paginationMode, setPaginationMode] = useState<"load-more" | "numbered">("load-more");

  // Cache all transactions for filtering
  const [allTransactionsCache, setAllTransactionsCache] = useState<Transaction[]>([]);

  // Live Data State
  const [liveBalance, setLiveBalance] = useState<number | null>(null);

  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState<string>("");
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);
  const [systemInstruction, setSystemInstruction] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Determine if showing wallet or connection details
  const isConnectionView = !!connection && !wallet;

  useEffect(() => {
    if (wallet) {
      setTransactions([]);
      setAllTransactionsCache([]);
      setMessages([]);
      setCopied(false);
      setSystemInstruction("");
      setIsTracing(false);
      setLiveBalance(null); // Reset live balance
      setIsTransactionsLoading(true); // Start loading transactions
      setCurrentPage(1); // Reset page
      setDirectionFilter("ALL"); // Reset filter

      // 1. Fetch live balance for accuracy
      fetchTokenBalance(wallet?.address, tokenAddress, tokenDecimals).then((bal) => {
        setLiveBalance(bal);
      });

      // 2. Fetch transactions to populate context for chat
      fetchWalletTransactions(wallet?.address, tokenAddress, assetType).then((txs) => {
        setTransactions(txs); // Keep for AI chat context
        setAllTransactionsCache(txs); // Cache for pagination
        setIsTransactionsLoading(false); // Stop loading transactions
        // Initialize chat context immediately with data
        const instruction = createWalletChatSystemInstruction(
          wallet,
          txs,
          tokenName,
          tokenSymbol,
          assetType
        );
        setSystemInstruction(instruction);

        // Add initial greeting
        const labelText = wallet?.label ? ` (Identified as ${wallet?.label})` : "";
        setMessages([
          {
            role: "model",
            text: `I've analyzed ${wallet?.address.substring(0, 6)}...${labelText}. What would you like to know regarding their ${tokenSymbol} activity?`,
          },
        ]);
      });

      setActiveTab("details");
    }
  }, [wallet, tokenAddress, assetType, tokenDecimals, tokenName, tokenSymbol]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Dynamic page size calculation based on viewport (must be before early return)
  useEffect(() => {
    const calculatePageSize = () => {
      const isMobile = window.innerWidth < 768;
      const viewportHeight = window.innerHeight;

      if (isMobile) {
        // Mobile: 85vh bottom sheet - header(160) - filter(50) - pagination(60)
        const availableHeight = viewportHeight * 0.85 - 270;
        const calculatedPageSize = Math.max(5, Math.floor(availableHeight / 60));
        setPageSize(calculatedPageSize);
      } else {
        // Desktop: full height - header(120) - filter(50) - pagination(60)
        const availableHeight = viewportHeight - 230;
        const calculatedPageSize = Math.max(5, Math.floor(availableHeight / 60));
        setPageSize(calculatedPageSize);
      }
    };

    calculatePageSize();
    const handleResize = debounce(calculatePageSize, 300);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Auto-switch pagination mode based on page count (must be before early return)
  useEffect(() => {
    // Calculate totalPages inline since useMemo comes after this hook
    const filteredTx = allTransactionsCache.filter((tx) => {
      if (!wallet) return true;
      if (directionFilter === "ALL") return true;
      const direction = tx.from.toLowerCase() === wallet?.address.toLowerCase() ? "OUT" : "IN";
      return direction === directionFilter;
    });
    const pages = Math.ceil(filteredTx.length / pageSize);

    if (pages >= 5) {
      setPaginationMode("numbered");
    } else {
      setPaginationMode("load-more");
    }
  }, [allTransactionsCache, directionFilter, pageSize, wallet]);

  // Helper functions (must be before useMemo that uses them)
  const filterTransactions = useCallback(
    (txs: Transaction[], filter: "ALL" | "IN" | "OUT"): Transaction[] => {
      if (!wallet) return txs;
      if (filter === "ALL") return txs;
      return txs.filter((tx) => {
        const direction = tx.from.toLowerCase() === wallet?.address.toLowerCase() ? "OUT" : "IN";
        return direction === filter;
      });
    },
    [wallet]
  );

  const paginateTransactions = (txs: Transaction[], page: number, size: number): Transaction[] => {
    const startIndex = (page - 1) * size;
    const endIndex = startIndex + size;
    return txs.slice(startIndex, endIndex);
  };

  // Get filtered and paginated transactions with memoization (must be before early return)
  const filteredTransactions = useMemo(
    () => filterTransactions(allTransactionsCache, directionFilter),
    [allTransactionsCache, directionFilter, filterTransactions]
  );

  const paginatedTransactions = useMemo(
    () => paginateTransactions(filteredTransactions, currentPage, pageSize),
    [filteredTransactions, currentPage, pageSize]
  );

  const totalPages = Math.ceil(filteredTransactions.length / pageSize);

  if (!wallet && !connection) return null;

  const handleCopyAddress = () => {
    if (!wallet) return;
    navigator.clipboard.writeText(wallet?.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopySourceAddress = () => {
    if (!connection) return;
    const sourceWallet = wallets.find(
      (w) =>
        w.id === (typeof connection.source === "string" ? connection.source : connection.source.id)
    );
    if (!sourceWallet) return;
    navigator.clipboard.writeText(sourceWallet.address);
    setSourceCopied(true);
    setTimeout(() => setSourceCopied(false), 2000);
  };

  const handleCopyTargetAddress = () => {
    if (!connection) return;
    const targetWallet = wallets.find(
      (w) =>
        w.id === (typeof connection.target === "string" ? connection.target : connection.target.id)
    );
    if (!targetWallet) return;
    navigator.clipboard.writeText(targetWallet.address);
    setTargetCopied(true);
    setTimeout(() => setTargetCopied(false), 2000);
  };

  const handleTrace = async () => {
    if (!onTraceConnections || !wallet) return;
    setIsTracing(true);
    try {
      await onTraceConnections(wallet);
      // On mobile, close the wallet panel after triggering trace to reveal the map
      if (typeof window !== "undefined" && window.innerWidth < 768) {
        onClose();
      }
    } catch {
      // Error handled by parent via toast usually
    } finally {
      setIsTracing(false);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim()) return;

    const userMsg = input;
    setInput("");

    // Optimistic UI update
    const newHistory = [...messages, { role: "user" as const, text: userMsg }];
    setMessages(newHistory);
    setIsChatLoading(true);

    try {
      const responseText = await sendChatToAI(newHistory, systemInstruction, userMsg);
      setMessages((prev) => [...prev, { role: "model", text: responseText }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "model", text: "Connection error. Please try again." },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const isNFT = assetType === AssetType.NFT;
  const displayBalance = liveBalance !== null ? liveBalance : (wallet?.balance ?? 0);

  return (
    <>
      {/* Mobile Backdrop - Click to close */}
      <div
        className="fixed inset-0 bg-black/70 z-[90] transition-opacity md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Desktop Backdrop - Click to close */}
      <div
        className="hidden md:block fixed inset-0 bg-black/30 z-[90] transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sidebar Container - Bottom Sheet on Mobile, Side Panel on Desktop */}
      <div
        className={`fixed z-[100] bg-space-800 shadow-2xl flex flex-col transition-transform duration-300 ease-out will-change-transform
       /50 rounded-t-2xl inset-x-0 bottom-0 h-[85vh]
           md:inset-y-0 md:right-0 md:left-auto md:w-96 md:max-w-[90vw] md:h-auto md:rounded-none md:top-16`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="wallet-details-title"
      >
        {/* Mobile Drag Handle */}
        <div
          className="md:hidden w-full flex justify-center pt-3 pb-1"
          onTouchStart={handleTouchStopPropagation}
          onClick={onClose}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onClose();
            }
          }}
          role="button"
          tabIndex={0}
          aria-label="Close wallet details"
        >
          <div className="w-12 h-1.5 bg-space-600 rounded-full"></div>
        </div>

        {/* Fixed Header */}
        <div className="p-5 bg-space-800 border-b border-space-700 flex items-start justify-between shrink-0 rounded-t-2xl md:rounded-none md:rounded-t-lg">
          <div className="flex-1 min-w-0 mr-4">
            <div className="flex items-center gap-2 mb-1">
              <h2 id="wallet-details-title" className="text-lg font-bold text-white">
                {isConnectionView ? "Connection Details" : "Wallet Details"}
              </h2>
              {/* Token Icon Indicator */}
              {iconUrl && (
                <div className="w-5 h-5 rounded-full overflow-hidden bg-space-700 border border-space-600">
                  <img
                    src={iconUrl}
                    alt={tokenSymbol}
                    className="w-full h-full object-cover"
                    onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                </div>
              )}
            </div>

            {/* Verification Badge for Contracts */}
            {wallet?.isContract && (
              <div className="flex items-center gap-2 mt-1 mb-1">
                {wallet?.address.toLowerCase() === tokenAddress.toLowerCase() ? (
                  <span className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded bg-space-700 text-slate-300">
                    <BrainCircuit size={10} /> Smart Contract
                  </span>
                ) : (
                  <div className="flex items-center gap-1 mt-1 text-purple-400 font-bold text-sm">
                    <Tag size={12} /> {wallet?.label || "Contract"}
                  </div>
                )}
              </div>
            )}

            {!wallet?.isContract && wallet?.label && (
              <div className="flex items-center gap-1 mt-1 text-purple-400 font-bold text-sm">
                <Tag size={12} /> {wallet?.label}
              </div>
            )}

            <div className="flex items-center gap-2 mt-1">
              {!isConnectionView && (
                <>
                  <p className="text-xs text-slate-400 font-mono" title={wallet?.address}>
                    {wallet?.address.slice(0, 6)}...{wallet?.address.slice(-4)}
                  </p>
                  <button
                    onTouchStart={handleTouchStopPropagation}
                    onClick={handleCopyAddress}
                    className="text-slate-500 hover:text-white transition-colors"
                    title="Copy Address"
                  >
                    {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                  </button>
                  <a
                    href={`https://explorer.dogechain.dog/address/${wallet?.address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onTouchStart={handleTouchStopPropagation}
                    className="text-slate-500 hover:text-white transition-colors p-2 rounded hover:bg-space-600 min-w-[44px] min-h-[44px] inline-flex items-center justify-center [touch-action:manipulation]"
                    title="View on Blockscout"
                  >
                    <ExternalLink size={14} />
                  </a>
                </>
              )}
            </div>
          </div>
          <button
            onTouchStart={handleTouchStopPropagation}
            onClick={onClose}
            className="p-2 bg-space-700 hover:bg-red-500/20 hover:text-red-400 text-slate-400 rounded-lg transition-all shrink-0"
            aria-label="Close sidebar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Connection Info Banner */}
        {isConnectionView && connection && (
          <div className="px-5 py-3 bg-purple-900/20 border-b border-purple-700/50">
            <p className="text-xs text-slate-300 mb-3">Transactions between two wallets</p>

            <div className="flex items-center justify-between gap-2">
              {/* Source Wallet */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-xs text-slate-400">From:</span>
                  <button
                    onTouchStart={handleTouchStopPropagation}
                    onClick={handleCopySourceAddress}
                    className="text-xs font-mono text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1 min-w-[44px] min-h-[44px] inline-flex justify-center [touch-action:manipulation]"
                    title={sourceCopied ? "Copied!" : "Click to copy full address"}
                  >
                    {wallets
                      .find(
                        (w) =>
                          w.id ===
                          (typeof connection.source === "string"
                            ? connection.source
                            : connection.source.id)
                      )
                      ?.address.slice(0, 8)}
                    ...
                    {sourceCopied ? (
                      <Check size={10} className="text-green-500" />
                    ) : (
                      <Copy size={10} />
                    )}
                  </button>
                </div>
                <a
                  href={`https://explorer.dogechain.dog/address/${
                    wallets.find(
                      (w) =>
                        w.id ===
                        (typeof connection.source === "string"
                          ? connection.source
                          : connection.source.id)
                    )?.address
                  }`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onTouchStart={handleTouchStopPropagation}
                  className="text-[10px] text-slate-500 hover:text-purple-400 transition-colors flex items-center gap-1"
                >
                  <ExternalLink size={8} />
                  View on Explorer
                </a>
              </div>

              {/* Arrow Icon */}
              <ArrowUpDown className="w-4 h-4 text-purple-400 flex-shrink-0" />

              {/* Target Wallet */}
              <div className="flex-1 min-w-0 text-right">
                <div className="flex items-center justify-end gap-1 mb-1">
                  <span className="text-xs text-slate-400">To:</span>
                  <button
                    onTouchStart={handleTouchStopPropagation}
                    onClick={handleCopyTargetAddress}
                    className="text-xs font-mono text-green-400 hover:text-green-300 transition-colors flex items-center gap-1 min-w-[44px] min-h-[44px] inline-flex justify-center [touch-action:manipulation]"
                    title={targetCopied ? "Copied!" : "Click to copy full address"}
                  >
                    ...
                    {wallets
                      .find(
                        (w) =>
                          w.id ===
                          (typeof connection.target === "string"
                            ? connection.target
                            : connection.target.id)
                      )
                      ?.address.slice(-8)}
                    {targetCopied ? (
                      <Check size={10} className="text-green-500" />
                    ) : (
                      <Copy size={10} />
                    )}
                  </button>
                </div>
                <a
                  href={`https://explorer.dogechain.dog/address/${
                    wallets.find(
                      (w) =>
                        w.id ===
                        (typeof connection.target === "string"
                          ? connection.target
                          : connection.target.id)
                    )?.address
                  }`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onTouchStart={handleTouchStopPropagation}
                  className="text-[10px] text-slate-500 hover:text-purple-400 transition-colors flex items-center gap-1 justify-end"
                >
                  View on Explorer
                  <ExternalLink size={8} />
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 overscroll-contain">
          {/* Connection Details View or Wallet Details */}
          {isConnectionView && connection ? (
            <ConnectionDetailsView
              connection={connection}
              sourceWallet={wallets.find(
                (w) =>
                  w.id ===
                  (typeof connection.source === "string" ? connection.source : connection.source.id)
              )}
              targetWallet={wallets.find(
                (w) =>
                  w.id ===
                  (typeof connection.target === "string" ? connection.target : connection.target.id)
              )}
              tokenSymbol={tokenSymbol}
            />
          ) : (
            <>
              {/* Quick Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-lg bg-space-900 border border-space-700">
                  <p className="text-[10px] uppercase tracking-wide text-slate-400">
                    {isNFT ? "Owned NFTs" : "Balance"}
                  </p>
                  <p
                    className={`text-lg font-bold break-words ${isNFT ? "text-purple-400" : "text-doge-500"}`}
                  >
                    {displayBalance.toLocaleString(undefined, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: isNFT ? 0 : 6,
                    })}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-space-900 border border-space-700">
                  <p className="text-[10px] uppercase tracking-wide text-slate-400">Supply Share</p>
                  <p className="text-lg font-bold text-white truncate">
                    {wallet?.percentage.toFixed(2)}%
                  </p>
                </div>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-2">
                {wallet?.isWhale && (
                  <span
                    className={`px-2 py-1 text-xs font-bold rounded border border-space-700/20 ${isNFT ? "text-purple-400 bg-purple-400/10 border-purple-400/30" : "text-doge-600 bg-doge-600/10 border-doge-600/30"}`}
                  >
                    {isNFT ? "TOP COLLECTOR" : "WHALE"}
                  </span>
                )}
                {wallet?.isContract && (
                  <span className="px-2 py-1 text-xs font-bold text-red-500 bg-red-500/10 rounded border border-red-500/30">
                    {isNFT ? "TREASURY" : "CONTRACT"}
                  </span>
                )}
                {onTraceConnections && (
                  <button
                    onTouchStart={handleTouchStopPropagation}
                    onClick={handleTrace}
                    disabled={isTracing}
                    className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-purple-300 hover:text-white bg-purple-500/20 hover:bg-purple-500/40 rounded transition-colors disabled:opacity-50"
                    title="Find interactions with other wallets on the map"
                  >
                    {isTracing ? (
                      <Loader2 size={10} className="animate-spin" />
                    ) : (
                      <Network size={10} />
                    )}
                    {isTracing ? "Tracing..." : "Trace Connections"}
                  </button>
                )}
              </div>

              {/* Tabs */}
              <div className="flex border-b border-space-700">
                <button
                  onTouchStart={handleTouchStopPropagation}
                  className={`flex-1 pb-2 text-sm font-medium transition-colors ${activeTab === "details" ? "text-doge-500" : "text-slate-400 hover:text-slate-200"}`}
                  onClick={() => setActiveTab("details")}
                >
                  AI Analyst
                </button>
                <button
                  onTouchStart={handleTouchStopPropagation}
                  className={`flex-1 pb-2 text-sm font-medium transition-colors ${activeTab === "txs" ? "text-doge-500" : "text-slate-400 hover:text-slate-200"}`}
                  onClick={() => setActiveTab("txs")}
                >
                  Recent Txs
                </button>
              </div>

              {activeTab === "details" && (
                <div className="animate-fade-in h-[300px] flex flex-col bg-space-900 rounded-xl border border-space-700 overflow-hidden relative isolate">
                  {/* Chat Header */}
                  <div className="px-3 py-2 bg-space-800/50 border-b border-space-700 flex items-center gap-2 text-xs font-bold text-purple-300">
                    <Sparkles size={12} /> On-Chain Detective
                  </div>

                  {/* Messages Area */}
                  <div className="flex-1 overflow-y-auto p-3 space-y-3">
                    {messages.map((msg, i) => (
                      <div
                        key={i}
                        className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                      >
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-1 ${msg.role === "user" ? "bg-space-700" : "bg-purple-600"}`}
                        >
                          {msg.role === "user" ? (
                            <User size={12} className="text-slate-300" />
                          ) : (
                            <BrainCircuit size={12} className="text-white" />
                          )}
                        </div>
                        <div
                          className={`p-2 rounded-lg border border-space-700/20 text-sm max-w-[80%] ${msg.role === "user" ? "bg-space-700 text-white" : "bg-purple-900/30 border-purple-500/30 text-purple-100"}`}
                        >
                          {msg.text}
                        </div>
                      </div>
                    ))}
                    {isChatLoading && (
                      <div className="flex gap-2">
                        <div className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center shrink-0">
                          <BrainCircuit size={12} className="text-white" />
                        </div>
                        <div className="flex gap-1 items-center p-2">
                          <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce"></span>
                          <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce delay-75"></span>
                          <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce delay-150"></span>
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Input Area */}
                  <form
                    onSubmit={handleSendMessage}
                    className="p-2 bg-space-800 border-t border-space-700 flex gap-2"
                  >
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Ask about risks, patterns..."
                      className="flex-1 bg-space-900 border border-space-700 rounded-md px-3 py-1.5 text-sm text-white focus:outline-none focus:border-space-600"
                    />
                    <button
                      onTouchStart={handleTouchStopPropagation}
                      type="submit"
                      disabled={isChatLoading || !input.trim()}
                      className="p-1.5 bg-purple-600 text-white rounded-md hover:bg-purple-500 disabled:opacity-50"
                    >
                      <Send size={14} />
                    </button>
                  </form>

                  {/* COMING SOON OVERLAY */}
                  <div className="absolute inset-0 z-[120] flex items-center justify-center bg-space-900/95 backdrop-blur-sm px-4 py-6">
                    <div className="w-full max-w-[240px] mx-auto rounded-xl bg-space-900/90 border border-purple-500/70 px-5 py-5 text-center shadow-2xl flex flex-col items-center gap-2">
                      <p className="text-sm font-bold text-purple-100 leading-tight">
                        FEATURE COMING SOON
                      </p>
                      <p className="text-xs text-slate-200 leading-tight">
                        AI-Powered Wallet Analysis
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "txs" && (
                <div className="flex flex-col h-full animate-fade-in">
                  {/* Filter Bar */}
                  <div className="flex items-center justify-between mb-3 shrink-0">
                    <div className="flex gap-2">
                      {(["ALL", "IN", "OUT"] as const).map((filter) => (
                        <button
                          key={filter}
                          onTouchStart={handleTouchStopPropagation}
                          onClick={() => {
                            setDirectionFilter(filter);
                            setCurrentPage(1); // Reset to page 1 on filter change
                          }}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                            directionFilter === filter
                              ? "bg-doge-600 text-white border-doge-500"
                              : "bg-space-800 text-slate-400 border-space-700 hover:bg-space-700"
                          }`}
                        >
                          {filter}
                        </button>
                      ))}
                    </div>
                    <span className="text-xs text-slate-500">
                      {filteredTransactions.length} transactions
                    </span>
                  </div>

                  {/* Transactions List */}
                  <div className="flex-1 overflow-y-auto space-y-3 min-h-0">
                    {isTransactionsLoading ? (
                      <div className="flex flex-col items-center justify-center py-8 space-y-3">
                        <Loader2 size={24} className="text-doge-500 animate-spin" />
                        <p className="text-sm text-slate-400">Fetching transactions...</p>
                      </div>
                    ) : paginatedTransactions.length === 0 ? (
                      <div className="text-center py-8 text-slate-500 text-sm">
                        {directionFilter === "ALL"
                          ? "No recent transactions found."
                          : `No ${directionFilter.toLowerCase()} transactions found.`}
                      </div>
                    ) : (
                      paginatedTransactions.map((tx) => (
                        <a
                          key={tx.hash}
                          href={`https://explorer.dogechain.dog/tx/${tx.hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onTouchStart={handleTouchStopPropagation}
                          className="block p-4 rounded-lg bg-space-900 border border-space-700 flex justify-between items-center gap-2 min-w-0 hover:border-space-600 hover:border-blue-500/50 transition-colors group [touch-action:manipulation]"
                          title="View transaction on Blockscout"
                        >
                          <div>
                            <div
                              className={`text-xs font-bold ${tx.from === wallet?.address ? "text-red-400" : "text-green-400"}`}
                            >
                              {tx.from === wallet?.address ? "OUT" : "IN"}
                            </div>
                            <div className="text-xs text-slate-500">
                              {new Date(tx.timestamp).toLocaleDateString()}
                            </div>
                          </div>
                          <div className="text-right flex items-center gap-2">
                            <div>
                              <div className="text-sm font-mono text-white truncate">
                                {tx.value.toLocaleString(undefined, {
                                  maximumFractionDigits: isNFT ? 0 : 4,
                                })}
                              </div>
                              <div className="text-[10px] text-slate-500">
                                {isNFT ? "NFTs" : tx.tokenSymbol || tokenSymbol}
                              </div>
                            </div>
                            <ExternalLink
                              size={14}
                              className="text-slate-500 group-hover:text-blue-400 transition-colors flex-shrink-0"
                            />
                          </div>
                        </a>
                      ))
                    )}
                  </div>

                  {/* Pagination Controls */}
                  {filteredTransactions.length > pageSize && (
                    <div className="mt-3 shrink-0">
                      {paginationMode === "load-more" && totalPages < 5 ? (
                        // Load More Button (initial pages)
                        <button
                          onTouchStart={handleTouchStopPropagation}
                          onClick={() => setCurrentPage((p) => p + 1)}
                          disabled={currentPage >= totalPages}
                          className="w-full py-3 bg-space-700 hover:bg-space-600 text-slate-300 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                        >
                          {currentPage >= totalPages
                            ? "All transactions loaded"
                            : `Load More (Page ${currentPage + 1})`}
                        </button>
                      ) : (
                        // Numbered Pagination (5+ pages)
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onTouchStart={handleTouchStopPropagation}
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="px-3 py-1 text-xs bg-space-800 border border-space-700 rounded hover:bg-space-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            Prev
                          </button>

                          {/* Page numbers */}
                          {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                            let pageNum;
                            if (totalPages <= 5) {
                              pageNum = i + 1;
                            } else if (currentPage <= 3) {
                              pageNum = i + 1;
                            } else if (currentPage >= totalPages - 2) {
                              pageNum = totalPages - 4 + i;
                            } else {
                              pageNum = currentPage - 2 + i;
                            }

                            return (
                              <button
                                key={pageNum}
                                onTouchStart={handleTouchStopPropagation}
                                onClick={() => setCurrentPage(pageNum)}
                                className={`min-w-[32px] h-8 px-2 text-xs font-medium rounded-lg border transition-colors ${
                                  currentPage === pageNum
                                    ? "bg-doge-600 text-white border-doge-500"
                                    : "bg-space-800 text-slate-400 border-space-700 hover:bg-space-600"
                                }`}
                              >
                                {pageNum}
                              </button>
                            );
                          })}

                          <button
                            onTouchStart={handleTouchStopPropagation}
                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="px-3 py-1 text-xs bg-space-800 border border-space-700 rounded hover:bg-space-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            Next
                          </button>
                        </div>
                      )}

                      {/* Page indicator */}
                      <div className="text-center mt-2">
                        <span className="text-xs text-slate-500">
                          Page {currentPage} of {totalPages}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </> // End of wallet details fragment
          )}
        </div>

        {/* Action Buttons Footer - Only for Wallet Details */}
        {!isConnectionView && (
          <div className="p-5 bg-space-800 border-t border-space-700 shrink-0">
            <button
              onTouchStart={handleTouchStopPropagation}
              onClick={() => onCreateAlert({ type: "WALLET" })}
              className="w-full py-3 flex items-center justify-center gap-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white border border-purple-500 transition-colors font-semibold shadow-lg shadow-purple-500/20"
            >
              <ShieldAlert size={18} /> Create Alert
            </button>
          </div>
        )}
      </div>
    </>
  );
};
