import { Router } from "express";
import TicketType from "../models/TicketType.js";

const router = Router();

// Public reads. Write routes live under /api/admin/ticket-types (ticket_manager).
router.get("/", async (req, res, next) => {
  try {
    const { match } = req.query;
    if (!match) return res.status(400).json({ error: "?match=<matchId> is required" });
    const ticketTypes = await TicketType.find({ match, isActive: true }).sort({ price: 1 });
    res.json(ticketTypes);
  } catch (err) {
    next(err);
  }
});

export default router;
