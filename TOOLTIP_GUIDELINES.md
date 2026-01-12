# Tooltip Usage Guidelines

## Standard

All tooltips in Dogechain Bubblemaps must use the custom `<Tooltip>` component from `/components/Tooltip.tsx`.

## Why Standard Tooltips?

- **Consistent User Experience**: Uniform appearance and behavior across the entire application
- **Dark Theme Matching**: Tooltips blend seamlessly with the space theme
- **Accessibility**: Full keyboard navigation and screen reader support
- **Auto-Positioning**: Intelligent collision detection prevents viewport overflow
- **Smooth Animations**: 200ms fade transitions for professional feel

## Component Import

```tsx
import { Tooltip } from "./components/Tooltip";
```

## Standard Patterns

### 1. Action Buttons

**Format**: Verb + noun (actionable description)

```tsx
// ✅ Good
<Tooltip content="Scan all wallets for new transactions">
  <button>Scan</button>
</Tooltip>

<Tooltip content="Copy address to clipboard">
  <button><Copy /></button>
</Tooltip>

<Tooltip content="Download map as PNG image">
  <button><Download /></button>
</Tooltip>

// ❌ Bad - too brief
<Tooltip content="Scan">
  <button>Scan</button>
</Tooltip>
```

### 2. External Links

**Format**: "View [noun] on [platform]"

```tsx
// ✅ Good
<Tooltip content="View transaction on Dogechain Explorer">
  <a href={explorerUrl} target="_blank">
    <ExternalLink />
  </a>
</Tooltip>

<Tooltip content="View wallet on Blockscout">
  <a href={explorerUrl} target="_blank">
    <ExternalLink />
  </a>
</Tooltip>
```

### 3. Status Indicators

**Format**: [State] [noun]

```tsx
// ✅ Good
<Tooltip content="Triggered alert">
  <AlertTriangle className="text-red-500" />
</Tooltip>

<Tooltip content="Paused animation">
  <button><Pause /></button>
</Tooltip>

<Tooltip content="Normal operation">
  <CheckCircle className="text-green-500" />
</Tooltip>
```

### 4. Disabled States

**Format**: Explain the requirement or next step

```tsx
// ✅ Good
<Tooltip content="Search for an asset first to enable map analysis">
  <button disabled>
    <Map />
    <span>Map Analysis</span>
  </button>
</Tooltip>

<Tooltip content="Create an alert first before scanning">
  <button disabled>Scan Now</button>
</Tooltip>
```

### 5. Icon-Only Buttons

**Format**: Explain the action clearly

```tsx
// ✅ Good
<Tooltip content="Close wallet details">
  <button><X /></button>
</Tooltip>

<Tooltip content="Reset to default view">
  <button><RotateCcw /></button>
</Tooltip>

<Tooltip content="Zoom in">
  <button><ZoomIn /></button>
</Tooltip>
```

### 6. Address Displays

**Format**: Show full address + copy action hint (use multiline for complex info)

```tsx
// ✅ Good - Simple address
<Tooltip content={wallet.address}>
  <span className="font-mono">{truncateAddress(wallet.address)}</span>
</Tooltip>

// ✅ Better - Address with context
<Tooltip content={
  <div className="space-y-1">
    <p className="font-mono text-xs">{wallet.address}</p>
    <p className="text-slate-400 text-xs">Click to copy</p>
  </div>
}>
  <span className="font-mono">{truncateAddress(wallet.address)}</span>
</Tooltip>

// ✅ Best - Dynamic state feedback
<Tooltip content={copied ? "Address copied!" : "Copy full address to clipboard"}>
  <button onClick={handleCopyAddress}>
    {copied ? <Check /> : <Copy />}
  </button>
</Tooltip>
```

### 7. Dynamic Content

**Format**: Content changes based on state

```tsx
// ✅ Good - Toggle buttons
<Tooltip content={soundEnabled ? "Mute notifications" : "Enable notification sound"}>
  <button onClick={toggleSound}>
    {soundEnabled ? <Volume2 /> : <VolumeX />}
  </button>
</Tooltip>

<Tooltip content={isPaused ? "Resume animation" : "Pause animation"}>
  <button onClick={togglePause}>
    {isPaused ? <Play /> : <Pause />}
  </button>
</Tooltip>
```

## Writing Guidelines

### 1. Be Concise

- **Max 60 characters** for simple tooltips
- Use multiline for complex information
- Avoid unnecessary words

### 2. Use Active Voice

- ✅ "Copy address" (active)
- ❌ "Address can be copied" (passive)

### 3. Explain WHY

- For disabled states: explain the requirement
- ✅ "Search for an asset first"
- ❌ "Not available"

### 4. Be Specific

- ✅ "View transaction on Dogechain Explorer"
- ❌ "View" (too vague)
- ❌ "Click to view the transaction details on the Dogechain blockchain explorer" (too long)

### 5. Avoid Redundancy

- Don't repeat button text in tooltip
- ✅ Button: "Copy" → Tooltip: "Copy address to clipboard"
- ❌ Button: "Copy Address" → Tooltip: "Copy Address"

## Position Guidelines

Use the `position` prop to suggest optimal placement:

```tsx
// Above buttons (default, works well most of the time)
<Tooltip content="Help text">
  <button>Action</button>
</Tooltip>

// Left side for left-aligned controls
<Tooltip content="Zoom in" position="left">
  <button><ZoomIn /></button>
</Tooltip>

// Right side for right-aligned controls
<Tooltip content="View details" position="right">
  <button><Info /></button>
</Tooltip>
```

The Tooltip component has **auto-positioning enabled by default**, so it will automatically adjust if the suggested position would cause viewport overflow.

## Position Guidelines

### Portal Rendering (Default)

**All tooltips use React Portal rendering by default** (`portal={true}`). This means:

- Tooltips render at document root level
- Escape parent container boundaries completely
- Never get clipped by drawers, tables, or other containers
- Float above all UI elements with proper z-index

**Benefits**:

- ✅ No clipping issues (WalletSidebar drawer, Dashboard tables, BubbleMap)
- ✅ Consistent z-index hierarchy (z-[130] above everything)
- ✅ Works with any container (overflow hidden, transform, etc.)
- ✅ Automatic positioning calculation

**When to Override** (rare):

- Tooltips in scrollable lists with many items
- Tooltips with complex interactive state
- Tooltips already inside a portal/iframe

```tsx
// Standard usage (recommended)
<Tooltip content="Help text">
  <button>Action</button>
</Tooltip>

// Disable portal rendering (edge cases only)
<Tooltip portal={false} content="Simple tooltip">
  <button>Action</button>
</Tooltip>
```

### Position Suggestion

Use the `position` prop to suggest optimal placement:

```tsx
// Above buttons (default, works well most of the time)
<Tooltip content="Help text">
  <button>Action</button>
</Tooltip>

// Left side for left-aligned controls
<Tooltip content="Zoom in" position="left">
  <button><ZoomIn /></button>
</Tooltip>

// Right side for right-aligned controls
<Tooltip content="View details" position="right">
  <button><Info /></button>
</Tooltip>

// Below for elements at top of viewport
<Tooltip content="Helpful info" position="bottom">
  <button>Top Button</button>
</Tooltip>
```

The Tooltip component has **auto-positioning enabled by default**, so it will automatically adjust if the suggested position would cause viewport overflow. This works perfectly with portal rendering.

### Custom Z-Index

For most tooltips, the default z-index of 130 is perfect. However, you can customize if needed:

```tsx
// Higher z-index for critical tooltips
<Tooltip content="Critical warning" zIndex={200}>
  <Alert />
</Tooltip>

// Lower z-index for decorative tooltips
<Tooltip content="Info hint" zIndex={100}>
  <Info />
</Tooltip>
```

## Styling

All tooltips automatically use:

- **Background**: `bg-space-800` (dark space theme)
- **Border**: `border-space-700` (subtle border)
- **Text**: `text-slate-300` (light gray)
- **Animation**: 200ms fade (smooth transitions)
- **Arrow**: Styled indicator pointing to trigger
- **Z-index**: 130 (above all UI elements, including WalletSidebar and modals)

No additional styling needed!

## Accessibility

The Tooltip component includes:

- ✅ Keyboard navigation (Tab + Focus)
- ✅ Screen reader support (ARIA attributes)
- ✅ Touch device support (long-press)
- ✅ Proper focus management

No additional accessibility work required when using `<Tooltip>`.

## Common Mistakes to Avoid

### ❌ DON'T: Use native title attributes

```tsx
// ❌ Bad - Uses browser default tooltip
<button title="Copy address">
  <Copy />
</button>

// ✅ Good - Uses custom Tooltip component
<Tooltip content="Copy address to clipboard">
  <button><Copy /></button>
</Tooltip>
```

### ❌ DON'T: Repeat obvious information

```tsx
// ❌ Bad - Button already says "Copy"
<button>Copy</button>
<Tooltip content="Copy button"> {/* Redundant */}

// ✅ Good - Explains what gets copied
<button>Copy</button>
<Tooltip content="Copy address to clipboard">
```

### ❌ DON'T: Use overly technical language

```tsx
// ❌ Bad - Too technical
<Tooltip content="Execute clipboard write operation for address string">

// ✅ Good - User-friendly
<Tooltip content="Copy address to clipboard">
```

## Testing Checklist

When adding or modifying tooltips:

- [ ] Tooltip appears on hover
- [ ] Tooltip disappears when mouse leaves
- [ ] Tooltip auto-positions if near viewport edge
- [ ] Keyboard focus triggers tooltip
- [ ] Long text displays properly (multiline)
- [ ] Dynamic content updates correctly
- [ ] No styling inconsistencies

## Migration Checklist

When converting native `title` attributes to `<Tooltip>`:

1. **Import** the Tooltip component
2. **Wrap** the target element with `<Tooltip>`
3. **Move** the title text to the `content` prop
4. **Enhance** the content if needed (be more specific)
5. **Remove** the native `title` attribute
6. **Test** the tooltip appearance and behavior

## Examples

### Before vs After

```tsx
// ❌ Before - Native title
<button onClick={handleCopy} title="Copy address">
  <Copy size={16} />
</button>

// ✅ After - Custom Tooltip
<Tooltip content="Copy address to clipboard">
  <button onClick={handleCopy}>
    <Copy size={16} />
  </button>
</Tooltip>
```

```tsx
// ❌ Before - Native title with variable
<a href={explorerUrl} title={txHash} target="_blank">
  View
</a>

// ✅ After - Custom Tooltip with context
<Tooltip content="View transaction on Dogechain Explorer">
  <a href={explorerUrl} target="_blank">
    View
  </a>
</Tooltip>
```

```tsx
// ❌ Before - Native title (unclear disabled state)
<button disabled title="Not available">
  Analyze
</button>

// ✅ After - Custom Tooltip (explains requirement)
<Tooltip content="Search for an asset first to enable analysis">
  <button disabled>
    Analyze
  </button>
</Tooltip>
```

## Future Development

**Rule**: Any new tooltip or hover-over interaction must use the `<Tooltip>` component.

**Exception**: None. Native `title` attributes should never be used for tooltips.

**Enforcement**: Run this command to verify:

```bash
grep -r 'title="' components/ --include='*.tsx'
# Should return zero results
```

---

## Need Help?

- **Implementation**: See `/components/Tooltip.tsx` for source code
- **Examples**: Check App.tsx:1848-1867 for homepage tooltip usage
- **Documentation**: See `TOOLTIP_COMPONENT_IMPLEMENTATION.md` for technical details
- **Positioning Fix**: See `TOOLTIP_POSITIONING_FIX.md` for portal rendering implementation

**Last Updated**: January 12, 2026
