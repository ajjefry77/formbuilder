import crypto from 'crypto';

const ALGO = 'aes-256-gcm';

function getKey() {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || !/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(
      'ENCRYPTION_KEY نامعتبر است. باید دقیقاً ۶۴ کاراکتر هگزادسیمال (۳۲ بایت) باشد. ' +
      'با دستور node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))" یکی بسازید.'
    );
  }
  return Buffer.from(hex, 'hex');
}

/**
 * رمزنگاری یک رشته یا آبجکت و بازگرداندن متن رمزشده به فرم "iv:authTag:cipherText" (base64)
 */
export function encrypt(plain) {
  const text = typeof plain === 'string' ? plain : JSON.stringify(plain);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('base64'), authTag.toString('base64'), encrypted.toString('base64')].join(':');
}

/**
 * بازگشایی رشته‌ی رمزشده با فرمت بالا و تبدیل به JSON (اگر قابل parse باشد)
 */
export function decrypt(payload) {
  if (!payload || typeof payload !== 'string' || !payload.includes(':')) return payload;
  const [ivB64, tagB64, dataB64] = payload.split(':');
  try {
    const decipher = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64')),
      decipher.final(),
    ]).toString('utf8');
    try {
      return JSON.parse(decrypted);
    } catch {
      return decrypted;
    }
  } catch (e) {
    return null; // داده خراب یا کلید نادرست
  }
}
