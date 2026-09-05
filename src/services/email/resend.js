const RESEND_API_URL = "https://api.resend.com/emails";

function isConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

// Resend requires `from` to be on a domain verified in their dashboard (or
// their shared sandbox address, which only delivers to the account owner's
// own verified email — fine for testing, not for real submissions). Set
// RESEND_FROM_EMAIL once a real sending domain is verified.
async function sendEmail({ to, subject, html, replyTo }) {
  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL || "Eko United FC <onboarding@resend.dev>",
      to: [to],
      subject,
      html,
      reply_to: replyTo,
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.message || "Failed to send email");
  return body;
}

export default { isConfigured, sendEmail };
