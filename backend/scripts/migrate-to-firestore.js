import "dotenv/config";
import pg from "pg";
import { getFirestoreDb } from "../firebase.js";

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for a one-time migration.");
if (!process.env.FIREBASE_SERVICE_ACCOUNT) throw new Error("FIREBASE_SERVICE_ACCOUNT is required.");
const pool = new Pool({
  connectionString: databaseUrl,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined,
  max: 2,
  connectionTimeoutMillis: 10000
});
const db = getFirestoreDb();
const dryRun = process.env.FIREBASE_MIGRATION_DRY_RUN !== "false";
const pageSize = 300;
let migrated = 0;

async function migrateRows({ table, collection, id, map = row => row }) {
  let offset = 0;
  for (;;) {
    const result = await pool.query(`SELECT * FROM ${table} ORDER BY ${id} LIMIT $1 OFFSET $2`, [pageSize, offset]);
    if (!result.rows.length) break;
    if (!dryRun) {
      const batch = db.batch();
      for (const row of result.rows) {
        const documentId = String(id.split(",").map(k => row[k]).join("_"));
        batch.set(db.collection(collection).doc(documentId), map(row), { merge: false });
      }
      await batch.commit();
    }
    migrated += result.rows.length;
    console.log(`${dryRun ? "DRY RUN" : "MIGRATED"} ${collection}: ${result.rows.length} rows (offset ${offset})`);
    offset += result.rows.length;
  }
}

try {
  await pool.query("SELECT 1");
  await db.collection("_fit_system").doc("migration_metadata").get();
  console.log("FIT PostgreSQL → Firestore migration");
  console.log("Mode:", dryRun ? "DRY RUN (no writes)" : "LIVE WRITE");
  console.log("Destination project:", process.env.FIREBASE_PROJECT_ID || "service-account project");
  // Preserve existing numeric user IDs as document IDs so references remain stable.
  await migrateRows({ table: "users", collection: "users", id: "id", map: r => ({
    legacyId: String(r.id), name: r.name, email: r.email,
    passwordHash: r.password_hash, createdAt: r.created_at
  }) });
  await migrateRows({ table: "user_data", collection: "userData", id: "user_id", map: r => ({
    userId: String(r.user_id), data: r.data || {}, updatedAt: r.updated_at
  }) });
  await migrateRows({ table: "payment_requests", collection: "paymentRequests", id: "id", map: r => ({
    legacyId: String(r.id), userId: String(r.user_id), planCode: r.plan_code,
    amountPaise: r.amount_paise, utr: r.utr, status: r.status,
    createdAt: r.created_at, reviewedAt: r.reviewed_at || null
  }) });
  await migrateRows({ table: "memberships", collection: "memberships", id: "user_id", map: r => ({
    userId: String(r.user_id), planCode: r.plan_code, startsAt: r.starts_at,
    expiresAt: r.expires_at, paymentRequestId: r.payment_request_id ? String(r.payment_request_id) : null,
    updatedAt: r.updated_at
  }) });
  await migrateRows({ table: "activity_days", collection: "activityDays", id: "user_id,activity_date", map: r => ({
    userId: String(r.user_id), activityDate: String(r.activity_date).slice(0, 10),
    steps: r.steps, stepGoal: r.step_goal, workouts: r.workouts,
    leaderboardOptIn: r.leaderboard_opt_in, updatedAt: r.updated_at
  }) });
  await migrateRows({ table: "activity_notifications", collection: "activityNotifications", id: "id", map: r => ({
    legacyId: String(r.id), userId: String(r.user_id), kind: r.kind,
    title: r.title, body: r.body, createdAt: r.created_at, readAt: r.read_at || null
  }) });
  if (!dryRun) {
    await db.collection("_fit_system").doc("migration_metadata").set({
      completedAt: new Date().toISOString(), migratedRows: migrated,
      source: "postgresql", mode: "initial-copy"
    }, { merge: true });
  }
  console.log(`Total rows ${dryRun ? "checked" : "written"}: ${migrated}`);
  if (dryRun) console.log("Review the counts, then set FIREBASE_MIGRATION_DRY_RUN=false to write.");
} finally {
  await pool.end();
}
