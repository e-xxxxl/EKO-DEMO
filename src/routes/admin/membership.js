import { Router } from "express";
import MembershipApplication from "../../models/MembershipApplication.js";
import MembershipTier from "../../models/MembershipTier.js";
import { ensureTiers, getContent } from "../../services/membershipDefaults.js";
import MembershipContent from "../../models/MembershipContent.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

const router = Router();

router.use(requireAuth, requireRole("content_editor"));

const slugify = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

// ---- Page content (a single document) ----
router.get("/content", async (_req, res, next) => {
  try {
    res.json(await getContent());
  } catch (err) {
    next(err);
  }
});

router.put("/content", async (req, res, next) => {
  try {
    const { eyebrow, title, intro, heroImageUrl, galleryHeading, gallery } = req.body;
    await getContent();
    const doc = await MembershipContent.findOneAndUpdate(
      { key: "membership" },
      {
        eyebrow,
        title,
        intro,
        heroImageUrl,
        galleryHeading,
        gallery: Array.isArray(gallery) ? gallery.filter((g) => g && g.url) : [],
      },
      { new: true, runValidators: true }
    );
    res.json(doc);
  } catch (err) {
    next(err);
  }
});

// ---- Packages ----
router.get("/tiers", async (_req, res, next) => {
  try {
    await ensureTiers();
    res.json(await MembershipTier.find().sort({ displayOrder: 1, createdAt: 1 }));
  } catch (err) {
    next(err);
  }
});

function tierFields(body) {
  const { name, audience, price, period, tagline, badge, imageUrl, perks, displayOrder, isActive } = body;
  return {
    name,
    audience,
    price,
    period,
    tagline,
    badge,
    imageUrl,
    perks: Array.isArray(perks) ? perks.map((p) => String(p).trim()).filter(Boolean) : [],
    displayOrder: Number(displayOrder) || 0,
    isActive,
  };
}

router.post("/tiers", async (req, res, next) => {
  try {
    const fields = tierFields(req.body);
    let slug = slugify(fields.name || "package") || "package";
    for (let n = 2; await MembershipTier.exists({ slug }); n++) slug = `${slugify(fields.name)}-${n}`;
    res.status(201).json(await MembershipTier.create({ ...fields, slug }));
  } catch (err) {
    next(err);
  }
});

router.put("/tiers/:id", async (req, res, next) => {
  try {
    const tier = await MembershipTier.findByIdAndUpdate(req.params.id, tierFields(req.body), {
      new: true,
      runValidators: true,
    });
    if (!tier) return res.status(404).json({ error: "Package not found" });
    res.json(tier);
  } catch (err) {
    next(err);
  }
});

router.delete("/tiers/:id", async (req, res, next) => {
  try {
    const tier = await MembershipTier.findByIdAndDelete(req.params.id);
    if (!tier) return res.status(404).json({ error: "Package not found" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ---- Applications ----
router.get("/", async (_req, res, next) => {
  try {
    res.json(await MembershipApplication.find().sort({ createdAt: -1 }));
  } catch (err) {
    next(err);
  }
});

// Mark handled/unhandled (read), the same single mutation the contact inbox has.
router.put("/:id", async (req, res, next) => {
  try {
    const application = await MembershipApplication.findByIdAndUpdate(
      req.params.id,
      { read: Boolean(req.body.read) },
      { new: true }
    );
    if (!application) return res.status(404).json({ error: "Application not found" });
    res.json(application);
  } catch (err) {
    next(err);
  }
});

export default router;
