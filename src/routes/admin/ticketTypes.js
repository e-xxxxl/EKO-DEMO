import { Router } from "express";
import mongoose from "mongoose";
import TicketType from "../../models/TicketType.js";
import Match from "../../models/Match.js";
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

// Tickets are only sold for home matches, so a ticket type can only be added to one.
async function homeMatchProblem(matchId) {
  if (!mongoose.isValidObjectId(matchId)) return "Choose a match";
  const match = await Match.findById(matchId);
  if (!match) return "Match not found";
  if (!match.isHome) return "Tickets are only sold for home matches";
  return null;
}

router.post("/", async (req, res, next) => {
  try {
    const problem = await homeMatchProblem(req.body.match);
    if (problem) return res.status(400).json({ error: problem });
    const ticketType = await TicketType.create(req.body);
    res.status(201).json(ticketType);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    if (req.body.match) {
      const problem = await homeMatchProblem(req.body.match);
      if (problem) return res.status(400).json({ error: problem });
    }
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
