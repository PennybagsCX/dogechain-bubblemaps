import express, { Express } from "express";
import helloRouter from "./hello";
import alertsRouter from "./alerts";

/**
 * Create and configure Express API application
 */
export function createApiApp(): Express {
  const app = express();

  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // CORS headers (if needed for development)
  app.use((_req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    next();
  });

  // Routes
  app.use("/api", helloRouter);
  app.use("/api/alerts", alertsRouter);

  // Health check endpoint
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // 404 handler
  app.use((_req, res) => {
    res.status(404).json({
      message: "Not found",
      timestamp: new Date().toISOString(),
      status: "error",
    });
  });

  return app;
}

export default createApiApp;
