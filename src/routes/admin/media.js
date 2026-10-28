import { Router } from "express";
import Player from "../../models/Player.js";
import News from "../../models/News.js";
import Product from "../../models/Product.js";
import Match from "../../models/Match.js";
import Standing from "../../models/Standing.js";
import Sponsor from "../../models/Sponsor.js";
import GalleryItem from "../../models/GalleryItem.js";
import Trophy from "../../models/Trophy.js";
import HistoryMilestone from "../../models/HistoryMilestone.js";
import Event from "../../models/Event.js";
import MembershipTier from "../../models/MembershipTier.js";
import MembershipContent from "../../models/MembershipContent.js";
import PagePhotos from "../../models/PagePhotos.js";
import SiteSettings from "../../models/SiteSettings.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

const router = Router();

// The media library: everything already uploaded to Cloudinary, so a photo can
// be picked again anywhere instead of uploaded twice, and each one is labelled
// with where the site uses it (the player's name, the article, the product...).
// Reading needs a content or shop role (the roles that can upload); deleting
// an unused photo to free space is super_admin only.
router.use(requireAuth);

const cloud = () => process.env.CLOUDINARY_CLOUD_NAME;
const authHeader = () =>
  "Basic " + Buffer.from(`${process.env.CLOUDINARY_API_KEY}:${process.env.CLOUDINARY_API_SECRET}`).toString("base64");

// Every (image URL, label) pair the site's own content refers to.
async function usagePairs() {
  const pairs = [];
  const add = (url, label) => {
    if (url) pairs.push({ url: String(url), label });
  };

  const [players, news, products, matches, standings, sponsors, gallery, trophies, history, events, tiers, mContent, pagePhotos, settings] =
    await Promise.all([
      Player.find().select("name role photoUrl extraPhotos").lean(),
      News.find().select("title coverImageUrl heroImageUrl images blocks").lean(),
      Product.find().select("name images").lean(),
      Match.find().select("opponent opponentLogoUrl").lean(),
      Standing.find().select("clubName clubLogoUrl").lean(),
      Sponsor.find().select("name logoUrl").lean(),
      GalleryItem.find().select("caption url").lean(),
      Trophy.find().select("name imageUrl").lean(),
      HistoryMilestone.find().select("title imageUrl").lean(),
      Event.find().select("name imageUrl images").lean(),
      MembershipTier.find().select("name imageUrl").lean(),
      MembershipContent.findOne().select("heroImageUrl gallery").lean(),
      PagePhotos.find().lean(),
      SiteSettings.findOne().select("heroBanners").lean(),
    ]);

  players.forEach((p) => {
    const kind = p.role === "player" ? "Player" : "Staff";
    add(p.photoUrl, `${kind}: ${p.name}`);
    (p.extraPhotos || []).forEach((u) => add(u, `${kind}: ${p.name} (extra photo)`));
  });
  news.forEach((n) => {
    add(n.coverImageUrl, `News cover: ${n.title}`);
    add(n.heroImageUrl, `News hero: ${n.title}`);
    (n.images || []).forEach((u) => add(u, `News photo: ${n.title}`));
    (n.blocks || []).forEach((b) => b.kind === "image" && add(b.url, `News photo: ${n.title}`));
  });
  products.forEach((p) => (p.images || []).forEach((u) => add(u, `Product: ${p.name}`)));
  matches.forEach((m) => add(m.opponentLogoUrl, `Opponent logo: ${m.opponent}`));
  standings.forEach((s) => add(s.clubLogoUrl, `Club logo: ${s.clubName}`));
  sponsors.forEach((s) => add(s.logoUrl, `Sponsor: ${s.name}`));
  gallery.forEach((g) => add(g.url, `Gallery${g.caption ? `: ${g.caption}` : ""}`));
  trophies.forEach((t) => add(t.imageUrl, `Trophy: ${t.name}`));
  history.forEach((h) => add(h.imageUrl, `History: ${h.title}`));
  events.forEach((e) => {
    add(e.imageUrl, `Event: ${e.name}`);
    (e.images || []).forEach((u) => add(u, `Event: ${e.name} (extra photo)`));
  });
  tiers.forEach((t) => add(t.imageUrl, `Membership package: ${t.name}`));
  if (mContent) {
    add(mContent.heroImageUrl, "Membership page banner");
    (mContent.gallery || []).forEach((g) => add(g.url, "Membership page gallery"));
  }
  pagePhotos.forEach((p) => (p.images || []).forEach((u) => add(u, `Page photos: ${p.key}`)));
  (settings?.heroBanners || []).forEach((b) => add(b.imageUrl, "Hero banner"));

  return pairs;
}

const labelsFor = (pairs, publicId) => [...new Set(pairs.filter((p) => p.url.includes(publicId)).map((p) => p.label))];

router.get("/", requireRole("content_editor", "shop_manager", "ticket_manager", "inventory_manager"), async (req, res, next) => {
  try {
    if (!cloud() || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      return res.status(503).json({ error: "Cloudinary is not configured on the server" });
    }
    const params = new URLSearchParams({ max_results: "60", direction: "desc" });
    if (req.query.cursor) params.set("next_cursor", String(req.query.cursor));

    const r = await fetch(`https://api.cloudinary.com/v1_1/${cloud()}/resources/image/upload?${params}`, {
      headers: { Authorization: authHeader() },
    });
    const body = await r.json();
    if (!r.ok) return res.status(502).json({ error: body.error?.message || "Cloudinary did not respond" });

    const pairs = await usagePairs();
    const items = (body.resources || []).map((a) => ({
      publicId: a.public_id,
      url: a.secure_url,
      bytes: a.bytes,
      width: a.width,
      height: a.height,
      format: a.format,
      createdAt: a.created_at,
      folder: a.public_id.includes("/") ? a.public_id.slice(0, a.public_id.lastIndexOf("/")) : "",
      usedBy: labelsFor(pairs, a.public_id),
    }));

    res.json({ items, nextCursor: body.next_cursor || null });
  } catch (err) {
    next(err);
  }
});

// Permanently removes a photo from Cloudinary to free space. Refuses if the
// site still uses it, and only a super_admin can do it.
router.post("/delete", requireRole("super_admin"), async (req, res, next) => {
  try {
    const { publicId } = req.body;
    if (!publicId || typeof publicId !== "string") return res.status(400).json({ error: "publicId is required" });

    const used = labelsFor(await usagePairs(), publicId);
    if (used.length > 0) {
      return res.status(409).json({ error: `Still in use by: ${used.join(", ")}. Replace it there first.` });
    }

    const params = new URLSearchParams();
    params.append("public_ids[]", publicId);
    const r = await fetch(`https://api.cloudinary.com/v1_1/${cloud()}/resources/image/upload?${params}`, {
      method: "DELETE",
      headers: { Authorization: authHeader() },
    });
    const body = await r.json();
    if (!r.ok) return res.status(502).json({ error: body.error?.message || "Cloudinary could not delete it" });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
