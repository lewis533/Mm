const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    )
  });
}

module.exports = async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') return res.status(405).end();

  const { token, tokens, title, body, type } = req.body;

  // Support both single token and array of tokens — FIX #41
  const allTokens = [];
  if (token) allTokens.push(token);
  if (tokens && Array.isArray(tokens)) allTokens.push(...tokens);
  const uniqueTokens = [...new Set(allTokens.filter(Boolean))];

  if (!uniqueTokens.length) {
    return res.status(400).json({ error: 'No tokens provided' });
  }

  // FIX #3: Build high-priority message with full webpush config
  const messageBase = {
    notification: {
      title: title || 'Share',
      body: body || 'You have a new notification'
    },
    // FIX #3: Android high priority
    android: {
      priority: 'high',
      notification: {
        sound: 'default',
        channelId: 'share_default',
        icon: 'ic_notification',
        color: '#7c6cfc',
        clickAction: 'FLUTTER_NOTIFICATION_CLICK'
      }
    },
    // FIX #3: Webpush high urgency — forces delivery even when phone is idle
    webpush: {
      headers: {
        Urgency: 'high',
        TTL: '86400' // FIX #47: Expire after 1 day (in seconds)
      },
      notification: {
        title: title || 'Share',
        body: body || 'You have a new notification',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        vibrate: [200, 100, 200, 100, 200],
        requireInteraction: false,
        tag: `share-${type || 'notif'}`
      },
      // FIX #49: Include notification type so SW can deep link
      data: {
        type: type || 'default',
        url: 'https://lewishare.vercel.app'
      },
      fcmOptions: {
        link: 'https://lewishare.vercel.app'
      }
    },
    // FIX #3: Apple/APNS priority for iOS
    apns: {
      headers: {
        'apns-priority': '10'
      },
      payload: {
        aps: {
          sound: 'default',
          badge: 1
        }
      }
    }
  };

  const results = [];
  const failedTokens = [];

  // FIX #41: Send to each token, collect failures
  for (const t of uniqueTokens) {
    try {
      await admin.messaging().send({
        ...messageBase,
        token: t
      });
      results.push({ token: t, success: true });
    } catch (e) {
      // FIX #4: If token is invalid/expired, track it
      const isInvalidToken =
        e.code === 'messaging/invalid-registration-token' ||
        e.code === 'messaging/registration-token-not-registered';

      results.push({ token: t, success: false, error: e.message });
      if (isInvalidToken) failedTokens.push(t);

      // FIX #46: Log but don't crash — try next token
      console.error(`Push failed for token ${t.slice(0, 20)}...:`, e.message);
    }
  }

  // FIX #4: Return failed tokens so app can clean them up
  res.status(200).json({
    ok: true,
    sent: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    invalidTokens: failedTokens
  });
};
