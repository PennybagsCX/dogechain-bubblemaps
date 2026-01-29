/**
 * Data Export Utility
 *
 * Export pool data to various formats:
 * - CSV
 * - JSON
 */

export interface ExportData {
  pools: PoolStats[];
  historicalData?: HistoricalDataPoint[];
  metadata?: {
    exportDate: string;
    chain: string;
    source: string;
  };
}

export interface PoolStats {
  address: string;
  token0: { symbol: string; address: string; name?: string };
  token1: { symbol: string; address: string; name?: string };
  factory: string;
  tvlUsd: number;
  volume24h?: number;
  priceChange24h?: number;
  reserve0?: string;
  reserve1?: string;
  pairAge?: number;
}

export interface HistoricalDataPoint {
  timestamp: number;
  date: string;
  price: number;
  volume: number;
  tvl: number;
}

export type ExportFormat = "csv" | "json";

export interface ExportOptions {
  format: ExportFormat;
  data: ExportData;
  filename?: string;
  includeCharts?: boolean;
  dateRange?: [Date, Date];
}

/**
 * Export data to CSV format
 */
export function exportToCSV(data: ExportData, filename: string = "dex-analytics-export.csv"): void {
  const rows: string[][] = [];

  // Header
  rows.push([
    "Pool Address",
    "Token0 Symbol",
    "Token1 Symbol",
    "DEX",
    "TVL (USD)",
    "24h Volume (USD)",
    "24h Price Change (%)",
    "Reserve0",
    "Reserve1",
    "Pool Age (ms)",
  ]);

  // Data rows
  for (const pool of data.pools) {
    rows.push([
      pool.address,
      pool.token0.symbol,
      pool.token1.symbol,
      pool.factory,
      pool.tvlUsd.toFixed(2),
      (pool.volume24h || 0).toFixed(2),
      (pool.priceChange24h || 0).toFixed(2),
      pool.reserve0 || "N/A",
      pool.reserve1 || "N/A",
      (pool.pairAge || 0).toString(),
    ]);
  }

  // Convert to CSV string
  const csvContent = rows
    .map((row) =>
      row
        .map((cell) => {
          // Escape cells containing commas or quotes
          const cellStr = String(cell);
          if (cellStr.includes(",") || cellStr.includes('"') || cellStr.includes("\n")) {
            return `"${cellStr.replace(/"/g, '""')}"`;
          }
          return cellStr;
        })
        .join(",")
    )
    .join("\n");

  // Add BOM for UTF-8
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });

  // Download
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

/**
 * Export data to JSON format
 */
export function exportToJSON(
  data: ExportData,
  filename: string = "dex-analytics-export.json"
): void {
  const exportData = {
    metadata: {
      exportDate: new Date().toISOString(),
      chain: "Dogechain",
      source: "DEX Analytics Dashboard",
      recordCount: data.pools.length,
    },
    pools: data.pools.map((pool) => ({
      address: pool.address,
      token0: pool.token0,
      token1: pool.token1,
      factory: pool.factory,
      tvlUsd: pool.tvlUsd,
      volume24h: pool.volume24h,
      priceChange24h: pool.priceChange24h,
      reserve0: pool.reserve0,
      reserve1: pool.reserve1,
      pairAge: pool.pairAge,
    })),
    historicalData: data.historicalData,
  };

  const jsonContent = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonContent], { type: "application/json;charset=utf-8;" });

  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

/**
 * Main export function
 */
export function exportData(options: ExportOptions): void {
  const { format, data, filename } = options;

  const defaultFilename = `dex-analytics-${new Date().toISOString().split("T")[0]}`;
  const finalFilename = filename || `${defaultFilename}.${format}`;

  try {
    switch (format) {
      case "csv":
        exportToCSV(data, finalFilename);
        break;
      case "json":
        exportToJSON(data, finalFilename);
        break;
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  } catch (error) {
    console.error("[Export] Failed to export data:", error);
    throw error;
  }
}

/**
 * Copy data to clipboard
 */
export async function copyToClipboard(data: PoolStats[]): Promise<void> {
  const text = data
    .map(
      (pool) =>
        `${pool.token0.symbol}/${pool.token1.symbol} - ${pool.factory} - TVL: $${pool.tvlUsd.toFixed(2)}`
    )
    .join("\n");

  try {
    await navigator.clipboard.writeText(text);
  } catch (error) {
    console.error("[Export] Failed to copy to clipboard:", error);
    throw error;
  }
}

/**
 * Generate shareable URL
 */
export function generateShareUrl(pool: PoolStats): string {
  const params = new URLSearchParams({
    pool: pool.address,
    token0: pool.token0.symbol,
    token1: pool.token1.symbol,
  });

  return `${window.location.origin}/dex-analytics?${params.toString()}`;
}

/**
 * Generate shareable text
 */
export function generateShareText(pool: PoolStats): string {
  const emoji = (pool.priceChange24h || 0) >= 0 ? "📈" : "📉";
  const change = (pool.priceChange24h || 0) >= 0 ? "+" : "";

  return (
    `${emoji} ${pool.token0.symbol}/${pool.token1.symbol} on Dogechain\n` +
    `TVL: $${pool.tvlUsd.toFixed(2)}\n` +
    `24h: ${change}${(pool.priceChange24h || 0).toFixed(2)}%\n` +
    `via DEX Analytics`
  );
}
