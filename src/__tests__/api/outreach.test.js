import { createServer } from "next"; // Assuming Next.js server

// Mocking the 'Request' class from node-fetch
global.Request = class {
  constructor() {}
  // Add any mock methods required by your test
};

describe("POST /api/outreach/send", () => {
  it("should send outreach emails", async () => {
    const res = await request(createServer())
      .post("/api/outreach/send")
      .send({ email: "test@example.com", subject: "Test Email" });

    expect(res.status).toBe(200);
  });
});
