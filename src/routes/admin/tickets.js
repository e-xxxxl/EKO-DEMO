import { Router } from "express";
import Ticket from "../../models/Ticket.js";
import Match from "../../models/Match.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { sensitiveLimiter } from "../../middleware/rateLimiters.js";

const router = Router();

// Gate staff — matchday scanning, not general ticket-type management (that's
// still ticket_manager's own /admin/ticket-types). inventory_manager is
// scoped to exactly this plus shop products/orders, per the 2026-09-09 role split.
router.use(requireAuth, requireRole("ticket_manager", "inventory_manager"));

async function findByCode(code) {
  if (!code || typeof code !== "string") return null;
  return Ticket.findOne({ code: code.trim().toUpperCase() }).populate("match", "opponent kickoff isHome");
}

// Read-only lookup — shows the ticket's status before a gate staffer commits
// to admitting the holder, so a mis-scan or mis-typed code doesn't silently
// consume a real ticket.
router.post("/lookup", sensitiveLimiter, async (req, res, next) => {
  try {
    const ticket = await findByCode(req.body.code);
    if (!ticket) return res.status(404).json({ error: "No ticket found with that code" });
    res.json(ticket);
  } catch (err) {
    next(err);
  }
});

// Marks a ticket used. Idempotent by design: scanning an already-used ticket
// again doesn't throw or re-stamp usedAt — it reports back "already used"
// (with the original usedAt) so staff can see it was already let in, not
// get a confusing error.
router.post("/validate", sensitiveLimiter, async (req, res, next) => {
  try {
    const ticket = await findByCode(req.body.code);
    if (!ticket) return res.status(404).json({ error: "No ticket found with that code" });

    if (ticket.used) {
      return res.json({ ...ticket.toObject(), alreadyUsed: true });
    }

    ticket.used = true;
    ticket.usedAt = new Date();
    await ticket.save();
    res.json({ ...ticket.toObject(), alreadyUsed: false });
  } catch (err) {
    next(err);
  }
});

// Per-match summary (sold vs scanned-in) — useful context on the scan page
// itself, e.g. "214 / 500 checked in".
router.get("/summary/:matchId", async (req, res, next) => {
  try {
    const match = await Match.findById(req.params.matchId);
    if (!match) return res.status(404).json({ error: "Match not found" });
    const total = await Ticket.countDocuments({ match: req.params.matchId });
    const used = await Ticket.countDocuments({ match: req.params.matchId, used: true });
    res.json({ total, used });
  } catch (err) {
    next(err);
  }
});

export default router;
