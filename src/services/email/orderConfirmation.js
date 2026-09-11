import resend from "./resend.js";

// Branded transactional email sent once a payment is confirmed (see
// markOrderPaid in routes/webhooks.js, the single place this is called from).
// Table-based layout with inline styles throughout, not a <style> block or
// flexbox/grid: email clients (Outlook desktop especially) strip or mangle
// modern CSS, so the safest transactional-email pattern is old-school HTML
// tables. Gated by RESEND_API_KEY same as media accreditation (resend.js's
// isConfigured()): with no key set this is a clean no-op, not a crash, so
// checkout/payment works today and email starts flowing the moment a real
// key is added, no code change needed.

const NAVY = "#0A244D";
const NAVY_DARK = "#061733";
const CYAN = "#65CBE9";

function formatNaira(amount) {
  return `₦${Number(amount).toLocaleString("en-NG")}`;
}

function crestUrl() {
  const base = process.env.FRONTEND_URL || "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/brand/crest-mark.png`;
}

function formatMatchDate(iso) {
  return new Date(iso).toLocaleString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Lagos",
  });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function itemsTableRows(order) {
  return order.items
    .map(
      (item) => `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #e5e9ef;color:${NAVY};font-size:14px;">
          ${escapeHtml(item.name)}${item.size ? ` <span style="color:#8a94a6;">(${escapeHtml(item.size)})</span>` : ""}
        </td>
        <td style="padding:12px 0;border-bottom:1px solid #e5e9ef;color:#8a94a6;font-size:14px;text-align:center;">
          &times;${item.quantity}
        </td>
        <td style="padding:12px 0;border-bottom:1px solid #e5e9ef;color:${NAVY};font-size:14px;text-align:right;font-weight:600;">
          ${formatNaira(item.unitPrice * item.quantity)}
        </td>
      </tr>`
    )
    .join("");
}

// tickets: an array of { ticketTypeName, code, matchInfo: {opponent, kickoff, venue, isHome} | null }
function ticketsBlock(tickets) {
  if (!tickets || tickets.length === 0) return "";
  const match = tickets.find((t) => t.matchInfo)?.matchInfo;
  const matchLine = match
    ? `${escapeHtml(match.isHome ? `Eko United vs ${match.opponent}` : `${match.opponent} vs Eko United`)} &middot; ${formatMatchDate(match.kickoff)}${match.venue ? ` &middot; ${escapeHtml(match.venue)}` : ""}`
    : "";

  const codeRows = tickets
    .map(
      (t) => `
      <tr>
        <td style="padding-bottom:10px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f8fb;border-radius:10px;">
            <tr>
              <td style="padding:14px 18px;">
                <p style="margin:0;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:${CYAN};font-weight:700;">${escapeHtml(t.ticketTypeName)}</p>
                <p style="margin:4px 0 0;font-size:24px;letter-spacing:5px;font-weight:700;color:${NAVY};font-family:'Courier New',monospace;">${t.code}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>`
    )
    .join("");

  return `
    <tr>
      <td style="padding-top:28px;">
        <p style="margin:0 0 4px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${NAVY};">Your Tickets</p>
        ${matchLine ? `<p style="margin:0 0 14px;font-size:14px;color:#5a6478;">${matchLine}</p>` : ""}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${codeRows}</table>
        <p style="margin:6px 0 0;font-size:13px;color:#8a94a6;line-height:1.5;">Show a code at the gate scan point to be admitted. Each code is valid for one person, one entry only.</p>
      </td>
    </tr>`;
}

export function buildOrderConfirmationEmail(order, tickets = []) {
  const isTicketOrder = order.type === "ticket";
  const orderRef = String(order._id).slice(-8).toUpperCase();
  const subject = isTicketOrder
    ? `Your Eko United FC tickets (#${orderRef})`
    : `Order confirmed, #${orderRef}, Eko United FC`;

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f0f2f5;font-family:Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;">
            <tr>
              <td style="background:${NAVY_DARK};padding:32px 40px;text-align:center;">
                <img src="${crestUrl()}" width="56" height="56" alt="Eko United FC crest" style="display:block;margin:0 auto 10px;border:0;" />
                <p style="margin:0;color:${CYAN};font-size:11px;letter-spacing:2px;text-transform:uppercase;font-weight:700;">Eko United FC</p>
                <p style="margin:6px 0 0;color:#ffffff;font-size:20px;font-weight:700;">Order Confirmed</p>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 40px;">
                <p style="margin:0 0 4px;font-size:15px;color:${NAVY};">Hi ${escapeHtml(order.customerName)},</p>
                <p style="margin:0 0 24px;font-size:14px;color:#5a6478;line-height:1.6;">
                  ${isTicketOrder ? "Payment received. Your match tickets are below." : "Payment received. Here is your order summary."}
                  Order reference <strong>#${orderRef}</strong>.
                </p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  ${itemsTableRows(order)}
                  <tr>
                    <td style="padding:16px 0 0;font-size:14px;font-weight:700;color:${NAVY};">Total</td>
                    <td></td>
                    <td style="padding:16px 0 0;font-size:16px;font-weight:700;color:${NAVY};text-align:right;">${formatNaira(order.totalAmount)}</td>
                  </tr>
                  ${ticketsBlock(tickets)}
                </table>
              </td>
            </tr>
            <tr>
              <td style="background:#f4f8fb;padding:24px 40px;text-align:center;">
                <p style="margin:0 0 6px;font-size:13px;color:${NAVY};font-weight:600;">Questions about your order?</p>
                <p style="margin:0;font-size:13px;color:#5a6478;">Reply to this email or reach us at Ekounitedfc01@gmail.com</p>
                <p style="margin:16px 0 0;font-size:11px;color:#9aa4b5;">Eko United FC &middot; Nigeria National League &middot; ekounitedfc.com</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, html };
}

// Returns { sent, reason? } rather than throwing: a failed email must never
// undo or retry-block a payment that already succeeded, so markOrderPaid
// (routes/webhooks.js) just calls this and moves on. The return value exists
// for the one caller that DOES want to know what happened: the admin
// "resend confirmation" action (routes/admin/orders.js), where a human
// clicked a button and deserves real feedback instead of a silent no-op.
export async function sendOrderConfirmationEmail(order, tickets = []) {
  if (!resend.isConfigured()) {
    console.log(`[email] Skipped order confirmation for order ${order._id}: RESEND_API_KEY not set yet.`);
    return { sent: false, reason: "RESEND_API_KEY isn't set yet." };
  }
  try {
    const { subject, html } = buildOrderConfirmationEmail(order, tickets);
    await resend.sendEmail({ to: order.customerEmail, subject, html });
    return { sent: true };
  } catch (err) {
    console.error(`[email] Failed to send order confirmation for order ${order._id}:`, err.message);
    return { sent: false, reason: err.message };
  }
}

export default { buildOrderConfirmationEmail, sendOrderConfirmationEmail };
