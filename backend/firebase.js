import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

let firestore = null;
let firebaseAuth = null;
let projectId = process.env.FIREBASE_PROJECT_ID || "";
let configurationError = null;

const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
if (rawServiceAccount) {
  try {
    const serviceAccount = JSON.parse(rawServiceAccount);
    projectId = projectId || serviceAccount.project_id || "";
    if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
      throw new Error("Service account JSON is missing required fields.");
    }
    const app = getApps().length
      ? getApps()[0]
      : initializeApp({ credential: cert(serviceAccount), projectId: projectId || serviceAccount.project_id });
    firestore = getFirestore(app);
    firebaseAuth = getAuth(app);
  } catch (error) {
    configurationError = error;
    console.error("Firebase Admin configuration is invalid:", error.message);
  }
}

export function getFirebaseStatus() {
  return {
    configured: Boolean(firestore),
    projectId: firestore ? projectId : undefined,
    configurationError: configurationError ? "invalid_configuration" : undefined
  };
}

export async function verifyFirestoreConnection() {
  if (!firestore) throw new Error(configurationError ? "Firebase configuration is invalid." : "Firebase is not configured.");
  // Read-only probe: does not create or modify a Firestore document.
  await firestore.collection("_fit_system").doc("connection_probe").get();
}

export function getFirestoreDb() {
  if (!firestore) throw new Error("Firestore is not configured. Set FIREBASE_SERVICE_ACCOUNT on the backend.");
  return firestore;
}

export async function verifyFirebaseIdToken(idToken) {
  if (!firebaseAuth) throw new Error("Firebase Admin Authentication is not configured.");
  return firebaseAuth.verifyIdToken(idToken, true);
}
