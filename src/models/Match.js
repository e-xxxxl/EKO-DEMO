import mongoose from "mongoose";

const eventSchema = new mongoose.Schema(
  {
    minute: Number,
    type: { type: String, enum: ["goal", "yellow_card", "red_card", "substitution"] },
    player: String,
    detail: String,
  },
  { _id: false }
);

const matchSchema = new mongoose.Schema(
  {
    opponent: { type: String, required: true, trim: true },
    competition: { type: String, trim: true },
    venue: { type: String, trim: true },
    kickoff: { type: Date, required: true },
    isHome: { type: Boolean, default: true },
    status: {
      type: String,
      enum: ["upcoming", "live", "finished", "postponed"],
      default: "upcoming",
    },
    score: {
      eko: { type: Number, default: null },
      opponent: { type: Number, default: null },
    },
    lineup: [{ type: mongoose.Schema.Types.ObjectId, ref: "Player" }],
    events: [eventSchema],
    summary: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

matchSchema.index({ kickoff: 1 });

export default mongoose.model("Match", matchSchema);
