import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { pool } from "../db/index.js";
import { authenticate, fetchUserRoles, fetchUserGroupIds } from "../middleware/auth.js";

const router = Router();

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
      full_name: user.full_name,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" },
  );
}

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
    if (!user.is_active) {
      const ug = await pool.query(
        'SELECT group_id FROM user_groups WHERE user_id = $1 LIMIT 1',
        [user.id]
      );
      if (!ug.rows.length && user.created_by) {
        const g = await pool.query(
          'SELECT id FROM groups WHERE created_by = $1 ORDER BY id LIMIT 1',
          [user.created_by]
        );
        if (g.rows.length) {
          await pool.query(
            'INSERT INTO user_groups (user_id, group_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [user.id, g.rows[0].id]
          );
        }
      }
      await pool.query(
        'UPDATE users SET is_active = true, updated_at = NOW() WHERE id = $1',
        [user.id],
      );
      user.is_active = true;
    }

    const [roles, group_ids] = await Promise.all([
      fetchUserRoles(user.id),
      fetchUserGroupIds(user.id),
    ]);

    const token = signToken(user);

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          full_name: user.full_name,
          phone: user.phone,
          roles,
          group_ids,
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
      `SELECT u.id, u.full_name, u.phone, u.created_at
       FROM users u WHERE u.id = $1`,
      [req.user.id],
    );
    if (!rows.length)
      return res.status(404).json({ success: false, error: "کاربر یافت نشد" });
    const [roles, group_ids] = await Promise.all([
      fetchUserRoles(req.user.id),
      fetchUserGroupIds(req.user.id),
    ]);
    res.json({ success: true, data: { ...rows[0], roles, group_ids } });
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
