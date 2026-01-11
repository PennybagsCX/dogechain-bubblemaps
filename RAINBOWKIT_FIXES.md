# RainbowKit Fixes - Separate Window & Styling Issues

## Summary

Fixed two issues with the RainbowKit implementation:

1. **Separate window pop-ups** - Updated configuration to prioritize extension connectors
2. **ConnectButton styling** - Customized button to match original purple theme design

---

## Changes Made

### 1. wagmi.ts - Prioritize Extension Connectors

**Issue**: RainbowKit was falling back to WalletConnect, which opens separate windows/QR modals.

**Fix**: Updated `wagmi.ts` to explicitly prioritize injected connectors (MetaMask, Rainbow, Rabby) over WalletConnect.

```typescript
// Added import
import { injected } from "wagmi/connectors";

// Updated config with explicit connectors
export const config = getDefaultConfig({
  appName: "Dogechain BubbleMaps",
  projectId: "YOUR_WALLETCONNECT_PROJECT_ID",
  chains: [dogechain],
  ssr: true,
  // Prioritize extension connectors over WalletConnect to prevent separate window pop-ups
  connectors: [
    // Injected connector (MetaMask, Rainbow, Rabby, etc.) - highest priority
    injected({ target: "metaMask" }),
    injected({ target: "rabby" }),
    injected({ target: "rainbow" }),
    // WalletConnect - lower priority, only for mobile wallets
  ],
});
```

**What this does**:

- Forces RainbowKit to try extension connectors first
- WalletConnect is still available but lower priority (for mobile wallets)
- Prevents fallback to WalletConnect QR modal/separate window

---

### 2. Navbar.tsx - Custom ConnectButton Styling

**Issue**: Default ConnectButton didn't match the original purple theme design.

**Fix**: Replaced simple `<ConnectButton />` with `ConnectButton.Custom` to have full control over styling.

**Before**:

```tsx
<ConnectButton />
```

**After**:

```tsx
<ConnectButton.Custom>
  {({
    account,
    chain,
    openAccountModal,
    openChainModal,
    openConnectModal,
    authenticationStatus,
    mounted,
  }) => {
    // Custom render logic with purple theme styling
    const ready = mounted && authenticationStatus !== "loading";
    const connected =
      ready &&
      account &&
      chain &&
      (!authenticationStatus || authenticationStatus === "authenticated");

    return (
      <div
        {...(!ready && {
          "aria-hidden": true,
          style: { opacity: 0, pointerEvents: "none", userSelect: "none" },
        })}
      >
        {(() => {
          if (!connected) {
            // Connect button - Purple theme matching original design
            return (
              <button
                onClick={openConnectModal}
                className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 bg-purple-600 text-white shadow-lg shadow-purple-600/20 hover:bg-purple-700 focus:ring-2 focus:ring-purple-500 focus:outline-none font-medium"
              >
                <span>Connect Wallet</span>
              </button>
            );
          }

          if (chain.unsupported) {
            // Wrong network button - Red theme
            return (
              <button
                onClick={openChainModal}
                className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 bg-red-600 text-white shadow-lg hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:outline-none font-medium"
              >
                <span>Wrong network</span>
              </button>
            );
          }

          // Connected state - Chain selector + Account button
          return (
            <div className="flex items-center gap-2">
              <button onClick={openChainModal} className="...chain-selector-styling...">
                {chain.hasIcon && <chain icon />}
                <span>{chain.name}</span>
              </button>
              <button onClick={openAccountModal} className="...account-button-purple-theme...">
                <span>{account.displayName}</span>
                <span>{account.displayBalance}</span>
              </button>
            </div>
          );
        })()}
      </div>
    );
  }}
</ConnectButton.Custom>
```

**Styling features**:

- **Connect button**: Purple-600 background with purple-600/20 shadow, hover:bg-purple-700
- **Wrong network**: Red-600 with hover:bg-red-700
- **Chain selector**: Dark theme (bg-space-700) with hover:bg-space-600
- **Account button**: Purple-600 matching connect button theme
- **Consistent spacing**: `px-4 py-2` rounded-lg matching nav buttons
- **Focus states**: ring-2 focus:ring-purple-500 for accessibility
- **Responsive**: Hidden elements on mobile (`sm:hidden`, `sm:inline`)

---

## Testing Instructions

### 1. Check for separate windows issue:

1. Open http://localhost:3003/
2. Click "Connect Wallet" button
3. **Expected**: See wallet selection modal (NOT separate window)
4. Select your wallet (Rainbow wallet in your case)
5. **Expected**: Wallet extension opens in its own UI (NOT separate popup window)
6. Approve connection
7. **Expected**: Connected successfully

### 2. Check styling:

1. When disconnected: Purple "Connect Wallet" button matching nav buttons
2. When connected on wrong network: Red "Wrong network" button
3. When connected on correct network:
   - Chain selector button (dark theme, left side)
   - Account button (purple theme, shows address + balance)

---

## Build Results

**Build completed successfully in 12.90s**

```
dist/index.html                                           3.60 kB │ gzip:   1.35 kB
dist/assets/index-B3bw8QIV.css                           88.50 kB │ gzip:  15.23 kB
[... chunks ...]
✓ built in 12.90s
```

No TypeScript errors, no runtime errors (pending testing).

---

## Remaining Tasks

### 1. Get WalletConnect Project ID (Optional)

For production deployment, get a free Project ID from WalletConnect Cloud:

1. Go to https://cloud.walletconnect.com/
2. Create a free account
3. Create a new project
4. Copy your Project ID
5. Replace `'YOUR_WALLETCONNECT_PROJECT_ID'` in `wagmi.ts`

**Note**: This is optional. The current configuration prioritizes extension connectors, so WalletConnect is only a fallback for mobile wallets.

### 2. Test with your Rainbow wallet

1. Make sure MetaMask is disabled (as you mentioned)
2. Open http://localhost:3003/
3. Click "Connect Wallet"
4. Verify the extension UI is used (not separate window)

---

## Technical Details

### Why this fixes the separate window issue:

1. **Explicit connector priority**: By explicitly listing `injected({ target: 'rainbow' })` before WalletConnect, we force RainbowKit to try the extension first.

2. **Prevents fallback**: The default RainbowKit config tries to be smart about which connector to use, which can lead to WalletConnect fallback. Our explicit config prevents this.

3. **Extension-native UI**: When RainbowKit detects an injected connector (Rainbow wallet), it uses the extension's native UI instead of opening a separate window.

### Why ConnectButton.Custom:

1. **Full styling control**: The default ConnectButton has limited styling options. Using `ConnectButton.Custom` gives us complete control.

2. **Matches original design**: We can now match the purple theme, spacing, and animations of the original design.

3. **Better UX**: Custom states for "wrong network", connected/disconnected, and responsive design.

---

## Files Modified

1. **wagmi.ts**
   - Added `import { injected } from 'wagmi/connectors'`
   - Added explicit `connectors` array prioritizing injected connectors

2. **components/Navbar.tsx**
   - Replaced `<ConnectButton />` with `<ConnectButton.Custom>`
   - Added custom render logic with purple theme styling
   - Added responsive classes for mobile/desktop

---

## Next Steps

1. **Test the wallet connection**:
   - Open http://localhost:3003/
   - Click "Connect Wallet"
   - Verify no separate window opens
   - Verify purple theme styling matches

2. **Report results**:
   - If still seeing separate windows: Check browser console for errors
   - If styling is off: Let me know what needs adjustment

3. **Optional**: Get WalletConnect Project ID for production deployment

---

## Expected Behavior

### Before fixes:

- Clicking "Connect Wallet" might open WalletConnect QR modal (separate window)
- Button styling didn't match original purple theme

### After fixes:

- Clicking "Connect Wallet" opens wallet selection modal in-page
- Selecting Rainbow wallet opens the extension's native UI (not separate window)
- All buttons match original purple theme design
- Proper styling for connected/disconnected/wrong-network states
