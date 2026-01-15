# Alert Sync Monitoring & Alerting Guide

This guide provides comprehensive monitoring and alerting strategies for the alert synchronization feature.

## Table of Contents

1. [Key Metrics](#key-metrics)
2. [Monitoring Setup](#monitoring-setup)
3. [Alerting Configuration](#alerting-configuration)
4. [Performance Baselines](#performance-baselines)
5. [Troubleshooting](#troubleshooting)
6. [Maintenance Procedures](#maintenance-procedures)

---

## Key Metrics

### Technical Metrics

#### Sync Success Rate

**Definition**: Percentage of successful sync operations
**Target**: > 99%
**Measurement**:

```javascript
// Track in application
const syncSuccessRate = (successfulSyncs / totalSyncs) * 100;
```

**Alert Threshold**: < 95% should trigger investigation

#### Sync Latency

**Definition**: Time from sync initiation to completion
**Target**: < 2 seconds for 100 alerts
**Measurement**:

```javascript
// Track sync duration
const startTime = performance.now();
await syncAlerts(walletAddress);
const duration = performance.now() - startTime;
```

**Alert Threshold**: > 5 seconds should trigger alert

#### API Error Rate

**Definition**: Percentage of failed API requests
**Target**: < 0.1%
**Measurement**:

```javascript
// Track API errors
const apiErrorRate = (failedRequests / totalRequests) * 100;
```

**Alert Threshold**: > 1% should trigger alert

#### Database Connection Pool

**Definition**: Active database connections / max connections
**Target**: < 80% utilization
**Monitoring**: Neon Dashboard

### User Metrics

#### Cross-Device Usage

**Definition**: Number of unique wallets syncing from multiple devices
**Measurement**: Count distinct wallet addresses with sync activity
**Trend**: Should increase over time as users discover feature

#### Alert Restore Rate

**Definition**: How often users benefit from sync (alerts restored from server)
**Formula**: `Restores = Downloads where local alerts = 0`
**Target**: > 10% of sync operations should be restores

#### Sync Opt-Out Rate

**Definition**: Percentage of users who don't connect wallet (opting out of sync)
**Target**: < 20% (should decrease as users discover benefits)
**Measurement**: Local-only alert creations / total alert creations

---

## Monitoring Setup

### 1. Application Monitoring

#### Vercel Analytics (Built-in)

The project already includes Vercel Analytics:

```typescript
// Already in App.tsx
import { Analytics } from "@vercel/analytics/react";
```

**Enable Custom Events**:

```typescript
// Track sync events
import { Analytics } from "@vercel/analytics/react";

// Track successful sync
Analytics.track("alert_sync_success", {
  walletAddress: userAddress,
  uploaded: result.uploaded,
  downloaded: result.downloaded,
  conflicts: result.conflicts,
  duration: result.timestamp,
});

// Track sync failures
Analytics.track("alert_sync_failed", {
  walletAddress: userAddress,
  error: result.error,
});
```

### 2. Console Logging

**Current Implementation**:

```typescript
// In services/db.ts
console.log("[SYNC] Syncing alerts with server...");
console.log(`[SYNC] ✅ Sync complete: ${downloaded} downloaded, ${uploaded} uploaded`);
console.error("[SYNC] ❌ Error during sync:", error);
```

**View in Production**:

- Browser DevTools → Console
- Filter by `[SYNC]` tag
- Enable "Preserve log" during navigation

### 3. Server-Side Logging (Neon)

**Enable Query Logging**:

```typescript
// In api/alerts/user.ts
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL ?? "", {
  // Enable query logging in development
  logQueries: process.env.NODE_ENV === "development",
});
```

**Monitor in Neon Dashboard**:

1. Go to [Neon Console](https://console.neon.tech)
2. Select your project
3. Navigate to SQL Editor
4. Run monitoring queries

**Key Queries**:

```sql
-- Sync success rate (last 24 hours)
SELECT
  COUNT(*) as total_syncs,
  SUM(CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN 1 ELSE 0 END) as recent_syncs
FROM user_alerts;

-- Most active users
SELECT
  user_wallet_address,
  COUNT(*) as alert_count,
  MAX(updated_at) as last_sync
FROM user_alerts
WHERE is_active = true
GROUP BY user_wallet_address
ORDER BY alert_count DESC
LIMIT 10;

-- Sync latency (average updated_at time)
SELECT
  AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_sync_latency_seconds
FROM user_alerts
WHERE updated_at > NOW() - INTERVAL '24 hours';

-- Storage usage
SELECT
  pg_size_pretty(pg_total_relation_size('user_alerts')) as total_size,
  pg_size_pretty(pg_relation_size('user_alerts')) as table_size,
  pg_size_pretty(pg_indexes_size('user_alerts')) as indexes_size;
```

### 4. Custom Monitoring Dashboard

**Create Monitoring Endpoint**:

File: `/api/alerts/monitoring-stats.ts`

```typescript
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL ?? "");

export async function GET() {
  try {
    const stats = await sql`
      SELECT
        COUNT(DISTINCT user_wallet_address) as total_users,
        COUNT(*) as total_alerts,
        COUNT(*) FILTER (WHERE is_active = true) as active_alerts,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as created_24h,
        COUNT(*) FILTER (WHERE updated_at > NOW() - INTERVAL '24 hours') as updated_24h,
        COUNT(*) FILTER (WHERE updated_at > NOW() - INTERVAL '7 days') as updated_7d
      FROM user_alerts
    `;

    return Response.json({
      success: true,
      data: stats[0],
      timestamp: Date.now(),
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: "Failed to fetch monitoring stats",
      },
      { status: 500 }
    );
  }
}
```

**Usage**:

```bash
curl http://localhost:3000/api/alerts/monitoring-stats
```

---

## Alerting Configuration

### 1. Vercel Deploy Hooks

**Configure Webhook Notifications**:

File: `vercel.json` (already exists, add alerts section)

```json
{
  "alerts": {
    "discord": {
      "url": "https://discord.com/api/webhooks/YOUR_WEBHOOK_URL"
    },
    "email": {
      "to": "dev-team@example.com"
    }
  }
}
```

**Or configure in Vercel Dashboard**:

1. Go to Project Settings
2. Navigate to "Deploy Hooks"
3. Add webhook URL

### 2. Neon Database Alerts

**Enable Email Alerts**:

1. Go to [Neon Console](https://console.neon.tech)
2. Select your project
3. Navigate to "Branches"
4. Click "Edit" on your branch
5. Enable "Database bloat" alerts
6. Enable "CPU usage" alerts
7. Enable "Connection pool" alerts

**Recommended Thresholds**:

- CPU Usage: > 80%
- Connection Pool: > 90%
- Storage: > 80% (800MB of 1GB free tier)

### 3. Custom Health Check Endpoint

**Create Health Check**:

File: `/api/health/alert-sync.ts`

```typescript
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL ?? "");

export async function GET() {
  const checks = {
    database: "unknown",
    storage: "unknown",
    performance: "unknown",
  };

  try {
    // Check database connectivity
    await sql`SELECT 1`;
    checks.database = "healthy";

    // Check storage usage
    const storage = await sql`
      SELECT
        pg_size_pretty(pg_total_relation_size('user_alerts')) as total_size
    `;
    const sizeInBytes = parseInt(storage[0].total_size.replace(/[^\d]/g, "")) || 0;
    const sizeInMB = sizeInBytes / (1024 * 1024);

    if (sizeInMB > 800) {
      checks.storage = "warning"; // Near 1GB limit
    } else {
      checks.storage = "healthy";
    }

    // Check performance (query time)
    const startTime = performance.now();
    await sql`SELECT COUNT(*) FROM user_alerts LIMIT 1`;
    const duration = performance.now() - startTime;

    if (duration > 100) {
      checks.performance = "degraded";
    } else if (duration > 500) {
      checks.performance = "critical";
    } else {
      checks.performance = "healthy";
    }

    const overallHealth = Object.values(checks).every((status) => status === "healthy")
      ? "healthy"
      : Object.values(checks).some((status) => status === "critical")
        ? "critical"
        : "warning";

    return Response.json({
      status: overallHealth,
      checks,
      timestamp: Date.now(),
    });
  } catch (error) {
    return Response.json(
      {
        status: "critical",
        checks: {
          database: "error",
          storage: "unknown",
          performance: "unknown",
        },
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: Date.now(),
      },
      { status: 500 }
    );
  }
}
```

**Usage**:

```bash
curl http://localhost:3000/api/health/alert-sync
```

**Expected Response**:

```json
{
  "status": "healthy",
  "checks": {
    "database": "healthy",
    "storage": "healthy",
    "performance": "healthy"
  },
  "timestamp": 1704067200000
}
```

### 4. Uptime Monitoring

**Recommended External Services**:

#### Option 1: UptimeRobot (Free)

- Monitor: `https://your-app.vercel.app/api/health/alert-sync`
- Check interval: Every 5 minutes
- Alert on: Non-200 status, response time > 5 seconds
- Notifications: Email, Slack, Discord

#### Option 2: Pingdom (Paid tier)

- More granular monitoring
- Synthetic transactions
- Multi-region checks

#### Option 3: Checkly (Free tier)

- API monitoring
- Scheduled checks
- Alert on failures

---

## Performance Baselines

### Target Metrics

| Metric                    | Target  | Warning | Critical |
| ------------------------- | ------- | ------- | -------- |
| Sync Success Rate         | > 99%   | < 99%   | < 95%    |
| Sync Latency (100 alerts) | < 2s    | < 5s    | > 5s     |
| API Response Time         | < 100ms | < 500ms | > 1s     |
| Database Query Time       | < 50ms  | < 200ms | > 500ms  |
| Storage Usage             | < 800MB | < 900MB | > 950MB  |
| Error Rate                | < 0.1%  | < 1%    | > 5%     |

### Weekly Performance Review

**Checklist**:

1. Review sync success rate for past 7 days
2. Check error logs for patterns
3. Monitor storage growth trend
4. Review slow query logs
5. Analyze user feedback

---

## Troubleshooting

### Common Issues

#### Issue 1: High Error Rate

**Symptoms**:

- API error rate > 1%
- Multiple sync failures in logs

**Diagnosis**:

```sql
-- Check recent errors in Neon
SELECT * FROM pg_stat_statements
WHERE calls > 100
ORDER BY mean_exec_time DESC
LIMIT 10;
```

**Solutions**:

1. Check database connection limits
2. Verify DATABASE_URL is correct
3. Check for network issues
4. Review recent code changes

#### Issue 2: Slow Sync Performance

**Symptoms**:

- Sync latency > 5 seconds
- User complaints about slowness

**Diagnosis**:

```sql
-- Check slow queries
SELECT
  query,
  calls,
  mean_exec_time,
  total_exec_time
FROM pg_stat_statements
WHERE query LIKE '%user_alerts%'
ORDER BY mean_exec_time DESC
LIMIT 5;
```

**Solutions**:

1. Add missing indexes
2. Optimize large batch operations
3. Check for N+1 queries
4. Consider database scaling

#### Issue 3: Storage Approaching Limit

**Symptoms**:

- Storage > 900MB
- Warning in health check

**Diagnosis**:

```sql
SELECT
  pg_size_pretty(pg_total_relation_size('user_alerts')) as total_size,
  COUNT(*) as row_count
FROM user_alerts;
```

**Solutions**:

1. Archive old triggered_alerts data
2. Implement data retention policy
3. Clean up test data
4. Consider upgrading to paid tier

---

## Maintenance Procedures

### Daily Checks

**Automated** (via health check endpoint):

- Database connectivity
- API response time
- Error rate monitoring

**Manual** (as needed):

- Review error logs
- Check user feedback

### Weekly Tasks

**Performance Review**:

```sql
-- Sync performance by hour
SELECT
  DATE_TRUNC('hour', updated_at) as hour,
  COUNT(*) as sync_count,
  AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_latency
FROM user_alerts
WHERE updated_at > NOW() - INTERVAL '7 days'
GROUP BY hour
ORDER BY hour DESC;
```

**Capacity Planning**:

```sql
-- Storage projection (current growth rate)
SELECT
  pg_size_pretty(pg_total_relation_size('user_alerts')) as current_size,
  COUNT(*) as current_alerts,
  -- Project 30 days growth based on current rate
  pg_size_pretty(
    pg_total_relation_size('user_alerts') *
    (1 + (COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days'))::float / COUNT(*) * 4)
  ) as projected_30d
FROM user_alerts;
```

### Monthly Tasks

**Database Maintenance**:

```sql
-- Analyze table statistics
ANALYZE user_alerts;

-- Reindex if fragmented
REINDEX TABLE user_alerts;

-- Check for bloat
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_len(schemaname||'.'||tablename)) as external_size
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'user_alerts';
```

**Cleanup Old Data**:

```sql
-- Archive soft-deleted alerts older than 90 days
DELETE FROM user_alerts
WHERE is_active = false
  AND updated_at < NOW() - INTERVAL '90 days';
```

**Security Audit**:

- Review database access logs
- Check for unauthorized access patterns
- Verify rate limiting is working
- Review CORS configuration

### Quarterly Tasks

**Capacity Review**:

- Evaluate free tier usage
- Plan for scaling if needed
- Review and update retention policies
- Optimize database indexes based on query patterns

**Performance Optimization**:

- Review and optimize slow queries
- Update index strategy based on usage patterns
- Consider caching improvements
- Evaluate need for read replicas

---

## Monitoring Dashboard Template

### Grafana Dashboard (Optional)

**Panel 1: Sync Success Rate**

- Query: Custom API endpoint `/api/alerts/monitoring-stats`
- Visualization: Gauge chart
- Thresholds: Green > 99%, Yellow > 95%, Red < 95%

**Panel 2: Sync Latency**

- Query: Custom metric from application logs
- Visualization: Time series graph
- Time range: Last 24 hours
- Y-axis: Sync duration in milliseconds

**Panel 3: Active Users**

- Query: `COUNT(DISTINCT user_wallet_address)` from user_alerts
- Visualization: Single stat
- Time range: Last 7 days

**Panel 4: Storage Usage**

- Query: `pg_size_pretty(pg_total_relation_size('user_alerts'))`
- Visualization: Progress bar
- Max: 1GB (free tier limit)

**Panel 5: Error Rate**

- Query: Application error logs
- Visualization: Time series graph
- Alert: > 1% for 5 minutes

---

## Alert Response Procedures

### Level 1: Informational (Green)

**Example**: Sync success rate dropped from 99.5% to 98.5%
**Action**: Monitor for trends, no immediate action needed

### Level 2: Warning (Yellow)

**Example**: Sync success rate dropped to 96%
**Action**:

1. Check recent deployments
2. Review error logs
3. Verify database connectivity
4. Check service status

### Level 3: Critical (Red)

**Example**: Sync success rate dropped to 90%, API errors > 5%
**Action**:

1. Immediate investigation
2. Check system status
3. Review recent code changes
4. Consider rollback if needed
5. Notify team

### Escalation Matrix

| Severity      | Response Time  | Notification | Escalation                    |
| ------------- | -------------- | ------------ | ----------------------------- |
| Informational | 1 business day | None         | No escalation                 |
| Warning       | 4 hours        | Email        | Tech lead if persists > 1 day |
| Critical      | 15 minutes     | SMS + Email  | On-call engineer immediately  |

---

## Continuous Improvement

### A/B Testing

**Test monitoring strategies**:

1. Sampling rate (log 10% of syncs vs 100%)
2. Logging verbosity (detailed vs minimal)
3. Health check frequency
4. Alert thresholds

### Feedback Loop

1. **Monthly**:
   - Review alert effectiveness
   - Adjust thresholds based on false positives
   - Gather user feedback on sync reliability

2. **Quarterly**:
   - Update monitoring dashboards
   - Revise performance targets
   - Implement new metrics based on insights

3. **Annually**:
   - Full monitoring stack review
   - Tool evaluation (consider alternatives)
   - Cost-benefit analysis

---

## Sign-Off

**Monitoring Checklist**:

- [ ] Health check endpoint deployed
- [ ] Vercel Analytics configured
- [ ] Neon database alerts enabled
- [ ] Uptime monitoring configured
- [ ] Performance baselines documented
- [ ] Alert response procedures documented
- [ ] Team trained on monitoring tools

**Next Steps**:

1. Deploy monitoring endpoints
2. Configure external monitoring service
3. Set up alert notifications
4. Schedule weekly performance reviews
5. Document learnings and iterate
