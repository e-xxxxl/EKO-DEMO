import { Router } from "express";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import TicketType from "../models/TicketType.js";
import Match from "../models/Match.js";
import Ticket, { generateTicketCode } from "../models/Ticket.js";
import paystack from "../services/payments/paystack.js";
import flutterwave from "../services/payments/flutterwave.js";
import { sendOrderConfirmationEmail } from "../services/email/orderConfirmation.js";

const router = Router();

// One TicketType can belong to many matches over a season, so it's the
// authority on which match a purchased ticket is actually for — read once
// per line item rather than trusting anything from the order itself.
// Returns the created tickets (with the match info the confirmation email
// needs attached) rather than void, so markOrderPaid can hand them straight
// to sendOrderConfirmationEmail without a second lookup.
async function createTicketsForOrder(order, item) {
  const ticketType = await TicketType.findById(item.ref);
  if (!ticketType) return []; // shouldn't happen (checkout already validated it exists), but never crash the webhook over it

  const match = await Match.findById(ticketType.match);
  const matchInfo = match
    ? { opponent: match.opponent, kickoff: match.kickoff, venue: match.venue, isHome: match.isHome }
    : null;

  const created = [];
  for (let i = 0; i < item.quantity; i++) {
    // Retry on the astronomically rare code collision rather than trusting
    // a single random draw to always be unique.
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const ticket = await Ticket.create({
          order: order._id,
          match: ticketType.match,
          ticketType: ticketType._id,
          ticketTypeName: item.name,
          holderName: order.customerName,
          holderEmail: order.customerEmail,
          code: generateTicketCode(),
        });
        created.push({ ticketTypeName: item.name, code: ticket.code, matchInfo });
        break;
      } catch (err) {
        if (err.code !== 11000 || attempt === 4) throw err; // 11000 = duplicate key
      }
    }
  }
  return created;
}

// Called once a payment is confirmed paid (from either webhook handler below,
// after independently re-verifying with the provider's API — never trust the
// webhook body alone). Idempotent: if the order is already marked paid
// (provider retried the webhook, or the success-page poll got there first),
// this is a no-op rather than double-decrementing stock/ticket counts or
// minting duplicate tickets.
async function markOrderPaid(order) {
  if (order.status === "paid") return;
  order.status = "paid";
  await order.save();

  const tickets = [];
  for (const item of order.items) {
    if (item.refType === "Product") {
      await Product.findByIdAndUpdate(item.ref, { $inc: { stock: -item.quantity } });
    } else {
      await TicketType.findByIdAndUpdate(item.ref, { $inc: { quantitySold: item.quantity } });
      tickets.push(...(await createTicketsForOrder(order, item)));
    }
  }

  // Fire-and-forget from the caller's perspective: sendOrderConfirmationEmail
  // never throws (it logs and swallows its own errors) and is a no-op until
  // RESEND_API_KEY is set, so this line is safe today and starts actually
  // emailing customers the moment both a key and a live payment provider
  // are configured, no code change needed at that point.
  await sendOrderConfirmationEmail(order, tickets);
}

// Reloads the {ticketTypeName, code, matchInfo} shape sendOrderConfirmationEmail
// wants for an order that's already paid: used by the admin "resend
// confirmation" action (routes/admin/orders.js), which has no fresh
// createTicketsForOrder() call to piggyback on since the tickets already exist.
export async function loadTicketsForEmail(order) {
  if (order.type !== "ticket") return [];
  const tickets = await Ticket.find({ order: order._id }).populate("match");
  return tickets.map((t) => ({
    ticketTypeName: t.ticketTypeName,
    code: t.code,
    matchInfo: t.match
      ? { opponent: t.match.opponent, kickoff: t.match.kickoff, venue: t.match.venue, isHome: t.match.isHome }
      : null,
  }));
}

export { markOrderPaid };

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
