import { Router } from "express";
import HistoryMilestone from "../../models/HistoryMilestone.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

const router = Router();

router.use(requireAuth, requireRole("content_editor"));

router.get("/", async (_req, res, next) => {
  try {
    res.json(await HistoryMilestone.find().sort({ year: 1 }));
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const milestone = await HistoryMilestone.create(req.body);
    res.status(201).json(milestone);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const milestone = await HistoryMilestone.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!milestone) return res.status(404).json({ error: "Milestone not found" });
    res.json(milestone);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const milestone = await HistoryMilestone.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    if (!milestone) return res.status(404).json({ error: "Milestone not found" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
