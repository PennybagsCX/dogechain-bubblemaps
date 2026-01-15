/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router, type Request, type Response } from "express";
import { GET, POST, DELETE } from "@/api/alerts/user";
import { POST as SyncPOST } from "@/api/alerts/sync";

/**
 * Express router wrapper for Vercel alert API routes
 * This allows testing Vercel serverless functions with Express/supertest
 */

// Helper to convert Vercel Request handler to Express middleware
function wrapVercelHandler(
  handler: (req: any) => Promise<any>
): (req: Request, res: Response) => Promise<void> {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      // Convert Express request to Vercel Request
      const url = new URL(req.originalUrl || req.url, `http://${req.headers.host}`);
      const vercelReq = new globalThis.Request(url, {
        method: req.method,
        headers: req.headers as HeadersInit,
        body: req.body ? JSON.stringify(req.body) : undefined,
      });

      // Call the Vercel handler
      const vercelRes = await handler(vercelReq);

      // Convert Vercel Response back to Express
      const body = await vercelRes.text();
      const contentType = vercelRes.headers.get("content-type");

      if (contentType) {
        res.setHeader("Content-Type", contentType);
      }

      res.status(vercelRes.status).send(body);
    } catch (error) {
      console.error("[Express Router] Error in wrapped handler:", error);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  };
}

const router = Router();

// GET /api/alerts/user - Fetch alerts for a user
router.get("/user", wrapVercelHandler(GET as any));

// POST /api/alerts/user - Create or update an alert
router.post("/user", wrapVercelHandler(POST as any));

// DELETE /api/alerts/user - Soft delete an alert
router.delete("/user", wrapVercelHandler(DELETE as any));

// POST /api/alerts/sync - Bidirectional sync
router.post("/sync", wrapVercelHandler(SyncPOST as any));

export default router;
