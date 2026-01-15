import React, { useCallback, useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { useClickOutside } from "../hooks/useClickOutside";
import { Wallet, Link, AssetType } from "../types";
import { ensureLPDetectionInitialized } from "../services/db";

/* eslint-disable @typescript-eslint/no-explicit-any */
// D3.js requires 'any' types for its dynamic simulation system
import { handleTouchStopPropagation } from "../utils/touchHandlers";
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
  EyeOff,
  Eye,
  ChevronDown,
  ChevronUp,
  Settings,
  Sliders,
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
  freezeLayout?: boolean; // When true, defer resize-driven rebuilds (e.g., while modals open)
}

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
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
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
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isHelpMenuOpen, setIsHelpMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [userNodeFound, setUserNodeFound] = useState(false);
  const [isSnapshotting, setIsSnapshotting] = useState(false);
  const [areControlsOpen, setAreControlsOpen] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth >= 768; // default open on desktop, collapsed on small screens
    }
    return true;
  });

  // Memoize close handlers for click-outside hook
  const closeSettings = useCallback(() => setIsSettingsOpen(false), []);
  const closeLegend = useCallback(() => setIsLegendOpen(false), []);
  const closeControls = useCallback(() => setAreControlsOpen(false), []);
  const closeHelpMenu = useCallback(() => setIsHelpMenuOpen(false), []);

  // Apply click-outside hooks for menus
  useClickOutside(settingsRef, closeSettings, isSettingsOpen);
  useClickOutside(legendRef, closeLegend, isLegendOpen);
  useClickOutside(helpMenuRef, closeHelpMenu, isHelpMenuOpen);

  // Custom click-outside handler for controls (checks both desktop and mobile refs)
  useEffect(() => {
    if (!areControlsOpen) return;

    const handleClick = (event: Event) => {
      const isInsideDesktop = controlsRef.current?.contains(event.target as Node);
      const isInsideMobile = mobileControlsRef.current?.contains(event.target as Node);

      if (!isInsideDesktop && !isInsideMobile) {
        closeControls();
      }
    };

    document.addEventListener("click", handleClick, true);
    return () => {
      document.removeEventListener("click", handleClick, true);
    };
  }, [areControlsOpen, closeControls]);

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
  const applySelectionHighlight = (walletId: string | null, showLabels: boolean) => {
    if (!svgRef.current) return;

    const nodeSelection = d3.select(svgRef.current).selectAll(".synapse-node");
    const nodeWrapperSelection = d3
      .select(svgRef.current)
      .selectAll<SVGGElement, any>(".node-wrapper");
    const rankSelection = d3.select(svgRef.current).selectAll(".rank-label");
    const labelSelection = d3.select(svgRef.current).selectAll(".name-label");

    // Clear previous
    nodeSelection.classed("node-selected", false);
    lastSelectedIdRef.current = null;
    if (!walletId) {
      // Reset labels to default visibility state
      rankSelection.style("display", showLabels ? "block" : "none").style("opacity", 1);
      labelSelection.style("display", showLabels ? "block" : "none").style("opacity", 1);
      return;
    }

    // Highlight target
    nodeSelection.filter((d: any) => d.id === walletId).classed("node-selected", true);
    lastSelectedIdRef.current = walletId;

    // Raise the entire wrapper so labels remain above the circle
    nodeWrapperSelection.filter((d: any) => d.id === walletId).raise();

    // Ensure labels visible for target
    rankSelection.style("display", showLabels ? "block" : "none").style("opacity", 1);
    labelSelection.style("display", showLabels ? "block" : "none").style("opacity", 1);
    rankSelection
      .filter((d: any) => d.id === walletId)
      .style("display", "block")
      .style("opacity", 1)
      .raise();
    labelSelection
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

  // --- MAP SETTINGS ---
  const [showLinks, setShowLinks] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [minBalancePercent, setMinBalancePercent] = useState(0); // 0 to 100 slider representing % of max balance or just arbitrary threshold

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
      if (d.label) return "#fb7185"; // Rose-400 (Known Entity)
      if (d.isContract) return "#fb7185"; // Rose-400 (Warning/Special)

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
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);

    // Update Links
    svg.selectAll(".neural-vein").style("display", showLinks ? "block" : "none");

    // Update Labels - Only target bubble labels
    // IMPORTANT: Only update display property, NOT opacity
    // Opacity is managed by hover animations and should not be reset here
    svg
      .selectAll("text.rank-label, text.name-label")
      .style("display", showLabels ? "block" : "none");
    // Note: We DON'T set opacity here to avoid conflicts with hover animations

    // Update Nodes based on slider (Simple logic: filter by % of max holding in this set)
    if (wallets.length > 0) {
      const max = Math.max(...wallets.map((w) => w.balance));
      const threshold = (max * minBalancePercent) / 100;

      svg
        .selectAll(".nodes circle")
        .style("opacity", (d: any) => {
          // Always show user
          if (userAddress && d.address.toLowerCase() === userAddress.toLowerCase()) return 1;
          return d.balance >= threshold ? 1 : 0.1;
        })
        .style("pointer-events", (d: any) => (d.balance >= threshold ? "all" : "none"));
    }
  }, [showLinks, showLabels, minBalancePercent, wallets, userAddress]);

  useEffect(() => {
    if (!svgRef.current || wallets.length === 0 || !hasMeasured) return;
    const { width, height } = dimensions;

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
    gradient.append("stop").attr("offset", "100%").attr("stop-color", "#c084fc"); // Purple

    // --- DATA PREPARATION ---
    const nodes: NodeDatum[] = wallets.map((w, idx) => {
      const savedPosition = nodePositionsRef.current.get(w.id);
      return {
        ...w,
        x: savedPosition?.x ?? width / 2,
        y: savedPosition?.y ?? height / 2,
        rank: idx + 1,
      };
    }) as NodeDatum[];

    const maxBalance = d3.max(nodes, (d: NodeDatum) => d.balance) || 1;
    const minBalance = d3.min(nodes, (d: NodeDatum) => d.balance) || 0;

    const radiusScale = d3.scaleSqrt().domain([minBalance, maxBalance]).range([6, 55]);

    nodes.forEach((n) => {
      n.r = radiusScale(n.balance);
    });

    // HYBRID LAYOUT: Initial Pack (only for nodes without saved positions)
    const pack = d3.pack().size([width, height]).padding(5);

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

    const linksCopy: LinkDatum[] = links.map((l) => {
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
      .velocityDecay(0.2)
      .alphaDecay(0.02) // Balanced decay speed
      .alpha(hasSettledPositions ? 0.3 : 1) // Moderate alpha if we have settled positions
      .force(
        "link",
        d3
          .forceLink<NodeDatum, LinkDatum>(linksCopy)
          .id((d: NodeDatum) => d.id)
          .distance(80)
          .strength(0.1)
      )
      .force(
        "charge",
        d3.forceManyBody<NodeDatum>().strength((d: NodeDatum) => -d.r * 3 - 15)
      )
      .force(
        "collide",
        d3
          .forceCollide<NodeDatum>()
          .radius((d: NodeDatum) => d.r + 4)
          .strength(0.8)
          .iterations(3)
      )
      .force("x", d3.forceX(width / 2).strength(0.02))
      .force("y", d3.forceY(height / 2).strength(0.02));

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
      .attr("class", "link-wrapper");

    // Invisible wide path for easier clicking (the "hitbox")
    linkSelection
      .append("path")
      .attr("class", "link-hitbox")
      .attr("stroke", "transparent")
      .attr("stroke-width", 20) // Wide invisible hitbox
      .attr("fill", "none")
      .attr("opacity", 0)
      .style("cursor", "pointer")
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
        wrapper.select(".link-hitbox").style("cursor", "pointer");

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
        // Don't reset if this link is highlighted on mobile
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
        d3.select(_event.currentTarget)
          .select(".neural-vein")
          .transition()
          .duration(150)
          .attr("stroke", "url(#veinGradient)")
          .attr("stroke-width", 3)
          .attr("stroke-dasharray", "4, 4") // Restore dashed animation
          .attr("opacity", 0.6)
          .style("filter", "none")
          .style("animation-play-state", "running"); // Resume animation
      });

    // --- RENDER: NODES WITH LABELS (each node has a wrapper group containing circle + labels) ---
    const nodeGroup = g.append("g").attr("class", "nodes");

    // Create a wrapper group for each node (will contain circle + labels)
    const nodeWrapperSelection = nodeGroup
      .selectAll("g.node-wrapper")
      .data(nodes)
      .enter()
      .append("g")
      .attr("class", "node-wrapper");

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

    // Render rank label inside the wrapper (after circle so circle receives events first)
    const rankSelection = nodeWrapperSelection
      .append("text")
      .attr("class", "rank-label")
      .attr("text-anchor", "middle")
      .attr("dy", (d: NodeDatum) => -Math.min(d.r * 0.4, 12))
      .attr("fill", "#fff")
      .attr("font-size", (d: NodeDatum) => Math.min(d.r / 1.8, 12))
      .attr("font-weight", "800")
      .style("pointer-events", "none")
      .style("text-shadow", "0px 1px 3px rgba(0,0,0,0.9)")
      .style("display", showLabels ? "block" : "none")
      .attr("opacity", 1)
      .text((d: NodeDatum) => `#${d.rank}`);

    // Render name label inside the wrapper
    const labelSelection = nodeWrapperSelection
      .append("text")
      .attr("class", "name-label")
      .attr("text-anchor", "middle")
      .attr("dy", ".35em")
      .attr("fill", "#fff")
      .attr("font-size", (d: NodeDatum) => Math.min(d.r / 2, 11))
      .attr("font-weight", "700")
      .style("pointer-events", "none")
      .style("text-shadow", "0px 1px 3px rgba(0,0,0,0.9)")
      .style("display", showLabels ? "block" : "none")
      .attr("opacity", 1)
      .text((d: NodeDatum) => {
        if (userAddress && d.address.toLowerCase() === userAddress.toLowerCase()) return "YOU";
        if (d.label) return d.label.length > 8 ? d.label.substring(0, 6) + ".." : d.label;
        if (d.isContract) return "C";
        if (assetType === AssetType.NFT && d.r > 20) return d.balance.toString();
        return `${d.percentage.toFixed(2)} %`;
      });

    // Raise labels to ensure they render on top of circles (prevents visual occlusion)
    rankSelection.raise();
    labelSelection.raise();

    // --- INTERACTION HANDLERS ---
    const drag = d3
      .drag<SVGGElement, NodeDatum>()
      .on("start", (event: any, d: NodeDatum) => {
        // Detect input type - touch events use pointerType property
        const isTouch =
          event.sourceEvent.pointerType === "touch" ||
          ("ontouchstart" in window && event.sourceEvent.type.startsWith("touch"));

        if (!event.active && simulationRef.current) {
          // Use even lower alpha for desktop mouse to match mobile responsiveness
          const targetAlpha = isTouch ? 0.005 : 0.003;
          simulationRef.current.alphaTarget(targetAlpha).restart();
        }
        d.fx = d.x;
        d.fy = d.y;
        d3.select(event.sourceEvent.target).attr("cursor", "grabbing");
      })
      .on("drag", (event: any, d: NodeDatum) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event: any, d: NodeDatum) => {
        if (!event.active && simulationRef.current) {
          simulationRef.current.alphaTarget(0);
        }
        d.fx = null;
        d.fy = null;
        d3.select(event.sourceEvent.target).attr("cursor", "grab");
      });

    nodeWrapperSelection.call(drag);

    // Attach event handlers to the wrapper group (not the circle)
    // This way, hovering over labels won't trigger mouseout on the node
    nodeWrapperSelection
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
      })
      .on("mouseover", (_event: any, d: NodeDatum) => {
        const wrapper = d3.select(_event.currentTarget);
        const hoveredId = d.id;

        // Mark that this node wrapper is being hovered
        wrapper.classed("hovering", true);

        // Logic to dim everyone but connected
        nodeSelection
          .interrupt()
          .transition()
          .duration(200)
          .attr("opacity", 0.15)
          .style("filter", "none");
        linkSelection
          .select(".neural-vein")
          .interrupt()
          .transition()
          .duration(200)
          .attr("opacity", 0.05);
        // NOTE: Labels are NO LONGER dimmed on hover - they stay fully visible

        const connectedIds = new Set<string>();
        connectedIds.add(hoveredId);

        linkSelection
          .filter(
            (l: LinkDatum) =>
              (l.source as NodeDatum).id === hoveredId || (l.target as NodeDatum).id === hoveredId
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

        nodeWrapperSelection
          .filter((n: NodeDatum) => connectedIds.has(n.id))
          .raise() // Bring connected nodes (and their labels) to front during hover
          .interrupt()
          .transition()
          .duration(200);

        const max = Math.max(...wallets.map((w) => w.balance));
        const threshold = (max * minBalancePercent) / 100;

        nodeSelection
          .interrupt()
          .transition()
          .duration(400)
          .attr("opacity", (d: NodeDatum) => {
            if (userAddress && d.address.toLowerCase() === userAddress.toLowerCase()) return 1;
            return d.balance >= threshold ? 1 : 0.1;
          })
          .attr("stroke-width", (d: NodeDatum) => {
            const isUser = userAddress && d.address.toLowerCase() === userAddress.toLowerCase();
            return isUser ? 3 : 1;
          })
          .attr("stroke", (d: NodeDatum) => {
            const isUser = userAddress && d.address.toLowerCase() === userAddress.toLowerCase();
            if (isUser) return "#ffffff";
            return d3.color(getNodeColorRef.current(d))?.brighter(0.8).formatHex() || "#fff";
          })
          .attr("fill", (d: NodeDatum) => getNodeColorRef.current(d))
          .style("filter", "url(#glow)");

        linkSelection
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
        // Remove hover state from wrapper
        d3.select(_event.currentTarget).classed("hovering", false);

        // Reset all nodes to normal appearance
        nodeSelection
          .interrupt()
          .transition()
          .duration(200)
          .attr("opacity", 1)
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

    // --- TICK ---
    simulation.on("tick", () => {
      // Save node positions once simulation has made meaningful progress (alpha < 0.6)
      if (simulation.alpha() < 0.6) {
        nodes.forEach((node) => {
          if (node.x !== undefined && node.y !== undefined) {
            nodePositionsRef.current.set(node.id, { x: node.x, y: node.y });
          }
        });
      }

      // Update both hitbox and visible paths
      linkSelection.selectAll("path").attr("d", (d: any) => {
        const source = d.source as NodeDatum;
        const target = d.target as NodeDatum;
        return `M${source.x},${source.y} L${target.x},${target.y}`;
      });

      nodeSelection.attr("cx", (d: NodeDatum) => d.x).attr("cy", (d: NodeDatum) => d.y);
      rankSelection
        .attr("x", (d: NodeDatum) => d.x)
        .attr("y", (d: NodeDatum) => d.y - Math.min(d.r * 0.4, 12));
      labelSelection.attr("x", (d: NodeDatum) => d.x).attr("y", (d: NodeDatum) => d.y);

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
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 8])
      .on("zoom", (event: any) => {
        g.attr("transform", event.transform);
        zoomTransformRef.current = event.transform;
      });

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
    minBalancePercent,
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
  }, [targetWalletId]);

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
      <div className="absolute top-16 md:top-16 left-3 md:left-4 z-20 flex flex-col gap-3 md:gap-3">
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

        {/* Settings button and popup container for click-outside detection */}
        <div className="relative" ref={settingsRef}>
          <Tooltip content="Open map settings">
            <button
              onTouchStart={handleTouchStopPropagation}
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className={`p-2 rounded-full border shadow-lg transition-colors ${isSettingsOpen ? "bg-purple-600 border-purple-500 text-white" : "bg-space-800 border border-space-700 text-slate-400 hover:text-white hover:border-space-600"}`}
            >
              <Settings size={20} />
            </button>
          </Tooltip>

          {/* --- SETTINGS POPUP --- */}
          {isSettingsOpen && (
            <div className="absolute top-0 left-14 z-30 bg-space-800 rounded-xl border border-space-700 shadow-2xl p-4 w-64 animate-in fade-in slide-in-from-left-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2">
                <Sliders size={12} /> Filter Map
              </h4>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white flex items-center gap-2">
                    {showLinks ? (
                      <Eye size={14} />
                    ) : (
                      <EyeOff size={14} className="text-slate-500" />
                    )}{" "}
                    Links
                  </span>
                  <button
                    onTouchStart={handleTouchStopPropagation}
                    onClick={() => setShowLinks(!showLinks)}
                    className={`w-10 h-5 rounded-full relative transition-colors ${showLinks ? "bg-purple-600" : "bg-space-600"}`}
                  >
                    <span
                      className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-transform ${showLinks ? "left-6" : "left-1"}`}
                    ></span>
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-white flex items-center gap-2">
                    {showLabels ? (
                      <Eye size={14} />
                    ) : (
                      <EyeOff size={14} className="text-slate-500" />
                    )}{" "}
                    Labels
                  </span>
                  <button
                    onTouchStart={handleTouchStopPropagation}
                    onClick={() => setShowLabels(!showLabels)}
                    className={`w-10 h-5 rounded-full relative transition-colors ${showLabels ? "bg-purple-600" : "bg-space-600"}`}
                  >
                    <span
                      className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-transform ${showLabels ? "left-6" : "left-1"}`}
                    ></span>
                  </button>
                </div>

                <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Filter Dust</span>
                    <span>{minBalancePercent}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="50"
                    step="1"
                    value={minBalancePercent}
                    onChange={(e) => setMinBalancePercent(parseInt(e.target.value))}
                    className="w-full h-1 bg-space-600 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {/* --- HELP MODAL --- */}
      {isHelpOpen && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 p-4 animate-in fade-in">
          <div className="bg-space-800 rounded-xl border border-space-700 shadow-2xl max-w-sm w-full overflow-hidden">
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
          <div
            className="absolute inset-0 -z-10"
            onClick={() => setIsHelpOpen(false)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setIsHelpOpen(false);
            }}
            role="button"
            tabIndex={-1}
            aria-label="Close help"
          ></div>
        </div>
      )}

      {/* --- BOTTOM STACK (MOBILE) --- */}
      <div className="absolute inset-x-0 bottom-4 z-20 flex flex-col items-end gap-3 px-3 md:hidden">
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
        <div ref={legendRef} className="w-full max-w-[240px]">
          <div className="bg-space-900 rounded-xl border border-space-700 shadow-xl overflow-hidden transition-all duration-300">
            <button
              onTouchStart={handleTouchStopPropagation}
              onClick={() => setIsLegendOpen(!isLegendOpen)}
              className="w-full px-4 py-2 flex items-center justify-between text-[10px] uppercase tracking-widest text-slate-500 font-bold hover:bg-space-800/50"
            >
              Legend
              {isLegendOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </button>

            <div
              className={`px-4 pb-4 transition-all duration-300 ${isLegendOpen ? "max-h-[300px] opacity-100 mt-2" : "max-h-0 opacity-0 overflow-hidden"}`}
            >
              <div className="w-full h-2 rounded-full bg-gradient-to-r from-cyan-500 via-yellow-500 to-red-500 mb-1"></div>
              <div className="flex justify-between text-[10px] text-slate-400 font-mono mb-4">
                <span>Retail</span>
                <span>Whale</span>
                <span>Mega</span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-start gap-4">
                  <span className="flex items-center gap-2 text-slate-300 whitespace-nowrap">
                    <span className="w-2 h-2 rounded-full bg-rose-400 shadow-[0_0_6px_rgba(251,113,133,0.8)]"></span>{" "}
                    Contract
                  </span>
                  <span className="text-slate-500 text-[10px] whitespace-nowrap ml-1">
                    Protocol / Treasury
                  </span>
                </div>
                <div className="flex items-start gap-4">
                  <span className="flex items-center gap-2 text-slate-300 whitespace-nowrap">
                    <span className="w-2 h-2 rounded-full bg-white border border-space-600"></span>{" "}
                    Node
                  </span>
                  <span className="text-slate-500 text-[10px] whitespace-nowrap ml-1">
                    Interactive Wallet
                  </span>
                </div>
                {userNodeFound && (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-doge-400 font-bold">
                      <span className="w-3 h-3 rounded-full bg-amber-400 border-2 border-white"></span>{" "}
                      YOU
                    </span>
                    <span className="text-slate-500 text-[10px]">Connected Wallet</span>
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
        className="hidden md:flex absolute bottom-6 right-6 flex-col items-end gap-3 z-20"
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
      <div ref={legendRef} className="hidden md:block absolute bottom-6 left-6 z-20 max-w-[220px]">
        <div className="bg-space-900 rounded-xl border border-space-700 shadow-xl overflow-hidden transition-all duration-300">
          <button
            onTouchStart={handleTouchStopPropagation}
            onClick={() => setIsLegendOpen(!isLegendOpen)}
            className="w-full px-4 py-2 flex items-center justify-between text-[10px] uppercase tracking-widest text-slate-500 font-bold hover:bg-space-800/50"
          >
            Legend
            {isLegendOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>

          <div
            className={`px-4 pb-4 transition-all duration-300 ${isLegendOpen ? "max-h-[300px] opacity-100 mt-2" : "max-h-0 opacity-0 overflow-hidden"}`}
          >
            <div className="w-full h-2 rounded-full bg-gradient-to-r from-cyan-500 via-yellow-500 to-red-500 mb-1"></div>
            <div className="flex justify-between text-[10px] text-slate-400 font-mono mb-4">
              <span>Retail</span>
              <span>Whale</span>
              <span>Mega</span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-300">
                  <span className="w-2 h-2 rounded-full bg-rose-400 shadow-[0_0_6px_rgba(251,113,133,0.8)]"></span>{" "}
                  Contract
                </span>
                <span className="text-slate-500 text-[10px]">Protocol / Treasury</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-300">
                  <span className="w-2 h-2 rounded-full bg-white border border-space-600"></span>{" "}
                  Node
                </span>
                <span className="text-slate-500 text-[10px]">Interactive Wallet</span>
              </div>
              {userNodeFound && (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-doge-400 font-bold">
                    <span className="w-3 h-3 rounded-full bg-amber-400 border-2 border-white"></span>{" "}
                    YOU
                  </span>
                  <span className="text-slate-500 text-[10px]">Connected Wallet</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
