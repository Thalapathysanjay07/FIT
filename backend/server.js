import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pg from "pg";
import QRCode from "qrcode";
import { timingSafeEqual } from "node:crypto";

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
app.use("/api/admin", rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false }));

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
    CREATE TABLE IF NOT EXISTS activity_days (
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      activity_date DATE NOT NULL,
      steps INTEGER NOT NULL DEFAULT 0 CHECK (steps >= 0 AND steps <= 200000),
      step_goal INTEGER NOT NULL DEFAULT 8000 CHECK (step_goal BETWEEN 1000 AND 50000),
      workouts INTEGER NOT NULL DEFAULT 0 CHECK (workouts >= 0 AND workouts <= 20),
      leaderboard_opt_in BOOLEAN NOT NULL DEFAULT FALSE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY(user_id, activity_date)
    );
    CREATE TABLE IF NOT EXISTS activity_notifications (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kind VARCHAR(40) NOT NULL,
      title VARCHAR(120) NOT NULL,
      body VARCHAR(300) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      read_at TIMESTAMPTZ
    );
  `);
}
function tokenFor(user) {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error("JWT_SECRET must contain at least 32 characters.");
  return jwt.sign({ sub: String(user.id), email: user.email }, process.env.JWT_SECRET, { expiresIn: "7d", issuer: "fit-api", audience: "fit-app" });
}
function adminAuthorized(req) {
  const configured=Buffer.from(String(process.env.FIT_ADMIN_KEY||""));
  const supplied=Buffer.from(String(req.headers["x-fit-admin-key"]||""));
  return configured.length>=24 && configured.length===supplied.length && timingSafeEqual(configured,supplied);
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
async function activeMembership(userId) {
  const result = await pool.query(
    "SELECT plan_code, starts_at, expires_at FROM memberships WHERE user_id=$1 AND starts_at<=NOW() AND expires_at>NOW()",
    [userId]
  );
  return result.rows[0] || null;
}
app.get("/api/membership/access", ready, auth, async (req,res) => {
  try {
    const membership = await activeMembership(req.user.sub);
    res.set("Cache-Control","no-store");
    res.json({ tier:membership?"pro":"free", isPremium:!!membership, membership });
  } catch(error) {
    console.error("Membership access check failed:",error.message);
    res.status(503).json({ error:"Could not verify membership." });
  }
});
app.post("/api/coach", ready, auth, async (req,res) => {
  const mode = String(req.body?.mode || "chat");
  if (!["chat","diet","workout","weekly-report"].includes(mode)) return res.status(400).json({error:"Choose a valid coach mode."});
  if (mode !== "chat") {
    let membership;
    try { membership = await activeMembership(req.user.sub); }
    catch(error) {
      console.error("Coach membership verification failed:",error.message);
      return res.status(503).json({error:"Membership verification is temporarily unavailable. Please retry."});
    }
    if (!membership) return res.status(403).json({error:"FIT Pro is required for personalised AI plans and weekly reports.",code:"PREMIUM_REQUIRED"});
  }
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
          { role: "system", content: "You are FIT Coach. Requested mode: " + mode + ". Use the supplied profile, goal, experience, height, weight, diet preference, food log, calorie/protein targets, water, steps and training availability. For diet mode, return a practical Indian-food day plan with meal timing, portions, approximate calories/protein per meal, affordable substitutions and a grocery list. For workout mode, create a safe weekly plan matching goal, level, equipment, days and session duration; include warm-up, exercises, sets, reps, rest and recovery. For weekly-report mode, summarise logged trends, wins, gaps and 2-3 achievable next-week actions; never fabricate missing data. Explain assumptions and mark nutrition/energy estimates as approximate. Do not diagnose, prescribe treatment, recommend extreme diets, guarantee results or give dangerous exercise instructions. For injuries, pregnancy, chronic conditions, eating disorders or concerning symptoms, advise consulting a qualified healthcare professional. Never claim to be a doctor or certified personal trainer. Be concise, practical and non-judgmental." },
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
  quarterly: { name: "FIT Pro 3 Months", amountPaise: 4900, days: 90 }
};
app.get("/api/membership/qr", ready, async (req,res) => {
  const planCode=String(req.query.plan||"quarterly");
  const plan=membershipPlans[planCode];
  const upiId=String(process.env.FIT_UPI_ID||"");
  if(!plan)return res.status(400).json({error:"Choose a valid membership plan."});
  if(!/^[A-Za-z0-9._-]{2,256}@[A-Za-z0-9.-]{2,64}$/.test(upiId))return res.status(503).json({error:"A valid merchant UPI ID is not configured."});
  try{
    const params=new URLSearchParams({pa:upiId,pn:process.env.FIT_MERCHANT_NAME||"FIT",am:(plan.amountPaise/100).toFixed(2),cu:"INR",tn:plan.name});
    const paymentUri="upi://pay?"+params.toString();
    const qr=await QRCode.toDataURL(paymentUri,{errorCorrectionLevel:"M",margin:2,width:280});
    res.set("Cache-Control","no-store");
    res.json({qrDataUrl:qr,amount:plan.amountPaise/100,planCode});
  }catch(error){console.error("UPI QR generation failed:",error.message);res.status(500).json({error:"Could not generate the payment QR."});}
});
app.get("/api/membership/config", ready, async (_req,res) => {
  res.json({
    upiId: process.env.FIT_UPI_ID || "",
    merchantName: process.env.FIT_MERCHANT_NAME || "FIT",
    plans: Object.entries(membershipPlans).map(([code,p]) => ({ code, name:p.name, amount:p.amountPaise/100, days:p.days }))
  });
});
app.get("/api/membership/me", ready, auth, async (req,res) => {
  const result = await pool.query(
    "SELECT plan_code, starts_at, expires_at FROM memberships WHERE user_id=$1 AND starts_at<=NOW() AND expires_at>NOW()",
    [req.user.sub]
  );
  const payments = await pool.query(
    "SELECT id,plan_code,amount_paise,utr,status,created_at FROM payment_requests WHERE user_id=$1 ORDER BY created_at DESC LIMIT 5",
    [req.user.sub]
  );
  res.set("Cache-Control","no-store");
  res.json({ membership: result.rows[0] || null, isPremium:!!result.rows[0], payments: payments.rows });
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
app.get("/api/admin/payments", ready, async (req,res) => {
  if (!adminAuthorized(req)) return res.status(401).json({error:"Admin authorization required."});
  res.set("Cache-Control","no-store");
  try {
    const result = await pool.query(`SELECT p.id,p.plan_code,p.amount_paise,p.utr,p.status,p.created_at,u.name,u.email FROM payment_requests p JOIN users u ON u.id=p.user_id ORDER BY CASE WHEN p.status='pending' THEN 0 ELSE 1 END,p.created_at DESC LIMIT 100`);
    res.json({payments:result.rows});
  } catch(error) { console.error("Admin payment list error:",error.message);res.status(500).json({error:"Could not load payment requests."}); }
});
app.post("/api/admin/payments/:id/review", ready, async (req,res) => {
  if (!adminAuthorized(req)) return res.status(401).json({ error:"Admin authorization required." });
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
        starts_at=CASE WHEN memberships.expires_at>NOW() THEN memberships.starts_at ELSE NOW() END,
        expires_at=GREATEST(memberships.expires_at,NOW())+($3 * INTERVAL '1 day'),
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

function validActivityDate(value) {
  return typeof value==="string" && /^\\d{4}-\\d{2}-\\d{2}$/.test(value) && !Number.isNaN(Date.parse(value+"T00:00:00Z"));
}
app.get("/api/activity/today", ready, auth, async (req,res) => {
  try {
    const date=String(req.query.date||new Date().toISOString().slice(0,10));
    if(!validActivityDate(date))return res.status(400).json({error:"Invalid activity date."});
    const result=await pool.query("SELECT activity_date,steps,step_goal,workouts FROM activity_days WHERE user_id=$1 AND activity_date=$2",[req.user.sub,date]);
    res.set("Cache-Control","no-store");
    res.json({activity:result.rows[0]||{activity_date:date,steps:0,step_goal:8000,workouts:0}});
  } catch(error){console.error("Activity read failed:",error.message);res.status(500).json({error:"Could not load activity."});}
});
app.put("/api/activity/today", ready, auth, async (req,res) => {
  const date=String(req.body?.date||new Date().toISOString().slice(0,10));
  const steps=Number(req.body?.steps),goal=Number(req.body?.stepGoal);
  if(!validActivityDate(date)||!Number.isInteger(steps)||steps<0||steps>200000||!Number.isInteger(goal)||goal<1000||goal>50000)
    return res.status(400).json({error:"Activity values are outside the allowed range."});
  try{
    const result=await pool.query(`INSERT INTO activity_days(user_id,activity_date,steps,step_goal)
      VALUES($1,$2,$3,$4) ON CONFLICT(user_id,activity_date) DO UPDATE SET
      steps=GREATEST(activity_days.steps,EXCLUDED.steps),step_goal=EXCLUDED.step_goal,updated_at=NOW()
      RETURNING activity_date,steps,step_goal,workouts`,[req.user.sub,date,steps,goal]);
    const row=result.rows[0];
    if(row.steps>=row.step_goal){
      const already=await pool.query("SELECT 1 FROM activity_notifications WHERE user_id=$1 AND kind='step_goal' AND created_at::date=$2 LIMIT 1",[req.user.sub,date]);
      if(!already.rowCount)await pool.query("INSERT INTO activity_notifications(user_id,kind,title,body) VALUES($1,'step_goal','Daily step goal reached','You reached your step goal. Great consistency!')",[req.user.sub]);
    }
    res.json({activity:row});
  }catch(error){console.error("Activity save failed:",error.message);res.status(500).json({error:"Could not save activity."});}
});
app.post("/api/activity/workout", ready, auth, async (req,res) => {
  const date=String(req.body?.date||new Date().toISOString().slice(0,10));
  if(!validActivityDate(date))return res.status(400).json({error:"Invalid workout date."});
  try{
    const result=await pool.query(`INSERT INTO activity_days(user_id,activity_date,workouts)
      VALUES($1,$2,1) ON CONFLICT(user_id,activity_date) DO UPDATE SET
      workouts=LEAST(activity_days.workouts+1,20),updated_at=NOW()
      RETURNING workouts`,[req.user.sub,date]);
    const count=result.rows[0].workouts;
    await pool.query("INSERT INTO activity_notifications(user_id,kind,title,body) VALUES($1,'workout','Workout logged','Your workout has been added to today’s activity.')",[req.user.sub]);
    res.status(201).json({workouts:count});
  }catch(error){console.error("Workout log failed:",error.message);res.status(500).json({error:"Could not log workout."});}
});
app.put("/api/activity/leaderboard-opt-in", ready, auth, async (req,res) => {
  const enabled=req.body?.enabled;
  if(typeof enabled!=="boolean")return res.status(400).json({error:"Choose whether to join the leaderboard."});
  try{
    await pool.query(`INSERT INTO activity_days(user_id,activity_date,leaderboard_opt_in)
      VALUES($1,CURRENT_DATE,$2) ON CONFLICT(user_id,activity_date)
      DO UPDATE SET leaderboard_opt_in=EXCLUDED.leaderboard_opt_in,updated_at=NOW()`,[req.user.sub,enabled]);
    await pool.query("UPDATE activity_days SET leaderboard_opt_in=$2 WHERE user_id=$1",[req.user.sub,enabled]);
    res.json({leaderboardOptIn:enabled});
  }catch(error){console.error("Leaderboard preference failed:",error.message);res.status(500).json({error:"Could not update leaderboard preference."});}
});
app.get("/api/activity/leaderboard", ready, auth, async (req,res) => {
  try{
    const result=await pool.query(`SELECT u.name, SUM(a.steps)::int AS steps, SUM(a.workouts)::int AS workouts
      FROM activity_days a JOIN users u ON u.id=a.user_id
      WHERE a.activity_date>=CURRENT_DATE-6 AND a.activity_date<=CURRENT_DATE
      GROUP BY a.user_id,u.name
      HAVING BOOL_OR(a.leaderboard_opt_in)=TRUE
      ORDER BY steps DESC,workouts DESC LIMIT 20`);
    res.set("Cache-Control","no-store");
    res.json({leaderboard:result.rows});
  }catch(error){console.error("Leaderboard load failed:",error.message);res.status(500).json({error:"Could not load leaderboard."});}
});
app.get("/api/activity/notifications", ready, auth, async (req,res) => {
  try{
    const result=await pool.query("SELECT id,kind,title,body,created_at,read_at FROM activity_notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 30",[req.user.sub]);
    res.set("Cache-Control","no-store");
    res.json({notifications:result.rows});
  }catch(error){console.error("Notifications load failed:",error.message);res.status(500).json({error:"Could not load notifications."});}
});
app.post("/api/activity/notifications/:id/read", ready, auth, async (req,res) => {
  const id=Number(req.params.id);
  if(!Number.isSafeInteger(id)||id<1)return res.status(400).json({error:"Invalid notification."});
  try{
    const result=await pool.query("UPDATE activity_notifications SET read_at=NOW() WHERE id=$1 AND user_id=$2 RETURNING id",[id,req.user.sub]);
    if(!result.rowCount)return res.status(404).json({error:"Notification not found."});
    res.json({read:true});
  }catch(error){console.error("Notification update failed:",error.message);res.status(500).json({error:"Could not update notification."});}
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
