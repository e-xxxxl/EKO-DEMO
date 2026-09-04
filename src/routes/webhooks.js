import { Router } from "express";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import TicketType from "../models/TicketType.js";
import paystack from "../services/payments/paystack.js";
import flutterwave from "../services/payments/flutterwave.js";

const router = Router();

// Called once a payment is confirmed paid (from either webhook handler below,
// after independently re-verifying with the provider's API — never trust the
// webhook body alone). Idempotent: if the order is already marked paid
// (provider retried the webhook, or the success-page poll got there first),
// this is a no-op rather than double-decrementing stock/ticket counts.
async function markOrderPaid(order) {
  if (order.status === "paid") return;
  order.status = "paid";
  await order.save();

  for (const item of order.items) {
    if (item.refType === "Product") {
      await Product.findByIdAndUpdate(item.ref, { $inc: { stock: -item.quantity } });
    } else {
      await TicketType.findByIdAndUpdate(item.ref, { $inc: { quantitySold: item.quantity } });
    }
  }
}

// order._id is used as both Paystack's `reference` and Flutterwave's `tx_ref`
// (see services/payments/*.js's initialize()), so both webhooks look the
// order up the same way.
router.post("/paystack", async (req, res) => {
  if (!paystack.verifyWebhookSignature(req)) {
    return res.status(401).json({ error: "Invalid signature" });
  }
  try {
    if (req.body?.event === "charge.success") {
      const orderId = req.body.data?.reference;
      const order = await Order.findById(orderId);
      if (order) {
        const result = await paystack.verifyTransaction(order.paymentReference || orderId);
        if (result.status === "paid") await markOrderPaid(order);
      }
    }
    res.sendStatus(200);
  } catch (err) {
    console.error("Paystack webhook error:", err);
    res.sendStatus(200); // still 200 so Paystack doesn't hammer retries over a logged, already-recorded order
  }
});

router.post("/flutterwave", async (req, res) => {
  if (!flutterwave.verifyWebhookSignature(req)) {
    return res.status(401).json({ error: "Invalid signature" });
  }
  try {
    if (req.body?.data?.status === "successful") {
      const orderId = req.body.data?.tx_ref;
      const order = await Order.findById(orderId);
      if (order) {
        const result = await flutterwave.verifyTransaction(order.paymentReference || orderId);
        if (result.status === "paid") await markOrderPaid(order);
      }
    }
    res.sendStatus(200);
  } catch (err) {
    console.error("Flutterwave webhook error:", err);
    res.sendStatus(200);
  }
});

export default router;
