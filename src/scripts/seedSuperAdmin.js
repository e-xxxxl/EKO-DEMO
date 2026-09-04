import "dotenv/config";
import bcrypt from "bcryptjs";
import { connectDB } from "../config/db.js";
import AdminUser from "../models/AdminUser.js";
import mongoose from "mongoose";

// Usage: node src/scripts/seedSuperAdmin.js "Name" "email@example.com" "password"
const [, , name, email, password] = process.argv;

if (!name || !email || !password) {
  console.error('Usage: node src/scripts/seedSuperAdmin.js "Name" "email@example.com" "password"');
  process.exit(1);
}

await connectDB();

const existing = await AdminUser.findOne({ email: email.toLowerCase() });
if (existing) {
  console.error("An admin user with that email already exists.");
  process.exit(1);
}

const passwordHash = await bcrypt.hash(password, 12);
await AdminUser.create({ name, email, passwordHash, role: "super_admin" });

console.log(`Super admin created: ${email}`);
await mongoose.disconnect();
process.exit(0);
