import React, { useCallback, useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { Wallet, Link, AssetType } from "../types";
import { ensureLPDetectionInitialized } from "../services/db";
import { useFilters } from "../contexts/FilterContext";

/* eslint-disable @typescript-eslint/no-explicit-any */
// D3.js requires 'any' types for its dynamic simulation system
import { filterWallets } from "../utils/filterUtils";
import { handleTouchStopPropagation } from "../utils/touchHandlers";
import { useClickOutside } from "../hooks/useClickOutside";
import {
  Move,
  MousePointer2,
  ZoomIn,
  ZoomOut,
  HelpCircle,
  Crosshair,
  Camera,
  Pause,
  Play,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Settings,
  X,
  Layers,
  RefreshCw,
} from "lucide-react";
import { Tooltip } from "./Tooltip";

interface BubbleMapProps {
  wallets: Wallet[];
  links: Link[];
  onWalletClick: (wallet: Wallet | null) => void;
  assetType: AssetType;
  userAddress?: string | null;
  width?: number; // Optional now, used for initial override only
  height?: number; // Optional now
  targetWalletId?: string | null; // New: ID of wallet to zoom to
  onConnectionClick?: (link: Link) => void; // Handler for clicking connections (view details)
  selectedConnectionId?: string | null; // ID of selected connection for persistent highlight
  freezeLayout?: boolean;
  onOpenFilters?: () => void; // When true, defer resize-driven rebuilds (e.g., while modals open)
  tokenAddress?: string; // Token address for saving/restoring map state
}

type NodeDatum = Wallet & {
  r: number;
  x: number;
  y: number;
  fx?: number | null;
  fy?: number | null;
  rank: number;
};

type LinkDatum = {
  source: string | NodeDatum;
  target: string | NodeDatum;
  value: number;
};

// Minimum bubble radius to render text labels (prevents overflow on tiny bubbles)
const MIN_LABEL_RADIUS = 14;

export const BubbleMap: React.FC<BubbleMapProps> = ({
  wallets,
  links,
  onWalletClick,
  assetType,
  userAddress,
  width: initialWidth,
  height: initialHeight,
  targetWalletId,
  onConnectionClick,
  selectedConnectionId,
  freezeLayout = false,
  onOpenFilters,
  // @ts-expect-error tokenAddress used by future map state persistence
  tokenAddress, // eslint-disable-line @typescript-eslint/no-unused-vars
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const legendRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const mobileControlsRef = useRef<HTMLDivElement>(null);
  const helpMenuRef = useRef<HTMLDivElement>(null);
  const resizeRafRef = useRef<number | null>(null);
  const resizeDebounceRef = useRef<number | null>(null);
  const pendingSizeRef = useRef<{ width: number; height: number } | null>(null);
  const lastAppliedSizeRef = useRef<{ width: number; height: number } | null>(null);
  const pendingWhileFrozenRef = useRef<{ width: number; height: number } | null>(null);
  const freezeLayoutRef = useRef<boolean>(freezeLayout);
  const [dimensions, setDimensions] = useState({
    width: initialWidth || 800,
    height: initialHeight || 600,
  });
  const [hasMeasured, setHasMeasured] = useState<boolean>(!!(initialWidth && initialHeight));

  // Prevent redundant dimension updates that can cause double renders/reflows
  const updateDimensions = useCallback((width: number, height: number) => {
    // If layout is frozen (e.g., overlay open), just record the pending size and exit
    if (freezeLayoutRef.current) {
      pendingWhileFrozenRef.current = { width, height };
      return;
    }

    // Normalize sizes to integers to avoid sub-pixel churn
    const nextWidth = Math.round(width);
    const nextHeight = Math.round(height);

    // Cancel any in-flight frame to avoid back-to-back updates in the same frame burst
    if (resizeRafRef.current !== null) {
      cancelAnimationFrame(resizeRafRef.current);
    }

    // Debounce to coalesce rapid overlay/scrollbar/layout changes into a single update
    pendingSizeRef.current = { width: nextWidth, height: nextHeight };

    resizeRafRef.current = requestAnimationFrame(() => {
      if (resizeDebounceRef.current !== null) {
        clearTimeout(resizeDebounceRef.current);
      }

      resizeDebounceRef.current = window.setTimeout(() => {
        resizeDebounceRef.current = null;

        const pending = pendingSizeRef.current;
        if (!pending) return;

        const tolerance = 3; // px: ignore negligible jitter (e.g., scrollbars toggling)
        const lastApplied = lastAppliedSizeRef.current;
        const widthUnchanged = lastApplied
          ? Math.abs(lastApplied.width - pending.width) <= tolerance
          : false;
        const heightUnchanged = lastApplied
          ? Math.abs(lastApplied.height - pending.height) <= tolerance
          : false;

        if (widthUnchanged && heightUnchanged) {
          pendingSizeRef.current = null;
          return;
        }

        setDimensions({ width: pending.width, height: pending.height });
        lastAppliedSizeRef.current = pending;
        setHasMeasured(true);
        pendingSizeRef.current = null;
      }, 200);

      resizeRafRef.current = null;
    });
  }, []);

  // Apply any pending size once freeze is lifted
  useEffect(() => {
    freezeLayoutRef.current = freezeLayout;
    if (!freezeLayout && pendingWhileFrozenRef.current) {
      const { width, height } = pendingWhileFrozenRef.current;
      pendingWhileFrozenRef.current = null;
      updateDimensions(width, height);
    }
  }, [freezeLayout, updateDimensions]);

  const zoomTransformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const simulationRef = useRef<d3.Simulation<any, undefined> | null>(null);
  const previousLinksLengthRef = useRef<number>(0);
  const nodePositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const pendingZoomTargetRef = useRef<string | null>(null);
  const pendingZoomHandledRef = useRef<boolean>(false);

  // Store function props in refs to prevent unnecessary rebuilds
  const onWalletClickRef = useRef(onWalletClick);
  const onConnectionClickRef = useRef(onConnectionClick);
  // Provide safe defaults to avoid undefined during initial render
  const getNodeColorRef = useRef<(d: any) => string>(() => "#06b6d4");
  const handleSelectNodeRef = useRef<(w: Wallet | null) => void>(() => {});

  const [isPaused, setIsPaused] = useState(false);
  const [isLegendOpen, setIsLegendOpen] = useState(false);
  const toggleLegend = useCallback((e?: React.MouseEvent | React.TouchEvent) => {
    if (e) {
      e.stopPropagation();
    }
    setIsLegendOpen((prev) => !prev);
  }, []);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isHelpMenuOpen, setIsHelpMenuOpen] = useState(false);
  const [userNodeFound, setUserNodeFound] = useState(false);
  const [isSnapshotting, setIsSnapshotting] = useState(false);
  const isDraggingRef = useRef(false);
  const [areControlsOpen, setAreControlsOpen] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth >= 768; // default open on desktop, collapsed on small screens
    }
    return true;
  });

  // Close quick-help modal with Escape
  useEffect(() => {
    if (!isHelpOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsHelpOpen(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isHelpOpen]);

  const closeLegend = useCallback(() => setIsLegendOpen(false), []);
  const closeControls = useCallback(() => setAreControlsOpen(false), []);
  const closeHelpMenu = useCallback(() => setIsHelpMenuOpen(false), []);

  // Simple click-outside hooks for remaining overlays
  useClickOutside(legendRef, closeLegend, isLegendOpen);
  useClickOutside(helpMenuRef, closeHelpMenu, isHelpMenuOpen);
  useClickOutside(controlsRef, closeControls, areControlsOpen);
  useClickOutside(mobileControlsRef, closeControls, areControlsOpen);
  // --- LP DETECTION INITIALIZATION ---
  useEffect(() => {
    // Initialize LP detection database on first load (non-blocking)
    ensureLPDetectionInitialized();
  }, []);

  // Keep track of selected index for keyboard nav
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const lastSelectedIdRef = useRef<string | null>(null);

  // Keep track of selected connection
  const lastSelectedConnectionIdRef = useRef<string | null>(null);

  // Helper: apply highlight and label visibility for a given wallet id
  const applySelectionHighlight = (walletId: string | null, _showLabels: boolean) => {
    if (!svgRef.current) return;

    const nodeSelection = d3.select(svgRef.current).selectAll(".synapse-node");
    const nodeWrapperSelection = d3
      .select(svgRef.current)
      .selectAll<SVGGElement, any>(".node-wrapper");
    const bubbleLabelSelection = d3.select(svgRef.current).selectAll(".bubble-label");

    // Clear previous
    nodeSelection.classed("node-selected", false);
    lastSelectedIdRef.current = null;
    if (!walletId) {
      const k = zoomTransformRef.current?.k ?? 1;
      bubbleLabelSelection
        .style("display", (d: any) => (d.r * k >= MIN_LABEL_RADIUS ? "block" : "none"))
        .style("opacity", 1);
      return;
    }

    // Highlight target
    nodeSelection.filter((d: any) => d.id === walletId).classed("node-selected", true);
    lastSelectedIdRef.current = walletId;

    // Raise the entire wrapper so labels remain above the circle
    nodeWrapperSelection.filter((d: any) => d.id === walletId).raise();

    // Ensure label visible for target (always show for selected wallet)
    bubbleLabelSelection
      .filter((d: any) => d.id === walletId)
      .style("display", "block")
      .style("opacity", 1)
      .raise();
  };

  // Helper: apply connection selection highlight
  const applyConnectionHighlight = useCallback((connectionId: string | null) => {
    if (!svgRef.current) return;

    const linkSelection = d3.select(svgRef.current).selectAll(".link-wrapper");

    // Clear previous selection
    linkSelection.select(".neural-vein").classed("link-selected", false);
    lastSelectedConnectionIdRef.current = null;

    if (!connectionId) {
      // Reset all links to default
      linkSelection
        .select(".neural-vein")
        .transition()
        .duration(150)
        .attr("stroke", "url(#veinGradient)")
        .attr("stroke-width", 3)
        .attr("stroke-dasharray", "4, 4")
        .attr("opacity", 0.6)
        .style("filter", "none")
        .style("animation-play-state", "running");

      // Reset pointer events to allow bubbles to be clicked
      linkSelection.style("pointer-events", "none");
      linkSelection.select(".link-hitbox").style("pointer-events", "all");
      return;
    }

    // Highlight selected connection with purple glow
    linkSelection
      .filter((d: any) => {
        const source = d.source;
        const target = d.target;

        // Handle both string IDs and node objects with id property
        const sourceId = typeof source === "string" ? source : source?.id;
        const targetId = typeof target === "string" ? target : target?.id;

        if (!sourceId || !targetId) return false;

        return `${sourceId}-${targetId}` === connectionId;
      })
      .select(".neural-vein")
      .classed("link-selected", true)
      .style("animation-play-state", "paused")
      .transition()
      .duration(150)
      .attr("stroke", "#a855f7")
      .attr("stroke-width", 6)
      .attr("stroke-dasharray", "none")
      .attr("opacity", 1)
      .style("filter", "drop-shadow(0 0 8px rgba(168, 85, 247, 0.8))");

    lastSelectedConnectionIdRef.current = connectionId;
  }, []);

  // --- MAP SETTINGS - Use Filter Context ---
  const { filters } = useFilters();
  const showLinks = filters.showLinks;
  const showLabels = filters.showLabels;

  // Helper: map click selection to parent + highlight
  const handleSelectNode = useCallback(
    (wallet: Wallet | null) => {
      onWalletClickRef.current(wallet);
      applySelectionHighlight(wallet ? wallet.id : null, showLabels);
    },
    [showLabels]
  );

  // Helper: get node color based on properties
  const getNodeColor = useCallback(
    (d: any) => {
      if (userAddress && d.address.toLowerCase() === userAddress.toLowerCase()) return "#fbbf24"; // Amber-400 (User)
      if (d.label) return "#a855f7"; // Purple-500 (Known Entity)
      if (d.isContract) return "#a855f7"; // Purple-500 (Known Entity)

      // Logic for NFTs (Count based)
      if (assetType === AssetType.NFT) {
        const bal = d.balance;
        if (bal >= 50) return "#ef4444"; // Red (Hot)
        if (bal >= 20) return "#f97316"; // Orange
        if (bal >= 5) return "#eab308"; // Yellow
        if (bal >= 2) return "#10b981"; // Green
        return "#06b6d4"; // Cyan (Cold)
      }

      // Logic for Tokens (Percentage based)
      const pct = d.percentage;
      if (pct >= 5.0) return "#ef4444"; // Red (Massive)
      if (pct >= 1.0) return "#f97316"; // Orange (Whale)
      if (pct >= 0.5) return "#eab308"; // Yellow (Large)
      if (pct >= 0.1) return "#10b981"; // Green (Medium)
      return "#06b6d4"; // Cyan (Retail)
    },
    [userAddress, assetType]
  );

  // Update refs when functions change (must be after function definitions)
  useEffect(() => {
    onWalletClickRef.current = onWalletClick;
    onConnectionClickRef.current = onConnectionClick;
    getNodeColorRef.current = getNodeColor;
    handleSelectNodeRef.current = handleSelectNode;
  }, [onWalletClick, onConnectionClick, getNodeColor, handleSelectNode]);

  // --- RESIZE OBSERVER ---
  // Track container size; mark measured once we have a real measurement
  useEffect(() => {
    if (!containerRef.current) return;

    // Initial measure on mount
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      updateDimensions(rect.width, rect.height);
    }

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          updateDimensions(width, height);
        }
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => {
      resizeObserver.disconnect();
      if (resizeRafRef.current !== null) {
        cancelAnimationFrame(resizeRafRef.current);
      }
      if (resizeDebounceRef.current !== null) {
        clearTimeout(resizeDebounceRef.current);
      }
    };
  }, [updateDimensions]);

  // --- KEYBOARD NAVIGATION HANDLER ---
  useEffect(() => {
    const handleKeyNav = (e: KeyboardEvent) => {
      if (wallets.length === 0) return;

      // Only capture arrows if svg focused or body focused (to avoid capturing in inputs)
      if (
        document.activeElement &&
        (document.activeElement.tagName === "INPUT" ||
          document.activeElement.tagName === "TEXTAREA")
      )
        return;

      let newIndex = focusedIndex;

      const getWalletAt = (idx: number): Wallet | null => {
        const next = wallets[idx];
        return next ?? null;
      };

      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        newIndex = focusedIndex === null ? 0 : (focusedIndex + 1) % wallets.length;
        setFocusedIndex(newIndex);
        handleSelectNodeRef.current(getWalletAt(newIndex));
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        newIndex =
          focusedIndex === null
            ? wallets.length - 1
            : (focusedIndex - 1 + wallets.length) % wallets.length;
        setFocusedIndex(newIndex);
        handleSelectNodeRef.current(getWalletAt(newIndex));
      }
    };

    window.addEventListener("keydown", handleKeyNav);
    return () => window.removeEventListener("keydown", handleKeyNav);
  }, [wallets, focusedIndex, onWalletClick]);

  // --- DEBUG: Log labeled wallets on mount ---
  useEffect(() => {
    if (wallets.length > 0) {
      const labeled = wallets.filter((w) => w.label);
      if (labeled.length > 0) {
        labeled.forEach((_w) => {
          // Debug logging for LP pools
        });
      }
    }
  }, [wallets]);

  // --- UPDATE VISIBILITY ---
  // This effect handles ONLY cosmetic visibility (links).
  // Labels are now zoom-aware and managed by the zoom handler, not by showLabels toggle.
  // Filter-based node hiding/re-arranging is handled by the main D3 rebuild effect
  // which completely excludes non-matching wallets from the simulation.
  useEffect(() => {
    if (!svgRef.current || wallets.length === 0 || !hasMeasured) return;

    const svg = d3.select(svgRef.current);

    // Update Links visibility
    svg.selectAll(".neural-vein").style("display", showLinks ? "block" : "none");

    // Labels are now zoom-aware: visibility is controlled by the zoom handler
    // based on effective radius (zoom scale * node radius). No global toggle needed.
  }, [showLinks, showLabels, wallets.length, hasMeasured]);

  useEffect(() => {
    if (!svgRef.current || wallets.length === 0 || !hasMeasured) return;
    const { width, height } = dimensions;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clear previous render

    // Add desktop optimization - prevent browser interference with drag
    svg.style("touch-action", "none");

    // Check if user is in the dataset
    const foundUser = userAddress
      ? wallets.some((w) => w.address.toLowerCase() === userAddress.toLowerCase())
      : false;
    setUserNodeFound(foundUser);

    // --- DEFINITIONS ---
    const defs = svg.append("defs");

    // 1. Glow Filter (Sci-Fi effect)
    const filter = defs
      .append("filter")
      .attr("id", "glow")
      .attr("x", "-50%")
      .attr("y", "-50%")
      .attr("width", "200%")
      .attr("height", "200%");

    filter.append("feGaussianBlur").attr("stdDeviation", "2").attr("result", "coloredBlur");

    const feMerge = filter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "coloredBlur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    // 2. Connection Gradient (Neural Vein)
    const gradient = defs
      .append("linearGradient")
      .attr("id", "veinGradient")
      .attr("gradientUnits", "userSpaceOnUse");
    gradient.append("stop").attr("offset", "0%").attr("stop-color", "#22d3ee"); // Cyan
    gradient.append("stop").attr("offset", "50%").attr("stop-color", "#a855f7"); // Purple
    gradient.append("stop").attr("offset", "100%").attr("stop-color", "#f472b6"); // Pink

    // --- DATA PREPARATION ---
    // Apply filters to determine which wallets participate in the simulation.
    const filteredWallets = filterWallets(wallets, filters);
    const visibleWalletIds = new Set(filteredWallets.map((w) => w.id));

    // Only include filtered wallets in the simulation
    const nodes: NodeDatum[] = filteredWallets.map((w, idx) => {
      const savedPosition = nodePositionsRef.current.get(w.id);
      return {
        ...w,
        x: savedPosition?.x ?? width / 2,
        y: savedPosition?.y ?? height / 2,
        rank: idx + 1,
      };
    }) as NodeDatum[];

    // Filter links to only include connections between visible wallets
    const filteredLinks = links.filter((link) => {
      const sourceId = typeof link.source === "string" ? link.source : link.source.id;
      const targetId = typeof link.target === "string" ? link.target : link.target.id;
      return visibleWalletIds.has(sourceId) && visibleWalletIds.has(targetId);
    });

    const maxBalance = d3.max(nodes, (d: NodeDatum) => d.balance) || 1;
    const minBalance = d3.min(nodes, (d: NodeDatum) => d.balance) || 0;

    const radiusScale = d3.scaleSqrt().domain([minBalance, maxBalance]).range([8, 50]);

    nodes.forEach((n) => {
      n.r = radiusScale(n.balance);
    });

    // HYBRID LAYOUT: Initial Pack (only for nodes without saved positions)
    const pack = d3.pack().size([width, height]).padding(12);

    const root = d3.hierarchy({ children: nodes }).sum((d: any) => d.balance);

    const packedData = pack(root as any).leaves() as Array<{ x?: number; y?: number }>;

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const packed = packedData[i];
      if (!node || !packed) continue;
      // Only use pack position if we don't have a saved position
      const savedPosition = nodePositionsRef.current.get(node.id);
      if (!savedPosition) {
        if (packed.x !== undefined) node.x = packed.x;
        if (packed.y !== undefined) node.y = packed.y;
      }
    }

    const linksCopy: LinkDatum[] = filteredLinks.map((l) => {
      const sourceId = typeof l.source === "string" ? l.source : l.source.id;
      const targetId = typeof l.target === "string" ? l.target : l.target.id;
      return { source: sourceId, target: targetId, value: l.value };
    });

    previousLinksLengthRef.current = links.length;

    // --- LAYOUT ENGINE: FORCE SIMULATION ---
    // Check if we have saved positions AND simulation has ended before
    const hasSettledPositions =
      nodes.length > 0 && nodes.every((n) => nodePositionsRef.current.has(n.id));

    const simulation = d3
      .forceSimulation(nodes)
      .velocityDecay(0.35)
      .alphaDecay(0.012)
      .alpha(hasSettledPositions ? 0.8 : 1)
      .force(
        "link",
        d3
          .forceLink<NodeDatum, LinkDatum>(linksCopy)
          .id((d: NodeDatum) => d.id)
          .distance((d: any) => {
            // Dynamic link distance based on connected node sizes
            const src = d.source as NodeDatum;
            const tgt = d.target as NodeDatum;
            return Math.max(src.r + tgt.r + 50, 100);
          })
          .strength(0.06)
      )
      .force(
        "charge",
        d3
          .forceManyBody<NodeDatum>()
          .strength((d: NodeDatum) => -Math.max(d.r * 6, 60) - 30)
          .distanceMax(500)
      )
      .force(
        "collide",
        d3
          .forceCollide<NodeDatum>()
          .radius((d: NodeDatum) => {
            // Generous padding to guarantee no visual overlap
            if (d.r >= 25) return d.r + 18;
            if (d.r >= 15) return d.r + 14;
            return d.r + 10;
          })
          .strength(1.0)
          .iterations(8)
      )
      .force("x", d3.forceX(width / 2).strength(0.01))
      .force("y", d3.forceY(height / 2).strength(0.015));

    simulationRef.current = simulation;

    // Group for Zooming
    const g = svg.append("g");

    // Handle background click for deselection
    const handleBackgroundClick = (event: any) => {
      // If clicking directly on the SVG (background) and not a node
      if (event && event.target === svg.node()) {
        onWalletClickRef.current(null);
        setFocusedIndex(null);
        applySelectionHighlight(null, showLabels);

        // Clear connection selection
        lastSelectedConnectionIdRef.current = null;
        applyConnectionHighlight(null);

        // Clear mobile link highlights
        if (highlightedLinks.size > 0) {
          highlightedLinks.clear();
          // Reset all links to normal appearance
          svg
            .selectAll(".link-wrapper .neural-vein")
            .transition()
            .duration(150)
            .attr("stroke", "url(#veinGradient)")
            .attr("stroke-width", 3)
            .attr("stroke-dasharray", "4, 4")
            .attr("opacity", 0.6)
            .style("filter", "none")
            .style("animation-play-state", "running");
        }
      }
    };
    svg.on("click", handleBackgroundClick as any);

    // --- RENDER: CONNECTIONS ---
    // Create wider invisible clickable areas for easier selection
    const linkGroup = g.append("g").attr("class", "links");

    const linkSelection = linkGroup
      .selectAll("g.link-wrapper")
      .data(linksCopy)
      .enter()
      .append("g")
      .attr("class", "link-wrapper")
      .style("pointer-events", "none"); // Wrapper itself should be none to let events through to nodes below if not hovering hitbox

    // Invisible wide path for easier clicking (the "hitbox")
    linkSelection
      .append("path")
      .attr("class", "link-hitbox")
      .attr("stroke", "transparent")
      .attr("stroke-width", 8) // Reduced from 20 to prevent accidental node interception
      .attr("fill", "none")
      .attr("opacity", 0)
      .style("cursor", "pointer")
      .style("pointer-events", "all") // ACTIVE point events on hitbox so it catches mouseover
      .attr("role", "button")
      .attr("aria-label", () => `Connection. Click to remove.`)
      .style("display", showLinks ? "block" : "none");

    // Visible path (the actual connection line)
    linkSelection
      .append("path")
      .attr("stroke", "url(#veinGradient)")
      .attr("stroke-width", 3)
      .attr("fill", "none")
      .attr("opacity", 0.6)
      .attr("stroke-dasharray", "4, 4")
      .attr("class", "neural-vein")
      .style("pointer-events", "none") // Let events pass through to hitbox
      .style("display", showLinks ? "block" : "none");

    // Track highlighted links for mobile two-tap removal
    const highlightedLinks = new Set<string>();

    // Helper to get link ID
    const getLinkId = (d: LinkDatum | any) => {
      // Check if this is an event object (not actual data)
      if (!d || typeof d !== "object" || !("source" in d) || !("target" in d)) {
        return null;
      }

      const source = d.source;
      const target = d.target;

      // Handle both string IDs and node objects with id property
      const sourceId = typeof source === "string" ? source : (source as any)?.id;
      const targetId = typeof target === "string" ? target : (target as any)?.id;

      if (!sourceId || !targetId) {
        return null;
      }

      return `${sourceId}-${targetId}`;
    };

    // Link click and hover handlers on hitbox
    linkSelection
      .on("click", (event: any, d: LinkDatum) => {
        event.stopPropagation();

        if (!onConnectionClick) return;

        const linkId = getLinkId(d);
        if (!linkId) return; // Guard against invalid link data

        const isTouch = "ontouchstart" in window;

        if (isTouch) {
          // Mobile: Two-tap to view details
          const wrapper = d3.select(event.currentTarget);
          const visiblePath = wrapper.select(".neural-vein");

          if (highlightedLinks.has(linkId)) {
            // Second tap: View connection details
            highlightedLinks.delete(linkId);

            const source = d.source;
            const target = d.target;

            const link: Link = {
              source: typeof source === "string" ? source : (source as any)?.id || source,
              target: typeof target === "string" ? target : (target as any)?.id || target,
              value: d.value,
            };

            onConnectionClickRef.current?.(link);
          } else {
            // First tap: Highlight the connection
            // Clear other highlights
            highlightedLinks.clear();
            highlightedLinks.add(linkId);

            // Reset all other links
            linkSelection
              .select(".neural-vein")
              .transition()
              .duration(150)
              .attr("stroke", "url(#veinGradient)")
              .attr("stroke-width", 3)
              .attr("stroke-dasharray", "4, 4")
              .attr("opacity", 0.6)
              .style("filter", "none")
              .style("animation-play-state", "running");

            // Highlight this link
            visiblePath
              .style("animation-play-state", "paused")
              .transition()
              .duration(150)
              .attr("stroke", "#a855f7") // Purple color
              .attr("stroke-width", 6)
              .attr("stroke-dasharray", "none")
              .attr("opacity", 1)
              .style("filter", "drop-shadow(0 0 8px rgba(168, 85, 247, 0.8))"); // Purple glow
          }
        } else {
          // Desktop: Single click to view details
          const linkId = getLinkId(d);
          if (!linkId) return; // Guard against invalid link data

          // Clear wallet selection
          onWalletClickRef.current(null);
          setFocusedIndex(null);
          applySelectionHighlight(null, showLabels);

          // Set connection selection highlight (parent manages state via onConnectionClick)
          applyConnectionHighlight(linkId);

          const source = d.source;
          const target = d.target;

          const link: Link = {
            source: typeof source === "string" ? source : (source as any)?.id || source,
            target: typeof target === "string" ? target : (target as any)?.id || target,
            value: d.value,
          };

          onConnectionClick(link);
        }
      })
      .on("mouseover", (_event: any, _d: LinkDatum) => {
        // Turn connection purple to indicate details available
        const wrapper = d3.select(_event.currentTarget);

        // Set cursor to pointer
        wrapper.style("cursor", "pointer");

        wrapper
          .select(".neural-vein")
          .style("animation-play-state", "paused") // Pause animation
          .transition()
          .duration(150)
          .attr("stroke", "#a855f7") // Purple color
          .attr("stroke-width", 6) // Thicker for easier clicking
          .attr("stroke-dasharray", "none") // Solid line (not dashed)
          .attr("opacity", 1)
          .style("filter", "drop-shadow(0 0 8px rgba(168, 85, 247, 0.8))"); // Purple glow
      })
      .on("mouseout", (_event: any, d: LinkDatum) => {
        const wrapper = d3.select(_event.currentTarget);

        // Don't reset appearance if this link is highlighted on mobile
        const linkId = getLinkId(d);
        if (!linkId) return; // Guard against invalid link data

        // Don't reset if this link is selected (persistent highlight)
        if (linkId === lastSelectedConnectionIdRef.current) {
          return;
        }

        if (highlightedLinks.has(linkId)) {
          return;
        }

        // Restore gradient appearance
        wrapper
          .select(".neural-vein")
          .transition()
          .duration(150)
          .style("animation-play-state", "running");
      });

    // --- INTERACTION HANDLERS ---
    // Use 'any' type for element to allow attaching to both Group and Circle
    const drag = d3
      .drag<any, NodeDatum>()
      // Set the container to the zoom <g> element directly.
      // This is critical because:
      // 1. The default container is the circle's parent (node-wrapper <g>),
      //    whose transform changes on EVERY simulation tick — this creates a
      //    feedback loop where getScreenCTM() returns different matrices each
      //    frame, producing ghost/double bubbles.
      // 2. The zoom <g> is stable (only changes on zoom events), so drag
      //    coordinates are resolved consistently in simulation-space.
      // 3. Since `g` is the zoom transform target, event.x/y are already in
      //    simulation coordinates — no manual zoom inversion needed.
      .container(g.node() as SVGGElement)
      .on("start", (event: any, d: NodeDatum) => {
        isDraggingRef.current = true;

        // Interrupt any running D3 transitions on ALL nodes to prevent
        // visual conflicts between scheduled opacity/style tweens and
        // the simulation tick handler's position updates.
        nodeWrapperSelection.interrupt();
        nodeSelection.interrupt();
        linkSelection.select(".neural-vein").interrupt();

        // Fix the node position at its current location
        d.fx = d.x;
        d.fy = d.y;

        d3.select(event.sourceEvent.target).attr("cursor", "grabbing");
      })
      .on("drag", (event: any, d: NodeDatum) => {
        // With .container(g), event.x/y are already in simulation-space
        // because `g` is the zoom transform target.
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event: any, d: NodeDatum) => {
        // Release the fixed position so the simulation can settle the node
        isDraggingRef.current = false;
        d.fx = null;
        d.fy = null;
        d3.select(event.sourceEvent.target).attr("cursor", "grab");

        // Gently reheat simulation so neighbors can settle after the drag.
        if (simulationRef.current) {
          simulationRef.current.alpha(0.15).restart();
        }
      });

    // --- RENDER: WALLETS ---
    const nodeGroup = g.append("g").attr("class", "nodes");

    // Ensure nodes are ALWAYS on top of links in the DOM initial order
    nodeGroup.raise();

    // Create a wrapper group for each node (will contain circle + labels)
    const nodeWrapperSelection = nodeGroup
      .selectAll("g.node-wrapper")
      .data(nodes)
      .enter()
      .append("g")
      .attr("class", "node-wrapper")
      .attr("transform", (d: NodeDatum) => `translate(${d.x},${d.y})`);

    // Render circle inside the wrapper
    const nodeSelection = nodeWrapperSelection
      .append("circle")
      .attr("r", (d: NodeDatum) => d.r)
      .attr("class", (d: NodeDatum) => {
        const isUser = userAddress && d.address.toLowerCase() === userAddress.toLowerCase();
        return `synapse-node ${isUser ? "user-node" : ""}`;
      })
      .attr("fill", (d: NodeDatum) => getNodeColorRef.current(d))
      .attr("stroke", (d: NodeDatum) => {
        const isUser = userAddress && d.address.toLowerCase() === userAddress.toLowerCase();
        if (isUser) return "#ffffff"; // Bright white stroke for user
        return d3.color(getNodeColorRef.current(d))?.brighter(0.8).formatHex() || "#fff";
      })
      .attr("stroke-width", (d: NodeDatum) => {
        const isUser = userAddress && d.address.toLowerCase() === userAddress.toLowerCase();
        return isUser ? 3 : 1;
      })
      .style("filter", "url(#glow)")
      .attr("cursor", "grab")
      .attr("aria-label", (d: NodeDatum) => `Wallet ${d.address}, Balance ${d.balance}`)
      .attr("role", "button")
      .attr("tabindex", "0");

    // Attach Drag, Click, and Keydown handlers to the circle (direct target)
    nodeSelection
      .call(drag)
      .on("click", (event: any, d: NodeDatum) => {
        event.stopPropagation();

        // Clear connection selection
        lastSelectedConnectionIdRef.current = null;
        applyConnectionHighlight(null);

        handleSelectNodeRef.current(d);
        setFocusedIndex(wallets.indexOf(d));
      })
      .on("keydown", (event: any, d: NodeDatum) => {
        if (event.key === "Enter" || event.key === " ") {
          handleSelectNodeRef.current(d);
          setFocusedIndex(wallets.indexOf(d));
        }
      });

    // On touch devices, skip hover animations to prevent race conditions with tap/click
    const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;

    // Attach hover handlers to the wrapper group
    nodeWrapperSelection
      .on("mouseover", (_event: any, d: NodeDatum) => {
        // Skip hover on touch devices
        if (isTouchDevice || isDraggingRef.current) return;
        // Apply advanced filters for hover state
        const visibleWalletIds = new Set(wallets.map((w) => w.id));

        // Logic to dim everyone but connected
        nodeSelection
          .interrupt()
          .transition()
          .duration(200)
          .attr("opacity", (n: NodeDatum) => {
            // If node should be hidden by filters, keep it hidden (0.1)
            if (
              !visibleWalletIds.has(n.id) &&
              !(userAddress && n.address.toLowerCase() === userAddress.toLowerCase())
            ) {
              return 0.1;
            }
            return 0.15;
          })
          .style("filter", "none");

        linkSelection
          .select(".neural-vein")
          .interrupt()
          .transition()
          .duration(200)
          .attr("opacity", 0.05);

        // NOTE: Labels are NO LONGER dimmed on hover - they stay fully visible

        const connectedIds = new Set<string>();
        connectedIds.add(d.id);

        linkSelection
          .filter(
            (l: LinkDatum) =>
              (l.source as NodeDatum).id === d.id || (l.target as NodeDatum).id === d.id
          )
          .select(".neural-vein") // Target the visible path inside wrapper
          .interrupt()
          .transition()
          .duration(200)
          .attr("opacity", 1)
          .attr("stroke-width", 4)
          .attr("stroke", "#ffffff")
          .style("filter", "url(#glow)")
          .style("display", "block") // Force show even if filtered hidden
          .each((l: LinkDatum) => {
            connectedIds.add((l.source as NodeDatum).id);
            connectedIds.add((l.target as NodeDatum).id);
          });

        nodeSelection
          .filter((n: NodeDatum) => connectedIds.has(n.id))
          .interrupt()
          .transition()
          .duration(400)
          .attr("opacity", 1)
          .attr("stroke-width", (n: NodeDatum) => {
            const isUser = userAddress && n.address.toLowerCase() === userAddress.toLowerCase();
            return isUser ? 3 : 1;
          })
          .attr("stroke", (n: NodeDatum) => {
            const isUser = userAddress && n.address.toLowerCase() === userAddress.toLowerCase();
            if (isUser) return "#ffffff";
            return d3.color(getNodeColorRef.current(n))?.brighter(0.8).formatHex() || "#fff";
          })
          .attr("fill", (n: NodeDatum) => getNodeColorRef.current(n))
          .style("filter", "url(#glow)");

        linkSelection
          .filter(
            (l: LinkDatum) =>
              (l.source as NodeDatum).id === d.id || (l.target as NodeDatum).id === d.id
          )
          .select(".neural-vein") // Target the visible path inside wrapper
          .interrupt()
          .transition()
          .duration(400)
          .attr("opacity", 0.5)
          .attr("stroke", "url(#veinGradient)")
          .attr("stroke-width", 2)
          .style("filter", "none")
          .style("display", showLinks ? "block" : "none"); // Respect filter

        // NOTE: Labels are NOT filtered - all labels stay visible during hover
      })
      .on("mouseout", (_event: any) => {
        // Skip mouseout on touch devices
        if (isTouchDevice || isDraggingRef.current) return;
        // Remove hover state from wrapper
        d3.select(_event.currentTarget).classed("hovering", false);

        // Apply advanced filters for reset state
        const visibleWalletIds = new Set(wallets.map((w) => w.id));

        // Reset all nodes to normal appearance
        nodeSelection
          .interrupt()
          .transition()
          .duration(200)
          .attr("opacity", (d: NodeDatum) => {
            if (userAddress && d.address.toLowerCase() === userAddress.toLowerCase()) return 1;
            return visibleWalletIds.has(d.id) ? 1 : 0.1;
          })
          .style("filter", "url(#glow)");
        linkSelection
          .select(".neural-vein")
          .interrupt()
          .transition()
          .duration(200)
          .attr("opacity", 0.6)
          .attr("stroke", "url(#veinGradient)")
          .attr("stroke-width", 3)
          .attr("stroke-dasharray", "4, 4")
          .style("filter", "none")
          .style("animation-play-state", "running");

        // NOTE: Labels are NOT reset - they stay visible throughout since we no longer dim them on hover
      });

    // --- UNIFIED BUBBLE LABEL ---
    // Single text element with stacked tspans for clean vertical layout:
    //   Labeled wallets: #N → Label → X.X%  (3 lines)
    //   Unlabeled wallets: #N → X.X%        (2 lines)
    const bubbleLabelSelection = nodeWrapperSelection
      .append("text")
      .attr("class", "bubble-label")
      .attr("text-anchor", "middle")
      .attr("fill", "#fff")
      .attr("font-weight", "700")
      .style("pointer-events", "none")
      .style("text-shadow", "0px 1px 3px rgba(0,0,0,0.9)")
      .style("display", (d: NodeDatum) => (d.r >= MIN_LABEL_RADIUS ? "block" : "none"))
      .attr("opacity", 1)
      .each(function (d: NodeDatum) {
        const text = d3.select(this);
        const isUser = userAddress && d.address.toLowerCase() === userAddress.toLowerCase();
        const hasLabel = !!d.label;
        const lineCount = hasLabel || isUser ? 3 : 2;
        const pct = `${d.percentage.toFixed(1)}%`;
        const rankStr = `#${d.rank}`;

        // Font sizing: scale to fit inside bubble with room for all lines
        // Each line needs ~1.2em of height; we need total text height < diameter
        const maxFontSize = (d.r * 2) / (lineCount * 1.3);
        const baseFontSize = Math.min(maxFontSize, d.r < 18 ? 7 : d.r < 30 ? 9 : 11);
        const pctFontSize = Math.max(baseFontSize * 0.78, 5);

        text.attr("font-size", baseFontSize);

        // Vertical offset to center the block of lines
        // For 2 lines: shift up by ~0.3em. For 3 lines: shift up by ~0.8em.
        const topDy = lineCount === 3 ? "-0.8em" : "-0.2em";

        if (isUser) {
          // YOU wallet: rank + YOU + pct
          text
            .append("tspan")
            .attr("x", 0)
            .attr("dy", topDy)
            .attr("font-weight", "800")
            .text(rankStr);
          text
            .append("tspan")
            .attr("x", 0)
            .attr("dy", "1.15em")
            .attr("font-size", Math.min(baseFontSize, 9))
            .text("YOU");
          text
            .append("tspan")
            .attr("x", 0)
            .attr("dy", "1.1em")
            .attr("font-size", pctFontSize)
            .attr("opacity", 0.8)
            .text(pct);
        } else if (hasLabel) {
          // Labeled wallet: rank + label + pct
          const maxLen = d.r < 20 ? 5 : d.r < 30 ? 7 : 9;
          const labelText =
            d.label!.length > maxLen ? d.label!.substring(0, maxLen - 2) + ".." : d.label!;
          text
            .append("tspan")
            .attr("x", 0)
            .attr("dy", topDy)
            .attr("font-weight", "800")
            .text(rankStr);
          text
            .append("tspan")
            .attr("x", 0)
            .attr("dy", "1.15em")
            .attr("font-size", Math.min(baseFontSize, 9))
            .text(labelText);
          text
            .append("tspan")
            .attr("x", 0)
            .attr("dy", "1.1em")
            .attr("font-size", pctFontSize)
            .attr("opacity", 0.8)
            .text(pct);
        } else if (d.isContract) {
          // Contract: rank + C marker + pct
          text
            .append("tspan")
            .attr("x", 0)
            .attr("dy", "-0.2em")
            .attr("font-weight", "800")
            .text(rankStr);
          text
            .append("tspan")
            .attr("x", 0)
            .attr("dy", "1.2em")
            .attr("font-size", pctFontSize)
            .attr("opacity", 0.8)
            .text(pct);
        } else if (assetType === AssetType.NFT && d.r > 20) {
          // NFT: rank + balance
          text
            .append("tspan")
            .attr("x", 0)
            .attr("dy", "-0.2em")
            .attr("font-weight", "800")
            .text(rankStr);
          text
            .append("tspan")
            .attr("x", 0)
            .attr("dy", "1.2em")
            .attr("font-size", pctFontSize)
            .attr("opacity", 0.8)
            .text(d.balance.toString());
        } else {
          // Default unlabeled: rank + pct
          text
            .append("tspan")
            .attr("x", 0)
            .attr("dy", "-0.2em")
            .attr("font-weight", "800")
            .text(rankStr);
          text
            .append("tspan")
            .attr("x", 0)
            .attr("dy", "1.2em")
            .attr("font-size", pctFontSize)
            .attr("opacity", 0.8)
            .text(pct);
        }
      });

    // Raise labels to ensure they render on top of circles
    bubbleLabelSelection.raise();

    // Helper to calculate link path with optional gap
    const getLinkPath = (d: any, gap: number = 0) => {
      const source = d.source as NodeDatum;
      const target = d.target as NodeDatum;

      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // If nodes are too close or overlapping, hide the link
      if (dist === 0 || dist <= source.r + target.r + gap * 2) {
        return "M0,0L0,0";
      }

      // Calculate start and end points at the edge of the bubbles + gap
      const sourceDist = source.r + gap;
      const targetDist = target.r + gap;

      const sourceRatio = sourceDist / dist;
      const targetRatio = targetDist / dist;

      const sourceX = source.x + dx * sourceRatio;
      const sourceY = source.y + dy * sourceRatio;

      const targetX = target.x - dx * targetRatio;
      const targetY = target.y - dy * targetRatio;

      return `M${sourceX},${sourceY} L${targetX},${targetY}`;
    };

    simulation.on("tick", () => {
      // Update hitbox with gap to prevent click interception on bubbles
      // Hitbox is 8px wide (4px each side), so 9px gap ensures 5px clearance from bubble
      linkSelection.select(".link-hitbox").attr("d", (d: any) => getLinkPath(d, 9));

      // Update visible vein starting exactly at bubble edge
      linkSelection.select(".neural-vein").attr("d", (d: any) => getLinkPath(d, 0));

      nodeWrapperSelection.attr("transform", (d: NodeDatum) => `translate(${d.x},${d.y})`);

      // Apply deferred zoom once layout is reasonably stable
      if (
        pendingZoomTargetRef.current &&
        !pendingZoomHandledRef.current &&
        simulation.alpha() < 0.35 &&
        svgRef.current &&
        zoomBehaviorRef.current
      ) {
        const targetNode = nodes.find((n: any) => n.id === pendingZoomTargetRef.current);
        if (targetNode) {
          const { width, height } = dimensions;
          const scale = 1.9;
          const translateX = width / 2 - targetNode.x * scale;
          const translateY = height / 2 - targetNode.y * scale;
          const transform = d3.zoomIdentity.translate(translateX, translateY).scale(scale);

          d3.select(svgRef.current)
            .transition()
            .duration(450)
            .ease(d3.easeCubicOut)
            .call(zoomBehaviorRef.current.transform, transform);

          applySelectionHighlight(pendingZoomTargetRef.current, showLabels);
          pendingZoomHandledRef.current = true;
        }
      }
    });

    // --- ZOOM ---
    // Threshold for effective zoomed radius to show labels
    // Aligned with MIN_LABEL_RADIUS so zoom level 1x matches initial render
    const ZOOM_LABEL_THRESHOLD = 14;

    const updateLabelVisibility = (k: number) => {
      if (!svgRef.current) return;
      const svg = d3.select(svgRef.current);
      const selectedId = lastSelectedIdRef.current;
      svg.selectAll<SVGGElement, NodeDatum>(".node-wrapper").each(function (d) {
        const effectiveR = d.r * k;
        const isSelected = d.id === selectedId;
        const shouldShow = isSelected || effectiveR >= ZOOM_LABEL_THRESHOLD;

        const wrapper = d3.select(this);
        wrapper
          .select(".bubble-label")
          .style("display", shouldShow ? "block" : "none")
          .attr("opacity", shouldShow ? 1 : 0);
      });
    };

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 8])
      // CRITICAL: Prevent zoom from capturing events that originate on bubble circles.
      // Without this filter, both d3-zoom (pan) and d3-drag fire simultaneously when
      // clicking a bubble — the zoom pans the entire <g> while drag moves the node's
      // simulation position, creating a ghost/double bubble that flickers.
      .filter((event: any) => {
        // Allow wheel events (scroll zoom) always
        if (event.type === "wheel") return true;
        // For mouse/touch gestures: only zoom if the target is NOT a bubble circle.
        // This lets d3-drag handle circle interactions exclusively.
        const target = event.target as SVGElement;
        return !target.classList.contains("synapse-node");
      })
      .on("zoom", (event: any) => {
        g.attr("transform", event.transform);
        zoomTransformRef.current = event.transform;
        // Update label visibility based on zoom level
        updateLabelVisibility(event.transform.k);
      });

    // Initial label visibility based on current zoom
    if (zoomTransformRef.current) {
      updateLabelVisibility(zoomTransformRef.current.k);
    } else {
      updateLabelVisibility(1);
    }

    svg.call(zoom);
    zoomBehaviorRef.current = zoom;

    // Restore previous zoom transform after rebuilds (e.g., tracing adds links)
    if (zoomTransformRef.current) {
      svg.call(zoom.transform, zoomTransformRef.current);
      g.attr("transform", zoomTransformRef.current as any);
    }

    return () => {
      if (simulationRef.current) simulationRef.current.stop();
    };
  }, [
    wallets,
    links,
    dimensions,
    assetType,
    userAddress,
    filters,
    showLabels,
    showLinks,
    hasMeasured,
    applyConnectionHighlight,
    onConnectionClick,
  ]);

  // Re-apply connection selection after re-renders (resize, etc)
  useEffect(() => {
    if (selectedConnectionId) {
      applyConnectionHighlight(selectedConnectionId);
    }
  }, [selectedConnectionId, wallets, links, dimensions, applyConnectionHighlight]);

  // --- ACTIONS ---
  const handleZoomIn = () => {
    if (svgRef.current && zoomBehaviorRef.current) {
      d3.select(svgRef.current)
        .transition()
        .duration(300)
        .call(zoomBehaviorRef.current.scaleBy, 1.3);
    }
  };

  const handleZoomOut = () => {
    if (svgRef.current && zoomBehaviorRef.current) {
      d3.select(svgRef.current)
        .transition()
        .duration(300)
        .call(zoomBehaviorRef.current.scaleBy, 0.7);
    }
  };

  const handleReset = () => {
    if (svgRef.current && zoomBehaviorRef.current) {
      d3.select(svgRef.current)
        .transition()
        .duration(750)
        .call(zoomBehaviorRef.current.transform, d3.zoomIdentity);
    }
  };

  const handleLocateUser = () => {
    if (!simulationRef.current || !svgRef.current || !zoomBehaviorRef.current || !userAddress)
      return;

    const nodes = simulationRef.current.nodes();
    const userNode = nodes.find((n: any) => n.address.toLowerCase() === userAddress.toLowerCase());

    if (userNode) {
      const { width, height } = dimensions;
      const scale = 2;
      const tx = width / 2 - userNode.x * scale;
      const ty = height / 2 - userNode.y * scale;

      const transform = d3.zoomIdentity.translate(tx, ty).scale(scale);

      d3.select(svgRef.current)
        .transition()
        .duration(1500)
        .ease(d3.easeCubicOut)
        .call(zoomBehaviorRef.current.transform, transform);
    }
  };

  const togglePause = () => {
    if (!simulationRef.current) return;
    if (isPaused) {
      simulationRef.current.alphaTarget(0.3).restart();
      setIsPaused(false);
    } else {
      simulationRef.current.stop();
      setIsPaused(true);
    }
  };

  // --- ZOOM TO TARGET WALLET (deferred until layout settles) ---
  useEffect(() => {
    // Set pending target; handled in simulation tick when alpha is low/stable
    pendingZoomTargetRef.current = targetWalletId ?? null;
    pendingZoomHandledRef.current = false;

    // If simulation has already settled (alpha ≈ 0), ticks won't fire anymore.
    // Execute the zoom immediately in that case.
    if (!targetWalletId) return;
    if (!simulationRef.current || !svgRef.current || !zoomBehaviorRef.current) return;

    const sim = simulationRef.current;
    // If alpha is already low enough, the simulation is settled — tick won't fire again
    if (sim.alpha() < 0.35) {
      const nodes = sim.nodes() as NodeDatum[];
      const targetNode = nodes.find((n: NodeDatum) => n.id === targetWalletId);
      if (targetNode) {
        const { width, height } = dimensions;
        const scale = 1.9;
        const translateX = width / 2 - targetNode.x * scale;
        const translateY = height / 2 - targetNode.y * scale;
        const transform = d3.zoomIdentity.translate(translateX, translateY).scale(scale);

        d3.select(svgRef.current)
          .transition()
          .duration(450)
          .ease(d3.easeCubicOut)
          .call(zoomBehaviorRef.current.transform, transform);

        applySelectionHighlight(targetWalletId, showLabels);
        pendingZoomHandledRef.current = true;
      }
    }
  }, [targetWalletId, dimensions, showLabels]);

  // Ensure selection highlight matches target wallet even outside zoom timing
  useEffect(() => {
    if (!targetWalletId) return;
    applySelectionHighlight(targetWalletId, showLabels);
  }, [targetWalletId, showLabels]);

  // Restore selection highlight after rebuilds (e.g., data/resize) so clicks persist
  useEffect(() => {
    if (lastSelectedIdRef.current) {
      applySelectionHighlight(lastSelectedIdRef.current, showLabels);
    }
  }, [wallets, links, dimensions, showLabels]);

  // Screenshot handler using SVG serialization
  const handleSnapshot = async () => {
    if (!svgRef.current) return;
    setIsSnapshotting(true);
    try {
      const svg = svgRef.current;

      // Clone the SVG to avoid modifying the original
      const clone = svg.cloneNode(true) as SVGSVGElement;

      // Get the computed dimensions
      const bbox = svg.getBoundingClientRect();
      clone.setAttribute("width", bbox.width.toString());
      clone.setAttribute("height", bbox.height.toString());

      // Set explicit background
      const bgRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      bgRect.setAttribute("width", "100%");
      bgRect.setAttribute("height", "100%");
      bgRect.setAttribute("fill", "#0f0f1a");
      clone.insertBefore(bgRect, clone.firstChild);

      // Inject font styles into the SVG to ensure proper rendering in canvas
      const styleElement = document.createElementNS("http://www.w3.org/2000/svg", "style");
      styleElement.textContent = `
        text {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
        }
        .rank-label {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
          font-weight: 800 !important;
        }
        .name-label {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
          font-weight: 700 !important;
        }
      `;
      clone.insertBefore(styleElement, clone.firstChild);

      // Serialize SVG to string
      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(clone);

      // Create a Blob from the SVG string
      const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);

      // Create an image element
      const img = new Image();

      // Load the image and convert to PNG
      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Failed to get canvas context"));
            return;
          }

          // Set canvas size (2x for higher quality)
          canvas.width = bbox.width * 2;
          canvas.height = bbox.height * 2;

          // Draw the image
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          // Convert to blob and download
          canvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error("Failed to create blob"));
              return;
            }
            const link = document.createElement("a");
            link.download = `bubblemap-${Date.now()}.png`;
            link.href = URL.createObjectURL(blob);
            link.click();
            URL.revokeObjectURL(link.href);
            resolve();
          }, "image/png");
        };

        img.onerror = () => {
          reject(new Error("Failed to load SVG image"));
        };

        img.src = url;
      });

      // Clean up
      URL.revokeObjectURL(url);
    } catch {
      // Error handled silently - snapshot capture failed
    } finally {
      setIsSnapshotting(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-space-900 overflow-hidden rounded-xl border border-space-700 shadow-2xl group"
      aria-label="Bubble map visualization"
    >
      <style>
        {`
          @keyframes flow { 0% { stroke-dashoffset: 16; } 100% { stroke-dashoffset: 0; } }
          .neural-vein { animation: flow 1s linear infinite; transition: stroke-width 0.15s ease, opacity 0.15s ease, stroke 0.15s ease; cursor: pointer; }
          .neural-vein.active { animation: flow 0.2s linear infinite; }
          @keyframes pulse-gold { 0% { stroke-width: 3px; opacity: 1; } 50% { stroke-width: 6px; opacity: 0.7; } 100% { stroke-width: 3px; opacity: 1; } }
          .user-node { stroke: #fbbf24 !important; animation: pulse-gold 2s infinite; }
          /* Disable default focus ring (we highlight via .node-selected only) */
          .synapse-node:focus, .synapse-node:focus-visible {
            outline: none !important;
            outline-offset: 0 !important;
          }
          .synapse-node.node-selected {
            stroke: #a855f7 !important;
            stroke-width: 3 !important;
            filter: drop-shadow(0 0 8px rgba(168, 85, 247, 0.7)) !important;
          }
          .neural-vein.link-selected {
            stroke: #a855f7 !important;
            stroke-width: 6 !important;
            opacity: 1 !important;
            filter: drop-shadow(0 0 8px rgba(168, 85, 247, 0.8)) !important;
            animation-play-state: paused !important;
            stroke-dasharray: none !important;
          }
          /* Remove square outlines on the SVG container */
          svg:focus, svg:focus-visible {
            outline: none !important;
            outline-offset: 0 !important;
          }
        `}
      </style>

      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
        className="block touch-none select-none cursor-move focus:outline-none"
        role="img"
        aria-label="Interactive visualization of wallet connections"
        tabIndex={0} // Make focusable for keyboard nav
      />

      {/* --- TOP LEFT: CONTROLS --- */}
      <div
        role="presentation"
        className="absolute top-16 md:top-16 left-3 md:left-4 z-20 flex flex-col gap-3 md:gap-3"
        onTouchStart={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Help menu container for click-outside detection */}
        <div className="relative help-menu-container" ref={helpMenuRef}>
          <Tooltip content={isHelpMenuOpen ? "" : "Open help menu"}>
            <button
              onTouchStart={handleTouchStopPropagation}
              onClick={() => setIsHelpMenuOpen(!isHelpMenuOpen)}
              className="p-2 bg-space-800 border border-space-700 text-slate-400 hover:text-white hover:border-space-600 rounded-full shadow-lg transition-colors"
              aria-label="Open help menu"
            >
              <HelpCircle size={20} />
            </button>
          </Tooltip>

          {/* Help menu dropdown */}
          {isHelpMenuOpen && (
            <div className="absolute left-0 top-full mt-2 w-56 bg-space-800 border border-space-700 rounded-lg shadow-xl z-50">
              <div className="py-1">
                <button
                  onClick={() => {
                    setIsHelpMenuOpen(false);
                    // @ts-expect-error expose guide helper
                    window.__DOGECCHAIN_GUIDES__?.openBubbleGuide();
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-space-700 transition-colors flex items-center gap-2"
                >
                  <Layers size={14} className="text-blue-500" />
                  Bubble Map Guide
                </button>
                <button
                  onClick={() => {
                    setIsHelpMenuOpen(false);
                    setIsHelpOpen(true);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-space-700 transition-colors flex items-center gap-2"
                >
                  <HelpCircle size={14} className="text-green-500" />
                  Quick Help
                </button>
                <div className="border-t border-space-700 my-1"></div>
                <button
                  onClick={() => {
                    setIsHelpMenuOpen(false);
                    // @ts-expect-error expose guide helper
                    window.__DOGECCHAIN_GUIDES__?.resetAllGuides();
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-space-700 transition-colors flex items-center gap-2"
                >
                  <RefreshCw size={14} className="text-purple-500" />
                  Reset Guides
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Settings / Filter button */}
        <Tooltip content="Open filters">
          <button
            onTouchStart={handleTouchStopPropagation}
            onClick={() => onOpenFilters?.()}
            className="p-2 bg-space-800 border border-space-700 text-slate-400 hover:text-white hover:border-space-600 rounded-full shadow-lg transition-colors"
            aria-label="Open filters"
          >
            <Settings size={20} />
          </button>
        </Tooltip>
      </div>
      {/* --- HELP MODAL --- */}
      {isHelpOpen && (
        <button
          type="button"
          className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 p-4 animate-in fade-in"
          onClick={() => setIsHelpOpen(false)}
          aria-label="Close help overlay"
        >
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
          <div
            className="bg-space-800 rounded-xl border border-space-700 shadow-2xl max-w-sm w-full overflow-hidden"
            role="dialog"
            aria-modal="true"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              // prevent escape handling from parent when focusing inside content
              e.stopPropagation();
            }}
          >
            <div className="p-4 border-b border-space-700 flex justify-between items-center">
              <h3 className="font-bold text-white flex items-center gap-2">
                <HelpCircle size={18} /> Interactive Guide
              </h3>
              <button
                onTouchStart={handleTouchStopPropagation}
                onClick={() => setIsHelpOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-4 space-y-4 text-sm text-slate-300">
              <div className="flex gap-3">
                <div className="p-2 bg-space-900 border border-space-700 rounded h-fit">
                  <Move size={16} />
                </div>
                <div>
                  <strong className="text-white block">Pan & Drag</strong>
                  Click and drag background to pan. Drag individual bubbles to rearrange them.
                </div>
              </div>
              <div className="flex gap-3">
                <div className="p-2 bg-space-900 border border-space-700 rounded h-fit">
                  <MousePointer2 size={16} />
                </div>
                <div>
                  <strong className="text-white block">Inspect Wallet</strong>
                  Click any bubble to view balance, transactions, and get AI insights.
                  <div className="text-xs text-slate-500 mt-1">
                    💡 Use Arrow Keys to cycle through bubbles!
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="p-2 bg-space-900 border border-space-700 rounded h-fit">
                  <ZoomIn size={16} />
                </div>
                <div>
                  <strong className="text-white block">Zoom</strong>
                  Scroll or use the buttons to zoom in/out on complex clusters.
                </div>
              </div>
            </div>
            <div className="p-4 bg-space-900 text-xs text-center text-slate-500">
              Click anywhere outside to close
            </div>
          </div>
        </button>
      )}

      {/* --- BOTTOM STACK (MOBILE) --- */}
      <div
        role="presentation"
        className="absolute inset-x-0 bottom-4 z-20 flex flex-col items-end gap-3 px-3 md:hidden"
        onTouchStart={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Controls */}
        <div ref={mobileControlsRef} className="flex flex-col gap-2 w-full max-w-[240px]">
          <div className="flex items-center gap-2 justify-between">
            <div className="pointer-events-none bg-space-900 border border-space-700 px-3 py-1 rounded-full text-[10px] text-slate-300 flex items-center gap-2 justify-center shadow-lg">
              <span
                className={`w-2 h-2 rounded-full ${isPaused ? "bg-red-500" : "bg-green-500"}`}
              />
              {isPaused ? "Physics Paused" : "Live Physics Engine"}
            </div>
            <button
              onTouchEnd={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setAreControlsOpen((prev) => !prev);
              }}
              onClick={(e) => {
                e.stopPropagation();
                setAreControlsOpen((prev) => !prev);
              }}
              className="p-2 bg-space-800 border border-space-700 rounded-lg text-slate-200 hover:bg-space-700 transition-all cursor-pointer [touch-action:manipulation]"
              aria-label={areControlsOpen ? "Hide controls" : "Show controls"}
            >
              <ChevronUp
                size={18}
                className={`transition-transform ${areControlsOpen ? "rotate-180" : ""}`}
              />
            </button>
          </div>
          <div
            className={`origin-top transition-all duration-200 ease-out overflow-hidden ${
              areControlsOpen ? "max-h-[420px] opacity-100 mt-1" : "max-h-0 opacity-0"
            }`}
          >
            <div className="grid grid-cols-3 gap-2 justify-items-center bg-space-900/70 rounded-xl p-2 shadow-xl">
              <Tooltip content="Center view on your wallet">
                <button
                  onTouchStart={handleTouchStopPropagation}
                  onClick={handleLocateUser}
                  disabled={!userNodeFound}
                  className="p-2 bg-purple-600 border border-purple-500 text-white rounded-lg shadow-lg transition-all hover:bg-purple-500 hover:border-purple-400 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Crosshair size={20} />
                </button>
              </Tooltip>
              <Tooltip content="Download map as PNG image">
                <button
                  onTouchStart={handleTouchStopPropagation}
                  onClick={handleSnapshot}
                  className="p-2 bg-space-800 border border-space-700 text-slate-300 hover:text-white hover:bg-space-700 hover:border-space-600 rounded-lg shadow-lg transition-all"
                >
                  <Camera size={20} className={isSnapshotting ? "text-purple-500" : ""} />
                </button>
              </Tooltip>
              <Tooltip content={isPaused ? "Resume animation" : "Pause animation"}>
                <button
                  onTouchStart={handleTouchStopPropagation}
                  onClick={togglePause}
                  className="p-2 bg-space-800 border border-space-700 text-slate-300 hover:text-white hover:bg-space-700 hover:border-space-600 rounded-lg shadow-lg transition-all"
                >
                  {isPaused ? <Play size={20} /> : <Pause size={20} />}
                </button>
              </Tooltip>
              <Tooltip content="Zoom in" position="left">
                <button
                  onTouchStart={handleTouchStopPropagation}
                  onClick={handleZoomIn}
                  className="p-2 bg-space-800 border border-space-700 text-slate-300 hover:text-white hover:bg-space-700 hover:border-space-600 rounded-lg shadow-lg transition-all"
                >
                  <ZoomIn size={20} />
                </button>
              </Tooltip>
              <Tooltip content="Zoom out" position="left">
                <button
                  onTouchStart={handleTouchStopPropagation}
                  onClick={handleZoomOut}
                  className="p-2 bg-space-800 border border-space-700 text-slate-300 hover:text-white hover:bg-space-700 hover:border-space-600 rounded-lg shadow-lg transition-all"
                >
                  <ZoomOut size={20} />
                </button>
              </Tooltip>
              <Tooltip content="Reset to default view">
                <button
                  onTouchStart={handleTouchStopPropagation}
                  onClick={handleReset}
                  className="p-2 bg-space-800 border border-space-700 text-slate-300 hover:text-white hover:bg-space-700 hover:border-space-600 rounded-lg shadow-lg transition-all"
                >
                  <RotateCcw size={20} />
                </button>
              </Tooltip>
            </div>
          </div>
        </div>

        {/* Legend stacked below */}
        <div
          ref={legendRef}
          role="presentation"
          className="w-full max-w-[240px]"
          onTouchStart={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-space-900 rounded-xl border border-space-700 shadow-xl overflow-hidden transition-all duration-300">
            <button
              onTouchStart={handleTouchStopPropagation}
              onClick={toggleLegend}
              className="w-full px-4 py-2 flex items-center justify-between text-[10px] uppercase tracking-widest text-slate-500 font-bold hover:bg-space-800/50 cursor-pointer bg-transparent border-none [touch-action:manipulation]"
              type="button"
              aria-expanded={isLegendOpen}
              aria-label={isLegendOpen ? "Close legend" : "Open legend"}
            >
              Legend
              {isLegendOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </button>

            <div
              role="presentation"
              onTouchStart={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              className={`px-4 pb-5 transition-all duration-300 ${isLegendOpen ? "max-h-[360px] opacity-100 mt-2" : "max-h-0 opacity-0 overflow-hidden"}`}
            >
              <div className="w-full h-2 rounded-full bg-gradient-to-r from-cyan-500 via-yellow-500 to-red-500 mb-3"></div>
              <div className="flex justify-between text-[10px] text-slate-400 font-mono mb-5">
                <span>Retail</span>
                <span>Whale</span>
                <span>Mega</span>
              </div>

              <div className="flex flex-col gap-3 text-xs text-slate-200">
                <div className="flex items-start gap-3">
                  <span className="flex items-center gap-2">
                    <span className="inline-block w-3 h-3 rounded-full bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.85)] shrink-0"></span>
                    <span className="font-semibold">Labeled Wallet</span>
                  </span>
                  <span className="text-slate-500 text-[11px] leading-tight">
                    Identified wallets: exchanges, teams, known entities
                  </span>
                </div>

                <div className="flex items-start gap-3">
                  <span className="flex items-center gap-2">
                    <span
                      className="block h-[4px] w-24 min-w-[96px] rounded-full shrink-0"
                      style={{
                        backgroundImage:
                          "linear-gradient(90deg,#22d3ee 0%,#a855f7 50%,#f472b6 100%)",
                        WebkitMaskImage:
                          "repeating-linear-gradient(90deg, #000 0 6px, transparent 6px 12px)",
                        maskImage:
                          "repeating-linear-gradient(90deg, #000 0 6px, transparent 6px 12px)",
                        boxShadow: "0 0 8px rgba(168,85,247,0.55)",
                      }}
                    ></span>
                    <span className="font-semibold">Wallet Link</span>
                  </span>
                  <span className="text-slate-500 text-[11px] leading-tight">
                    Connection between wallets
                  </span>
                </div>

                {userNodeFound && (
                  <div className="flex items-start gap-3">
                    <span className="flex items-center gap-2 text-doge-400 font-bold">
                      <span className="w-3 h-3 rounded-full bg-amber-400 border-2 border-white"></span>
                      YOU
                    </span>
                    <span className="text-slate-500 text-[11px] leading-tight">
                      Connected Wallet
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* --- DESKTOP SEPARATE POSITIONS --- */}
      {/* Controls (desktop) */}
      <div
        ref={controlsRef}
        role="presentation"
        className="hidden md:flex absolute bottom-6 right-6 flex-col items-end gap-3 z-20"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <div className="pointer-events-none bg-space-900 border border-space-700 px-3 py-1 rounded-full text-[10px] text-slate-300 flex items-center gap-2 justify-center shadow-lg">
            <span className={`w-2 h-2 rounded-full ${isPaused ? "bg-red-500" : "bg-green-500"}`} />
            {isPaused ? "Physics Paused" : "Live Physics Engine"}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="grid grid-cols-3 gap-2 justify-items-center bg-space-900/70 rounded-xl p-2 shadow-xl">
            <Tooltip content="Center view on your wallet">
              <button
                onTouchStart={handleTouchStopPropagation}
                onClick={handleLocateUser}
                disabled={!userNodeFound}
                className="p-2 bg-purple-600 border border-purple-500 text-white rounded-lg shadow-lg transition-all hover:bg-purple-500 hover:border-purple-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Crosshair size={20} />
              </button>
            </Tooltip>
            <Tooltip content="Download map as PNG image">
              <button
                onTouchStart={handleTouchStopPropagation}
                onClick={handleSnapshot}
                className="p-2 bg-space-800 border border-space-700 text-slate-300 hover:text-white hover:bg-space-700 hover:border-space-600 rounded-lg transition-all"
              >
                <Camera size={20} className={isSnapshotting ? "text-purple-500" : ""} />
              </button>
            </Tooltip>
            <Tooltip content={isPaused ? "Resume animation" : "Pause animation"}>
              <button
                onTouchStart={handleTouchStopPropagation}
                onClick={togglePause}
                className="p-2 bg-space-800 border border-space-700 text-slate-300 hover:text-white hover:bg-space-700 hover:border-space-600 rounded-lg shadow-lg transition-all"
              >
                {isPaused ? <Play size={20} /> : <Pause size={20} />}
              </button>
            </Tooltip>
            <Tooltip content="Zoom in" position="left">
              <button
                onTouchStart={handleTouchStopPropagation}
                onClick={handleZoomIn}
                className="p-2 bg-space-800 border border-space-700 text-slate-300 hover:text-white hover:bg-space-700 hover:border-space-600 rounded-lg shadow-lg transition-all"
              >
                <ZoomIn size={20} />
              </button>
            </Tooltip>
            <Tooltip content="Zoom out" position="left">
              <button
                onTouchStart={handleTouchStopPropagation}
                onClick={handleZoomOut}
                className="p-2 bg-space-800 border border-space-700 text-slate-300 hover:text-white hover:bg-space-700 hover:border-space-600 rounded-lg shadow-lg transition-all"
              >
                <ZoomOut size={20} />
              </button>
            </Tooltip>
            <Tooltip content="Reset to default view">
              <button
                onTouchStart={handleTouchStopPropagation}
                onClick={handleReset}
                className="p-2 bg-space-800 border border-space-700 text-slate-300 hover:text-white hover:bg-space-700 hover:border-space-600 rounded-lg shadow-lg transition-all"
              >
                <RotateCcw size={20} />
              </button>
            </Tooltip>
          </div>
        </div>
      </div>

      {/* Legend (desktop) */}
      <div
        ref={legendRef}
        role="presentation"
        className="hidden md:block absolute bottom-6 left-6 z-20 max-w-[240px]"
        onTouchStart={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-space-900 rounded-xl border border-space-700 shadow-xl overflow-hidden transition-all duration-300">
          <button
            onTouchStart={handleTouchStopPropagation}
            onClick={toggleLegend}
            className="w-full px-4 py-2 flex items-center justify-between text-[10px] uppercase tracking-widest text-slate-500 font-bold hover:bg-space-800/50 cursor-pointer bg-transparent border-none [touch-action:manipulation]"
            type="button"
            aria-expanded={isLegendOpen}
            aria-label={isLegendOpen ? "Close legend" : "Open legend"}
          >
            Legend
            {isLegendOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>

          <div
            role="presentation"
            onTouchStart={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className={`px-4 pb-5 transition-all duration-300 ${isLegendOpen ? "max-h-[360px] opacity-100 mt-2" : "max-h-0 opacity-0 overflow-hidden"}`}
          >
            <div className="w-full h-2 rounded-full bg-gradient-to-r from-cyan-500 via-yellow-500 to-red-500 mb-3"></div>
            <div className="flex justify-between text-[10px] text-slate-400 font-mono mb-5">
              <span>Retail</span>
              <span>Whale</span>
              <span>Mega</span>
            </div>

            <div className="flex flex-col gap-3 text-xs text-slate-200">
              <div className="flex items-start gap-3">
                <span className="flex items-center gap-2">
                  <span className="inline-block w-3 h-3 rounded-full bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.85)] shrink-0"></span>
                  <span className="font-semibold">Labeled Wallet</span>
                </span>
                <span className="text-slate-500 text-[11px] leading-tight">
                  Identified wallets: exchanges, teams, known entities
                </span>
              </div>

              <div className="flex items-start gap-3">
                <span className="flex items-center gap-2">
                  <span
                    className="block h-[4px] w-24 min-w-[96px] rounded-full shrink-0"
                    style={{
                      backgroundImage: "linear-gradient(90deg,#22d3ee 0%,#a855f7 50%,#f472b6 100%)",
                      WebkitMaskImage:
                        "repeating-linear-gradient(90deg, #000 0 6px, transparent 6px 12px)",
                      maskImage:
                        "repeating-linear-gradient(90deg, #000 0 6px, transparent 6px 12px)",
                      boxShadow: "0 0 8px rgba(168,85,247,0.55)",
                    }}
                  ></span>
                  <span className="font-semibold">Wallet Link</span>
                </span>
                <span className="text-slate-500 text-[11px] leading-tight">
                  Connection between wallets
                </span>
              </div>

              {userNodeFound && (
                <div className="flex items-start gap-3">
                  <span className="flex items-center gap-2 text-doge-400 font-bold">
                    <span className="w-3 h-3 rounded-full bg-amber-400 border-2 border-white"></span>
                    YOU
                  </span>
                  <span className="text-slate-500 text-[11px] leading-tight">Connected Wallet</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
