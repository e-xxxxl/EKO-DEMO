import mongoose from "mongoose";

// Pulls the 11-character video id out of any common YouTube link: watch,
// youtu.be, shorts, embed, live, or a bare id. Returns null when it is not a
// YouTube link, so a typo is caught on save instead of publishing a dead card.
export function extractYoutubeId(input = "") {
  const value = String(input).trim();
  if (/^[\w-]{11}$/.test(value)) return value;
  let url;
  try {
    url = new URL(value.startsWith("http") ? value : `https://${value}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\.|^m\./, "");
  let id = null;
  if (host === "youtu.be") id = url.pathname.slice(1).split("/")[0];
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (url.pathname === "/watch") id = url.searchParams.get("v");
    else {
      const m = url.pathname.match(/^\/(?:shorts|embed|live|v)\/([\w-]{11})/);
      id = m ? m[1] : null;
    }
  }
  return id && /^[\w-]{11}$/.test(id) ? id : null;
}

const videoSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    youtubeUrl: { type: String, required: true, trim: true },
    videoId: { type: String, trim: true }, // derived from youtubeUrl on save
    isActive: { type: Boolean, default: true },
    publishedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

videoSchema.pre("validate", function (next) {
  const id = extractYoutubeId(this.youtubeUrl);
  if (!id) return next(new Error("Enter a valid YouTube link, for example https://www.youtube.com/watch?v=..."));
  this.videoId = id;
  next();
});

videoSchema.index({ publishedAt: -1 });

export default mongoose.model("Video", videoSchema);
