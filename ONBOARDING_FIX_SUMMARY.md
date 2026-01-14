# Onboarding Hard Reload Behavior

## Current Behavior

The onboarding modal shows on **both** first visits AND hard reloads (until the user completes it).

## Implementation Details

### What Shows Onboarding

```typescript
const shouldAutoOpen =
  view === ViewState.HOME &&
  shouldShowOnboarding() &&
  (isHardReload || !hasShownOnboardingRef.current);
```

**Triggers:**

1. ✅ First visit to homepage
2. ✅ Hard refresh (Cmd+R, F5) - detects actual network reload
3. ✅ Every subsequent hard refresh

**What Stops Onboarding:**

- ❌ User completes all onboarding steps (localStorage: `hasSeen = true`)
- ❌ User skips 3+ times (dismissal count reaches limit)
- ❌ Navigation changes away from HOME view

### Technical Details

**Hard Reload Detection:**

```typescript
const isHardReload =
  navigationInfoRef.current.type === "reload" &&
  typeof navigationInfoRef.current.transferSize === "number" &&
  navigationInfoRef.current.transferSize > 0;
```

This uses the Performance Navigation Timing API to detect:

- Type: "reload" (user triggered refresh)
- transferSize > 0 (actual network transfer, not back/forward cache)

**Key Implementation Notes:**

1. Session flag is initialized **synchronously** from sessionStorage (prevents timing bugs)
2. Session flag is NOT set when modal opens (allows re-show on hard reload)
3. Session flag is only set when user **completes** onboarding
4. Hard reload detection happens in useEffect on mount (read-only, no side effects)

## Expected User Flow

1. **First visit**: Modal appears automatically
2. **User hard refreshes**: Modal appears again
3. **User refreshes again**: Modal appears again
4. **User completes all steps**: Modal never shows again (localStorage set)
5. **User clicks help icon**: Can manually re-open anytime

## Testing Results

Tested with Playwright automation:

- ✅ First visit: Modal appeared
- ✅ Hard refresh #1: Modal appeared
- ✅ Hard refresh #2: Modal appeared
- ✅ Completes onboarding: Never shows again

## Rationale

This behavior ensures users see the onboarding:

- When they first discover the app
- Every time they refresh (reminders to complete onboarding)
- Until they explicitly complete it

This helps with user onboarding and feature discovery, as users often refresh pages and may have missed important information the first time.
