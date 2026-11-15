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
app.post("/api/coach", ready, auth, async (req,res) => {
  const question = String(req.body?.question || "").trim();
  if (question.length < 2 || question.length > 1200) {
    return res.status(400).json({ error: "Ask a question between 2 and 1,200 characters." });
  }
  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: "FIT Coach AI is not configured yet. Add OPENAI_API_KEY to the backend environment to enable it." });
  }
  const baseUrl = (process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\\/$/, "");
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
          { role: "system", content: "You are FIT Coach, a supportive general fitness education assistant. Give concise, practical, non-judgmental guidance. Ask for missing context when needed. Do not diagnose, prescribe treatment, recommend extreme diets, guarantee results, or provide dangerous exercise instructions. For injuries, pregnancy, chronic conditions, eating disorders, or concerning symptoms, advise the user to consult a qualified healthcare professional. Never claim to be a doctor or certified personal trainer. Distinguish general information from individualized medical advice." },
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
