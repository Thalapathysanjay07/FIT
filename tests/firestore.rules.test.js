import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";

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
  it("keeps userData private to its owner", async () => {
    await env.withSecurityRulesDisabled(async ctx => {
      await setDoc(doc(ctx.firestore(), "userData/user-a"), { uid: "user-a", data: {}, updatedAt: "now" });
    });
    await assertSucceeds(getDoc(doc(env.authenticatedContext("user-a").firestore(), "userData/user-a")));
    await assertFails(getDoc(doc(env.authenticatedContext("user-b").firestore(), "userData/user-a")));
  });

  it("rejects client-created or modified premium memberships", async () => {
    const db = env.authenticatedContext("user-a").firestore();
    await assertFails(setDoc(doc(db, "memberships/user-a"), {
      userId: "user-a", planCode: "quarterly", startsAt: "now", expiresAt: "later"
    }));
  });

  it("accepts only a valid pending quarterly payment request", async () => {
    const db = env.authenticatedContext("user-a").firestore();
    const valid = { userId: "user-a", planCode: "quarterly", amountPaise: 4900, utr: "123456789012", status: "pending", createdAt: new Date().toISOString() };
    await assertSucceeds(setDoc(doc(db, "paymentRequests/123456789012"), valid));
    await assertFails(setDoc(doc(db, "paymentRequests/999999999999"), { ...valid, utr: "999999999999", amountPaise: 5000 }));
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
        userId: "user-a", planCode: "quarterly", amountPaise: 4900, utr: "123456789012", status: "pending", createdAt: "now"
      });
    });
    await assertFails(setDoc(doc(env.authenticatedContext("user-a").firestore(), "paymentRequests/123456789012"), {
      userId: "user-a", planCode: "quarterly", amountPaise: 4900, utr: "123456789012", status: "approved", createdAt: "now"
    }));
  });
});
