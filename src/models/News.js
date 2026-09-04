import mongoose from "mongoose";

const newsSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    body: { type: String, required: true },
    coverImageUrl: { type: String, trim: true },
    images: [{ type: String, trim: true }], // additional photos shown within the article body, separate from the cover
    category: {
      type: String,
      enum: ["article", "match_report", "press_release"],
      default: "article",
    },
    relatedMatch: { type: mongoose.Schema.Types.ObjectId, ref: "Match" },
    author: { type: String, trim: true, default: "Eko United FC" },
    publishedAt: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

newsSchema.index({ publishedAt: -1 });

export default mongoose.model("News", newsSchema);
