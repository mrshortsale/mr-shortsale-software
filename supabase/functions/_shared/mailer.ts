export async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function generateResetToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
  name: string,
): Promise<boolean> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("EMAIL_FROM") ?? "Mr. Short Sale <noreply@mrshortsale.net>";

  if (!apiKey) {
    console.warn("[mailer] RESEND_API_KEY not set — password reset email not sent");
    console.info(`[mailer] Reset URL for ${to}: ${resetUrl}`);
    return false;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "Reset your Mr. Short Sale password",
      html: `
        <p>Hi ${name},</p>
        <p>We received a request to reset your password. Click the link below to choose a new password:</p>
        <p><a href="${resetUrl}">Reset password</a></p>
        <p>This link expires in 1 hour. If you did not request this, you can ignore this email.</p>
        <p>— Mr. Short Sale</p>
      `,
    }),
  });

  if (!res.ok) {
    console.error("[mailer] Failed to send email:", await res.text());
    return false;
  }

  return true;
}
