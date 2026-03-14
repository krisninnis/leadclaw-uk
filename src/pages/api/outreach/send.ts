import { Resend } from "resend";

// Initialize Resend with your API key from .env.local
const resend = new Resend(process.env.RESEND_API_KEY!);

// Your API handler logic
export default async function handler(req, res) {
  if (req.method === "POST") {
    const { email, subject } = req.body;

    try {
      // Send the email using Resend API
      const emailResponse = await resend.sendEmail({
        from: "your-email@example.com", // Your sender email
        to: email, // Recipient's email
        subject: subject,
        text: `Welcome to LeadClaw, ${email}!`, // Email body
      });

      // Return a success response
      return res.status(200).json({ success: true, emailResponse });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  } else {
    res.status(405).json({ success: false, error: "Method Not Allowed" });
  }
}
