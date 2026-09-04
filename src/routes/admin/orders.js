import { Router } from "express";
import Order from "../../models/Order.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

const router = Router();

router.use(requireAuth, requireRole("shop_manager", "ticket_manager"));

// shop_manager only sees shop orders, ticket_manager only sees ticket
// orders, super_admin (requireRole's implicit bypass) sees everything and
// can still narrow with ?type=. Orders aren't created/edited here — they
// come from the public checkout flow (routes/checkout.js) — this is
// view sales + mark-fulfilled only, matching the signed scope.
router.get("/", async (req, res, next) => {
  try {
    const roleType = req.admin.role === "shop_manager" ? "shop" : req.admin.role === "ticket_manager" ? "ticket" : null;
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
    // webhook (routes/webhooks.js), never from this admin route.
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

export default router;
