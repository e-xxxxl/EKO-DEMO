import { Router } from "express";
import Trophy from "../../models/Trophy.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

const router = Router();

router.use(requireAuth, requireRole("content_editor"));

router.get("/", async (_req, res, next) => {
  try {
    res.json(await Trophy.find().sort({ year: -1, displayOrder: 1 }));
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const trophy = await Trophy.create(req.body);
    res.status(201).json(trophy);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const trophy = await Trophy.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!trophy) return res.status(404).json({ error: "Trophy not found" });
    res.json(trophy);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const trophy = await Trophy.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    if (!trophy) return res.status(404).json({ error: "Trophy not found" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
