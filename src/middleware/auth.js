import jwt from "jsonwebtoken";
import AdminUser from "../models/AdminUser.js";

// Checks the signed token, then looks the account up so that what the super admin
// changes takes effect straight away: a deactivated account is locked out on its
// very next request (not when the 8 hour token runs out), and a changed role or
// name applies at once. `req.admin` always carries the current details.
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid authorization header" });
  }
  let claims;
  try {
    claims = jwt.verify(header.split(" ")[1], process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  try {
    const user = await AdminUser.findById(claims.sub).select("name email role isActive").lean();
    if (!user || !user.isActive) {
      return res.status(401).json({ error: "This account is no longer active" });
    }
    req.admin = { sub: String(user._id), name: user.name, email: user.email, role: user.role };
    next();
  } catch (err) {
    next(err);
  }
}

// Usage: router.post("/", requireAuth, requireRole("super_admin", "content_editor"), handler)
// super_admin is always allowed through, everyone else must be explicitly listed.
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.admin) return res.status(401).json({ error: "Not authenticated" });
    if (req.admin.role === "super_admin" || allowedRoles.includes(req.admin.role)) {
      return next();
    }
    res.status(403).json({ error: "You don't have access to this section" });
  };
}
