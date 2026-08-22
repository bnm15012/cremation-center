/**
 * Seed script: creates an initial admin user.
 * Usage: bun run scripts/seed.ts
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";

const host = process.env.MYSQL_HOST ?? "127.0.0.1";
const port = process.env.MYSQL_PORT ? parseInt(process.env.MYSQL_PORT) : 3306;
const database = process.env.MYSQL_DATABASE ?? "cremation_centre";
const user = process.env.MYSQL_USER ?? "root";
const password = process.env.MYSQL_PASSWORD ?? "";
const isTiDB = host.includes("tidbcloud.com");

// Seed credentials — change after first login
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@cremation.local";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "Admin@123";
const ADMIN_NAME = "Administrator";

async function main() {
  const connection = await mysql.createConnection({
    host,
    port,
    database,
    user,
    password,
    ...(isTiDB && { ssl: { rejectUnauthorized: true } }),
  });

  const db = drizzle(connection);
  const { users } = await import("../src/lib/db/schema.ts");
  const { eq } = await import("drizzle-orm");

  // Check if admin already exists
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, ADMIN_EMAIL))
    .limit(1);

  if (existing) {
    console.log(`Admin user already exists: ${ADMIN_EMAIL}`);
    await connection.end();
    return;
  }

  const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const now = new Date();

  await db.insert(users).values({
    email: ADMIN_EMAIL,
    password_hash: hash,
    full_name: ADMIN_NAME,
    role: "admin",
    is_active: true,
    created_at: now,
    updated_at: now,
  });

  console.log("-------------------------------------------");
  console.log("Admin user created:");
  console.log(`  Email:    ${ADMIN_EMAIL}`);
  console.log(`  Password: ${ADMIN_PASSWORD}`);
  console.log("  Please change the password after first login!");
  console.log("-------------------------------------------");

  await connection.end();
}

main().catch((e) => {
  console.error("Seed failed:", e.message);
  process.exit(1);
});
