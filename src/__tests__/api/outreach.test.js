import request from "supertest";
import { createServer } from "next"; // Assuming the app is built with Next.js

describe("POST /api/outreach/send", () => {
  it("should send outreach emails", async () => {
    const res = await request(createServer()) // Ensure you pass Next.js server instance
      .post("/api/outreach/send")
      .send({ email: "test@example.com", subject: "Test Email" });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("success", true);
  });
});
