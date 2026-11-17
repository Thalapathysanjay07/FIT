import React, { useEffect, useState } from "react";
import { Activity, ArrowRight, LockKeyhole, Mail, UserRound } from "lucide-react";
import { createUserWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, updateProfile, EmailAuthProvider, reauthenticateWithCredential, deleteUser, sendEmailVerification, reload, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, where, writeBatch } from "firebase/firestore";
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
  const [verificationEmail, setVerificationEmail] = useState("");

  useEffect(() => {
    if (!firebaseAuth || !firestoreDb) {
      setError("Firebase is not configured. Add the VITE_FIREBASE_* settings and enable Email/Password in Firebase Authentication.");
      setChecking(false);
      return undefined;
    }
    return onAuthStateChanged(firebaseAuth, async (nextUser) => {
      try {
        if (nextUser && !nextUser.emailVerified) {
          setVerificationEmail(nextUser.email || "");
          setUser(null);
          setChecking(false);
          return;
        }
        if (nextUser) {
          setVerificationEmail("");
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
        await sendEmailVerification(credential.user);
        setVerificationEmail(credential.user.email || email.trim());
        setNotice("Verification email sent. Verify your email before opening FIT.");
        await setDoc(doc(firestoreDb, "users", credential.user.uid), {
          uid: credential.user.uid,
          name: name.trim(),
          email: credential.user.email || email.trim(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      } else {
        const credential = await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
        if (!credential.user.emailVerified) {
          await sendEmailVerification(credential.user);
          setVerificationEmail(credential.user.email || email.trim());
          setNotice("Your email is not verified yet. We sent a new verification link.");
        }
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

  async function signInWithGoogle() {
    setBusy(true); setError(""); setNotice("");
    try {
      if (!isFirebaseConfigured || !firebaseAuth || !firestoreDb) {
        throw new Error("Firebase configuration is missing. Add the Firebase Web App settings first.");
      }
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const credential = await signInWithPopup(firebaseAuth, provider);
      const googleUser = credential.user;
      await setDoc(doc(firestoreDb, "users", googleUser.uid), {
        uid: googleUser.uid,
        name: googleUser.displayName || "FIT Member",
        email: googleUser.email || "",
        photoURL: googleUser.photoURL || "",
        provider: "google",
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (e) {
      const messages = {
        "auth/popup-closed-by-user": "Google sign-in was cancelled.",
        "auth/popup-blocked": "Allow pop-ups and try Google sign-in again.",
        "auth/unauthorized-domain": "Add this app domain to Firebase Authentication authorized domains.",
        "auth/account-exists-with-different-credential": "An account already exists with this email. Sign in using its original method."
      };
      setError(messages[e.code] || e.message || "Google sign-in failed.");
    } finally { setBusy(false); }
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

  async function refreshEmailVerification() {
    setBusy(true); setError(""); setNotice("");
    try {
      const currentUser = firebaseAuth?.currentUser;
      if (!currentUser) throw new Error("Please sign in again to verify your email.");
      await reload(currentUser);
      if (!firebaseAuth.currentUser?.emailVerified) {
        setNotice("Email is not verified yet. Open the latest verification email, then try again.");
        return;
      }
      setVerificationEmail("");
      setChecking(true);
      setUser(firebaseAuth.currentUser);
    } catch (e) {
      setError(e.message || "Could not refresh email verification status.");
    } finally { setBusy(false); }
  }

  async function resendVerification() {
    setBusy(true); setError(""); setNotice("");
    try {
      const currentUser = firebaseAuth?.currentUser;
      if (!currentUser) throw new Error("Please sign in again to resend verification.");
      await sendEmailVerification(currentUser);
      setNotice("A new verification email was sent. Check your inbox and spam folder.");
    } catch (e) { setError(e.message || "Could not send verification email."); }
    finally { setBusy(false); }
  }

  async function deleteAccount() {
    if (!firebaseAuth?.currentUser || !firestoreDb) return;
    const currentUser = firebaseAuth.currentUser;
    if (!currentUser.email) { setError("This account needs a supported reauthentication method before deletion."); return; }
    if (!window.confirm("Permanently delete your FIT account and its Firebase fitness data? This cannot be undone.")) return;
    const currentPassword = window.prompt("Enter your account password to confirm deletion:");
    if (!currentPassword) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
      await reauthenticateWithCredential(currentUser, credential);
      const ownedQueries = [
        query(collection(firestoreDb, "activityDays"), where("userId", "==", currentUser.uid)),
        query(collection(firestoreDb, "activityNotifications"), where("userId", "==", currentUser.uid)),
        query(collection(firestoreDb, "paymentRequests"), where("userId", "==", currentUser.uid))
      ];
      const snapshots = await Promise.all(ownedQueries.map(getDocs));
      const refs = snapshots.flatMap(snapshot => snapshot.docs.map(item => item.ref));
      refs.push(
        doc(firestoreDb, "users", currentUser.uid),
        doc(firestoreDb, "userData", currentUser.uid),
        doc(firestoreDb, "memberships", currentUser.uid)
      );
      for (let offset = 0; offset < refs.length; offset += 400) {
        const batch = writeBatch(firestoreDb);
        refs.slice(offset, offset + 400).forEach(ref => batch.delete(ref));
        await batch.commit();
      }
      await deleteUser(currentUser);
      hydrateFitnessData({});
      localStorage.removeItem("fit-token");
      setUser(null);
      setNotice("Your FIT account and associated Firebase records were deleted.");
    } catch (e) {
      const messages = {
        "auth/wrong-password": "Password is incorrect.",
        "auth/invalid-credential": "Password is incorrect. Please try again.",
        "auth/requires-recent-login": "Please sign in again and retry account deletion."
      };
      setError(messages[e.code] || e.message || "Could not delete the account.");
    } finally {
      setBusy(false);
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
    return <><div className="account-strip"><span>Signed in as <b>{profile.name}</b></span><button onClick={logout}>Sign out</button><button onClick={deleteAccount} disabled={busy}>Delete account</button></div><App user={profile} onSignOut={logout}/></>;
  }

  if (verificationEmail && firebaseAuth?.currentUser && !firebaseAuth.currentUser.emailVerified) return <main className="auth-screen"><section className="auth-card"><div className="auth-brand"><span><Activity size={25}/></span> FIT<span className="auth-green">.</span></div><div className="auth-kicker">EMAIL VERIFICATION</div><h1>Verify your email.</h1><p>We sent a verification link to <b>{verificationEmail}</b>. Verify it before accessing your FIT account.</p>{error && <div className="auth-error">{error}</div>}{notice && <div className="auth-foot">{notice}</div>}<button className="auth-submit" disabled={busy} onClick={refreshEmailVerification}>{busy?"Checking…":"I've verified my email"}</button><button type="button" className="auth-switch" disabled={busy} onClick={resendVerification}>Resend verification email</button><button type="button" className="auth-switch" disabled={busy} onClick={logout}>Sign out</button></section></main>;

  return <main className="auth-screen">
    <section className="auth-card">
      <div className="auth-brand"><span><Activity size={25}/></span> FIT<span className="auth-green">.</span></div>
      <div className="auth-kicker">FIREBASE SECURE SIGN-IN</div>
      <h1>{mode === "register" ? "Create your account." : "Welcome back."}</h1>
      <p>Train with purpose. Track your progress. Build better habits.</p>
      <button type="button" className="google-signin" onClick={signInWithGoogle} disabled={busy || !isFirebaseConfigured}>
        <svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.74 7.18l7.73 6C44.43 37.98 46.98 31.88 46.98 24.55z"/><path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.9 23.9 0 0 0 0 24c0 3.87.93 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.14 1.44-4.89 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
        Continue with Google
      </button>
      <div className="auth-divider"><span>OR CONTINUE WITH EMAIL</span></div>
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
