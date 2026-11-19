import ActivityLog from "../models/ActivityLog.js";
import Player from "../models/Player.js";
import Match from "../models/Match.js";
import News from "../models/News.js";
import GalleryItem from "../models/GalleryItem.js";
import Sponsor from "../models/Sponsor.js";
import Standing from "../models/Standing.js";
import Trophy from "../models/Trophy.js";
import Video from "../models/Video.js";
import Event from "../models/Event.js";
import HistoryMilestone from "../models/HistoryMilestone.js";
import Product from "../models/Product.js";
import TicketType from "../models/TicketType.js";
import ReferralCode from "../models/ReferralCode.js";
import MembershipTier from "../models/MembershipTier.js";
import AdminUser from "../models/AdminUser.js";

// The first part of an /api/admin/<section>/... path, as a heading and a noun
// ("Deleted fixture ..."), plus the model and field that give a record its name.
const SECTIONS = {
  players: { title: "Players & Staff", noun: "profile", model: Player, field: "name" },
  matches: { title: "Fixtures & Results", noun: "fixture", model: Match, field: "opponent" },
  news: { title: "News", noun: "article", model: News, field: "title" },
  gallery: { title: "Gallery", noun: "gallery item", model: GalleryItem, field: "caption" },
  sponsors: { title: "Sponsors", noun: "sponsor", model: Sponsor, field: "name" },
  standings: { title: "League Table", noun: "club row", model: Standing, field: "clubName" },
  settings: { title: "Settings", noun: "site settings" },
  trophies: { title: "Trophies", noun: "trophy", model: Trophy, field: "name" },
  videos: { title: "Videos", noun: "video", model: Video, field: "title" },
  events: { title: "Events & CSR", noun: "event", model: Event, field: "name" },
  "page-photos": { title: "Page photos", noun: "page photos" },
  enquiries: { title: "Enquiries", noun: "enquiry" },
  media: { title: "Photo library", noun: "photo" },
  membership: { title: "Memberships", noun: "membership item" },
  history: { title: "History", noun: "milestone", model: HistoryMilestone, field: "title" },
  contact: { title: "Messages", noun: "message" },
  upload: { title: "Photo uploads", noun: "photo" },
  products: { title: "Shop products", noun: "product", model: Product, field: "name" },
  "ticket-types": { title: "Ticket types", noun: "ticket type", model: TicketType, field: "name" },
  orders: { title: "Shop orders", noun: "order" },
  referrals: { title: "Referral codes", noun: "referral code", model: ReferralCode, field: "code" },
  users: { title: "Staff accounts", noun: "staff account", model: AdminUser, field: "name" },
  tickets: { title: "Ticketing", noun: "ticket" },
};

// Fields that are never recorded, not even by name.
const HIDDEN_FIELDS = new Set(["password", "passwordHash", "token", "secret", "signature"]);

const isId = (s) => /^[a-f0-9]{24}$/i.test(s);
const quote = (s) => (s ? ` "${String(s).slice(0, 80)}"` : "");

// Works out what a request did, in words, before the route runs (so a record that
// is about to be deleted can still be named).
async function lookupName(section, id) {
  const info = SECTIONS[section];
  if (!info?.model || !id) return "";
  try {
    const doc = await info.model.findById(id).select(info.field).lean();
    return doc?.[info.field] ? String(doc[info.field]) : "";
  } catch {
    return "";
  }
}

function describe({ method, section, rest, id, name, body }) {
  const info = SECTIONS[section] || { title: section, noun: "item" };
  const sub = rest.filter((s) => !isId(s));
  const given = name || body?.name || body?.title || body?.opponent || body?.clubName || body?.caption || body?.code || "";
  const target = quote(given);
  const common = { section: info.title };

  // Special actions that are not a plain create, edit or delete.
  if (section === "upload") return { ...common, action: "upload", summary: `Uploaded a photo${body?.folder ? ` (${String(body.folder).replace(/^eko-united-fc\/?/, "") || "general"})` : ""}` };
  if (section === "media" && sub[0] === "delete") return { ...common, action: "delete", summary: `Deleted a photo from the library`, targetId: body?.publicId };
  if (section === "users" && sub[0] === "password") return { ...common, action: "action", summary: `Reset the password of staff account${target}` };
  if (section === "orders" && sub[0] === "mark-paid") return { ...common, action: "action", summary: `Marked a shop order as paid` };
  if (section === "orders" && sub[0] === "resend-confirmation") return { ...common, action: "action", summary: `Re-sent an order confirmation email` };
  if (section === "tickets" && sub[0] === "validate") return { ...common, action: "action", summary: `Checked a ticket in at the gate` };
  if (section === "tickets" && sub[0] === "undo") return { ...common, action: "action", summary: `Undid a ticket check-in` };
  if (section === "standings" && method === "PUT" && !id) return { ...common, action: "update", summary: `Saved the league table${Array.isArray(body?.rows) ? ` (${body.rows.length} clubs)` : ""}` };
  if (section === "membership" && sub[0] === "content") return { ...common, action: "update", summary: `Edited the membership page content` };
  if (section === "membership" && sub[0] === "tiers") {
    const verb = method === "DELETE" ? "Deleted" : method === "POST" ? "Created" : "Edited";
    return { ...common, action: method === "DELETE" ? "delete" : method === "POST" ? "create" : "update", summary: `${verb} a membership package${target}` };
  }
  if (section === "page-photos") return { ...common, action: "update", summary: `Changed the photos on the ${sub[0] || ""} page`.replace("  ", " ") };
  if (section === "settings") return { ...common, action: "update", summary: `Changed the site settings` };

  if (method === "DELETE") return { ...common, action: "delete", summary: `Deleted ${info.noun}${target}` };
  if (method === "POST") return { ...common, action: "create", summary: `Added ${info.noun}${target}` };
  return { ...common, action: "update", summary: `Edited ${info.noun}${target}` };
}

// Mount once, ahead of the admin routes: app.use("/api/admin", activityLogger).
// It watches every request that changes something (never a plain read) and, once
// the response has gone out successfully, writes the record. A failed save of the
// log is reported to the console and never blocks or fails the staff member's action.
export function activityLogger(req, res, next) {
  const method = req.method;
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return next();

  const parts = req.originalUrl.split("?")[0].replace(/^\/api\/admin\/?/, "").split("/").filter(Boolean);
  const section = parts[0];
  const rest = parts.slice(1);
  // Sign-ins are recorded by the login route itself, and a ticket lookup only reads.
  if (!section || section === "auth" || (section === "tickets" && rest[0] === "lookup")) return next();

  const id = rest.find(isId);
  const pending = method === "DELETE" || method === "PUT" || method === "PATCH" ? lookupName(section, id) : Promise.resolve("");

  res.on("finish", () => {
    if (res.statusCode >= 400 || !req.admin) return;
    pending
      .then((name) => {
        const body = req.body && typeof req.body === "object" ? req.body : {};
        const what = describe({ method, section, rest, id, name, body });
        const fields = Object.keys(body)
          .filter((k) => !HIDDEN_FIELDS.has(k))
          .slice(0, 25);
        return ActivityLog.create({
          adminId: req.admin.sub,
          adminName: req.admin.name,
          adminEmail: req.admin.email,
          adminRole: req.admin.role,
          ...what,
          targetId: what.targetId || id,
          fields: method === "DELETE" ? [] : fields,
          method,
          path: req.originalUrl.split("?")[0],
          ip: req.ip,
          userAgent: String(req.headers["user-agent"] || "").slice(0, 200),
        });
      })
      .catch((err) => console.error("Could not write activity log:", err.message));
  });

  next();
}

// For events the middleware above cannot see, such as sign-ins.
export async function recordActivity(entry) {
  try {
    await ActivityLog.create(entry);
  } catch (err) {
    console.error("Could not write activity log:", err.message);
  }
}
