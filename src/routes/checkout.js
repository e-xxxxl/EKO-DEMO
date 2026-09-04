import { Router } from "express";
import mongoose from "mongoose";
import Product from "../models/Product.js";
import TicketType from "../models/TicketType.js";
import Order from "../models/Order.js";
import { getActiveProvider } from "../services/payments/index.js";
import { sensitiveLimiter } from "../middleware/rateLimiters.js";

const router = Router();

// Never trust a client-supplied price or a client-supplied "is this in
// stock" claim — every line item's real price and availability is read
// fresh from the database here, and that's what gets stored on the Order
// and charged. The client only ever sends refs + quantities.
router.post("/", sensitiveLimiter, async (req, res, next) => {
  try {
    const { type, items, customerName, customerEmail, customerPhone } = req.body;

    if (!["shop", "ticket"].includes(type)) {
      return res.status(400).json({ error: "type must be 'shop' or 'ticket'" });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "At least one item is required" });
    }
    if (!customerName || !customerEmail) {
      return res.status(400).json({ error: "Name and email are required" });
    }

    const expectedRefType = type === "shop" ? "Product" : "TicketType";
    const Model = type === "shop" ? Product : TicketType;

    const resolvedItems = [];
    for (const raw of items) {
      const quantity = Number(raw.quantity);
      if (!raw.ref || !Number.isInteger(quantity) || quantity < 1) {
        return res.status(400).json({ error: "Each item needs a valid ref and quantity" });
      }
      if (raw.refType !== expectedRefType) {
        return res.status(400).json({ error: `Items must all be ${expectedRefType} for a ${type} order` });
      }
      // A ref that isn't a real ObjectId (e.g. a leftover demo-data id like
      // "p2" from lib/demoData.ts, added to the cart while the shop/tickets
      // page had nothing real yet to show) would otherwise make Mongoose
      // throw a CastError here and crash the request with a raw 500 — fail
      // clean instead, same "not found" response as a real-but-missing id.
      if (!mongoose.isValidObjectId(raw.ref)) {
        return res.status(404).json({ error: `${expectedRefType} not found: ${raw.ref}` });
      }

      const doc = await Model.findOne({ _id: raw.ref, isActive: true });
      if (!doc) {
        return res.status(404).json({ error: `${expectedRefType} not found: ${raw.ref}` });
      }

      if (type === "shop") {
        if (doc.stock < quantity) {
          return res.status(409).json({ error: `Not enough stock for "${doc.name}"` });
        }
        if (doc.sizes?.length > 0 && !doc.sizes.includes(raw.size)) {
          return res.status(400).json({ error: `Choose a valid size for "${doc.name}"` });
        }
      } else {
        const remaining = doc.quantityAvailable - doc.quantitySold;
        if (remaining < quantity) {
          return res.status(409).json({ error: `Only ${Math.max(0, remaining)} "${doc.name}" tickets left` });
        }
      }

      resolvedItems.push({
        refType: expectedRefType,
        ref: doc._id,
        name: doc.name,
        unitPrice: doc.price, // read from the DB, not from req.body — this is the whole point
        quantity,
        size: type === "shop" ? raw.size : undefined,
      });
    }

    const totalAmount = resolvedItems.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

    const order = await Order.create({
      type,
      items: resolvedItems,
      customerName,
      customerEmail,
      customerPhone,
      totalAmount,
      status: "pending",
    });

    const provider = getActiveProvider();
    if (!provider) {
      // Order is still recorded so the club can follow up manually — just
      // no payment redirect until a processor is configured (see PAYMENT_PROVIDER
      // in .env.example and services/payments/index.js).
      return res.status(201).json({
        orderId: order._id,
        totalAmount,
        paymentUrl: null,
        message: "Payments aren't fully set up yet — we've recorded your order and the club will be in touch to complete it.",
      });
    }

    const callbackUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/checkout/success?orderId=${order._id}`;
    const { authorizationUrl, reference } = await provider.initialize({ order, callbackUrl });

    order.paymentProvider = provider.name;
    order.paymentReference = reference;
    await order.save();

    res.status(201).json({ orderId: order._id, totalAmount, paymentUrl: authorizationUrl });
  } catch (err) {
    next(err);
  }
});

// Lets the success page confirm status without waiting on the webhook race —
// safe to expose read-only, doesn't leak anything beyond what the customer
// who just placed the order already knows.
router.get("/:orderId", async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json({
      status: order.status,
      type: order.type,
      totalAmount: order.totalAmount,
      items: order.items,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
