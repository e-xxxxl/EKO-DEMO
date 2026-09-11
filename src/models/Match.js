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

// One {eko, opponent} pair per stat category, kept as plain numbers (not a
// percentage-only possession type) so the same shape covers both "58" (%)
// and "12" (shot count) without a second schema. All optional: a stat left
// unset (null on both sides) just doesn't render on the public match page,
// same degrade-gracefully pattern used for score/summary/lineup elsewhere.
const statPairSchema = new mongoose.Schema(
  {
    eko: { type: Number, default: null },
    opponent: { type: Number, default: null },
  },
  { _id: false }
);

const matchSchema = new mongoose.Schema(
  {
    opponent: { type: String, required: true, trim: true },
    opponentLogoUrl: { type: String, trim: true },
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
    // Pre-match writeup (team news, form, what's at stake), distinct from
    // `summary` below, which is the post-match report. Admin fills in
    // whichever is relevant to the match's current status.
    preview: { type: String, trim: true },
    formation: { type: String, trim: true }, // e.g. "4-3-3", display only, doesn't drive lineup validation
    lineup: [{ type: mongoose.Schema.Types.ObjectId, ref: "Player" }], // starting XI
    substitutes: [{ type: mongoose.Schema.Types.ObjectId, ref: "Player" }],
    events: [eventSchema],
    stats: {
      possession: statPairSchema, // whole-number percentage, e.g. 58 vs 42
      shots: statPairSchema,
      shotsOnTarget: statPairSchema,
      corners: statPairSchema,
      fouls: statPairSchema,
      yellowCards: statPairSchema,
      redCards: statPairSchema,
    },
    summary: { type: String, trim: true }, // post-match report
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

matchSchema.index({ kickoff: 1 });

export default mongoose.model("Match", matchSchema);
