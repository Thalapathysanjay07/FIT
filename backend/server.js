import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pg from "pg";

const { Pool } = pg;
const app = express();
const port = process.env.PORT || 5000;
const pool = process.env.DATABASE_URL ? new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
}) : null;

app.use(helmet());
app.use(cors({ origin: (process.env.CLIENT_ORIGIN || "").split(",").filter(Boolean), credentials: false }));
app.use(express.json({ limit: "256kb" }));
app.use("/api/auth", rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false }));
app.use("/api/coach", rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false }));
app.use("/api/payments", rateLimit({ windowMs: 60 * 60 * 1000, limit: 8, standardHeaders: true, legacyHeaders: false }));

async function ready(req,res,next) {
  if (!pool) return res.status(503).json({ error: "Database is not configured. Set DATABASE_URL." });
  try { await pool.query("SELECT 1"); next(); } catch { res.status(503).json({ error: "Database is unavailable." }); }
}
async function init() {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      name VARCHAR(80) NOT NULL,
      email VARCHAR(254) NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS user_data (
      user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS payment_requests (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      plan_code VARCHAR(30) NOT NULL,
      amount_paise INTEGER NOT NULL,
      utr VARCHAR(80) NOT NULL UNIQUE,
      status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      reviewed_at TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS memberships (
      user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      plan_code VARCHAR(30) NOT NULL,
      starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      payment_request_id BIGINT REFERENCES payment_requests(id),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}
function tokenFor(user) {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error("JWT_SECRET must contain at least 32 characters.");
  return jwt.sign({ sub: String(user.id), email: user.email }, process.env.JWT_SECRET, { expiresIn: "7d", issuer: "fit-api", audience: "fit-app" });
}
function auth(req,res,next) {
  const value = req.headers.authorization || "";
  if (!value.startsWith("Bearer ")) return res.status(401).json({ error: "Please sign in." });
  try {
    req.user = jwt.verify(value.slice(7), process.env.JWT_SECRET, { issuer: "fit-api", audience: "fit-app" });
    next();
  } catch { return res.status(401).json({ error: "Session expired. Please sign in again." }); }
}

app.get("/api/health", async (_req,res) => {
  if (!pool) return res.status(503).json({ status: "needs_database" });
  try { await pool.query("SELECT 1"); res.json({ status: "ok" }); }
  catch { res.status(503).json({ status: "database_unavailable" }); }
});
app.post("/api/auth/register", ready, async (req,res) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    if (name.length < 2 || name.length > 80) return res.status(400).json({ error: "Enter a name between 2 and 80 characters." });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return res.status(400).json({ error: "Enter a valid email address." });
    if (password.length < 10 || password.length > 72) return res.status(400).json({ error: "Password must be 10–72 characters." });
    const hash = await bcrypt.hash(password, 12);
    const result = await pool.query("INSERT INTO users(name,email,password_hash) VALUES($1,$2,$3) RETURNING id,name,email", [name,email,hash]);
    const user = result.rows[0];
    await pool.query("INSERT INTO user_data(user_id,data) VALUES($1,'{}'::jsonb)", [user.id]);
    res.status(201).json({ token: tokenFor(user), user });
  } catch (error) {
    if (error.code === "23505") return res.status(409).json({ error: "An account with this email already exists." });
    console.error("Register error:", error.message); res.status(500).json({ error: "Could not create account." });
  }
});
app.post("/api/auth/login", ready, async (req,res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const result = await pool.query("SELECT id,name,email,password_hash FROM users WHERE email=$1", [email]);
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password,user.password_hash))) return res.status(401).json({ error: "Email or password is incorrect." });
    res.json({ token: tokenFor(user), user: { id:user.id,name:user.name,email:user.email } });
  } catch (error) { console.error("Login error:",error.message); res.status(500).json({ error: "Could not sign in." }); }
});
app.get("/api/auth/me", ready, auth, async (req,res) => {
  const r = await pool.query("SELECT id,name,email FROM users WHERE id=$1", [req.user.sub]);
  if (!r.rows[0]) return res.status(401).json({ error: "Account not found." });
  res.json({ user:r.rows[0] });
});
app.delete("/api/account", ready, auth, async (req,res) => {
  const password = String(req.body?.password || "");
  if (!password || password.length > 72) return res.status(400).json({ error:"Enter your current password to confirm account deletion." });
  try {
    const found = await pool.query("SELECT password_hash FROM users WHERE id=$1",[req.user.sub]);
    if (!found.rows[0] || !(await bcrypt.compare(password,found.rows[0].password_hash))) {
      return res.status(401).json({ error:"Password is incorrect. Your account was not deleted." });
    }
    await pool.query("DELETE FROM users WHERE id=$1",[req.user.sub]);
    res.json({ deleted:true });
  } catch(error) {
    console.error("Account deletion error:",error.message);
    res.status(500).json({ error:"Could not delete the account. Please try again." });
  }
});
app.post("/api/coach", ready, auth, async (req,res) => {
  const question = String(req.body?.question || "").trim();
  if (question.length < 2 || question.length > 1200) {
    return res.status(400).json({ error: "Ask a question between 2 and 1,200 characters." });
  }
  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: "FIT Coach AI is not configured yet. Add OPENAI_API_KEY to the backend environment to enable it." });
  }
  const baseUrl = (process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.AI_MODEL || "gpt-4o-mini";
  try {
    const response = await fetch(baseUrl + "/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + process.env.OPENAI_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        max_tokens: 500,
        messages: [
          { role: "system", content: "You are FIT Coach, a supportive fitness, food-planning and wellness education assistant. Use the FIT profile and recent logs included in the user message (goal, experience, height, weight, diet preference, food log, calories, protein, water and steps) to personalize answers. Help create practical Indian-food meal plans, simple recipes, portion suggestions, approximate calorie/protein estimates, grocery lists, affordable food swaps, workout guidance and habit coaching. Clearly label nutrition estimates as approximate and never invent verified food database values. Ask only for essential missing context. Be concise, practical and non-judgmental. Do not diagnose, prescribe treatment, recommend extreme diets, guarantee results, or provide dangerous exercise instructions. For injuries, pregnancy, chronic conditions, eating disorders, or concerning symptoms, advise the user to consult a qualified healthcare professional. Never claim to be a doctor or certified personal trainer. Distinguish general information from individualized medical advice." },
          { role: "user", content: question }
        ]
      }),
      signal: AbortSignal.timeout(20000)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("FIT Coach provider error:", response.status, payload?.error?.message || "Request failed");
      return res.status(502).json({ error: "FIT Coach is temporarily unavailable. Please try again shortly." });
    }
    const answer = payload?.choices?.[0]?.message?.content;
    if (typeof answer !== "string" || !answer.trim()) {
      return res.status(502).json({ error: "FIT Coach returned an empty response. Please try again." });
    }
    res.json({ answer: answer.trim(), model });
  } catch (error) {
    console.error("FIT Coach request failed:", error.name || "Error");
    res.status(504).json({ error: "FIT Coach timed out. Please try again." });
  }
});
// Manual UPI/QR membership payments. No payment gateway or automatic payment claim.
const membershipPlans = {
  monthly: { name: "FIT Pro Monthly", amountPaise: 19900, days: 30 },
  yearly: { name: "FIT Pro Yearly", amountPaise: 149900, days: 365 }
};
app.get("/api/membership/config", ready, async (_req,res) => {
  res.json({
    upiId: process.env.FIT_UPI_ID || "",
    merchantName: process.env.FIT_MERCHANT_NAME || "FIT",
    plans: Object.entries(membershipPlans).map(([code,p]) => ({ code, name:p.name, amount:p.amountPaise/100, days:p.days }))
  });
});
app.get("/api/membership/me", ready, auth, async (req,res) => {
  const result = await pool.query(
    "SELECT plan_code, starts_at, expires_at FROM memberships WHERE user_id=$1 AND expires_at>NOW()",
    [req.user.sub]
  );
  const payments = await pool.query(
    "SELECT id,plan_code,amount_paise,utr,status,created_at FROM payment_requests WHERE user_id=$1 ORDER BY created_at DESC LIMIT 5",
    [req.user.sub]
  );
  res.json({ membership: result.rows[0] || null, payments: payments.rows });
});
app.post("/api/payments/upi-request", ready, auth, async (req,res) => {
  const planCode = String(req.body?.planCode || "");
  const utr = String(req.body?.utr || "").trim().replace(/\s/g,"");
  const plan = membershipPlans[planCode];
  if (!plan) return res.status(400).json({ error:"Choose a valid membership plan." });
  if (!/^[A-Za-z0-9-]{8,80}$/.test(utr)) return res.status(400).json({ error:"Enter a valid UPI transaction reference/UTR (8–80 letters or numbers)." });
  if (!process.env.FIT_UPI_ID) return res.status(503).json({ error:"UPI payments are not configured yet. The app owner must add FIT_UPI_ID to the backend environment." });
  try {
    const result = await pool.query(
      "INSERT INTO payment_requests(user_id,plan_code,amount_paise,utr) VALUES($1,$2,$3,$4) RETURNING id,plan_code,amount_paise,utr,status,created_at",
      [req.user.sub,planCode,plan.amountPaise,utr]
    );
    res.status(201).json({ payment: result.rows[0], message:"Payment reference submitted. FIT Pro will activate only after manual verification." });
  } catch(error) {
    if (error.code === "23505") return res.status(409).json({ error:"This UTR has already been submitted." });
    console.error("UPI request error:",error.message);
    res.status(500).json({ error:"Could not submit payment reference." });
  }
});
app.post("/api/admin/payments/:id/review", ready, async (req,res) => {
  const supplied = String(req.headers["x-fit-admin-key"] || "");
  if (!process.env.FIT_ADMIN_KEY || supplied.length < 24 || supplied !== process.env.FIT_ADMIN_KEY) {
    return res.status(401).json({ error:"Admin authorization required." });
  }
  const id = Number(req.params.id);
  const decision = String(req.body?.decision || "");
  if (!Number.isSafeInteger(id) || id < 1 || !["approve","reject"].includes(decision)) {
    return res.status(400).json({ error:"Invalid payment review request." });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const found = await client.query("SELECT * FROM payment_requests WHERE id=$1 FOR UPDATE",[id]);
    const payment = found.rows[0];
    if (!payment) { await client.query("ROLLBACK"); return res.status(404).json({error:"Payment request not found."}); }
    if (payment.status !== "pending") { await client.query("ROLLBACK"); return res.status(409).json({error:"Payment request has already been reviewed."}); }
    const status = decision === "approve" ? "approved" : "rejected";
    await client.query("UPDATE payment_requests SET status=$1,reviewed_at=NOW() WHERE id=$2",[status,id]);
    if (decision === "approve") {
      const days = membershipPlans[payment.plan_code]?.days;
      if (!days) throw new Error("Unknown membership plan.");
      await client.query(`INSERT INTO memberships(user_id,plan_code,starts_at,expires_at,payment_request_id)
        VALUES($1,$2,NOW(),NOW()+($3 * INTERVAL '1 day'),$4)
        ON CONFLICT(user_id) DO UPDATE SET plan_code=EXCLUDED.plan_code,
        starts_at=NOW(),expires_at=NOW()+($3 * INTERVAL '1 day'),
        payment_request_id=EXCLUDED.payment_request_id,updated_at=NOW()`,
        [payment.user_id,payment.plan_code,days,id]);
    }
    await client.query("COMMIT");
    res.json({success:true,status});
  } catch(error) {
    await client.query("ROLLBACK");
    console.error("Payment review error:",error.message);
    res.status(500).json({error:"Could not review payment."});
  } finally { client.release(); }
});
app.get("/api/data", ready, auth, async (req,res) => {
  const r = await pool.query("SELECT data FROM user_data WHERE user_id=$1", [req.user.sub]);
  res.json({ data:r.rows[0]?.data || {} });
});
app.put("/api/data", ready, auth, async (req,res) => {
  const data = req.body?.data;
  if (!data || typeof data !== "object" || Array.isArray(data) || JSON.stringify(data).length > 200000) return res.status(400).json({ error: "Invalid fitness data." });
  const allowed = Object.fromEntries(Object.entries(data).filter(([key]) => /^fit-[a-z0-9-]{1,60}$/.test(key)));
  await pool.query(`INSERT INTO user_data(user_id,data,updated_at) VALUES($1,$2::jsonb,NOW())
    ON CONFLICT(user_id) DO UPDATE SET data=EXCLUDED.data,updated_at=NOW()`, [req.user.sub,JSON.stringify(allowed)]);
  res.json({ saved:true });
});
app.use((_req,res)=>res.status(404).json({error:"Not found"}));
init().then(()=>app.listen(port,()=>console.log(`FIT API listening on ${port}`))).catch(error=>{console.error("Database initialization failed:",error.message);process.exit(1);});
