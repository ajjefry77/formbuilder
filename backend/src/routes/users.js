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
router.use(authenticate);

const PHONE_RE = /^09\d{9}$/;

function hasRole(user, role) {
  return user?.roles?.includes(role);
}

// GET /api/users
router.get("/", requireGroupManagerOrAdmin, async (req, res) => {
  try {
    const isAdmin = hasRole(req.user, 'admin');
    let query = `
      SELECT u.id, u.full_name, u.phone, u.is_active, u.created_at
      FROM users u`;
    const params = [];
    if (!isAdmin) {
      query += " WHERE u.created_by = $1";
      params.push(req.user.id);
    }
    query += " ORDER BY u.created_at DESC";
    const { rows } = await pool.query(query, params);
    // گرفتن roles و group_ids برای هر کاربر
    const data = await Promise.all(rows.map(async (u) => {
      const [roles, groups] = await Promise.all([
        pool.query("SELECT role FROM user_roles WHERE user_id = $1", [u.id]),
        pool.query(
          `SELECT g.id, g.name FROM user_groups ug JOIN groups g ON g.id = ug.group_id WHERE ug.user_id = $1`,
          [u.id]
        ),
      ]);
      return {
        ...u,
        roles: roles.rows.map(r => r.role),
        groups: groups.rows.map(g => ({ id: g.id, name: g.name })),
      };
    }));
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/users
router.post("/", requireGroupManagerOrAdmin, async (req, res) => {
  const {
    full_name,
    phone,
    password,
    roles = ["user"],
    group_ids = [],
  } = req.body;

  if (!full_name || !phone || !password) {
    return res
      .status(400)
      .json({ success: false, error: "نام، شماره تماس و رمز عبور الزامی است" });
  }

  if (hasRole(req.user, 'group_manager')) {
    if (roles.some(r => r !== 'user')) {
      return res
        .status(403)
        .json({ success: false, error: "مدیر گروه فقط می‌تواند کاربر عادی بسازد" });
    }
    if (!group_ids.length) {
      return res
        .status(400)
        .json({ success: false, error: "انتخاب حداقل یک گروه برای کاربر جدید الزامی است" });
    }
    for (const gId of group_ids) {
      const g = await pool.query(
        "SELECT 1 FROM groups WHERE id = $1 AND created_by = $2",
        [gId, req.user.id],
      );
      if (!g.rows.length) {
        return res
          .status(403)
          .json({ success: false, error: `شما مالک گروه ${gId} نیستید` });
      }
    }
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const hash = await bcrypt.hash(password, 12);
    const { rows } = await client.query(
      `INSERT INTO users (full_name, phone, password_hash, created_by, is_active)
       VALUES ($1, $2, $3, $4, false)
       RETURNING id, full_name, phone, is_active`,
      [full_name, phone, hash, req.user.id],
    );
    const userId = rows[0].id;

    for (const role of roles) {
      await client.query(
        "INSERT INTO user_roles (user_id, role) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [userId, role],
      );
    }
    for (const gId of group_ids) {
      await client.query(
        "INSERT INTO user_groups (user_id, group_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [userId, gId],
      );
    }
    await client.query("COMMIT");
    res.status(201).json({ success: true, data: { ...rows[0], roles, group_ids } });
  } catch (err) {
    await client.query("ROLLBACK");
    if (err.code === "23505")
      return res
        .status(409)
        .json({ success: false, error: "این شماره تماس قبلاً ثبت شده است" });
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

// PUT /api/users/:id
router.put("/:id", requireGroupManagerOrAdmin, checkUserOwnership(), async (req, res) => {
  const { full_name, phone, password, roles, group_ids, is_active } = req.body;
  if (phone && !PHONE_RE.test(phone)) {
    return res
      .status(400)
      .json({ success: false, error: "شماره تماس معتبر نیست" });
  }

  const isAdmin = hasRole(req.user, 'admin');

  if (!isAdmin && roles) {
    if (roles.some(r => r !== 'user')) {
      return res
        .status(403)
        .json({ success: false, error: "مدیر گروه فقط می‌تواند کاربر عادی مدیریت کند" });
    }
  }

  if (!isAdmin && group_ids?.length) {
    for (const gId of group_ids) {
      const g = await pool.query(
        "SELECT 1 FROM groups WHERE id = $1 AND created_by = $2",
        [gId, req.user.id],
      );
      if (!g.rows.length) {
        return res
          .status(403)
          .json({ success: false, error: `شما مالک گروه ${gId} نیستید` });
      }
    }
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

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

    const { rows } = await client.query(
      `UPDATE users SET
         full_name = COALESCE($1, full_name),
         phone = COALESCE($2, phone),
         password_hash = COALESCE($3, password_hash),
         is_active = COALESCE($4, is_active),
         updated_at = NOW()
       WHERE id = $5
       RETURNING id, full_name, phone, is_active, created_at`,
      [
        full_name,
        phone,
        passwordHash,
        is_active,
        req.params.id,
      ],
    );
    if (!rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, error: "کاربر یافت نشد" });
    }

    if (roles && isAdmin) {
      await client.query("DELETE FROM user_roles WHERE user_id = $1", [req.params.id]);
      for (const role of roles) {
        await client.query(
          "INSERT INTO user_roles (user_id, role) VALUES ($1, $2) ON CONFLICT DO NOTHING",
          [req.params.id, role],
        );
      }
    }
    if (group_ids !== undefined) {
      await client.query("DELETE FROM user_groups WHERE user_id = $1", [req.params.id]);
      for (const gId of group_ids) {
        await client.query(
          "INSERT INTO user_groups (user_id, group_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
          [req.params.id, gId],
        );
      }
    }

    await client.query("COMMIT");
    const [finalRoles, finalGroups] = await Promise.all([
      pool.query("SELECT role FROM user_roles WHERE user_id = $1", [req.params.id]),
      pool.query(
        `SELECT g.id, g.name FROM user_groups ug JOIN groups g ON g.id = ug.group_id WHERE ug.user_id = $1`,
        [req.params.id]
      ),
    ]);
    res.json({
      success: true,
      data: {
        ...rows[0],
        roles: finalRoles.rows.map(r => r.role),
        groups: finalGroups.rows.map(g => ({ id: g.id, name: g.name })),
      },
    });
  } catch (err) {
    await client.query("ROLLBACK");
    if (err.code === "23505")
      return res
        .status(409)
        .json({ success: false, error: "این شماره تماس قبلاً ثبت شده است" });
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

// DELETE /api/users/:id
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
