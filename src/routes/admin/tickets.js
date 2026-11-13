import { Router } from "express";
import mongoose from "mongoose";
import Ticket, { normalizeTicketCode } from "../../models/Ticket.js";
import TicketType from "../../models/TicketType.js";
import Match from "../../models/Match.js";
import Order from "../../models/Order.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { sensitiveLimiter } from "../../middleware/rateLimiters.js";
import { buildOverview, buildMatchesSummary, orderView, ref8, paymentMethod } from "../../services/ticketStats.js";

const router = Router();

router.use(requireAuth);

// Two kinds of staff. The ticket manager runs the whole ticketing side (what is
// on sale, who bought, the money). Gate staff, including the inventory manager,
// only check people in. super_admin passes both.
const gate = requireRole("ticket_manager", "inventory_manager");
const manager = requireRole("ticket_manager");

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const lagosTime = (d) => (d ? new Date(d).toLocaleString("en-GB", { timeZone: "Africa/Lagos" }) : "");

// ---------------------------------------------------------------------------
// Gate: look up, check in, undo, find, recent, live counts
// ---------------------------------------------------------------------------

async function findByCode(code) {
  const clean = normalizeTicketCode(code);
  if (!clean) return null;
  return Ticket.findOne({ code: clean }).populate("match", "opponent kickoff isHome");
}

// A ticket for a different match must not get someone in. The scan page sends
// the match it is set to; if the ticket belongs to another one, say so.
function wrongMatch(ticket, matchId) {
  if (!matchId || !ticket.match) return false;
  return String(ticket.match._id) !== String(matchId);
}

const wrongMatchMessage = (ticket) => `This ticket is for ${ticket.match.opponent}, not the match you selected`;

// Read-only lookup: shows the ticket's status before gate staff commit to
// admitting the holder, so a mis-typed code never uses up a real ticket.
router.post("/lookup", gate, sensitiveLimiter, async (req, res, next) => {
  try {
    const ticket = await findByCode(req.body.code);
    if (!ticket) return res.status(404).json({ error: "No ticket found with that code" });
    if (wrongMatch(ticket, req.body.matchId)) return res.status(409).json({ error: wrongMatchMessage(ticket) });
    res.json(ticket);
  } catch (err) {
    next(err);
  }
});

// Checks a ticket in. Safe to repeat and safe with two scanners at the gate:
// the change is made in one atomic step that only succeeds for a ticket not yet
// used, so the same ticket can never be admitted twice. Scanning an already used
// ticket reports who and when instead of an error.
router.post("/validate", gate, async (req, res, next) => {
  try {
    const found = await findByCode(req.body.code);
    if (!found) return res.status(404).json({ error: "No ticket found with that code" });
    if (wrongMatch(found, req.body.matchId)) return res.status(409).json({ error: wrongMatchMessage(found) });

    const updated = await Ticket.findOneAndUpdate(
      { _id: found._id, used: false },
      { $set: { used: true, usedAt: new Date(), usedBy: req.admin.name || "" } },
      { new: true }
    ).populate("match", "opponent kickoff isHome");

    if (!updated) {
      // Someone got there first (or it was already used): report the original check-in.
      const current = await findByCode(req.body.code);
      return res.json({ ...current.toObject(), alreadyUsed: true });
    }
    res.json({ ...updated.toObject(), alreadyUsed: false });
  } catch (err) {
    next(err);
  }
});

// Reverses a check-in made by mistake.
router.post("/undo", gate, async (req, res, next) => {
  try {
    const clean = normalizeTicketCode(req.body.code);
    const ticket = await Ticket.findOneAndUpdate(
      { code: clean, used: true },
      { $set: { used: false }, $unset: { usedAt: 1, usedBy: 1 } },
      { new: true }
    ).populate("match", "opponent kickoff isHome");
    if (!ticket) return res.status(404).json({ error: "That ticket is not checked in" });
    res.json(ticket);
  } catch (err) {
    next(err);
  }
});

// For a person with no QR code to hand: find their ticket by name, email,
// phone number or the number on it.
router.get("/search", gate, async (req, res, next) => {
  try {
    const q = String(req.query.q || "").trim();
    if (q.length < 2) return res.json([]);
    const rx = new RegExp(escapeRegex(q), "i");
    const codeRx = new RegExp(escapeRegex(normalizeTicketCode(q) || q), "i");
    const filter = { $or: [{ holderName: rx }, { holderEmail: rx }, { holderPhone: rx }, { code: codeRx }] };
    if (req.query.match && mongoose.isValidObjectId(req.query.match)) filter.match = req.query.match;
    res.json(await Ticket.find(filter).sort({ holderName: 1 }).limit(25).populate("match", "opponent kickoff isHome"));
  } catch (err) {
    next(err);
  }
});

// The latest check-ins for a match, newest first.
router.get("/recent/:matchId", gate, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.matchId)) return res.json([]);
    res.json(
      await Ticket.find({ match: req.params.matchId, used: true })
        .sort({ usedAt: -1 })
        .limit(10)
        .populate("match", "opponent kickoff isHome")
    );
  } catch (err) {
    next(err);
  }
});

// Live counts for the gate: how many are in, overall and by category.
router.get("/summary/:matchId", gate, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.matchId)) return res.status(404).json({ error: "Match not found" });
    const match = await Match.findById(req.params.matchId);
    if (!match) return res.status(404).json({ error: "Match not found" });
    const rows = await Ticket.aggregate([
      { $match: { match: match._id } },
      { $group: { _id: "$ticketTypeName", total: { $sum: 1 }, used: { $sum: { $cond: ["$used", 1, 0] } } } },
      { $sort: { _id: 1 } },
    ]);
    res.json({
      total: rows.reduce((s, r) => s + r.total, 0),
      used: rows.reduce((s, r) => s + r.used, 0),
      byCategory: rows.map((r) => ({ name: r._id, total: r.total, used: r.used })),
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Ticketing overview (ticket manager)
// ---------------------------------------------------------------------------

// One row per home match that has tickets on sale: how many sold, how many in,
// and the money.
router.get("/matches-summary", manager, async (_req, res, next) => {
  try {
    const types = await TicketType.find().lean();
    const matchIds = [...new Set(types.map((t) => String(t.match)))];
    const matches = await Match.find({ _id: { $in: matchIds }, isHome: true }).sort({ kickoff: 1 }).lean();
    const typeIds = types.map((t) => t._id);
    const [ticketCounts, paidOrders] = await Promise.all([
      Ticket.aggregate([{ $group: { _id: "$match", sold: { $sum: 1 }, used: { $sum: { $cond: ["$used", 1, 0] } } } }]),
      Order.find({ type: "ticket", status: "paid", "items.ref": { $in: typeIds } }).lean(),
    ]);
    res.json(buildMatchesSummary({ matches, types, ticketCounts, paidOrders }));
  } catch (err) {
    next(err);
  }
});

// The full picture for one match.
router.get("/overview/:matchId", manager, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.matchId)) return res.status(404).json({ error: "Match not found" });
    const match = await Match.findById(req.params.matchId).lean();
    if (!match) return res.status(404).json({ error: "Match not found" });

    const types = await TicketType.find({ match: match._id }).sort({ price: 1, createdAt: 1 }).lean();
    const typeIds = types.map((t) => t._id);
    const [counts, paidOrders, pendingOrders] = await Promise.all([
      Ticket.aggregate([
        { $match: { match: match._id } },
        { $group: { _id: "$ticketType", sold: { $sum: 1 }, used: { $sum: { $cond: ["$used", 1, 0] } } } },
      ]),
      Order.find({ type: "ticket", status: "paid", "items.ref": { $in: typeIds } }).lean(),
      Order.find({ type: "ticket", status: "pending", "items.ref": { $in: typeIds } }).lean(),
    ]);
    res.json(buildOverview({ match, types, counts, paidOrders, pendingOrders }));
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Ticket orders (ticket manager): kept apart from shop orders
// ---------------------------------------------------------------------------

async function ticketOrderFilter(query) {
  const filter = { type: "ticket" };
  if (["paid", "pending", "failed", "cancelled"].includes(query.status)) filter.status = query.status;

  if (query.match && mongoose.isValidObjectId(query.match)) {
    const ids = (await TicketType.find({ match: query.match }).select("_id").lean()).map((t) => t._id);
    filter["items.ref"] = { $in: ids };
  }
  if (query.kind === "free") filter.totalAmount = 0;
  if (query.kind === "paid") filter.totalAmount = { $gt: 0 };

  const q = String(query.q || "").trim();
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    filter.$or = [
      { customerName: rx },
      { customerEmail: rx },
      { customerPhone: rx },
      { referralCode: rx },
      { $expr: { $regexMatch: { input: { $toString: "$_id" }, regex: escapeRegex(q), options: "i" } } },
    ];
  }
  return filter;
}

router.get("/orders", manager, async (req, res, next) => {
  try {
    const filter = await ticketOrderFilter(req.query);
    const limit = Math.min(Number(req.query.limit) || 25, 100);
    const page = Math.max(Number(req.query.page) || 1, 1);

    const [orders, count, totals] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Order.countDocuments(filter),
      Order.aggregate([
        { $match: filter },
        { $addFields: { ticketCount: { $sum: "$items.quantity" } } },
        {
          $group: {
            _id: "$status",
            orders: { $sum: 1 },
            amount: { $sum: "$totalAmount" },
            tickets: { $sum: "$ticketCount" },
          },
        },
      ]),
    ]);

    const refs = [...new Set(orders.flatMap((o) => o.items.map((i) => String(i.ref))))];
    const types = await TicketType.find({ _id: { $in: refs } }).lean();
    const matches = await Match.find({ _id: { $in: [...new Set(types.map((t) => String(t.match)))] } }).lean();
    const tickets = await Ticket.find({ order: { $in: orders.map((o) => o._id) } })
      .sort({ createdAt: 1 })
      .lean();
    const byOrder = new Map();
    for (const t of tickets) {
      const k = String(t.order);
      byOrder.set(k, [...(byOrder.get(k) || []), t]);
    }
    const typeMap = new Map(types.map((t) => [String(t._id), t]));
    const matchMap = new Map(matches.map((m) => [String(m._id), m]));

    const stat = (s) => totals.find((r) => r._id === s) || { orders: 0, amount: 0, tickets: 0 };
    res.json({
      page,
      pages: Math.max(1, Math.ceil(count / limit)),
      count,
      summary: {
        paidOrders: stat("paid").orders,
        paidAmount: stat("paid").amount,
        paidTickets: stat("paid").tickets,
        pendingOrders: stat("pending").orders,
        pendingAmount: stat("pending").amount,
      },
      orders: orders.map((o) => orderView(o, { typeMap, matchMap, tickets: byOrder.get(String(o._id)) })),
    });
  } catch (err) {
    next(err);
  }
});

// The attendee list for a match as a spreadsheet: every ticket, who holds it,
// what they paid, and whether they have been checked in. Handy as a printed
// backup at the gate.
router.get("/export.csv", manager, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.query.match)) return res.status(400).json({ error: "Choose a match" });
    const match = await Match.findById(req.query.match).lean();
    if (!match) return res.status(404).json({ error: "Match not found" });

    const types = await TicketType.find({ match: match._id }).lean();
    const priceByType = new Map(types.map((t) => [String(t._id), t.price]));
    const tickets = await Ticket.find({ match: match._id }).sort({ ticketTypeName: 1, holderName: 1 }).populate("order").lean();

    const cell = (v) => {
      const s = String(v ?? "");
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = [["Ticket number", "Category", "Name", "Email", "Phone", "Order", "Price (NGN)", "Referral code", "Payment", "Checked in", "Checked in at", "Checked in by"]];
    for (const t of tickets) {
      const o = t.order || {};
      rows.push([
        t.code,
        t.ticketTypeName,
        t.holderName,
        t.holderEmail || o.customerEmail || "",
        t.holderPhone || o.customerPhone || "",
        o._id ? ref8(o._id) : "",
        priceByType.get(String(t.ticketType)) ?? "",
        o.referralCode || "",
        o._id ? paymentMethod(o) : "",
        t.used ? "Yes" : "No",
        lagosTime(t.usedAt),
        t.usedBy || "",
      ]);
    }
    const safeName = match.opponent.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="attendees-${safeName}.csv"`);
    res.send(rows.map((r) => r.map(cell).join(",")).join("\r\n"));
  } catch (err) {
    next(err);
  }
});

export default router;
