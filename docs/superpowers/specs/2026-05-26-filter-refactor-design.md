# Filter System Refactor Design

## Problem

The bubble map's filter interactions are unreliable ("finicky") — especially on mobile. Multiple rounds of patching `stopPropagation`, `useClickOutside`, portal z-index fixes, and touch handler additions have failed to resolve the issues. The root cause is architectural:

1. **BubbleMap.tsx is a 2000-line monolith** mixing D3 rendering, 4+ overlay UIs, click-outside handling, zoom/drag, AND filter consumption. Event handling is spread across capture-phase document listeners, React synthetic events, D3 native events, and portal DOM — all competing.

2. **The unified click-outside handler** is a capture-phase document listener that must know about every overlay ref. Adding new UI elements requires updating it, creating a fragile coupling.

3. **FilterControls renders via `createPortal(document.body)`** but its parent is inside the `z-20` container. The portal escapes the stacking context but creates DOM hierarchy issues — the modal's DOM is outside the BubbleMap container, making event coordination harder.

4. **D3 native events** (`svg.on("click")`, `svg.call(zoom)`, `drag`) don't participate in React's synthetic event system. React's `stopPropagation` stops synthetic propagation but native listeners attached by D3 on the SVG can still fire for events that reach the SVG element.

## Goal

Refactor the filter system so that:

- Filter state, UI, and logic are isolated from BubbleMap's D3 rendering
- Events are handled cleanly with no competing capture/bubble/portal/D3 systems
- Filter interactions work reliably on both desktop and mobile
- The code is easy to understand and maintain

## Architecture

### Current Flow (broken)

```
App.tsx
  └── FilterProvider (React Context)
        └── BubbleMap.tsx (2000 lines)
              ├── D3 SVG rendering (useEffect with filters in deps)
              ├── Unified click-outside handler (capture phase on document)
              ├── Legend UI (z-20, stopPropagation on touch/click)
              ├── Controls UI (z-20, stopPropagation)
              ├── Help UI (z-30)
              └── FilterControls (portal to document.body, z-9999)
```

### New Flow (clean separation)

```
App.tsx
  └── FilterProvider (unchanged)
        └── BubbleMap.tsx (~1800 lines — filter UI removed)
              ├── D3 SVG rendering
              ├── Legend UI
              ├── Controls UI
              ├── Help UI
              └── FilterButton (triggers onFilterModalOpen callback)

        └── FilterModal.tsx (new, standalone)
              ├── Full-screen portal overlay
              ├── FilterControls panel
              └── Own click-outside handling (self-contained)
```

**Key change:** FilterControls is no longer rendered inside BubbleMap. It becomes a standalone `FilterModal` component rendered at the App level. BubbleMap only has a settings button that calls `onOpenFilters()` — it doesn't know about or care about the filter modal's existence.

### Component Changes

#### 1. `components/FilterModal.tsx` (NEW)

- Self-contained modal that renders via `createPortal(document.body, z-[9999])`
- Has its own backdrop click handler (no external click-outside system needed)
- Contains the current FilterControls content
- Props: `isOpen: boolean, onClose: () => void`
- When open: captures ALL pointer events (backdrop + panel)
- When closed: renders nothing (returns null, no DOM footprint)

#### 2. `components/FilterControls.tsx` (SIMPLIFIED)

- Remove `createPortal` — the new `FilterModal` handles portal rendering
- Remove `useClickOutside` for presets — use a simpler local handler
- Render as a plain panel component (no overlay/backdrop logic)
- Props: `onClose: () => void`

#### 3. `components/BubbleMap.tsx` (SIMPLIFIED)

- Remove `FilterControls` import and rendering
- Remove `settingsRef` and `isSettingsOpen` state
- Remove `closeSettings` and `lastModalCloseTimeRef`
- Remove the unified click-outside handler entirely
- Keep only: legend, controls, help overlays
- Replace settings button click with: `onOpenFilters?.()` callback prop
- Remove `filters` from D3 rebuild dependency — accept `filteredWallets` as prop instead
- The parent (App.tsx) computes filtered wallets and passes them down

#### 4. `utils/filterUtils.ts` (UNCHANGED)

- Pure functions, no changes needed

#### 5. `contexts/FilterContext.tsx` (UNCHANGED)

- State management and localStorage persistence, no changes needed

#### 6. `App.tsx` (MODIFIED)

- Render `FilterModal` at the top level
- Compute `filteredWallets` from `filters` + `wallets` and pass to BubbleMap
- Pass `onOpenFilters` callback to BubbleMap
- Manage `isFilterOpen` state locally

### Why This Fixes The Problems

1. **No competing event systems** — The filter modal is a sibling of BubbleMap in the React tree, not nested inside it. Their events never interact.

2. **No unified click-outside handler needed** — The filter modal handles its own click-outside via backdrop click. Legend/controls/help are simple toggles that don't need coordination with a filter modal that doesn't exist inside BubbleMap.

3. **No portal inside BubbleMap** — The portal is at the App level, completely outside BubbleMap's DOM. BubbleMap has zero knowledge of it.

4. **No D3 filter dependency** — BubbleMap receives `filteredWallets` as a prop. It doesn't import `filterWallets` or depend on `filters` context. When the parent passes new wallets, BubbleMap rebuilds. Clean data flow.

5. **Mobile works** — The filter modal is a simple full-screen overlay with backdrop. Touch events on the backdrop close it. Touch events on the panel interact with filter buttons. No propagation issues because the modal is DOM-isolated from the SVG.

### BubbleMap Simplified Event Handling

After the refactor, BubbleMap's remaining overlays (legend, controls, help) are much simpler:

- Each overlay is a simple toggle (open/close)
- No cross-overlay coordination needed (no unified handler)
- Click-outside for each is handled by a simple `useClickOutside` per overlay (like the original design, but now there's no filter modal to conflict with)
- OR even simpler: use React's `onBlur` / native dialog element

## Files Changed

| File                                    | Action    | Description                                          |
| --------------------------------------- | --------- | ---------------------------------------------------- |
| `components/FilterModal.tsx`            | CREATE    | Standalone filter modal with portal                  |
| `components/FilterControls.tsx`         | MODIFY    | Remove portal/overlay logic, render as panel         |
| `components/BubbleMap.tsx`              | MODIFY    | Remove filter rendering, accept filteredWallets prop |
| `App.tsx`                               | MODIFY    | Render FilterModal, compute filteredWallets          |
| `contexts/FilterContext.tsx`            | NO CHANGE | State management unchanged                           |
| `utils/filterUtils.ts`                  | NO CHANGE | Pure functions unchanged                             |
| `hooks/useClickOutside.ts`              | NO CHANGE | Kept for simple overlay click-outside                |
| `tests/bubblemap-filter-e2e.test.tsx`   | MODIFY    | Update to test new structure                         |
| `tests/bubblemap-interactions.test.tsx` | MODIFY    | Update to test new structure                         |

## Testing Plan

- All 101 existing tests updated to work with new structure
- New tests for FilterModal standalone behavior
- Verify: opening filters, changing holding size, clicking legend, mobile touch — all work independently
- Verify: no event leakage between filter modal and bubble map
