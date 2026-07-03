import jwt from "jsonwebtoken";
import { pool } from "../db/index.js";

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * توکن JWT ر از هدر Authorization می‌خواند و کاربر را روی req.user قرار می‌دهد.
 * در صورت نبود یا نامعتبر بودن توکن، خطای ۴۰۱ برمی‌گرداند.
 */
export function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token)
    return res.status(401).json({ success: false, error: "وارد نشده‌اید" });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload; // { id, phone, role, group_id, full_name }
    next();
  } catch (e) {
    return res
      .status(401)
      .json({ success: false, error: "نشست منقضی شده، دوباره وارد شوید" });
  }
}

/** مدیر سیستم یا مدیر گروه */
export function requireGroupManagerOrAdmin(req, res, next) {
  if (req.user?.role === 'admin' || req.user?.role === 'group_manager') {
    return next();
  }
  return res.status(403).json({ success: false, error: 'دسترسی کافی ندارید' });
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'فقط مدیر سیستم اجازه‌ی این عملیات را دارد' });
  }
  next();
}

// چک مالکیت کاربر (مدیر گروه فقط به کاربرانی دسترسی دارد که خودش ساخته)
export function checkUserOwnership() {
  return async (req, res, next) => {
    if (req.user?.role === 'admin') return next();

    const userId = req.params.id;
    try {
      const { rows } = await pool.query(
        'SELECT 1 FROM users WHERE id = $1 AND created_by = $2',
        [userId, req.user.id]
      );
      if (!rows.length) {
        return res.status(403).json({ success: false, error: 'شما مالک این کاربر نیستید' });
      }
      next();
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  };
}

// چک مالکیت گروه
export function checkGroupOwnership() {
  return async (req, res, next) => {
    if (req.user?.role === 'admin') return next();
    
    const groupId = req.params.id || req.body.group_id;
    if (!groupId) return next();

    try {
      const { rows } = await pool.query(
        'SELECT 1 FROM groups WHERE id = $1 AND created_by = $2',
        [groupId, req.user.id]
      );
      if (!rows.length) {
        return res.status(403).json({ success: false, error: 'شما مالک این گروه نیستید' });
      }
      next();
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  };
}

/**
 * بررسی می‌کند کاربر فعلی به فرم مشخص‌شده در پارامتر مسیر (پیش‌فرض :id) دسترسی دارد یا نه.
 * مدیر همیشه دسترسی کامل دارد. کاربر عادی باید یا دسترسی مستقیم داشته باشد یا از طریق گروه خودش.
 */
export function checkFormAccess(paramName = "id") {
  return async (req, res, next) => {
    if (req.user?.role === "admin") return next();

    const formId = req.params[paramName];
    try {
      const exists = await pool.query(
        'SELECT 1 FROM forms WHERE id = $1', [formId]
      );
      if (!exists.rows.length) {
        return res
          .status(404)
          .json({ success: false, error: "فرم یافت نشد" });
      }

      // مدیر گروه: فرم‌هایی که خودش ساخته یا به یکی از گروه‌های خودش اختصاص داده
      if (req.user?.role === "group_manager") {
        const owned = await pool.query(
          `SELECT 1 FROM forms f
             WHERE f.id = $1
               AND (f.created_by = $2 OR f.group_id IN (
                 SELECT id FROM groups WHERE created_by = $2
               ))`,
          [formId, req.user.id],
        );
        if (owned.rows.length) return next();
      }

      const result = await pool.query(
        `SELECT 1 FROM form_user_permissions WHERE form_id = $1 AND user_id = $2
         UNION
         SELECT 1 FROM form_group_permissions g
           JOIN users u ON u.group_id = g.group_id
           WHERE g.form_id = $1 AND u.id = $2
         LIMIT 1`,
        [formId, req.user.id],
      );
      if (!result.rows.length) {
        return res
          .status(403)
          .json({ success: false, error: "شما به این فرم دسترسی ندارید" });
      }
      next();
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  };
}

