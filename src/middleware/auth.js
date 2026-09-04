import jwt from "jsonwebtoken";

export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid authorization header" });
  }
  try {
    const token = header.split(" ")[1];
    req.admin = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
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
