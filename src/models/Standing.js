import mongoose from "mongoose";

const standingSchema = new mongoose.Schema(
  {
    clubName: { type: String, required: true, trim: true },
    clubLogoUrl: { type: String, trim: true },
    isEkoUnited: { type: Boolean, default: false }, // highlight our row in the table UI
    played: { type: Number, default: 0 },
    won: { type: Number, default: 0 },
    drawn: { type: Number, default: 0 },
    lost: { type: Number, default: 0 },
    goalsFor: { type: Number, default: 0 },
    goalsAgainst: { type: Number, default: 0 },
    points: { type: Number, default: 0 },
    position: { type: Number, required: true },
    season: { type: String, default: "2026" }, // supports keeping past seasons around
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

standingSchema.index({ season: 1, position: 1 });
standingSchema.virtual("goalDifference").get(function () {
  return this.goalsFor - this.goalsAgainst;
});
standingSchema.set("toJSON", { virtuals: true });

export default mongoose.model("Standing", standingSchema);
