import mongoose from "mongoose";

// This collection should only ever hold one document — fetch with
// SiteSettings.findOne() and upsert on save from the admin panel.
const siteSettingsSchema = new mongoose.Schema(
  {
    heroBanners: [{ imageUrl: String, headline: String, linkUrl: String }],
    clubInfo: {
      history: String,
      vision: String,
      mission: String,
      stadiumInfo: String,
      address: String,
      phone: String,
      email: String,
    },
    socialLinks: {
      instagram: String,
      twitter: String,
      facebook: String,
      youtube: String,
      tiktok: String,
    },
    footerContent: String,
    seoDefaults: {
      title: String,
      description: String,
    },
  },
  { timestamps: true }
);

export default mongoose.model("SiteSettings", siteSettingsSchema);
