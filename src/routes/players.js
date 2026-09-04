import { Router } from "express";
import Player from "../models/Player.js";

const router = Router();

// Public reads. Write routes (POST/PUT/DELETE) belong under /api/admin/players
// behind auth middleware once that's built in Phase 1 admin work — not here.
router.get("/", async (req, res, next) => {
  try {
    const { role } = req.query;
    const filter = { isActive: true };
    if (role) filter.role = role;
    const players = await Player.find(filter).sort({ squadNumber: 1 });
    res.json(players);
  } catch (err) {
    next(err);
  }
});

router.get("/:slug", async (req, res, next) => {
  try {
    const player = await Player.findOne({ slug: req.params.slug, isActive: true });
    if (!player) return res.status(404).json({ error: "Player not found" });
    res.json(player);
  } catch (err) {
    next(err);
  }
});

export default router;
