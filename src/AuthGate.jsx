import { useEffect, useState } from "react";
import { Activity, ArrowRight, LockKeyhole, Mail, UserRound } from "lucide-react";
import App from "./App.jsx";

const API = import.meta.env.VITE_API_URL || "";
const request = async (path, options = {}) => {
  const response = await fetch(`${API}/api${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Something went wrong.");
  return body;
};

export default function AuthGate() {
  const [session, setSession] = useState(null);
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let alive = true;
    const token = localStorage.getItem("fit-token");
    if (!token) { setChecking(false); return; }
    request("/auth/me", { headers: { Authorization: `Bearer ${token}` } })
      .then(async ({ user }) => {
        const stored = await request("/data", { headers: { Authorization: `Bearer ${token}` } });
        Object.entries(stored.data || {}).forEach(([key, value]) => {
          if (key.startsWith("fit-")) localStorage.setItem(key, JSON.stringify(value));
        });
        if (alive) setSession({ user, token });
      })
      .catch(() => localStorage.removeItem("fit-token"))
      .finally(() => { if (alive) setChecking(false); });
    return () => { alive = false; };
  }, []);

  async function submit(event) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const result = await request(mode === "register" ? "/auth/register" : "/auth/login", {
        method: "POST",
        body: JSON.stringify({ name, email, password })
      });
      localStorage.setItem("fit-token", result.token);
      const stored = await request("/data", { headers: { Authorization: `Bearer ${result.token}` } });
      Object.entries(stored.data || {}).forEach(([key, value]) => {
        if (key.startsWith("fit-")) localStorage.setItem(key, JSON.stringify(value));
      });
      setSession({ user: result.user, token: result.token });
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  if (checking) return <div className="auth-loading"><Activity/> FIT</div>;
  if (session) return <><div className="account-strip"><span>Signed in as <b>{session.user.name}</b></span><button onClick={() => { localStorage.removeItem("fit-token"); setSession(null); }}>Sign out</button></div><App/></>;

  return <main className="auth-screen">
    <section className="auth-card">
      <div className="auth-brand"><span><Activity size={25}/></span> FIT<span className="auth-green">.</span></div>
      <div className="auth-kicker">YOUR PERSONAL FITNESS SPACE</div>
      <h1>{mode === "register" ? "Create your account." : "Welcome back."}</h1>
      <p>Train with purpose. Track your progress. Build better habits.</p>
      <form onSubmit={submit}>
        {mode === "register" && <label><UserRound size={16}/><input value={name} onChange={e=>setName(e.target.value)} placeholder="Your name" minLength="2" maxLength="80" required/></label>}
        <label><Mail size={16}/><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email address" required/></label>
        <label><LockKeyhole size={16}/><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password (10+ characters)" minLength="10" maxLength="72" required/></label>
        {error && <div className="auth-error">{error}</div>}
        <button className="auth-submit" disabled={busy}>{busy ? "Please wait…" : mode === "register" ? "Create account" : "Sign in"} <ArrowRight size={16}/></button>
      </form>
      <div className="auth-switch">{mode === "register" ? "Already have an account?" : "New to FIT?"} <button onClick={()=>{setMode(mode==="register"?"login":"register");setError("");}}>{mode==="register"?"Sign in":"Create account"}</button></div>
      <div className="auth-foot">Your fitness data is private to your account.</div>
    </section>
  </main>;
}
