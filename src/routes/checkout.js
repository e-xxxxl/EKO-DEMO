import { Router } from "express";
import mongoose from "mongoose";
import { randomBytes } from "node:crypto";
import Product from "../models/Product.js";
import TicketType from "../models/TicketType.js";
import Order from "../models/Order.js";
import Ticket from "../models/Ticket.js";
import ReferralCode, { normalizeReferralCode, referralAppliesTo } from "../models/ReferralCode.js";
import { getActiveProvider } from "../services/payments/index.js";
import { checkoutLimiter } from "../middleware/rateLimiters.js";
import { markOrderPaid } from "./webhooks.js";

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Free tickets are claimed with a name, email and phone number, so a cap per
// order keeps one person from emptying a match's allocation in a single go.
const FREE_TICKETS_MAX_PER_ORDER = 4;

// Never trust a client-supplied price or a client-supplied "is this in
// stock" claim — every line item's real price and availability is read
// fresh from the database here, and that's what gets stored on the Order
// and charged. The client only ever sends refs + quantities (+ the jersey
// version and a referral code, both of which are looked up here too).
router.post("/", checkoutLimiter, async (req, res, next) => {
  try {
    const { type, items, customerName, customerEmail, customerPhone, referralCode, marketingConsent } = req.body;

    if (!["shop", "ticket"].includes(type)) {
      return res.status(400).json({ error: "type must be 'shop' or 'ticket'" });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "At least one item is required" });
    }
    if (!customerName || !customerEmail) {
      return res.status(400).json({ error: "Name and email are required" });
    }
    if (typeof customerEmail !== "string" || !EMAIL_RE.test(customerEmail.trim())) {
      return res.status(400).json({ error: "Enter a valid email address" });
    }
    const phoneDigits = String(customerPhone || "").replace(/\D/g, "");
    if (type === "ticket" && phoneDigits.length < 7) {
      return res.status(400).json({ error: "A phone number is required for tickets" });
    }
    if (phoneDigits.length > 0 && phoneDigits.length < 7) {
      return res.status(400).json({ error: "Enter a valid phone number" });
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

      let unitPrice = doc.price; // read from the DB, not from req.body — this is the whole point
      let version;
      if (type === "shop") {
        if (doc.stock < quantity) {
          return res.status(409).json({ error: `Not enough stock for "${doc.name}"` });
        }
        // A kids line arrives as size "Kids" or "Kids <size>". It is charged the
        // product's kidsPrice, and only if the product actually has one.
        if (typeof raw.size === "string" && /^Kids(\s|$)/.test(raw.size)) {
          if (doc.kidsPrice === undefined || doc.kidsPrice === null) {
            return res.status(400).json({ error: `"${doc.name}" is not available in kids sizes` });
          }
          const kidsSize = raw.size.replace(/^Kids\s*/, "");
          const allowed = doc.kidsSizes?.length > 0 ? doc.kidsSizes : doc.sizes;
          if (allowed?.length > 0 && !allowed.includes(kidsSize)) {
            return res.status(400).json({ error: `Choose a valid kids size for "${doc.name}"` });
          }
          unitPrice = doc.kidsPrice;
        } else {
          if (doc.sizes?.length > 0 && !doc.sizes.includes(raw.size)) {
            return res.status(400).json({ error: `Choose a valid size for "${doc.name}"` });
          }
          // A product with a replica price is sold in two versions; the
          // player version (the main price) is the default.
          if (doc.replicaPrice !== undefined && doc.replicaPrice !== null) {
            if (raw.version === "replica") {
              unitPrice = doc.replicaPrice;
              version = "replica";
            } else {
              version = "player";
            }
          } else if (raw.version === "replica") {
            return res.status(400).json({ error: `"${doc.name}" has no replica version` });
          }
        }
      } else {
        const remaining = doc.quantityAvailable - doc.quantitySold;
        if (remaining < quantity) {
          return res.status(409).json({ error: `Only ${Math.max(0, remaining)} "${doc.name}" tickets left` });
        }
        if (doc.price === 0 && quantity > FREE_TICKETS_MAX_PER_ORDER) {
          return res.status(400).json({
            error: `You can claim up to ${FREE_TICKETS_MAX_PER_ORDER} free tickets at a time`,
          });
        }
      }

      resolvedItems.push({
        refType: expectedRefType,
        ref: doc._id,
        name: doc.name,
        unitPrice,
        quantity,
        size: type === "shop" ? raw.size : undefined,
        version,
      });
    }

    const subtotalAmount = resolvedItems.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

    // Referral code: looked up here, never trusted from the browser. An
    // unknown or switched-off code stops the order with a clear message
    // rather than quietly charging full price.
    let referral = null;
    const code = normalizeReferralCode(referralCode);
    if (code) {
      referral = await ReferralCode.findOne({ code, isActive: true });
      if (!referral || !referralAppliesTo(referral, type)) {
        return res.status(400).json({ error: "That referral code isn't valid" });
      }
    }
    const discountAmount = referral ? Math.round((subtotalAmount * referral.discountPercent) / 100) : 0;
    const totalAmount = Math.max(0, subtotalAmount - discountAmount);

    const consented = marketingConsent === true || marketingConsent === "true";

    const order = await Order.create({
      type,
      items: resolvedItems,
      customerName: String(customerName).trim().slice(0, 120),
      customerEmail: customerEmail.trim(),
      customerPhone: customerPhone ? String(customerPhone).trim().slice(0, 40) : undefined,
      subtotalAmount,
      discountAmount,
      referralCode: referral?.code,
      referralOwner: referral?.ownerName,
      totalAmount,
      marketingConsent: consented,
      consentAt: consented ? new Date() : undefined,
      accessToken: randomBytes(12).toString("hex"),
      status: "pending",
    });

    // Nothing to pay (free tickets, or a 100% referral code): confirm the
    // order straight away. This runs the same path a paid order does, so the
    // stock count moves, the tickets are created and the confirmation email
    // goes out.
    if (totalAmount === 0) {
      await markOrderPaid(order);
      return res.status(201).json({
        orderId: order._id,
        token: order.accessToken,
        totalAmount: 0,
        paymentUrl: null,
        free: true,
      });
    }

    const provider = getActiveProvider();
    if (!provider) {
      // Order is still recorded so the club can follow up manually — just
      // no payment redirect until a processor is configured (see PAYMENT_PROVIDER
      // in .env.example and services/payments/index.js).
      return res.status(201).json({
        orderId: order._id,
        token: order.accessToken,
        totalAmount,
        paymentUrl: null,
        message: "Payments aren't fully set up yet — we've recorded your order and the club will be in touch to complete it.",
      });
    }

    const callbackUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/checkout/success?orderId=${order._id}&token=${order.accessToken}`;
    const { authorizationUrl, reference } = await provider.initialize({ order, callbackUrl });

    order.paymentProvider = provider.name;
    order.paymentReference = reference;
    await order.save();

    res.status(201).json({ orderId: order._id, token: order.accessToken, totalAmount, paymentUrl: authorizationUrl });
  } catch (err) {
    next(err);
  }
});

// Lets the success page confirm status without waiting on the webhook race —
// safe to expose read-only, doesn't leak anything beyond what the customer
// who just placed the order already knows.
router.get("/:orderId", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.orderId)) return res.status(404).json({ error: "Order not found" });
    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json({
      status: order.status,
      type: order.type,
      totalAmount: order.totalAmount,
      discountAmount: order.discountAmount || 0,
      items: order.items,
    });
  } catch (err) {
    next(err);
  }
});

// The buyer's tickets, for the page they land on after claiming or paying. The
// order id alone is not enough: the random token issued at checkout (and put
// in the success link and the email) has to match, because the tickets are
// what gets someone through the gate.
router.get("/:orderId/tickets", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.orderId)) return res.status(404).json({ error: "Order not found" });
    const order = await Order.findById(req.params.orderId);
    const token = String(req.query.token || "");
    if (!order || order.type !== "ticket" || !order.accessToken || order.accessToken !== token) {
      return res.status(404).json({ error: "Order not found" });
    }
    if (order.status !== "paid") return res.json({ status: order.status, tickets: [] });

    const tickets = await Ticket.find({ order: order._id }).sort({ createdAt: 1 }).populate("match", "opponent kickoff venue isHome");
    res.json({
      status: order.status,
      customerName: order.customerName,
      tickets: tickets.map((t) => ({
        code: t.code,
        ticketTypeName: t.ticketTypeName,
        holderName: t.holderName,
        match: t.match
          ? { opponent: t.match.opponent, kickoff: t.match.kickoff, venue: t.match.venue, isHome: t.match.isHome }
          : null,
      })),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
