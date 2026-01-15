# Alert System User Guide

## Overview

The Dogechain Bubblemaps Alert System allows you to monitor wallet activity and receive real-time notifications when important transactions occur. You can track specific wallets, tokens, or large holder movements ("whale alerts").

## Alert Types

### 1. Wallet Watch (WALLET)

**Best for:** Monitoring general wallet activity

The WALLET alert type monitors **all token activity** for a specific wallet address. You'll receive notifications for every incoming and outgoing transaction, regardless of which token is being transferred.

**Use cases:**

- Monitor your own wallet for any activity
- Track a competitor's wallet movements
- Watch for activity from known whale addresses
- Monitor exchange wallets for deposits/withdrawals

**What it tracks:**

- All token transfers (incoming and outgoing)
- All tokens in the wallet
- No minimum threshold - every transaction triggers an alert

---

### 2. Token Movement (TOKEN)

**Best for:** Tracking specific token transfers

The TOKEN alert type monitors **only the specified token** for a wallet address. You'll only receive notifications when that particular token is transferred, ignoring all other token activity.

**Use cases:**

- Monitor when a whale transfers wDOGE
- Track specific token movements from a project treasury
- Watch for large transfers of a specific meme token
- Monitor your holdings of a particular token

**What it tracks:**

- Only transfers of the specified token address
- Both incoming and outgoing transfers
- Ignores all other token activity

**How to use:**

1. Select "Token Movement" as the alert type
2. Enter the wallet address to monitor
3. **Required:** Enter the token contract address
4. The system will only notify you when that specific token is transferred

---

### 3. Whale Watch (WHALE)

**Best for:** Detecting large value transfers

The WHALE alert type monitors **large transactions only**. It filters out small transfers and only notifies you when significant value moves.

**Use cases:**

- Detect large token dumps that could affect price
- Monitor when whales move their holdings
- Track institutional-sized transfers
- Get alerted to market-moving transactions

**What it tracks:**

- Only large transactions above a threshold
- Threshold is calculated as: **greater of 10,000 tokens OR 1% of wallet balance**
- Filters out small retail transfers
- Focuses on significant movements only

**Example:**

- If a wallet has 1,000,000 tokens: Whale threshold = 10,000 tokens (max of 10,000 or 1% of 1M)
- If a wallet has 50,000 tokens: Whale threshold = 10,000 tokens (max of 10,000 or 500)
- Only transactions larger than the threshold will trigger alerts

---

## Creating Alerts

### From the Dashboard

1. Navigate to the **My Dashboard** tab
2. Click the **"New Alert"** button (top right)
3. Fill in the alert form:
   - **Alert Name:** A descriptive name (e.g., "My wDOGE Wallet", "Whale Monitor")
   - **Alert Type:** Choose WALLET, TOKEN, or WHALE
   - **Wallet Address:** The 0x... address to monitor
   - **Token Address:** Required for TOKEN type, optional for WHALE type
4. Click **"Create Alert"**

### From Wallet Information Menu

1. Click on any bubble in the visualization
2. In the wallet information panel, click **"Create Alert for this Wallet"**
3. The Dashboard will open with the wallet address pre-filled
4. Complete the form and create your alert

---

## Managing Alerts

### View Your Alerts

All your active alerts are displayed in the **Alert Configurations** table on the Dashboard, showing:

- Alert name
- Monitored wallet address
- Current status (Normal, Triggered, or Pending)
- Number of triggered events
- Edit and Delete buttons

### Alert Statuses

- **Pending:** Alert was just created and hasn't been scanned yet
- **Normal:** No new activity detected since last scan
- **Triggered:** New activity detected - click "Dismiss" to reset to Normal

### Edit an Alert

1. Find the alert in the configurations table
2. Click the **pencil icon** (Edit button)
3. Modify the alert name, addresses, or type
4. Click **"Update Alert"** to save changes

### Delete an Alert

1. Find the alert in the configurations table
2. Click the **trash icon** (Delete button)
3. The alert will be permanently removed

---

## How Alerts Work

### Scanning Process

The system automatically scans for new activity every **30 seconds**. When a scan occurs:

1. **Fetch Transactions:** Retrieves recent transactions for monitored wallets
2. **Compare with Baseline:** Checks against previously seen transactions
3. **Filter by Type:** Applies type-specific filtering (WALLET/TOKEN/WHALE)
4. **Trigger Notifications:** Sends alerts for new qualifying transactions

### First Scan Behavior

When you first create an alert, the system establishes a **baseline** of existing transactions. You won't receive notifications for transactions that already existed - only for **new** transactions that occur after alert creation.

This prevents alert spam from historical activity.

### Persistent Triggered State

Once an alert is triggered, it stays in the "Triggered" state until you manually dismiss it. This ensures you don't miss any alerts even if you're away from the application.

---

## Receiving Notifications

### Browser Notifications

If you grant permission, the system will send **browser push notifications** when alerts trigger. These appear even if the app is in the background.

**To enable:**

- Click the notification icon (speaker) in your browser's address bar when prompted
- Grant permission to display notifications

### In-App Notifications

Alerts also appear as **in-app notification cards** at the top of the Dashboard, showing:

- Alert name
- Transaction direction (Incoming/Outgoing)
- Amount and token symbol
- Sender/Receiver addresses (clickable to explorer)
- Transaction timestamp

### Event History

All triggered alerts are saved to the **Event History** section, where you can:

- View past triggered events
- See transaction details
- Expand to see all transactions in an event
- View price charts for tokens (when available)
- Clear history as needed

---

## Tips and Best Practices

### Naming Conventions

Use descriptive names that include:

- What you're monitoring (e.g., "My Wallet")
- Token symbol if applicable (e.g., "wDOGE Treasury")
- Purpose (e.g., "Whale Dump Monitor")

**Good examples:**

- "My wDOGE Holdings - TOKEN type"
- "Exchange Wallet Monitor - WALLET type"
- "Large Transfer Alert - WHALE type"

### Choosing Alert Types

| Scenario                               | Recommended Type | Reason                          |
| -------------------------------------- | ---------------- | ------------------------------- |
| Monitor all my wallet activity         | WALLET           | Don't miss any transactions     |
| Track specific token from treasury     | TOKEN            | Ignore unrelated tokens         |
| Detect large price-impacting transfers | WHALE            | Filter out small retail noise   |
| Watch for rug pulls / dumps            | TOKEN            | Monitor specific token outflows |
| General whale watching                 | WALLET           | See all their movements         |

### Managing Alert Volume

If you receive too many notifications:

1. **Switch to TOKEN type:** Monitor only specific tokens
2. **Use WHALE type:** Filter out small transfers
3. **Delete redundant alerts:** Remove duplicates or unnecessary monitors
4. **Dismiss triggered alerts:** Clear old triggers to reduce visual clutter

### Performance Considerations

- Each wallet added consumes scanning resources
- More alerts = longer scan times (up to 30 seconds)
- Consider consolidating multiple TOKEN alerts into one WALLET alert
- Use WHALE type to reduce notification frequency for active wallets

---

## Troubleshooting

### Alert Not Triggering

**Possible causes:**

1. **Pending status:** First scan hasn't completed yet (wait up to 30 seconds)
2. **Wrong wallet address:** Verify the address is correct
3. **Wrong token address:** For TOKEN alerts, ensure token contract is accurate
4. **Threshold not met:** For WHALE alerts, transactions may be below the threshold
5. **Baseline not established:** First scan establishes baseline - new alerts trigger on subsequent activity

**Solution:**

- Wait 30-60 seconds for a full scan cycle
- Verify wallet/token addresses are correct
- Check alert type matches your expectations
- Try manually clicking "Scan Now" button

### Too Many Notifications

**Solutions:**

1. Switch from WALLET to TOKEN type
2. Switch from TOKEN to WHALE type
3. Delete alerts for very active wallets
4. Use "Dismiss" to clear triggered status

### Notifications Not Appearing

**Check:**

1. Browser notification permissions are granted
2. Notification sound is enabled (speaker icon in dashboard)
3. Browser is not in "Do Not Disturb" mode
4. System notification settings allow browser notifications

---

## Advanced Features

### Manual Scanning

Click the **"Scan Now"** button to trigger an immediate scan of all alerts, bypassing the 30-second automatic interval.

### Sound Notifications

Toggle notification sounds on/off using the **speaker icon** in the dashboard toolbar. Sounds play for each new triggered event.

### Data Export

Export all your alerts and triggered events as a CSV file using the **download icon** in the dashboard toolbar. Useful for:

- Backup and analysis
- Spreadsheet tracking
- Historical record keeping

### Event Filtering

Event History shows the last 10 triggered events. Older events are automatically removed to prevent database bloat.

---

## Security and Privacy

### Data Storage

- All alert data is stored **locally** in your browser's IndexedDB
- No alert configurations are sent to external servers
- Triggered events are logged anonymously to our servers for analytics
- Your wallet monitoring preferences remain private

### Best Practices

- **Don't share alerts:** Each user has their own alert configuration
- **Use accurate addresses:** Double-check wallet and token addresses
- **Regular cleanup:** Periodically delete unused alerts
- **Monitor sensitively:** Be respectful when monitoring others' wallets

---

## Getting Help

### Dashboard Guide

Click the **help icon (❔)** next to "My Dashboard" for an interactive walkthrough of the alert system.

### Support

For issues, feature requests, or questions:

- Check the audit report: `.claude/ALERT_SYSTEM_AUDIT_REPORT.md`
- Review this guide for common scenarios
- Test with small amounts first to verify alerts work as expected

---

## Summary

| Alert Type | Monitors           | Token Address Required? | Threshold Applied?                  |
| ---------- | ------------------ | ----------------------- | ----------------------------------- |
| **WALLET** | All tokens         | No                      | No - all transactions               |
| **TOKEN**  | One specific token | Yes - required          | No - all transactions of that token |
| **WHALE**  | Large transfers    | Optional                | Yes - filters small transactions    |

**Remember:**

- Alerts scan every 30 seconds automatically
- First scan establishes baseline (no notifications for historical activity)
- Triggered alerts stay triggered until manually dismissed
- All data stored locally in your browser
- Browser notifications require permission

Happy monitoring! 🚀
