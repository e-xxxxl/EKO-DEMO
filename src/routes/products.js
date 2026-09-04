import { Router } from "express";
import Product from "../models/Product.js";

const router = Router();

// Public reads. Write routes live under /api/admin/products (shop_manager).
router.get("/", async (req, res, next) => {
  try {
    const { category } = req.query;
    const filter = { isActive: true, ...(category ? { category } : {}) };
    const products = await Product.find(filter).sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    next(err);
  }
});

router.get("/:slug", async (req, res, next) => {
  try {
    const product = await Product.findOne({ slug: req.params.slug, isActive: true });
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json(product);
  } catch (err) {
    next(err);
  }
});

export default router;
