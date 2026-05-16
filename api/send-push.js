let adminInitError = null;
let admin;

try {
  admin = require('firebase-admin');
  if (!admin.apps.length) {
    const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!sa) throw new Error('FIREBASE_SERVICE_ACCOUNT env var is missing');
    const parsed = JSON.parse(sa);
    admin.initializeApp({ credential: admin.credential.cert(parsed) });
  }
} catch(e) {
  adminInitError = e.message;
}

module.exports = async function handler(req, res) {
  // Always respond with JSON so we can see what's happening
  res.setHeader('Content-Type', 'application/json');

  if (adminInitError) {
    return res.status(500).json({ error: 'Admin init failed', detail: adminInitError });
  }

  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, message: 'API is working!' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token, title, body } = req.body;
  if (!token) return res.status(400).json({ error: 'No token provided' });

  try {
    await admin.messaging().send({
      token,
      notification: { title: title || 'Share', body: body || 'Test' }
    });
    return res.status(200).json({ ok: true, sent: true });
  } catch(e) {
    return res.status(500).json({ error: e.message, code: e.code });
  }
};
