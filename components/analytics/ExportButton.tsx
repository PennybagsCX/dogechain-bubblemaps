/**
 * Export Button Component
 *
 * Provides UI for exporting DEX Analytics data:
 * - Export to CSV, JSON, Excel, PDF
 * - Copy to clipboard
 * - Share to social media
 * - Generate shareable links
 */

import React, { useState } from "react";
import {
  Download,
  Copy,
  Check,
  Share2,
  Twitter,
  Send,
  Link as LinkIcon,
  FileText,
  FileType,
} from "lucide-react";
import {
  exportData,
  copyToClipboard,
  generateShareUrl,
  generateShareText,
  type PoolStats,
  type HistoricalDataPoint,
} from "../../utils/dataExport";

export type ExportFormat = "csv" | "json";

interface ExportButtonProps {
  pools: PoolStats[];
  historicalData?: HistoricalDataPoint[];
  selectedPool?: PoolStats;
  className?: string;
  variant?: "button" | "dropdown" | "icon";
}

export const ExportButton: React.FC<ExportButtonProps> = ({
  pools,
  historicalData,
  selectedPool,
  className = "",
  variant = "dropdown",
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isExporting, setIsExporting] = useState<ExportFormat | null>(null);

  const handleExport = async (format: ExportFormat) => {
    setIsExporting(format);

    try {
      const data = {
        pools: selectedPool ? [selectedPool] : pools,
        historicalData,
        metadata: {
          exportDate: new Date().toISOString(),
          chain: "Dogechain",
          source: "DEX Analytics Dashboard",
        },
      };

      const filename = selectedPool
        ? `${selectedPool.token0.symbol}-${selectedPool.token1.symbol}-dex-analytics.${format}`
        : `dex-analytics-export.${format}`;

      exportData({ format, data, filename });
    } catch (error) {
      console.error("[ExportButton] Export failed:", error);
    } finally {
      setIsExporting(null);
    }

    setShowMenu(false);
  };

  const handleCopy = async () => {
    try {
      const dataToCopy = selectedPool ? [selectedPool] : pools;
      await copyToClipboard(dataToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("[ExportButton] Copy failed:", error);
    }
  };

  const handleShare = (platform: string) => {
    const pool = selectedPool || pools[0];
    if (!pool) return;

    const text = generateShareText(pool);
    const url = generateShareUrl(pool);

    switch (platform) {
      case "twitter":
        window.open(
          `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
          "_blank"
        );
        break;
      case "telegram":
        window.open(
          `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
          "_blank"
        );
        break;
      case "copy":
        navigator.clipboard.writeText(`${text}\n${url}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        break;
    }

    setShowShareMenu(false);
  };

  const exportOptions = [
    {
      format: "csv" as ExportFormat,
      label: "CSV",
      icon: FileText,
      description: "Spreadsheet format",
    },
    {
      format: "json" as ExportFormat,
      label: "JSON",
      icon: FileType,
      description: "Developer format",
    },
  ];

  // Button variant
  if (variant === "button") {
    return (
      <div className={`relative ${className}`}>
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="flex items-center gap-2 px-4 py-2 bg-space-700 hover:bg-space-600 text-white rounded-lg transition-colors"
        >
          <Download className="w-4 h-4" />
          Export
        </button>

        {showMenu && (
          <>
            <button
              className="fixed inset-0 z-10 bg-transparent"
              onClick={() => setShowMenu(false)}
              aria-label="Close export menu"
            />
            <div className="absolute z-20 top-full right-0 mt-2 bg-space-800 border border-space-700 rounded-lg shadow-xl overflow-hidden min-w-[200px]">
              <div className="p-2">
                <p className="px-2 py-1 text-xs text-slate-500 uppercase tracking-wider">
                  Export As
                </p>
                {exportOptions.map((option) => (
                  <button
                    key={option.format}
                    onClick={() => handleExport(option.format)}
                    disabled={isExporting !== null}
                    className="w-full flex items-center gap-3 px-2 py-2 hover:bg-space-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option.icon className="w-4 h-4 text-slate-400" />
                    <div className="text-left">
                      <p className="text-sm text-white">{option.label}</p>
                      <p className="text-xs text-slate-500">{option.description}</p>
                    </div>
                    {isExporting === option.format && (
                      <div className="ml-auto w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                    )}
                  </button>
                ))}
              </div>

              <div className="border-t border-space-700 p-2">
                <button
                  onClick={handleCopy}
                  className="w-full flex items-center gap-3 px-2 py-2 hover:bg-space-700 rounded transition-colors"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-slate-400" />
                  )}
                  <span className="text-sm text-white">
                    {copied ? "Copied!" : "Copy to Clipboard"}
                  </span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // Icon variant
  if (variant === "icon") {
    return (
      <div className={`relative ${className}`}>
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="p-2 hover:bg-space-700 rounded-lg transition-colors"
          title="Export data"
        >
          <Download className="w-4 h-4 text-slate-400" />
        </button>

        {showMenu && (
          <>
            <button
              className="fixed inset-0 z-10 bg-transparent"
              onClick={() => setShowMenu(false)}
              aria-label="Close export menu"
            />
            <div className="absolute z-20 top-full right-0 mt-2 bg-space-800 border border-space-700 rounded-lg shadow-xl overflow-hidden min-w-[200px]">
              <div className="p-2">
                <p className="px-2 py-1 text-xs text-slate-500 uppercase tracking-wider">
                  Export As
                </p>
                {exportOptions.map((option) => (
                  <button
                    key={option.format}
                    onClick={() => handleExport(option.format)}
                    disabled={isExporting !== null}
                    className="w-full flex items-center gap-3 px-2 py-2 hover:bg-space-700 rounded transition-colors disabled:opacity-50"
                  >
                    <option.icon className="w-4 h-4 text-slate-400" />
                    <span className="text-sm text-white">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // Dropdown variant (default)
  return (
    <div className={`relative ${className}`}>
      <div className="flex items-center gap-2">
        {/* Export Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="flex items-center gap-2 px-3 py-1.5 bg-space-700 hover:bg-space-600 rounded-lg text-sm text-slate-300 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Export</span>
          </button>

          {showMenu && (
            <>
              <button
                className="fixed inset-0 z-10 bg-transparent"
                onClick={() => setShowMenu(false)}
                aria-label="Close export menu"
              />
              <div className="absolute z-20 top-full right-0 mt-2 bg-space-800 border border-space-700 rounded-lg shadow-xl overflow-hidden min-w-[220px]">
                <div className="p-2">
                  <p className="px-2 py-1 text-xs text-slate-500 uppercase tracking-wider">
                    Export Format
                  </p>
                  {exportOptions.map((option) => (
                    <button
                      key={option.format}
                      onClick={() => handleExport(option.format)}
                      disabled={isExporting !== null}
                      className="w-full flex items-center gap-3 px-2 py-2 hover:bg-space-700 rounded transition-colors disabled:opacity-50"
                    >
                      <option.icon className="w-4 h-4 text-slate-400" />
                      <div className="text-left flex-1">
                        <p className="text-sm text-white">{option.label}</p>
                        <p className="text-xs text-slate-500">{option.description}</p>
                      </div>
                      {isExporting === option.format && (
                        <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                      )}
                    </button>
                  ))}
                </div>

                <div className="border-t border-space-700 p-2">
                  <button
                    onClick={handleCopy}
                    className="w-full flex items-center gap-3 px-2 py-2 hover:bg-space-700 rounded transition-colors"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4 text-slate-400" />
                    )}
                    <span className="text-sm text-white">
                      {copied ? "Copied!" : "Copy Table Data"}
                    </span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Share Button */}
        <div className="relative">
          <button
            onClick={() => setShowShareMenu(!showShareMenu)}
            className="flex items-center gap-2 px-3 py-1.5 bg-space-700 hover:bg-space-600 rounded-lg text-sm text-slate-300 transition-colors"
          >
            <Share2 className="w-4 h-4" />
            <span>Share</span>
          </button>

          {showShareMenu && (
            <>
              <button
                className="fixed inset-0 z-10 bg-transparent"
                onClick={() => setShowShareMenu(false)}
                aria-label="Close share menu"
              />
              <div className="absolute z-20 top-full right-0 mt-2 bg-space-800 border border-space-700 rounded-lg shadow-xl overflow-hidden min-w-[180px]">
                <div className="p-2">
                  <p className="px-2 py-1 text-xs text-slate-500 uppercase tracking-wider">
                    Share To
                  </p>
                  <button
                    onClick={() => handleShare("twitter")}
                    className="w-full flex items-center gap-3 px-2 py-2 hover:bg-space-700 rounded transition-colors"
                  >
                    <Twitter className="w-4 h-4 text-blue-400" />
                    <span className="text-sm text-white">Twitter</span>
                  </button>
                  <button
                    onClick={() => handleShare("telegram")}
                    className="w-full flex items-center gap-3 px-2 py-2 hover:bg-space-700 rounded transition-colors"
                  >
                    <Send className="w-4 h-4 text-blue-400" />
                    <span className="text-sm text-white">Telegram</span>
                  </button>
                  <button
                    onClick={() => handleShare("copy")}
                    className="w-full flex items-center gap-3 px-2 py-2 hover:bg-space-700 rounded transition-colors"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : (
                      <LinkIcon className="w-4 h-4 text-slate-400" />
                    )}
                    <span className="text-sm text-white">
                      {copied ? "Link Copied!" : "Copy Link"}
                    </span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Quick Export Toolbar
 * Shows export options as a toolbar with icons
 */

interface QuickExportToolbarProps {
  pools: PoolStats[];
  historicalData?: HistoricalDataPoint[];
  onExport?: (format: ExportFormat) => void;
  className?: string;
}

export const QuickExportToolbar: React.FC<QuickExportToolbarProps> = ({
  pools,
  historicalData,
  onExport,
  className = "",
}) => {
  const [isExporting, setIsExporting] = useState<ExportFormat | null>(null);

  const handleExport = async (format: ExportFormat) => {
    setIsExporting(format);

    try {
      const data = {
        pools,
        historicalData,
        metadata: {
          exportDate: new Date().toISOString(),
          chain: "Dogechain",
          source: "DEX Analytics Dashboard",
        },
      };

      exportData({ format, data });
      onExport?.(format);
    } catch (error) {
      console.error("[QuickExportToolbar] Export failed:", error);
    } finally {
      setIsExporting(null);
    }
  };

  const toolbarButtons = [
    { format: "csv" as ExportFormat, icon: FileText, label: "CSV", color: "text-green-400" },
    { format: "json" as ExportFormat, icon: FileType, label: "JSON", color: "text-blue-400" },
  ];

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {toolbarButtons.map((button) => (
        <button
          key={button.format}
          onClick={() => handleExport(button.format)}
          disabled={isExporting !== null}
          className={`p-2 hover:bg-space-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
          title={`Export as ${button.label}`}
        >
          {isExporting === button.format ? (
            <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          ) : (
            <button.icon className={`w-4 h-4 ${button.color}`} />
          )}
        </button>
      ))}
    </div>
  );
};
