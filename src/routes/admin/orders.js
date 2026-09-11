import { Router } from "express";
import Order from "../../models/Order.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { markOrderPaid, loadTicketsForEmail } from "../webhooks.js";
import { sendOrderConfirmationEmail } from "../../services/email/orderConfirmation.js";

const router = Router();

router.use(requireAuth, requireRole("shop_manager", "ticket_manager", "inventory_manager"));

// shop_manager and inventory_manager only see shop orders (the latter's
// "items/jersey purchased from the shop" scope), ticket_manager only sees
// ticket orders, super_admin (requireRole's implicit bypass) sees
// everything and can still narrow with ?type=. Orders aren't created/edited
// here — they come from the public checkout flow (routes/checkout.js) —
// this is view sales + mark-fulfilled only, matching the signed scope.
router.get("/", async (req, res, next) => {
  try {
    const roleType =
      req.admin.role === "shop_manager" || req.admin.role === "inventory_manager"
        ? "shop"
        : req.admin.role === "ticket_manager"
          ? "ticket"
          : null;
    const type = req.query.type || roleType;
    const filter = type ? { type } : {};
    res.json(await Order.find(filter).sort({ createdAt: -1 }));
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    // Only `fulfilled` is editable here (shop orders — has the item shipped/
    // been collected). Payment status changes only ever come from a verified
    // webhook (routes/webhooks.js) or the explicit mark-paid action below,
    // never from a raw field update on this route.
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { fulfilled: Boolean(req.body.fulfilled) },
      { new: true, runValidators: true }
    );
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json(order);
  } catch (err) {
    next(err);
  }
});

// Lets a super_admin complete an order that was paid outside the online flow
// (bank transfer, cash at the club, etc.), the only path checkout.js leaves
// an order in when no PAYMENT_PROVIDER is configured yet ("we've recorded
// your order and the club will be in touch to complete it"). Deliberately
// refuses any order that already has a `paymentProvider` stamped on it:
// those are Paystack/Flutterwave-tracked and must only ever be confirmed by
// a verified webhook, never by an admin click, even a super_admin's. Reuses
// markOrderPaid itself, so this goes through the exact same stock
// decrement / ticket-minting / confirmation-email path a real webhook does,
// including sending the order confirmation email today, without waiting on
// live payment integration.
router.post("/:id/mark-paid", requireRole("super_admin"), async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (order.paymentProvider) {
      return res.status(400).json({
        error: "This order is tracked by a payment provider and can only be confirmed by its webhook.",
      });
    }
    if (order.status === "paid") {
      return res.status(400).json({ error: "This order is already marked paid." });
    }
    await markOrderPaid(order);
    res.json(order);
  } catch (err) {
    next(err);
  }
});

// Re-sends the order confirmation email for an already-paid order: for a
// customer who says it never arrived, or to verify the email pipeline once
// RESEND_API_KEY is set, without re-touching stock or minting new tickets.
router.post("/:id/resend-confirmation", async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (order.status !== "paid") {
      return res.status(400).json({ error: "This order hasn't been marked paid yet." });
    }
    const tickets = await loadTicketsForEmail(order);
    const result = await sendOrderConfirmationEmail(order, tickets);
    if (!result.sent) {
      return res.status(502).json({ error: result.reason || "Failed to send the confirmation email." });
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
