import crypto from "crypto";

const BASE_URL = "https://api.paystack.co";

function isConfigured() {
  return Boolean(process.env.PAYSTACK_SECRET_KEY);
}

// order.totalAmount is in Naira (whole/decimal) — Paystack expects kobo (x100).
async function initialize({ order, callbackUrl }) {
  const res = await fetch(`${BASE_URL}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: order.customerEmail,
      amount: Math.round(order.totalAmount * 100),
      currency: "NGN",
      reference: order._id.toString(),
      callback_url: callbackUrl,
      metadata: { orderId: order._id.toString(), type: order.type },
    }),
  });
  const body = await res.json();
  if (!res.ok || !body.status) {
    throw new Error(body.message || "Paystack initialization failed");
  }
  return { authorizationUrl: body.data.authorization_url, reference: body.data.reference };
}

// Paystack signs the raw request body with your secret key (HMAC SHA512) —
// requires the raw bytes, not the parsed object, hence req.rawBody (captured
// via express.json()'s `verify` option in server.js).
function verifyWebhookSignature(req) {
  if (!process.env.PAYSTACK_SECRET_KEY || !req.rawBody) return false;
  const hash = crypto
    .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
    .update(req.rawBody)
    .digest("hex");
  return hash === req.headers["x-paystack-signature"];
}

// Always re-verify server-side against Paystack's API rather than trusting
// the webhook payload alone — the signature proves the request came from
// Paystack, not that the transaction data wasn't stale/replayed.
async function verifyTransaction(reference) {
  const res = await fetch(`${BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
  });
  const body = await res.json();
  if (!res.ok || !body.status) throw new Error(body.message || "Paystack verification failed");
  return {
    status: body.data.status === "success" ? "paid" : "failed",
    amount: body.data.amount / 100,
  };
}

export default { name: "paystack", isConfigured, initialize, verifyWebhookSignature, verifyTransaction };
