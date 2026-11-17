// Sends a push notification (and an icon badge count) to the family's other phones
// when products are added to the shopping list.
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();
const db = getFirestore();
const GATHER_MS = 20000; // additions made within this window go out as one notification
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fmtMonth = k => { const [y, m] = String(k).split("-"); return m && y ? m + "/" + y.slice(2) : ""; };

exports.notifyNewItems = onDocumentCreated(
  { document: "{coll}/{doc}", region: "europe-west1", timeoutSeconds: 120, memory: "256MiB", maxInstances: 10 },
  async (event) => {
    const m = /^hb_([A-Za-z0-9]{20,})_items$/.exec(event.params.coll);
    if (!m) return;
    const created = event.data && event.data.data();
    if (!created || created.notified !== false) return;
    const prefix = "hb_" + m[1] + "_";
    const lock = db.doc(prefix + "notify/state");

    // only one invocation per burst gathers and sends
    const leader = await db.runTransaction(async tx => {
      const s = await tx.get(lock);
      const until = s.exists ? s.data().gatherUntil || 0 : 0;
      if (until > Date.now()) return false;
      tx.set(lock, { gatherUntil: Date.now() + GATHER_MS + 15000 }, { merge: true });
      return true;
    });
    if (!leader) return;
    await sleep(GATHER_MS);

    const picked = await db.runTransaction(async tx => {
      const snap = await tx.get(db.collection(prefix + "items").where("notified", "==", false));
      snap.docs.forEach(d => tx.update(d.ref, { notified: true }));
      tx.set(lock, { gatherUntil: 0 }, { merge: true });
      return snap.docs.map(d => d.data());
    });
    if (!picked.length) return;

    const devices = await db.collection(prefix + "devices").get();
    await Promise.all(devices.docs.map(async (d) => {
      const dev = d.data();
      if (!dev.token) return;
      const mine = picked.filter(x => x.by !== d.id); // only what others added
      if (!mine.length) return;
      const months = [...new Set(mine.map(x => x.month).filter(Boolean))].sort().map(fmtMonth);
      const names = mine.map(x => x.name).filter(Boolean);
      const title = names.length === 1 ? "נוסף מוצר לרשימת הקניות" : `נוספו ${names.length} מוצרים לרשימת הקניות`;
      const body = (months.length ? `רשימה ${months.join(", ")}: ` : "") + names.slice(0, 6).join(", ") + (names.length > 6 ? ` ועוד ${names.length - 6}` : "");
      const badge = (dev.unread || 0) + names.length;
      try {
        await getMessaging().send({
          token: dev.token,
          data: { title, body, badge: String(badge) },
          webpush: { headers: { Urgency: "high", TTL: "86400" } },
        });
        await d.ref.update({ unread: FieldValue.increment(names.length) });
      } catch (err) {
        const code = err && err.code;
        if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token") await d.ref.delete();
        else console.error("push failed", code || err);
      }
    }));
  }
);
