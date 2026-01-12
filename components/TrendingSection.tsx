import React from "react";
import { ImageIcon, Coins, Box, CircleDollarSign, Shield } from "lucide-react";
import { AssetType } from "../types";

// Local TrendingAsset interface matching App.tsx
interface TrendingAsset {
  symbol: string;
  name: string;
  address: string;
  type: AssetType;
  hits: number;
}

interface TrendingSectionProps {
  title: string;
  icon: React.ReactNode;
  assets: TrendingAsset[];
  onAssetClick: (e: React.MouseEvent, asset: TrendingAsset) => void;
}

/**
 * Get icon for trending asset based on type and symbol
 */
function getAssetIcon(asset: TrendingAsset, index: number): React.ReactNode {
  const baseClass = "drop-shadow-[0_0_8px_rgba(255,255,255,0.12)]";

  // NFTs get purple ImageIcon
  if (asset.type === AssetType.NFT) {
    return <ImageIcon className={`${baseClass} text-purple-300`} size={30} strokeWidth={1.5} />;
  }

  // USDT gets emerald CircleDollarSign
  if (asset.symbol === "USDT") {
    return (
      <CircleDollarSign className={`${baseClass} text-emerald-300`} size={30} strokeWidth={1.5} />
    );
  }

  // DC (Dogechain) gets amber Shield
  if (asset.symbol === "DC") {
    return <Shield className={`${baseClass} text-amber-300`} size={30} strokeWidth={1.5} />;
  }

  // wDOGE gets doge-colored Coins
  if (asset.symbol === "wDOGE") {
    return <Coins className={`${baseClass} text-doge-400`} size={30} strokeWidth={1.5} />;
  }

  // Other tokens get alternating blue/pink Box icons
  return (
    <Box
      className={`${baseClass} ${index % 2 === 0 ? "text-blue-300" : "text-pink-300"}`}
      size={30}
      strokeWidth={1.5}
    />
  );
}

/**
 * TrendingSection Component
 *
 * Displays a section of trending assets (tokens or NFTs) in a responsive grid.
 * Each asset is displayed as a clickable tile with icon, symbol, and name.
 *
 * @param title - Section title (e.g., "Trending Tokens", "Trending NFTs")
 * @param icon - Icon to display next to the title
 * @param assets - Array of trending assets to display
 * @param onAssetClick - Callback when an asset tile is clicked
 */
export function TrendingSection({ title, icon, assets, onAssetClick }: TrendingSectionProps) {
  // Don't render section if no assets available
  if (assets.length === 0) {
    return null;
  }

  return (
    <div className="mt-8 px-3 sm:px-0">
      {/* Section Header */}
      <div className="flex items-center justify-center gap-2 text-slate-500 text-xs font-bold uppercase tracking-wider mb-4">
        {icon}
        <span>{title}</span>
      </div>

      {/* Asset Tiles Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-4">
        {assets.map((asset, idx) => {
          const uniqueKey = `${asset.address.toLowerCase()}-${idx}`;
          return (
            <button
              key={uniqueKey}
              onClick={(e) => onAssetClick(e, asset)}
              className="relative p-3 bg-space-800 hover:bg-space-700 rounded-lg border border-space-700 transition-all text-center flex flex-col items-center gap-1 cursor-pointer"
              type="button"
            >
              {/* Asset Icon */}
              <div className="text-xl sm:text-2xl">{getAssetIcon(asset, idx)}</div>

              {/* Asset Symbol */}
              <div className="font-bold text-white text-xs sm:text-sm truncate w-full">
                {asset.symbol}
              </div>

              {/* Asset Name */}
              <div className="text-[10px] sm:text-xs text-slate-400 truncate w-full">
                {asset.name}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
