import { Router } from "express";
import Match from "../../models/Match.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

const router = Router();

router.use(requireAuth, requireRole("content_editor"));

router.get("/", async (_req, res, next) => {
  try {
    res.json(await Match.find().sort({ kickoff: -1 }));
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const match = await Match.findById(req.params.id).populate("lineup");
    if (!match) return res.status(404).json({ error: "Match not found" });
    res.json(match);
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const match = await Match.create(req.body);
    res.status(201).json(match);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const match = await Match.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!match) return res.status(404).json({ error: "Match not found" });
    res.json(match);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    // Soft delete — keeps historical lineups/events intact, just hides from the public site
    const match = await Match.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    if (!match) return res.status(404).json({ error: "Match not found" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
