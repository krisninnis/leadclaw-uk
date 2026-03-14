import { generateEmailContent } from "../lib/email"; // Replace with actual function

describe("generateEmailContent", () => {
  it("should generate the correct email content", () => {
    const result = generateEmailContent("test@example.com", "Welcome");
    expect(result).toContain("Welcome to LeadClaw");
    expect(result).toContain("test@example.com");
  });
});
