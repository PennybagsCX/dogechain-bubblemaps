import { Wallet } from "../types";
import { FilterState } from "../contexts/FilterContext";

/**
 * Filter wallets based on the provided filter state
 */
export function filterWallets(wallets: Wallet[], filters: FilterState): Wallet[] {
  let filtered = [...wallets];

  // Apply holding size filter
  if (filters.holdingSize !== "all") {
    filtered = filtered.filter((wallet) => {
      const percentage = wallet.percentage;
      switch (filters.holdingSize) {
        case "micro":
          return percentage < 0.1;
        case "retail":
          return percentage >= 0.1 && percentage < 1;
        case "whale":
          return percentage >= 1 && percentage < 5;
        case "mega":
          return percentage >= 5;
        default:
          return true;
      }
    });
  }

  // Apply label filter
  if (filters.label !== "all") {
    filtered = filtered.filter((wallet) => {
      switch (filters.label) {
        case "labeled":
          return !!wallet.label;
        case "unlabeled":
          return !wallet.label;
        case "contracts":
          return wallet.isContract;
        case "noContracts":
          return !wallet.isContract;
        default:
          return true;
      }
    });
  }

  // Apply activity filter (based on connection count)
  if (filters.activity !== "all") {
    filtered = filtered.filter((wallet) => {
      const connectionCount = wallet.connections?.length || 0;
      switch (filters.activity) {
        case "inactive":
          return connectionCount === 0;
        case "low":
          return connectionCount >= 1 && connectionCount <= 5;
        case "medium":
          return connectionCount > 5 && connectionCount <= 15;
        case "high":
          return connectionCount > 15;
        default:
          return true;
      }
    });
  }

  // Apply quick filters
  if (filters.hideDust) {
    const maxBalance = Math.max(...wallets.map((w) => w.balance));
    const threshold = (maxBalance * 0.01) / 100; // 0.01% of max
    filtered = filtered.filter((wallet) => wallet.balance >= threshold);
  }

  if (filters.hideContracts) {
    filtered = filtered.filter((wallet) => !wallet.isContract);
  }

  if (filters.onlyWhales) {
    filtered = filtered.filter((wallet) => wallet.isWhale || wallet.percentage >= 1);
  }

  // Apply min balance percent filter (existing functionality)
  if (filters.minBalancePercent > 0) {
    const maxBalance = Math.max(...wallets.map((w) => w.balance));
    const threshold = (maxBalance * filters.minBalancePercent) / 100;
    filtered = filtered.filter((wallet) => wallet.balance >= threshold);
  }

  return filtered;
}

/**
 * Get visible wallets (for display) vs hidden wallets (dimmed)
 * Returns two arrays: [visible, hidden]
 */
export function getVisibleAndHiddenWallets(
  wallets: Wallet[],
  filters: FilterState
): [Wallet[], Wallet[]] {
  const filteredIds = new Set(filterWallets(wallets, filters).map((w) => w.id));

  const visible = wallets.filter((w) => filteredIds.has(w.id));
  const hidden = wallets.filter((w) => !filteredIds.has(w.id));

  return [visible, hidden];
}

/**
 * Check if a wallet should be visible based on filters
 */
export function isWalletVisible(
  wallet: Wallet,
  filters: FilterState,
  allWallets: Wallet[]
): boolean {
  const [visible] = getVisibleAndHiddenWallets(allWallets, filters);
  return visible.some((w) => w.id === wallet.id);
}

/**
 * Get filter summary text
 */
export function getFilterSummary(filters: FilterState): string {
  const activeFilters: string[] = [];

  if (filters.holdingSize !== "all") {
    activeFilters.push(filters.holdingSize);
  }

  if (filters.label !== "all") {
    activeFilters.push(filters.label);
  }

  if (filters.activity !== "all") {
    activeFilters.push(filters.activity);
  }

  if (filters.hideDust) {
    activeFilters.push("no dust");
  }

  if (filters.hideContracts) {
    activeFilters.push("no contracts");
  }

  if (filters.onlyWhales) {
    activeFilters.push("whales only");
  }

  if (filters.minBalancePercent > 0) {
    activeFilters.push(`>${filters.minBalancePercent}%`);
  }

  return activeFilters.length > 0 ? activeFilters.join(", ") : "No filters";
}

/**
 * Count active filters
 */
export function countActiveFilters(filters: FilterState): number {
  let count = 0;

  if (filters.holdingSize !== "all") count++;
  if (filters.label !== "all") count++;
  if (filters.activity !== "all") count++;
  if (filters.hideDust) count++;
  if (filters.hideContracts) count++;
  if (filters.onlyWhales) count++;
  if (filters.minBalancePercent > 0) count++;

  return count;
}
