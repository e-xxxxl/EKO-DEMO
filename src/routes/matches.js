import { Router } from "express";
import Match from "../models/Match.js";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const { status } = req.query;
    const filter = { isActive: true, ...(status ? { status } : {}) };
    const sortOrder = status === "finished" ? { kickoff: -1 } : { kickoff: 1 };
    const matches = await Match.find(filter).sort(sortOrder);
    res.json(matches);
  } catch (err) {
    next(err);
  }
});

router.get("/next", async (_req, res, next) => {
  try {
    const match = await Match.findOne({ status: "upcoming", isActive: true }).sort({
      kickoff: 1,
    });
    res.json(match);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const match = await Match.findOne({ _id: req.params.id, isActive: true }).populate(
      "lineup"
    );
    if (!match) return res.status(404).json({ error: "Match not found" });
    res.json(match);
  } catch (err) {
    next(err);
  }
});

export default router;
