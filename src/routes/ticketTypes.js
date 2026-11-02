import { Router } from "express";
import mongoose from "mongoose";
import TicketType from "../models/TicketType.js";
import Match from "../models/Match.js";

const router = Router();

// Public reads. Write routes live under /api/admin/ticket-types (ticket_manager).
router.get("/", async (req, res, next) => {
  try {
    const { match } = req.query;
    if (!match) return res.status(400).json({ error: "?match=<matchId> is required" });
    // Tickets are only sold for home matches: an away fixture has none to show.
    if (!mongoose.isValidObjectId(match)) return res.json([]);
    const fixture = await Match.findById(match);
    if (!fixture || !fixture.isHome) return res.json([]);
    const ticketTypes = await TicketType.find({ match, isActive: true }).sort({ price: 1 });
    res.json(ticketTypes);
  } catch (err) {
    next(err);
  }
});

export default router;
