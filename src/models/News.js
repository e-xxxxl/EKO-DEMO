import mongoose from "mongoose";

// The story, broken into ordered blocks the admin builds in the News form:
// a paragraph (optionally shown bold) or a photo (optionally captioned) that
// sits exactly where it was placed. `body` below always holds the paragraphs
// as plain text too, for search/SEO/share descriptions and for articles
// written before blocks existed (those have no `blocks` and render from `body`).
const blockSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ["paragraph", "image"], required: true },
    text: { type: String, trim: true },
    bold: { type: Boolean, default: false },
    url: { type: String, trim: true },
    caption: { type: String, trim: true },
  },
  { _id: false }
);

const newsSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    body: { type: String, required: true },
    blocks: { type: [blockSchema], default: undefined },
    coverImageUrl: { type: String, trim: true }, // portrait/phone image (also the article header on phones, list thumbnails, share cards)
    heroImageUrl: { type: String, trim: true }, // optional landscape 16:9 image, used only by the homepage hero on tablets/desktops
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
