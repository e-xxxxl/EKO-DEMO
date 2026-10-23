import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import mongoSanitize from "express-mongo-sanitize";
import { publicLimiter } from "./middleware/rateLimiters.js";
import { connectDB } from "./config/db.js";

import playerRoutes from "./routes/players.js";
import matchRoutes from "./routes/matches.js";
import newsRoutes from "./routes/news.js";
import galleryRoutes from "./routes/gallery.js";
import sponsorRoutes from "./routes/sponsors.js";
import settingsRoutes from "./routes/settings.js";
import standingsRoutes from "./routes/standings.js";
import trophyRoutes from "./routes/trophies.js";
import videoRoutes from "./routes/videos.js";
import membershipRoutes from "./routes/membership.js";
import historyRoutes from "./routes/history.js";
import contactRoutes from "./routes/contact.js";
import adminAuthRoutes from "./routes/adminAuth.js";
import adminPlayerRoutes from "./routes/admin/players.js";
import adminMatchRoutes from "./routes/admin/matches.js";
import adminNewsRoutes from "./routes/admin/news.js";
import adminGalleryRoutes from "./routes/admin/gallery.js";
import adminSponsorRoutes from "./routes/admin/sponsors.js";
import adminStandingRoutes from "./routes/admin/standings.js";
import adminSettingsRoutes from "./routes/admin/settings.js";
import adminTrophyRoutes from "./routes/admin/trophies.js";
import adminVideoRoutes from "./routes/admin/videos.js";
import adminMembershipRoutes from "./routes/admin/membership.js";
import adminHistoryRoutes from "./routes/admin/history.js";
import adminContactRoutes from "./routes/admin/contact.js";
import adminUploadRoutes from "./routes/adminUpload.js";
import productRoutes from "./routes/products.js";
import ticketTypeRoutes from "./routes/ticketTypes.js";
import checkoutRoutes from "./routes/checkout.js";
import webhookRoutes from "./routes/webhooks.js";
import adminProductRoutes from "./routes/admin/products.js";
import adminTicketTypeRoutes from "./routes/admin/ticketTypes.js";
import adminOrderRoutes from "./routes/admin/orders.js";
import adminUserRoutes from "./routes/admin/adminUsers.js";
import mediaAccreditationRoutes from "./routes/mediaAccreditation.js";
import adminTicketRoutes from "./routes/admin/tickets.js";
import adminAnalyticsRoutes from "./routes/admin/analytics.js";

const app = express();

// Trust the Nginx reverse proxy in front of this app on the VPS
app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: process.env.NODE_ENV === "production" ? undefined : false,
  })
);

// Lock CORS to the actual frontend origin — never use "*" once this is live
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);

// The `verify` hook captures the raw request bytes onto req.rawBody before
// JSON-parsing them — Paystack's webhook signature is an HMAC over the exact
// raw body, which the parsed object can't reproduce (key order, whitespace).
app.use(
  express.json({
    limit: "1mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(mongoSanitize());
app.use(morgan("combined"));
app.use(publicLimiter);

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/players", playerRoutes);
app.use("/api/matches", matchRoutes);
app.use("/api/news", newsRoutes);
app.use("/api/gallery", galleryRoutes);
app.use("/api/sponsors", sponsorRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/standings", standingsRoutes);
app.use("/api/trophies", trophyRoutes);
app.use("/api/videos", videoRoutes);
app.use("/api/membership", membershipRoutes);
app.use("/api/history", historyRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/products", productRoutes);
app.use("/api/ticket-types", ticketTypeRoutes);
app.use("/api/checkout", checkoutRoutes);
app.use("/api/webhooks", webhookRoutes);
app.use("/api/media-accreditation", mediaAccreditationRoutes);

// Admin — all behind requireAuth + requireRole (see middleware/auth.js).
// adminAuthRoutes itself is public (it's the login endpoint).
app.use("/api/admin/auth", adminAuthRoutes);
app.use("/api/admin/players", adminPlayerRoutes);
app.use("/api/admin/matches", adminMatchRoutes);
app.use("/api/admin/news", adminNewsRoutes);
app.use("/api/admin/gallery", adminGalleryRoutes);
app.use("/api/admin/sponsors", adminSponsorRoutes);
app.use("/api/admin/standings", adminStandingRoutes);
app.use("/api/admin/settings", adminSettingsRoutes);
app.use("/api/admin/trophies", adminTrophyRoutes);
app.use("/api/admin/videos", adminVideoRoutes);
app.use("/api/admin/membership", adminMembershipRoutes);
app.use("/api/admin/history", adminHistoryRoutes);
app.use("/api/admin/contact", adminContactRoutes);
app.use("/api/admin/upload", adminUploadRoutes);
app.use("/api/admin/products", adminProductRoutes);
app.use("/api/admin/ticket-types", adminTicketTypeRoutes);
app.use("/api/admin/orders", adminOrderRoutes);
app.use("/api/admin/users", adminUserRoutes);
app.use("/api/admin/tickets", adminTicketRoutes);
app.use("/api/admin/analytics", adminAnalyticsRoutes);

// Central error handler — never leak stack traces in production
app.use((err, _req, res, _next) => {
  console.error(err);

  // A malformed id (e.g. a stale/demo id reaching a real MongoDB query, or
  // a Mongoose schema validation failure) is a client mistake, not a server
  // fault — respond 400 with a clean message instead of a raw 500. Without
  // this, any route touching `findById`/`findOne({_id})` with a bad id
  // crashes the same way routes/checkout.js's Product lookup did.
  if (err.name === "CastError") {
    return res.status(400).json({ error: "Invalid id" });
  }
  if (err.name === "ValidationError") {
    return res.status(400).json({ error: err.message });
  }

  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === "production" ? "Something went wrong" : err.message,
  });
});

const PORT = process.env.PORT || 4000;

connectDB()
  .then(() => {
    app.listen(PORT, () => console.log(`API running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB, exiting:", err);
    process.exit(1);
  });
