import resend from "./resend.js";

// Where website forms (volunteer, media accreditation, membership) are sent.
// Override with MARKETING_TO_EMAIL in the backend environment.
export const marketingEmail = () => process.env.MARKETING_TO_EMAIL || "marketing&media@ekounitedfc.com";

// Visitor input goes into an HTML email body, so it is escaped first.
export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Emails a form submission to the marketing team. Returns true when it was
// sent, false when email is not configured or failed. Callers have already
// saved the submission, so a false here never loses it.
export async function notifyMarketing({ subject, heading, rows, replyTo }) {
  if (!resend.isConfigured()) return false;
  try {
    const body = rows
      .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== "")
      .map(
        ([label, value]) =>
          `<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value).replace(/\n/g, "<br/>")}</p>`
      )
      .join("");
    await resend.sendEmail({
      to: marketingEmail(),
      subject,
      html: `<h2>${escapeHtml(heading)}</h2>${body}`,
      replyTo,
    });
    return true;
  } catch (err) {
    console.error("Marketing email failed (submission is saved):", err.message);
    return false;
  }
}
