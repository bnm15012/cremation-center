import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import mysql from "mysql2/promise";

const host = process.env.MYSQL_HOST ?? "127.0.0.1";
const port = process.env.MYSQL_PORT ? parseInt(process.env.MYSQL_PORT) : 3306;
const database = process.env.MYSQL_DATABASE ?? "cremation_centre";
const user = process.env.MYSQL_USER ?? "root";
const password = process.env.MYSQL_PASSWORD ?? "";
const isTiDB = host.includes("tidbcloud.com");

async function main() {
  console.log("Connecting to database...");
  const connection = await mysql.createConnection({
    host,
    port,
    database,
    user,
    password,
    ...(isTiDB && { ssl: { rejectUnauthorized: true } }),
  });

  const db = drizzle(connection);

  console.log("Running migrations...");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations complete!");

  await connection.end();
}

main().catch((e) => {
  console.error("Migration failed:", e.message);
  process.exit(1);
});
