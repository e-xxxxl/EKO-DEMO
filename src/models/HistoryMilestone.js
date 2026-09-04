import mongoose from "mongoose";

const historyMilestoneSchema = new mongoose.Schema(
  {
    year: { type: Number, required: true },
    title: { type: String, required: true, trim: true }, // e.g. "Club founded", "First NNL promotion"
    description: { type: String, trim: true },
    imageUrl: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

historyMilestoneSchema.index({ year: 1 });

export default mongoose.model("HistoryMilestone", historyMilestoneSchema);
