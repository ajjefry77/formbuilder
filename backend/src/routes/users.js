import { Router } from "express";
import bcrypt from "bcryptjs";
import { pool } from "../db/index.js";
import {
  authenticate,
  requireAdmin,
  requireGroupManagerOrAdmin,
  checkUserOwnership,
} from "../middleware/auth.js";

const router = Router();
router.use(authenticate); // تمام مسیرهای این فایل نیاز به احراز هویت دارند

const PHONE_RE = /^09\d{9}$/;

// GET /api/users
// مدیر سیستم همه‌ی کاربران را می‌بیند؛ مدیر گروه فقط کاربرانی که خودش ساخته
router.get("/", requireGroupManagerOrAdmin, async (req, res) => {
  try {
    const isAdmin = req.user.role === "admin";
    let query = `
      SELECT u.id, u.full_name, u.phone, u.role, u.group_id, g.name AS group_name,
             u.is_active, u.created_at
      FROM users u LEFT JOIN groups g ON g.id = u.group_id`;
    const params = [];
    if (!isAdmin) {
      query += " WHERE u.created_by = $1";
      params.push(req.user.id);
    }
    const { rows } = await pool.query(
      query + " ORDER BY u.created_at DESC",
      params,
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/users  - ایجاد کاربر جدید (نام کاربری = شماره تماس)
router.post("/", requireGroupManagerOrAdmin, async (req, res) => {
  const {
    full_name,
    phone,
    password,
    role = "user",
    group_id = null,
  } = req.body;

  if (!full_name || !phone || !password) {
    return res
      .status(400)
      .json({ success: false, error: "نام، شماره تماس و رمز عبور الزامی است" });
  }

  // مدیر گروه فقط می‌تواند کاربر عادی بسازد
  if (req.user.role === "group_manager" && role !== "user") {
    return res
      .status(403)
      .json({ success: false, error: "مدیر گروه فقط می‌تواند کاربر عادی بسازد" });
  }

  let finalGroupId = group_id;

  if (req.user.role === "group_manager") {
    // مدیر گروه باید مشخص کند کاربر جدید عضو کدام یک از گروه‌های خودش باشد
    if (!finalGroupId) {
      return res
        .status(400)
        .json({ success: false, error: "انتخاب گروه برای کاربر جدید الزامی است" });
    }
    try {
      const g = await pool.query(
        "SELECT 1 FROM groups WHERE id = $1 AND created_by = $2",
        [finalGroupId, req.user.id],
      );
      if (!g.rows.length) {
        return res
          .status(403)
          .json({ success: false, error: "شما مالک این گروه نیستید" });
      }
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  try {
    const hash = await bcrypt.hash(password, 12);
    // کاربر تا زمانی که خودش برای اولین بار وارد شود غیرفعال باقی می‌ماند
    // (گروه از قبل تعیین شده، اما فعال‌سازی و دسترسی مؤثر با اولین ورود اتفاق می‌افتد)
    const { rows } = await pool.query(
      `INSERT INTO users (full_name, phone, password_hash, role, group_id, created_by, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, false)
       RETURNING id, full_name, phone, role, group_id, created_by, is_active`,
      [full_name, phone, hash, role, finalGroupId, req.user.id],
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    if (err.code === "23505")
      return res
        .status(409)
        .json({ success: false, error: "این شماره تماس قبلاً ثبت شده است" });
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/users/:id
// مدیر سیستم هر کاربری را ویرایش می‌کند؛ مدیر گروه فقط کاربرانی که خودش ساخته و فقط داخل گروه‌های خودش
router.put("/:id", requireGroupManagerOrAdmin, checkUserOwnership(), async (req, res) => {
  const { full_name, phone, password, role, group_id, is_active } = req.body;
  if (phone && !PHONE_RE.test(phone)) {
    return res
      .status(400)
      .json({ success: false, error: "شماره تماس معتبر نیست" });
  }

  const isAdmin = req.user.role === "admin";

  // مدیر گروه نمی‌تواند نقش کاربر را تغییر دهد یا او را از حالت «کاربر عادی» خارج کند
  if (!isAdmin && role && role !== "user") {
    return res
      .status(403)
      .json({ success: false, error: "مدیر گروه فقط می‌تواند کاربر عادی مدیریت کند" });
  }

  // مدیر گروه فقط می‌تواند کاربر را به یکی از گروه‌های خودش منتقل کند
  if (!isAdmin && group_id) {
    try {
      const g = await pool.query(
        "SELECT 1 FROM groups WHERE id = $1 AND created_by = $2",
        [group_id, req.user.id],
      );
      if (!g.rows.length) {
        return res
          .status(403)
          .json({ success: false, error: "شما مالک این گروه نیستید" });
      }
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  try {
    let passwordHash = null;
    if (password) {
      if (password.length < 6)
        return res
          .status(400)
          .json({
            success: false,
            error: "رمز عبور باید حداقل ۶ کاراکتر باشد",
          });
      passwordHash = await bcrypt.hash(password, 12);
    }
    const groupIdProvided = group_id !== undefined;
    const { rows } = await pool.query(
      `UPDATE users SET
         full_name = COALESCE($1, full_name),
         phone = COALESCE($2, phone),
         password_hash = COALESCE($3, password_hash),
         role = COALESCE($4, role),
         group_id = CASE WHEN $5 THEN $6 ELSE group_id END,
         is_active = COALESCE($7, is_active),
         updated_at = NOW()
       WHERE id = $8
       RETURNING id, full_name, phone, role, group_id, is_active, created_at`,
      [
        full_name,
        phone,
        passwordHash,
        isAdmin ? role : null,
        groupIdProvided,
        group_id ?? null,
        is_active,
        req.params.id,
      ],
    );
    if (!rows.length)
      return res.status(404).json({ success: false, error: "کاربر یافت نشد" });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    if (err.code === "23505")
      return res
        .status(409)
        .json({ success: false, error: "این شماره تماس قبلاً ثبت شده است" });
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/users/:id
// مدیر سیستم هر کاربری را حذف می‌کند؛ مدیر گروه فقط کاربرانی که خودش ساخته
router.delete("/:id", requireGroupManagerOrAdmin, checkUserOwnership(), async (req, res) => {
  if (req.params.id === req.user.id) {
    return res
      .status(400)
      .json({ success: false, error: "نمی‌توانید حساب خودتان را حذف کنید" });
  }
  try {
    const { rows } = await pool.query(
      "DELETE FROM users WHERE id = $1 RETURNING id",
      [req.params.id],
    );
    if (!rows.length)
      return res.status(404).json({ success: false, error: "کاربر یافت نشد" });
    res.json({ success: true, message: "کاربر حذف شد" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/users/:id/permissions
router.get("/:id/permissions", requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT form_id FROM form_user_permissions WHERE user_id = $1",
      [req.params.id],
    );
    res.json({ success: true, data: rows.map((r) => r.form_id) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/users/:id/permissions  { formIds: [...] }
router.put("/:id/permissions", requireAdmin, async (req, res) => {
  const { formIds = [] } = req.body;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM form_user_permissions WHERE user_id = $1", [
      req.params.id,
    ]);
    for (const formId of formIds) {
      await client.query(
        "INSERT INTO form_user_permissions (form_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [formId, req.params.id],
      );
    }
    await client.query("COMMIT");
    res.json({ success: true, message: "دسترسی‌های کاربر به‌روزرسانی شد" });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

export default router;
