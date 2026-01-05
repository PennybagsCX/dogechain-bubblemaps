/**
 * D3.js Type Definitions
 *
 * This file contains type definitions for D3.js force-directed graph simulation
 * used in the BubbleMap component.
 */

/**
 * Node data structure for D3 force simulation
 * Represents a wallet/node in the bubble visualization
 */
export interface NodeDatum {
  /** Unique identifier for the node */
  id: string;

  /** Wallet address */
  address: string;

  /** Token balance */
  balance: number;

  /** Percentage of total supply */
  percentage: number;

  /** Display label (optional) */
  label?: string;

  /** Color for the node (optional) */
  color?: string;

  /** X position (set by D3) */
  x?: number;

  /** Y position (set by D3) */
  y?: number;

  /** X velocity (set by D3) */
  vx?: number;

  /** Y velocity (set by D3) */
  vy?: number;

  /** Fixed X position (if pinned) */
  fx?: number | null;

  /** Fixed Y position (if pinned) */
  fy?: number | null;

  /** Index in the nodes array */
  index?: number;
}

/**
 * Link data structure for D3 force simulation
 * Represents connections between wallets
 */
export interface LinkDatum {
  /** Source node (can be node id or node object) */
  source: string | NodeDatum;

  /** Target node (can be node id or node object) */
  target: string | NodeDatum;

  /** Value/strength of the connection */
  value: number;

  /** Index in the links array */
  index?: number;
}
