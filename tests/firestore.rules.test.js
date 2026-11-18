import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

const projectId = "fit-rules-test";
let env;
before(async () => {
  env = await initializeTestEnvironment({
    projectId,
    firestore: { rules: await readFile(new URL("../firestore.rules", import.meta.url), "utf8") }
  });
});
beforeEach(async () => env.clearFirestore());
after(async () => env.cleanup());

describe("FIT Firestore security rules", () => {
  it("allows a user to create a Google profile with permitted provider fields", async () => {\n    const db = env.authenticatedContext("google-user").firestore();\n    await assertSucceeds(setDoc(doc(db, "users/google-user"), {\n      uid: "google-user", name: "FIT Member", email: "google@example.com",\n      photoURL: "https://example.com/avatar.png", provider: "google",\n      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()\n    }));\n  });\n\n  it("prevents a user from adding privileged fields to an existing profile", async () => {\n    const db = env.authenticatedContext("user-a").firestore();\n    await setDoc(doc(db, "users/user-a"), {\n      uid: "user-a", name: "FIT Member", email: "user@example.com",\n      createdAt: "now", updatedAt: "now"\n    });\n    await assertFails(updateDoc(doc(db, "users/user-a"), { role: "admin", isPremium: true }));\n  });\n\n  it("keeps userData private to its owner", async () => {
    await env.withSecurityRulesDisabled(async ctx => {
      await setDoc(doc(ctx.firestore(), "userData/user-a"), { uid: "user-a", data: {}, updatedAt: "now" });
    });
    await assertSucceeds(getDoc(doc(env.authenticatedContext("user-a").firestore(), "userData/user-a")));
    await assertFails(getDoc(doc(env.authenticatedContext("user-b").firestore(), "userData/user-a")));
  });

  it("prevents users from assigning themselves admin or premium profile flags", async () => {
    const db = env.authenticatedContext("user-a").firestore();
    await assertFails(setDoc(doc(db, "users/user-a"), {
      uid: "user-a", name: "FIT Member", email: "user@example.com",
      role: "admin", isPremium: true, createdAt: "now", updatedAt: "now"
    }));
  });

  it("keeps leaderboard activity hidden unless the owner opts in", async () => {
    await env.withSecurityRulesDisabled(async ctx => {
      await setDoc(doc(ctx.firestore(), "activityDays/user-a_2026-11-17"), {
        userId: "user-a", activityDate: "2026-11-17", steps: 5000,
        stepGoal: 8000, workouts: 1, leaderboardOptIn: false,
        displayName: "FIT Member", updatedAt: "now"
      });
    });
    const otherUserDb = env.authenticatedContext("user-b").firestore();
    await assertFails(getDoc(doc(otherUserDb, "activityDays/user-a_2026-11-17")));
  });

  it("allows leaderboard reads only for opted-in activity rows", async () => {
    await env.withSecurityRulesDisabled(async ctx => {
      await setDoc(doc(ctx.firestore(), "activityDays/user-a_2026-11-17"), {
        userId: "user-a", activityDate: "2026-11-17", steps: 5000,
        stepGoal: 8000, workouts: 1, leaderboardOptIn: true,
        displayName: "FIT Member", updatedAt: "now"
      });
    });
    const otherUserDb = env.authenticatedContext("user-b").firestore();
    await assertSucceeds(getDoc(doc(otherUserDb, "activityDays/user-a_2026-11-17")));
  });

  it("allows owners to create a workout activity notification", async () => {
    const db = env.authenticatedContext("user-a").firestore();
    await assertSucceeds(setDoc(doc(db, "activityNotifications/user-a_workout_session"), {
      userId: "user-a", kind: "workout", title: "Workout logged",
      body: "Your workout has been added to today’s activity.",
      createdAt: "now", readAt: null
    }));
  });

  it("does not allow clients to create privileged notification types", async () => {
    const db = env.authenticatedContext("user-a").firestore();
    await assertFails(setDoc(doc(db, "activityNotifications/notice-1"), {
      userId: "user-a", kind: "payment_approved", title: "Premium granted",
      body: "Your membership is active", createdAt: "now", readAt: null
    }));
  });

  it("rejects client-created or modified premium memberships", async () => {
    const db = env.authenticatedContext("user-a").firestore();
    await assertFails(setDoc(doc(db, "memberships/user-a"), {
      userId: "user-a", planCode: "monthly", startsAt: "now", expiresAt: "later"
    }));
  });

  it("accepts the published monthly and yearly pending payment amounts only", async () => {
    const db = env.authenticatedContext("user-a").firestore();
    const monthly = { userId: "user-a", planCode: "monthly", amountPaise: 4900, utr: "123456789012", status: "pending", createdAt: new Date().toISOString() };
    await assertSucceeds(setDoc(doc(db, "paymentRequests/123456789012"), monthly));
    const yearly = { userId: "user-a", planCode: "yearly", amountPaise: 49900, utr: "123456789013", status: "pending", createdAt: new Date().toISOString() };
    await assertSucceeds(setDoc(doc(db, "paymentRequests/123456789013"), yearly));
    await assertFails(setDoc(doc(db, "paymentRequests/999999999999"), { ...monthly, utr: "999999999999", amountPaise: 5000 }));
    await assertFails(setDoc(doc(db, "paymentRequests/999999999998"), { ...yearly, utr: "999999999998", amountPaise: 4900 }));
  });
  it("allows only bounded activity values owned by the signed-in user", async () => {
    const db = env.authenticatedContext("user-a").firestore();
    const valid = { userId: "user-a", activityDate: "2026-11-17", steps: 5000, stepGoal: 8000, workouts: 1, leaderboardOptIn: false, displayName: "FIT Member", updatedAt: new Date().toISOString() };
    await assertSucceeds(setDoc(doc(db, "activityDays/user-a_2026-11-17"), valid));
    await assertFails(setDoc(doc(db, "activityDays/user-a_2026-11-18"), { ...valid, steps: 999999 }));
    await assertFails(setDoc(doc(db, "activityDays/user-b_2026-11-17"), { ...valid, userId: "user-b" }));
  });

  it("does not let a client change payment approval status", async () => {
    await env.withSecurityRulesDisabled(async ctx => {
      await setDoc(doc(ctx.firestore(), "paymentRequests/123456789012"), {
        userId: "user-a", planCode: "monthly", amountPaise: 4900, utr: "123456789012", status: "pending", createdAt: "now"
      });
    });
    await assertFails(setDoc(doc(env.authenticatedContext("user-a").firestore(), "paymentRequests/123456789012"), {
      userId: "user-a", planCode: "monthly", amountPaise: 4900, utr: "123456789012", status: "approved", createdAt: "now"
    }));
  });
});
