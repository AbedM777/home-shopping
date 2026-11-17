// Push notification sender for the home shopping app.
// The app calls this after someone adds products; it notifies the family's other phones
// and raises the number on their app icon.
import { http } from '@google-cloud/functions-framework';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

initializeApp();
const db = getFirestore();
const ORIGIN = 'https://abedm777.github.io';
const fmtMonth = k => { const [y, m] = String(k || '').split('-'); return m && y ? m + '/' + y.slice(2) : ''; };

http('notify', async (req, res) => {
  res.set('Access-Control-Allow-Origin', ORIGIN);
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).send('');
  if (req.method !== 'POST') return res.status(405).send('');
  let b = req.body;
  if (Buffer.isBuffer(b)) b = b.toString();
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }
  b = b || {};
  const code = String(b.code || '');
  if (!/^[A-Za-z0-9]{20,64}$/.test(code)) return res.status(400).send('bad code');
  const prefix = 'hb_' + code + '_';
  const names = (Array.isArray(b.names) ? b.names : []).map(n => String(n).slice(0, 60)).filter(Boolean).slice(0, 100);
  if (!names.length) return res.status(204).send('');
  const by = String(b.by || '');
  const months = [...new Set((Array.isArray(b.months) ? b.months : []).map(String))].sort().map(fmtMonth).filter(Boolean);
  const title = names.length === 1 ? 'נוסף מוצר לרשימת הקניות' : `נוספו ${names.length} מוצרים לרשימת הקניות`;
  const body = (months.length ? `רשימה ${months.join(', ')}: ` : '') + names.slice(0, 6).join(', ') + (names.length > 6 ? ` ועוד ${names.length - 6}` : '');

  const devices = await db.collection(prefix + 'devices').get();
  let sent = 0;
  await Promise.all(devices.docs.map(async d => {
    if (d.id === by) return;
    const dev = d.data();
    if (!dev.token) return;
    const badge = (dev.unread || 0) + names.length;
    try {
      await getMessaging().send({ token: dev.token, data: { title, body, badge: String(badge) }, webpush: { headers: { Urgency: 'high', TTL: '86400' } } });
      await d.ref.update({ unread: FieldValue.increment(names.length) });
      sent++;
    } catch (err) {
      const c = err && err.code;
      if (c === 'messaging/registration-token-not-registered' || c === 'messaging/invalid-registration-token') await d.ref.delete().catch(() => {});
      else console.error('push failed', c || err);
    }
  }));
  res.status(200).json({ sent });
});
