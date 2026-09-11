import { Router } from "express";
import TicketType from "../../models/TicketType.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

const router = Router();

router.use(requireAuth, requireRole("ticket_manager"));

router.get("/", async (req, res, next) => {
  try {
    const { match } = req.query;
    const filter = match ? { match } : {};
    res.json(await TicketType.find(filter).sort({ createdAt: -1 }));
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const ticketType = await TicketType.create(req.body);
    res.status(201).json(ticketType);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const ticketType = await TicketType.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!ticketType) return res.status(404).json({ error: "Ticket type not found" });
    res.json(ticketType);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const ticketType = await TicketType.findByIdAndDelete(req.params.id);
    if (!ticketType) return res.status(404).json({ error: "Ticket type not found" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
