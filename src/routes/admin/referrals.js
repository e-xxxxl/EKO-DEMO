import { Router } from "express";
import ReferralCode, { normalizeReferralCode } from "../../models/ReferralCode.js";
import Order from "../../models/Order.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

const router = Router();

router.use(requireAuth, requireRole("shop_manager", "ticket_manager", "inventory_manager"));

function cleanFields(body) {
  const percent = Number(body.discountPercent);
  return {
    ownerName: String(body.ownerName || "").trim(),
    discountPercent: Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 0,
    appliesTo: ["both", "shop", "tickets"].includes(body.appliesTo) ? body.appliesTo : "both",
    isActive: body.isActive !== false,
    notes: String(body.notes || "").trim(),
  };
}

// Every code with what it has brought in: only paid orders count. "tickets" is
// the number of tickets issued (free ones included), "revenue" what was
// actually paid after the discount, "discount" what the code took off.
router.get("/", async (_req, res, next) => {
  try {
    const [codes, rows] = await Promise.all([
      ReferralCode.find().sort({ createdAt: -1 }).lean(),
      Order.aggregate([
        { $match: { status: "paid", referralCode: { $exists: true, $ne: null } } },
        { $addFields: { units: { $sum: "$items.quantity" } } },
        {
          $group: {
            _id: { code: "$referralCode", type: "$type" },
            orders: { $sum: 1 },
            units: { $sum: "$units" },
            revenue: { $sum: "$totalAmount" },
            discount: { $sum: "$discountAmount" },
          },
        },
      ]),
    ]);

    const byCode = new Map();
    for (const r of rows) {
      const s = byCode.get(r._id.code) || {
        shopOrders: 0,
        ticketOrders: 0,
        itemsSold: 0,
        ticketsIssued: 0,
        revenue: 0,
        discount: 0,
      };
      if (r._id.type === "shop") {
        s.shopOrders += r.orders;
        s.itemsSold += r.units;
      } else {
        s.ticketOrders += r.orders;
        s.ticketsIssued += r.units;
      }
      s.revenue += r.revenue;
      s.discount += r.discount;
      byCode.set(r._id.code, s);
    }

    res.json(
      codes.map((c) => ({
        ...c,
        stats: byCode.get(c.code) || { shopOrders: 0, ticketOrders: 0, itemsSold: 0, ticketsIssued: 0, revenue: 0, discount: 0 },
      }))
    );
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const code = normalizeReferralCode(req.body.code);
    if (!code) return res.status(400).json({ error: "Enter a code" });
    const fields = cleanFields(req.body);
    if (!fields.ownerName) return res.status(400).json({ error: "Enter the name this code belongs to" });
    res.status(201).json(await ReferralCode.create({ code, ...fields }));
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: "That code already exists" });
    next(err);
  }
});

// The code itself is not editable: orders already placed carry it, and
// changing it would cut them off from the totals on this page.
router.put("/:id", async (req, res, next) => {
  try {
    const fields = cleanFields(req.body);
    if (!fields.ownerName) return res.status(400).json({ error: "Enter the name this code belongs to" });
    const updated = await ReferralCode.findByIdAndUpdate(req.params.id, fields, { new: true, runValidators: true });
    if (!updated) return res.status(404).json({ error: "Code not found" });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const removed = await ReferralCode.findByIdAndDelete(req.params.id);
    if (!removed) return res.status(404).json({ error: "Code not found" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
