# Map Analysis Guide System - Testing Guide

This document provides instructions for testing and using the Map Analysis page guide system.

## Overview

The Map Analysis page has three context-aware guide modals:

1. **Bubble Visualization Guide** - 6 steps for bubble map visualization
2. **Token Info Panel Guide** - 6 steps for stats panel
3. **Wallet Details Guide** - 6 steps for wallet details sidebar

## Testing Guides via UI

The easiest way to test guides is through the UI:

1. Navigate to the **Map Analysis** page (search for any token)
2. Click the **Help button** (question mark icon) in the top-right corner
3. Select a guide from the dropdown:
   - "Bubble Map Help" - Opens bubble visualization guide
   - "Token Panel Help" - Opens token info panel guide
   - "Wallet Details Help" - Opens wallet details guide
   - "Reset All Guides" - Resets all guides to show them again

## Testing Guides via Console

You can also trigger guides programmatically from the browser console:

### Reset All Guides

```javascript
window.__DOGECCHAIN_GUIDES__.resetAllGuides();
```

Clears localStorage state and allows guides to show again. Refresh the page after calling this.

### Manually Trigger Bubble Visualization Guide

```javascript
window.__DOGECCHAIN_GUIDES__.openBubbleGuide();
```

Opens the bubble map visualization guide immediately.

### Manually Trigger Token Info Panel Guide

```javascript
window.__DOGECCHAIN_GUIDES__.openTokenPanelGuide();
```

Opens the token info panel guide immediately.

### Manually Trigger Wallet Details Guide

```javascript
window.__DOGECCHAIN_GUIDES__.openWalletDetailsGuide();
```

Opens the wallet details guide immediately.

### Check Current Guide Status

```javascript
window.__DOGECCHAIN_GUIDES__.getGuideStatus();
```

Returns the current state of all guides:

```javascript
{
  bubble: { isOpen: true/false, step: 0-5 },
  tokenPanel: { isOpen: true/false, step: 0-5 },
  walletDetails: { isOpen: true/false, step: 0-5 }
}
```

## Clear localStorage Manually

If guides don't appear after reset, clear all localStorage:

```javascript
localStorage.clear();
location.reload();
```

## Auto-Trigger Conditions

Guides automatically appear based on user interactions:

| Guide                | Trigger Condition                                 | Delay       |
| -------------------- | ------------------------------------------------- | ----------- |
| Bubble Visualization | When entering ANALYSIS view with a token selected | 2.5 seconds |
| Token Info Panel     | When ANALYSIS view loads with holder data         | 1 second    |
| Wallet Details       | When wallet sidebar opens                         | 0.5 seconds |

## localStorage Keys

The system uses these localStorage keys to track guide state:

### Bubble Visualization Guide

- `dogechain_bubble_guide_seen` - Boolean: Has user completed the guide?
- `dogechain_bubble_guide_version` - String: Current guide version
- `dogechain_bubble_guide_dismissed_count` - Number: Times user dismissed guide
- `dogechain_bubble_guide_last_step` - Number: Last step user was on

### Token Info Panel Guide

- `dogechain_token_panel_guide_seen`
- `dogechain_token_panel_guide_version`
- `dogechain_token_panel_guide_dismissed_count`
- `dogechain_token_panel_guide_last_step`

### Wallet Details Guide

- `dogechain_wallet_details_guide_seen`
- `dogechain_wallet_details_guide_version`
- `dogechain_wallet_details_guide_dismissed_count`
- `dogechain_wallet_details_guide_last_step`

## Guide Behavior Rules

1. **First-time users**: Guides show automatically on first interaction
2. **Version mismatch**: Guides re-show if version changes
3. **Dismissal limit**: After 3 dismissals, guides stop auto-showing
4. **Manual access**: Users can always access guides via Help button
5. **Completion**: Once completed, guides don't auto-show again

## Keyboard Controls

All guides support keyboard navigation:

- **ESC** - Close the guide
- **Arrow Right** - Next step
- **Arrow Left** - Previous step
- **Tab/Shift+Tab** - Navigate through interactive elements

## Testing Checklist

- [ ] Help button appears in ANALYSIS view
- [ ] Help menu dropdown opens/closes correctly
- [ ] "Reset All Guides" clears localStorage and resets state
- [ ] Bubble guide opens via menu button
- [ ] Token panel guide opens via menu button
- [ ] Wallet details guide opens via menu button
- [ ] Bubble guide auto-triggers on ANALYSIS view entry (2.5s delay)
- [ ] Token panel guide auto-triggers when holders load (1s delay)
- [ ] Wallet details guide auto-triggers on wallet selection (0.5s delay)
- [ ] Guides don't re-trigger after completion
- [ ] ESC key closes guides
- [ ] Arrow keys navigate steps
- [ ] Click outside closes guides
- [ ] Focus restoration works after closing guide
- [ ] Console helpers are available on page load

## Troubleshooting

### Guides not appearing?

1. Check localStorage: `localStorage.getItem('dogechain_bubble_guide_seen')`
2. Reset guides: `window.__DOGECCHAIN_GUIDES__.resetAllGuides()`
3. Clear all localStorage: `localStorage.clear(); location.reload()`
4. Check console for errors
5. Verify `window.__DOGECCHAIN_GUIDES__` is available

### Guides appearing too slowly?

The delays are intentional:

- Bubble guide: 2.5s (let visualization load)
- Token panel guide: 1s (let holders display)
- Wallet details guide: 0.5s (let sidebar slide in)

Use the Help button for immediate access.

### Testing helpers not available?

Wait for the console log: `🔧 Guide testing helpers available on window.__DOGECCHAIN_GUIDES__`

If it doesn't appear, check for import errors in the console.
