/**
 * Analytics / learning endpoints — no source on DogeOS Chikyū testnet.
 *
 * These routes fed off upstream server-side tables (`token_interactions`,
 * `token_popularity`, `learned_tokens`, search analytics) that are **not part of the
 * fork schema** (see prisma/migrations: only diagnostic_logs, triggered_alerts,
 * user_alerts exist). Rather than invent counts, each route answers HTTP 200 with the
 * explicit `{ unavailable: true, reason }` payload, and write endpoints additionally
 * report `recorded: false` so a caller cannot mistake a no-op for a stored event.
 *
 * `success`/array fields are kept for client compatibility (`services/db.ts`,
 * `trendingService.ts`, `learnedTokensService.ts` all tolerate `success: false` or an
 * empty array), but they never carry fabricated rows.
 */

import { Router } from "express";
import { unavailablePayload, unavailableWrite } from "../lib/unavailable";

const router = Router();

const SEARCH_ANALYTICS = "search-analytics";
const DETAIL =
  "token_interactions / token_popularity are not part of the fork schema, so nothing is recorded on the Chikyū testnet";

/* ------------------------------------------------------------------ reads */

/** GET /api/trending — search-frequency leaderboard has no data. */
router.get("/trending", (_req, res) => {
  res.json({
    ...unavailablePayload(SEARCH_ANALYTICS, DETAIL),
    assets: [],
    cached: false,
    stale: false,
    timestamp: new Date().toISOString(),
  });
});

/** GET /api/trending-wallet — wallet-driven trending, same missing tables. */
router.get("/trending-wallet", (_req, res) => {
  res.json({ success: false, ...unavailablePayload(SEARCH_ANALYTICS, DETAIL), assets: [] });
});

/** GET /api/learned-tokens — the learned-token index does not exist in this fork. */
router.get("/learned-tokens", (_req, res) => {
  res.json({ success: false, ...unavailablePayload("learned-token index", DETAIL), tokens: [] });
});

/** GET /api/trending/popularity — no popularity rows to return. */
router.get("/trending/popularity", (_req, res) => {
  res.json({ ...unavailablePayload("popularity-analytics", DETAIL), popularity: {} });
});

/** GET /api/recommendations/peers — collaborative filtering needs interaction history. */
router.get("/recommendations/peers", (_req, res) => {
  res.json({
    ...unavailablePayload(
      "peer-recommendation",
      "collaborative filtering needs interaction history, which is not collected here"
    ),
    recommendations: [],
  });
});

/* ----------------------------------------------------------------- writes */

/** POST /api/trending/log — fire-and-forget search logging with nowhere to land. */
router.post("/trending/log", (_req, res) => {
  res.json(unavailableWrite(SEARCH_ANALYTICS, DETAIL));
});

/** POST /api/interactions — token interaction logging. */
router.post("/interactions", (_req, res) => {
  res.json(unavailableWrite("search-interaction", DETAIL));
});

/** POST /api/analytics/search — search event logging. */
router.post("/analytics/search", (_req, res) => {
  res.json(unavailableWrite(SEARCH_ANALYTICS, DETAIL));
});

/** POST /api/analytics/click — click event logging. */
router.post("/analytics/click", (_req, res) => {
  res.json(unavailableWrite(SEARCH_ANALYTICS, DETAIL));
});

/** POST /api/trending/popularity — popularity counter update. */
router.post("/trending/popularity", (_req, res) => {
  res.json(unavailableWrite("popularity-analytics", DETAIL));
});

/** POST /api/wallet-scan — wallet scan learning submissions. */
router.post("/wallet-scan", (_req, res) => {
  res.json(unavailableWrite("wallet-scan learning", DETAIL));
});

/** POST /api/contributions/submit|vote — user contribution pipeline is not deployed here. */
router.post("/contributions/submit", (_req, res) => {
  res.json(
    unavailableWrite(
      "user-contribution",
      "no contribution service is deployed for the Chikyū testnet"
    )
  );
});

router.post("/contributions/vote", (_req, res) => {
  res.json(
    unavailableWrite(
      "user-contribution",
      "no contribution service is deployed for the Chikyū testnet"
    )
  );
});

export default router;
