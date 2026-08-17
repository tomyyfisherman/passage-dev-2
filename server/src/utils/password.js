const crypto = require('node:crypto');

const KEY_LENGTH = 64;

function hashPassword(plainPassword) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(plainPassword, salt, KEY_LENGTH);
  return `${salt}:${derivedKey.toString('hex')}`;
}

function verifyPassword(plainPassword, storedHash) {
  const [salt, key] = storedHash.split(':');
  if (!salt || !key) return false;
  const keyBuffer = Buffer.from(key, 'hex');
  const derivedKey = crypto.scryptSync(plainPassword, salt, KEY_LENGTH);
  if (keyBuffer.length !== derivedKey.length) return false;
  return crypto.timingSafeEqual(keyBuffer, derivedKey);
}

module.exports = { hashPassword, verifyPassword };
