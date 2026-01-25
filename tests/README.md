# Alert System Test Suite

Comprehensive test suite for the Dogechain Bubblemaps alert system, covering alert creation, scanning, trigger detection, and integration flows.

## Test Structure

```
tests/
├── alert-setup.ts           # Shared test utilities and mocks
├── alert-creation.test.ts   # Alert creation tests
├── alert-scanning.test.ts   # Alert scanning tests
├── trigger-detection.test.ts # Trigger detection tests
├── integration.test.ts      # Integration tests
├── setup.ts                 # Vitest setup configuration
└── README.md                # This file
```

## Test Files

### alert-setup.ts

Shared utilities and mocks for all alert system tests. Includes:

- **Mock Data**: Valid/invalid wallet addresses, token addresses, transactions
- **Mock Functions**: Data service mocks for balance, transactions, token data
- **Test Utilities**: Functions to create mock objects and assertions
- **Test Context**: Common setup/teardown helpers

### alert-creation.test.ts

Tests for alert creation functionality:

- Wallet alert creation
- Token alert creation
- Whale alert creation
- Invalid address validation
- `pendingInitialScan` flag behavior
- Status initialization order
- Alert properties (lowercasing, timestamps)

### alert-scanning.test.ts

Tests for alert scanning logic:

- Single alert scanning
- Batch processing multiple alerts
- Scanning with no transactions
- Scanning with new transactions
- Baseline establishment
- Whale alert filtering
- Error handling

### trigger-detection.test.ts

Tests for trigger detection logic:

- New alert with post-creation transactions
- Existing alert with new transactions
- Alert with no new transactions
- Triggered state persistence across scans
- Type-specific trigger behavior

### integration.test.ts

End-to-end integration tests:

- Full flow: create -> transaction -> scan -> trigger
- Full flow: create -> edit -> scan
- Full flow: create -> delete -> verify removed
- Complex integration scenarios
- Error recovery

## Running Tests

### Run All Tests

```bash
npm test
```

### Run Alert System Tests Only

```bash
npm run test:alert
```

### Run Specific Test Suites

```bash
# Alert creation tests
npm run test:alert:creation

# Alert scanning tests
npm run test:alert:scanning

# Trigger detection tests
npm run test:alert:trigger

# Integration tests
npm run test:alert:integration
```

### Run All Alert Tests Individually

```bash
npm run test:alert:all
```

### Watch Mode

Run tests in watch mode for development:

```bash
npm run test:alert:watch
```

### UI Mode

Run tests with the Vitest UI:

```bash
npm run test:ui
```

### Coverage Report

Generate a coverage report:

```bash
npm run test:coverage
```

## Test Utilities

### Creating Mock Objects

```typescript
import { createMockAlert, createMockAlertStatus, createMockTransaction } from "./tests/setup";

// Create a mock alert
const alert = createMockAlert({
  name: "Test Alert",
  walletAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
  type: "WALLET",
});

// Create a mock alert status
const status = createMockAlertStatus({
  triggered: true,
  baselineEstablished: true,
});

// Create a mock transaction
const tx = createMockTransaction({
  hash: "0x123456...",
  value: 100000,
});
```

### Using Mock Data

```typescript
import { MOCK_WALLET_ADDRESSES, MOCK_TOKEN_ADDRESSES, MOCK_TRANSACTIONS } from "./tests/setup";

// Use mock addresses
const validAddress = MOCK_WALLET_ADDRESSES.valid;
const wDOGEAddress = MOCK_TOKEN_ADDRESSES.wDOGE;

// Use mock transactions
const transactions = MOCK_TRANSACTIONS;
```

## Key Concepts

### pendingInitialScan Flag

The `pendingInitialScan` flag ensures that newly created alerts are picked up by the scanner:

1. Alert is created with `pendingInitialScan: true`
2. Scanner detects the flag and runs initial scan
3. After scan completes, flag is cleared to `false`

This prevents the need to scan all existing alerts when a new one is added.

### Baseline Establishment

The baseline prevents historical transaction spam:

- **New alerts**: Only trigger on transactions AFTER alert creation
- **Existing alerts**: Trigger on transactions since last scan
- Baseline timestamp is established on first successful scan

### Triggered State Persistence

Once an alert triggers, it stays triggered until manually dismissed:

- Prevents repeated notifications for the same event
- Maintains visual indicator in the UI
- Dismissible via the "Dismiss" button

## Test Patterns

### Testing Alert Creation

```typescript
it("should create a wallet alert", async () => {
  const result = await simulateAlertCreation(existingAlerts, existingStatuses, {
    name: "My Alert",
    walletAddress: MOCK_WALLET_ADDRESSES.valid,
    alertType: "WALLET",
  });

  expect(result.alerts).toHaveLength(1);
  expect(result.alerts[0].type).toBe("WALLET");
  expect(result.statuses[result.alerts[0].id].pendingInitialScan).toBe(true);
});
```

### Testing Trigger Detection

```typescript
it("should trigger on new transactions", () => {
  const alert = createMockAlert({ createdAt: Date.now() - 3600000 });
  const status = createMockAlertStatus({ baselineEstablished: true });

  const newTx = createMockTransaction({ timestamp: Date.now() - 60000 });

  const result = simulateScanForTriggerDetection(alert, status, [newTx]);

  expect(result.triggered).toBe(true);
  expect(result.newTransactions?.length).toBe(1);
});
```

## Troubleshooting

### Tests Fail with "Cannot find module"

Ensure the test files are in the correct location and imports use correct paths:

```typescript
// Correct
import { createMockAlert } from "./alert-setup";

// Incorrect (will fail)
import { createMockAlert } from "../tests/alert-setup";
```

### Mock Functions Not Being Called

Make sure to call `resetAllMocks()` in `beforeEach`:

```typescript
import { resetAllMocks } from "./tests/setup";

beforeEach(() => {
  resetAllMocks();
});
```

### Tests Timing Out

If tests timeout, consider:

1. Reducing batch sizes in test scenarios
2. Using shorter delays in test simulations
3. Mocking async operations instead of waiting for real responses

## Contributing

When adding new tests:

1. Use descriptive test names that explain what is being tested
2. Group related tests in nested `describe` blocks
3. Follow the existing test patterns and utilities
4. Update this README if adding new test files or patterns
5. Ensure all tests pass before committing

## Coverage Goals

The test suite aims for:

- **Alert Creation**: 100% coverage of creation flow
- **Alert Scanning**: 100% coverage of scanning logic
- **Trigger Detection**: 100% coverage of trigger scenarios
- **Integration**: Key user flows covered

Current coverage can be checked with:

```bash
npm run test:coverage
```

## Related Files

- `/Volumes/DEV Projects/Dogechain Bubblemaps/App.tsx` - Main app with alert creation
- `/Volumes/DEV Projects/Dogechain Bubblemaps/components/Dashboard.tsx` - Alert scanning UI
- `/Volumes/DEV Projects/Dogechain Bubblemaps/services/db.ts` - Database operations
- `/Volumes/DEV Projects/Dogechain Bubblemaps/api/alerts.ts` - Server API
- `/Volumes/DEV Projects/Dogechain Bubblemaps/types.ts` - Type definitions
