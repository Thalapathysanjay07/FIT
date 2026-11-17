import React, { useEffect, useState } from "react";
import { Activity, ArrowRight, LockKeyhole, Mail, UserRound } from "lucide-react";
import { createUserWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, updateProfile } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import App from "./App.jsx";
import { firebaseAuth, firestoreDb, isFirebaseConfigured } from "./firebase.js";

function hydrateFitnessData(data) {
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (key?.startsWith("fit-") && key !== "fit-token") localStorage.removeItem(key);
  }
  Object.entries(data || {}).forEach(([key, value]) => {
    if (/^fit-[a-z0-9-]{1,60}$/.test(key)) localStorage.setItem(key, JSON.stringify(value));
  });
}

export default function FirebaseAuthGate() {
  const [user, setUser] = useState(null);
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!firebaseAuth || !firestoreDb) {
      setError("Firebase is not configured. Add the VITE_FIREBASE_* settings and enable Email/Password in Firebase Authentication.");
      setChecking(false);
      return undefined;
    }
    return onAuthStateChanged(firebaseAuth, async (nextUser) => {
      try {
        if (nextUser) {
          const profileRef = doc(firestoreDb, "users", nextUser.uid);
          const profileSnap = await getDoc(profileRef);
          if (!profileSnap.exists()) {
            await setDoc(profileRef, {
              uid: nextUser.uid,
              name: nextUser.displayName || "FIT Member",
              email: nextUser.email || "",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });
          }
          const dataSnap = await getDoc(doc(firestoreDb, "userData", nextUser.uid));
          hydrateFitnessData(dataSnap.exists() ? dataSnap.data().data : {});
          localStorage.setItem("fit-token", await nextUser.getIdToken());
        } else {
          localStorage.removeItem("fit-token");
        }
        setUser(nextUser);
        setError("");
      } catch (e) {
        setError(e.message || "Could not load your Firebase account.");
      } finally {
        setChecking(false);
      }
    });
  }, []);

  async function submit(event) {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    try {
      if (!isFirebaseConfigured || !firebaseAuth || !firestoreDb) {
        throw new Error("Firebase configuration is missing. Add the Firebase Web App settings first.");
      }
      if (mode === "register") {
        if (name.trim().length < 2 || name.trim().length > 80) throw new Error("Enter a name between 2 and 80 characters.");
        const credential = await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);
        await updateProfile(credential.user, { displayName: name.trim() });
        await setDoc(doc(firestoreDb, "users", credential.user.uid), {
          uid: credential.user.uid,
          name: name.trim(),
          email: credential.user.email || email.trim(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      } else {
        await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
      }
    } catch (e) {
      const messages = {
        "auth/email-already-in-use": "An account already exists with this email.",
        "auth/invalid-credential": "Email or password is incorrect.",
        "auth/weak-password": "Use a stronger password (at least 6 characters).",
        "auth/invalid-email": "Enter a valid email address.",
        "auth/too-many-requests": "Too many attempts. Please wait and try again."
      };
      setError(messages[e.code] || e.message || "Could not complete authentication.");
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    setError(""); setNotice("");
    if (!email.trim()) { setError("Enter your email address first."); return; }
    try {
      await sendPasswordResetEmail(firebaseAuth, email.trim());
      setNotice("Password reset email sent. Check your inbox.");
    } catch (e) {
      setError(e.message || "Could not send password reset email.");
    }
  }

  async function logout() {
    await signOut(firebaseAuth);
    localStorage.removeItem("fit-token");
    hydrateFitnessData({});
  }

  if (checking) return <div className="auth-loading"><Activity/> FIT</div>;
  if (user) {
    const profile = { id: user.uid, uid: user.uid, name: user.displayName || "FIT Member", email: user.email };
    return <><div className="account-strip"><span>Signed in as <b>{profile.name}</b></span><button onClick={logout}>Sign out</button></div><App user={profile} onSignOut={logout}/></>;
  }

  return <main className="auth-screen">
    <section className="auth-card">
      <div className="auth-brand"><span><Activity size={25}/></span> FIT<span className="auth-green">.</span></div>
      <div className="auth-kicker">FIREBASE SECURE SIGN-IN</div>
      <h1>{mode === "register" ? "Create your account." : "Welcome back."}</h1>
      <p>Train with purpose. Track your progress. Build better habits.</p>
      <form onSubmit={submit}>
        {mode === "register" && <label><UserRound size={16}/><input value={name} onChange={e=>setName(e.target.value)} placeholder="Your name" minLength="2" maxLength="80" required/></label>}
        <label><Mail size={16}/><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email address" autoComplete="email" required/></label>
        <label><LockKeyhole size={16}/><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password (6+ characters)" minLength="6" maxLength="72" autoComplete={mode === "register" ? "new-password" : "current-password"} required/></label>
        {error && <div className="auth-error">{error}</div>}
        {notice && <div className="auth-foot">{notice}</div>}
        <button className="auth-submit" disabled={busy || !isFirebaseConfigured}>{busy ? "Please wait…" : mode === "register" ? "Create account" : "Sign in"} <ArrowRight size={16}/></button>
      </form>
      {mode === "login" && <button type="button" className="auth-switch" onClick={resetPassword}>Forgot password?</button>}
      <div className="auth-switch">{mode === "register" ? "Already have an account?" : "New to FIT?"} <button onClick={()=>{setMode(mode==="register"?"login":"register");setError("");setNotice("");}}>{mode==="register"?"Sign in":"Create account"}</button></div>
      <div className="auth-foot">Your account and fitness profile are stored in Firebase.</div>
    </section>
  </main>;
}
