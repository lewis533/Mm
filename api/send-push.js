const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    )
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { token, title, body } = req.body;
  if (!token) return res.status(400).json({ error: 'No token' });
  try {
    await admin.messaging().send({
      token,
      notification: { title, body }
    });
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
