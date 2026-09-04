import { Router } from "express";
import Standing from "../models/Standing.js";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const season = req.query.season || "2026";
    const table = await Standing.find({ season, isActive: true }).sort({ position: 1 });
    res.json(table);
  } catch (err) {
    next(err);
  }
});

export default router;
