import { generateEmailContent } from "../lib/email";

describe("generateEmailContent", () => {
  it("should generate the correct email content", () => {
    const result = generateEmailContent("test@example.com", "Welcome");
    expect(result).toContain("Subject: Welcome");
    expect(result).toContain("To: test@example.com");
  });
});
