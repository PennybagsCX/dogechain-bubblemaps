import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApiApp } from "../index";

describe("API Integration", () => {
  const app = createApiApp();

  it("should respond to health check", async () => {
    const response = await request(app).get("/health").expect(200);

    expect(response.body).toHaveProperty("status", "ok");
    expect(response.body).toHaveProperty("timestamp");
  });

  it("should return 404 for unknown routes", async () => {
    const response = await request(app).get("/api/unknown").expect(404);

    expect(response.body).toHaveProperty("message", "Not found");
    expect(response.body).toHaveProperty("status", "error");
  });

  it("should have CORS headers", async () => {
    const response = await request(app).get("/api/hello");

    expect(response.headers["access-control-allow-origin"]).toBe("*");
  });
});
