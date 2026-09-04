const BASE_URL = "https://api.flutterwave.com/v3";

function isConfigured() {
  return Boolean(process.env.FLUTTERWAVE_SECRET_KEY);
}

async function initialize({ order, callbackUrl }) {
  const res = await fetch(`${BASE_URL}/payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      tx_ref: order._id.toString(),
      amount: order.totalAmount,
      currency: "NGN",
      redirect_url: callbackUrl,
      customer: {
        email: order.customerEmail,
        name: order.customerName,
        phonenumber: order.customerPhone,
      },
      customizations: {
        title: "Eko United FC",
        description: order.type === "ticket" ? "Match ticket purchase" : "Club shop order",
      },
    }),
  });
  const body = await res.json();
  if (!res.ok || body.status !== "success") {
    throw new Error(body.message || "Flutterwave initialization failed");
  }
  return { authorizationUrl: body.data.link, reference: order._id.toString() };
}

// Flutterwave doesn't HMAC-sign webhook bodies — it just echoes back a fixed
// secret hash you set in the dashboard, sent as the `verif-hash` header.
// Plain string comparison, not crypto — that's the documented mechanism.
function verifyWebhookSignature(req) {
  const secretHash = process.env.FLUTTERWAVE_WEBHOOK_SECRET_HASH;
  if (!secretHash) return false;
  return req.headers["verif-hash"] === secretHash;
}

// Always re-verify server-side against Flutterwave's API rather than trusting
// the webhook payload alone. tx_ref is the order's own _id (see initialize above).
async function verifyTransaction(reference) {
  const res = await fetch(
    `${BASE_URL}/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`,
    { headers: { Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}` } }
  );
  const body = await res.json();
  if (!res.ok || body.status !== "success") {
    throw new Error(body.message || "Flutterwave verification failed");
  }
  return {
    status: body.data.status === "successful" ? "paid" : "failed",
    amount: body.data.amount,
  };
}

export default { name: "flutterwave", isConfigured, initialize, verifyWebhookSignature, verifyTransaction };
