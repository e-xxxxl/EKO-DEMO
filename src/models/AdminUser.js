import mongoose from "mongoose";
import bcrypt from "bcryptjs";

// Roles map directly to the admin sections in the signed scope
// (docs/invoice-scope.md), so access is scoped to what each staff
// member actually needs — a blog/content person should never be able
// to touch ticket sales or shop payouts.
const ROLES = [
  "super_admin", // full access to every admin section, incl. managing other admin users
  "content_editor", // news, fixtures/results, players, coaches, gallery, sponsors, pages
  "ticket_manager", // create matches for sale, ticket categories/prices, view sales, validate QR
  "shop_manager", // products, inventory, orders
];

const adminUserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ROLES, required: true, default: "content_editor" },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

adminUserSchema.methods.checkPassword = function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

adminUserSchema.statics.ROLES = ROLES;

export default mongoose.model("AdminUser", adminUserSchema);
