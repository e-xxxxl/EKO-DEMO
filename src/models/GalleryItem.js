import mongoose from "mongoose";

const galleryItemSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["photo", "video"], required: true },
    url: { type: String, required: true, trim: true },
    caption: { type: String, trim: true },
    relatedMatch: { type: mongoose.Schema.Types.ObjectId, ref: "Match" },
    tags: [{ type: String, trim: true }],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("GalleryItem", galleryItemSchema);
