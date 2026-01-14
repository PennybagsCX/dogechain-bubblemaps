import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createApiApp } from "../index";

describe("GET /api/hello", () => {
  let app: ReturnType<typeof createApiApp>;

  beforeAll(() => {
    app = createApiApp();
  });

  it("should return Hello World response", async () => {
    const response = await request(app)
      .get("/api/hello")
      .expect("Content-Type", /json/)
      .expect(200);

    expect(response.body).toHaveProperty("message", "Hello World");
    expect(response.body).toHaveProperty("timestamp");
    expect(response.body).toHaveProperty("status", "success");
    expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);
  });

  it("should return valid ISO timestamp", async () => {
    const response = await request(app).get("/api/hello").expect(200);

    const timestamp = new Date(response.body.timestamp);
    expect(timestamp.toISOString()).toBe(response.body.timestamp);
  });

  it("should have correct response structure", async () => {
    const response = await request(app).get("/api/hello").expect(200);

    expect(Object.keys(response.body)).toEqual(
      expect.arrayContaining(["message", "timestamp", "status"])
    );
    expect(typeof response.body.message).toBe("string");
    expect(typeof response.body.timestamp).toBe("string");
    expect(typeof response.body.status).toBe("string");
  });

  it("should return success status", async () => {
    const response = await request(app).get("/api/hello").expect(200);

    expect(response.body.status).toBe("success");
  });
});
