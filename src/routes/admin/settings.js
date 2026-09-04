import { Router } from "express";
import SiteSettings from "../../models/SiteSettings.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

const router = Router();

router.use(requireAuth, requireRole("content_editor"));

// SiteSettings is a singleton collection — no create/delete, just read and
// upsert the one document. See models/SiteSettings.js.
router.get("/", async (_req, res, next) => {
  try {
    res.json((await SiteSettings.findOne()) || {});
  } catch (err) {
    next(err);
  }
});

router.put("/", async (req, res, next) => {
  try {
    const settings = await SiteSettings.findOneAndUpdate({}, req.body, {
      new: true,
      upsert: true,
      runValidators: true,
    });
    res.json(settings);
  } catch (err) {
    next(err);
  }
});

export default router;
