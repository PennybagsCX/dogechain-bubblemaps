import { Router, Request, Response } from "express";

const router = Router();

interface HelloResponse {
  message: string;
  timestamp: string;
  status: string;
}

interface ErrorResponse {
  message: string;
  timestamp: string;
  status: string;
}

/**
 * GET /api/hello
 * Returns a Hello World greeting with timestamp
 */
router.get("/hello", (_req: Request, res: Response<HelloResponse | ErrorResponse>) => {
  try {
    const response: HelloResponse = {
      message: "Hello World",
      timestamp: new Date().toISOString(),
      status: "success",
    };
    res.json(response);
  } catch {
    const errorResponse: ErrorResponse = {
      message: "Internal server error",
      timestamp: new Date().toISOString(),
      status: "error",
    };
    res.status(500).json(errorResponse);
  }
});

export default router;
