// A lightweight app-lock for the web build: a 4-6 digit PIN, hashed with
// SubtleCrypto (SHA-256) so the raw PIN is never stored. This isn't meant
// to be bank-grade security — it just keeps the passbook from opening if
// someone picks up your phone, since a real biometric API isn't available
// to plain web pages the way it is in a native app.

async function sha256(text) {
  const enc = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashPin(pin) {
  return sha256("gpf-passbook:" + pin);
}

export async function verifyPin(pin, storedHash) {
  const h = await hashPin(pin);
  return h === storedHash;
}
