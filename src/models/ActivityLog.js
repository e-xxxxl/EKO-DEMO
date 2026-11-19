import mongoose from "mongoose";

// One row per thing a staff member did in the admin panel (every create, edit,
// delete and special action, plus sign-ins). Written by middleware/activityLog.js
// and shown to super admins on /admin/activity, so there is a record of who did
// what and when. Rows describe the action in plain words; they never hold
// passwords, tokens or whole documents.
const activityLogSchema = new mongoose.Schema(
  {
    // Who. The name, email and role are copied in at the time so the record still
    // reads correctly if the account is later renamed or removed.
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser", index: true },
    adminName: { type: String, trim: true },
    adminEmail: { type: String, trim: true },
    adminRole: { type: String, trim: true },

    // What.
    action: {
      type: String,
      enum: ["login", "login_failed", "create", "update", "delete", "upload", "action"],
      required: true,
      index: true,
    },
    section: { type: String, trim: true, index: true }, // "Players & Staff", "News"...
    summary: { type: String, trim: true, maxlength: 300 }, // 'Edited player "Taiwo"'
    targetId: { type: String, trim: true },
    fields: [{ type: String, maxlength: 60 }], // names of the fields that were sent, never their values

    // How.
    method: { type: String, trim: true },
    path: { type: String, trim: true, maxlength: 300 },
    ip: { type: String, trim: true, maxlength: 80 },
    userAgent: { type: String, trim: true, maxlength: 200 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

activityLogSchema.index({ createdAt: -1 });
// Keep two years of history, then let the database tidy up on its own.
activityLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 730 });

export default mongoose.model("ActivityLog", activityLogSchema);
