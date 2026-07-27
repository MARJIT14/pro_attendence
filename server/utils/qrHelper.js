const crypto = require('crypto');
const QRCode = require('qrcode');

/**
 * Generate a cryptographically secure random session ID.
 * Uses SHA-256 hash of random bytes + timestamp for uniqueness.
 * @returns {string} 64-character hex string
 */
function generateSessionId() {
  const random = crypto.randomBytes(32).toString('hex');
  const timestamp = Date.now().toString(16);
  // Create a deterministic-looking but unpredictable ID
  return crypto.createHash('sha256').update(random + timestamp).digest('hex');
}

/**
 * Generate a QR code data URL containing session metadata.
 * The QR payload includes a unique session ID, timestamp, and subject.
 *
 * @param {Object} session - { sessionId, subject, expiresAt }
 * @returns {Promise<string>} Base64 data URL of the QR code
 */
async function generateQRDataUrl(session) {
  // Compact JSON payload for the QR code
  const payload = JSON.stringify({
    sid: session.sessionId,   // Session ID
    sub: session.subject,     // Subject name
    exp: session.expiresAt,   // ISO expiry timestamp
  });

  // Generate QR as a data URL (renders in <img> tags directly)
  const dataUrl = await QRCode.toDataURL(payload, {
    width: 400,
    margin: 2,
    color: {
      dark: '#1a1a2e',   // Dark color for QR modules
      light: '#eeff00ff',  // Background
    },
  });

  return dataUrl;
}

module.exports = { generateSessionId, generateQRDataUrl };

