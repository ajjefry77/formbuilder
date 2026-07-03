import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { pool } from "../db/index.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

// محدودیت تلاش ورود برای جلوگیری از حمله‌ی brute-force روی رمز عبور
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: {
    success: false,
    error:
      "تعداد تلاش‌های ورود بیش از حد مجاز است، چند دقیقه بعد دوباره امتحان کنید",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      phone: user.phone,
      role: user.role,
      group_id: user.group_id,
      full_name: user.full_name,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" },
  );
}

// POST /api/auth/login  { phone, password }
// POST /api/auth/login
router.post("/login", loginLimiter, async (req, res) => {
  const { phone, password } = req.body;
  if (!phone || !password) {
    return res
      .status(400)
      .json({ success: false, error: "شماره تماس و رمز عبور الزامی است" });
  }
  try {
    const { rows } = await pool.query("SELECT * FROM users WHERE phone = $1", [
      phone,
    ]);
    const user = rows[0];

    if (!user) {
      return res
        .status(401)
        .json({ success: false, error: "نام کاربری یا رمز عبور اشتباه است" });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res
        .status(401)
        .json({ success: false, error: "نام کاربری یا رمز عبور اشتباه است" });
    }

    // فعال‌سازی اتوماتیک کاربر بعد از اولین لاگین موفق
    // گروه کاربر از قبل (هنگام ایجاد توسط مدیر گروه) تعیین شده؛ اینجا فقط فعال می‌شود.
    // اگر به هر دلیلی گروهی تعیین نشده بود ولی سازنده‌ی او مدیرگروه بود، به عنوان تمهید عقب‌افتادگی
    // به اولین گروه سازنده ملحق می‌شود.
    if (!user.is_active) {
      let groupId = user.group_id;
      if (!groupId && user.created_by) {
        const g = await pool.query(
          'SELECT id FROM groups WHERE created_by = $1 ORDER BY id LIMIT 1',
          [user.created_by]
        );
        if (g.rows.length) groupId = g.rows[0].id;
      }
      await pool.query(
        'UPDATE users SET is_active = true, group_id = COALESCE($1, group_id), updated_at = NOW() WHERE id = $2',
        [groupId, user.id],
      );
      user.is_active = true;
      if (groupId) user.group_id = groupId;
    }

    const token = signToken(user);

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          full_name: user.full_name,
          phone: user.phone,
          role: user.role,
          group_id: user.group_id,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/auth/me
router.get("/me", authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.full_name, u.phone, u.role, u.group_id, g.name AS group_name
       FROM users u LEFT JOIN groups g ON g.id = u.group_id WHERE u.id = $1`,
      [req.user.id],
    );
    if (!rows.length)
      return res.status(404).json({ success: false, error: "کاربر یافت نشد" });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const changePasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  message: {
    success: false,
    error: "تعداد تلاش‌های تغییر رمز بیش از حد مجاز است، چند دقیقه بعد دوباره امتحان کنید",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /api/auth/change-password  { currentPassword, newPassword }
router.post("/change-password", authenticate, changePasswordLimiter, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword || newPassword.length < 6) {
    return res
      .status(400)
      .json({ success: false, error: "رمز جدید باید حداقل ۶ کاراکتر باشد" });
  }
  try {
    const { rows } = await pool.query("SELECT * FROM users WHERE id = $1", [
      req.user.id,
    ]);
    const user = rows[0];
    const ok = await bcrypt.compare(currentPassword, user.password_hash);
    if (!ok)
      return res
        .status(401)
        .json({ success: false, error: "رمز فعلی اشتباه است" });

    const hash = await bcrypt.hash(newPassword, 12);
    await pool.query(
      "UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2",
      [hash, req.user.id],
    );
    res.json({ success: true, message: "رمز عبور با موفقیت تغییر کرد" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
