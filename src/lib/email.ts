export function generateEmailContent(email: string, subject: string): string {
  return `Subject: ${subject}\nTo: ${email}`;
}
