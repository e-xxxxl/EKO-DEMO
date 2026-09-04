import mongoose from "mongoose";

const trophySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // e.g. "NNL Regional Champions"
    competition: { type: String, trim: true },
    year: { type: Number, required: true },
    timesWon: { type: Number, default: 1 },
    description: { type: String, trim: true },
    imageUrl: { type: String, trim: true },
    displayOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("Trophy", trophySchema);
