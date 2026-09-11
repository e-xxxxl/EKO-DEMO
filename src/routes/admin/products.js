import { Router } from "express";
import Product from "../../models/Product.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

const router = Router();

router.use(requireAuth, requireRole("shop_manager", "inventory_manager"));

router.get("/", async (_req, res, next) => {
  try {
    res.json(await Product.find().sort({ createdAt: -1 }));
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    // req.body.images[] should already be Cloudinary secure_urls obtained
    // via POST /api/admin/upload/signature from the admin panel's upload form
    const product = await Product.create(req.body);
    res.status(201).json(product);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json(product);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
