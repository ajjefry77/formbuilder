import { Router } from "express";
import { pool } from "../db/index.js";
import {
  authenticate,
  requireGroupManagerOrAdmin,
  checkGroupOwnership,
} from "../middleware/auth.js";

const router = Router();
router.use(authenticate, requireGroupManagerOrAdmin);

// GET /api/groups
router.get("/", async (req, res) => {
  try {
    const isAdmin = req.user?.roles?.includes('admin');
    let query = `
      SELECT g.id, g.name, g.description, g.created_at,
             (SELECT COUNT(*)::int FROM user_groups WHERE group_id = g.id) AS member_count
      FROM groups g`;

    const params = [];
    if (!isAdmin) {
      query += ' WHERE g.created_by = $1';
      params.push(req.user.id);
    }

    const { rows } = await pool.query(
      query + " ORDER BY g.created_at DESC",
      params,
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/groups  { name, description }
router.post('/', async (req, res) => {
  const { name, description = '' } = req.body;
  try {
    const { rows } = await pool.query(
      'INSERT INTO groups (name, description, created_by) VALUES ($1, $2, $3) RETURNING *',
      [name, description, req.user.id]
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/groups/:id
router.put("/:id", checkGroupOwnership(), async (req, res) => {
  const { name, description } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE groups SET name = COALESCE($1, name), description = COALESCE($2, description)
       WHERE id = $3 RETURNING *`,
      [name, description, req.params.id],
    );
    if (!rows.length)
      return res.status(404).json({ success: false, error: "گروه یافت نشد" });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/groups/:id  (کاربران عضو گروه حذف نمی‌شوند، فقط group_id آن‌ها خالی می‌شود)
router.delete("/:id", checkGroupOwnership(), async (req, res) => {
  try {
    const { rows } = await pool.query(
      "DELETE FROM groups WHERE id = $1 RETURNING id",
      [req.params.id],
    );
    if (!rows.length)
      return res.status(404).json({ success: false, error: "گروه یافت نشد" });
    res.json({ success: true, message: "گروه حذف شد" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/groups/:id/permissions
router.get("/:id/permissions", checkGroupOwnership(), async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT form_id FROM form_group_permissions WHERE group_id = $1",
      [req.params.id],
    );
    res.json({ success: true, data: rows.map((r) => r.form_id) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/groups/:id/permissions  { formIds: [...] }
router.put("/:id/permissions", checkGroupOwnership(), async (req, res) => {
  let { formIds = [] } = req.body;
  const client = await pool.connect();
  try {
    // مدیر گروه فقط می‌تواند فرم‌های خودش را به گروه خودش اختصاص دهد
    if (req.user.roles?.includes("group_manager") && formIds.length) {
      const owned = await client.query(
        `SELECT id FROM forms WHERE id = ANY($1::bigint[])
           AND (created_by = $2 OR group_id IN (SELECT id FROM groups WHERE created_by = $2))`,
        [formIds, req.user.id],
      );
      formIds = owned.rows.map((r) => r.id);
    }

    await client.query("BEGIN");
    await client.query(
      "DELETE FROM form_group_permissions WHERE group_id = $1",
      [req.params.id],
    );
    for (const formId of formIds) {
      await client.query(
        "INSERT INTO form_group_permissions (form_id, group_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [formId, req.params.id],
      );
    }
    await client.query("COMMIT");
    res.json({ success: true, message: "دسترسی‌های گروه به‌روزرسانی شد" });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

// GET /api/groups/:id/members
router.get("/:id/members", checkGroupOwnership(), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.full_name, u.phone, u.is_active,
              ARRAY(SELECT role FROM user_roles WHERE user_id = u.id) AS roles
       FROM user_groups ug
       JOIN users u ON u.id = ug.user_id
       WHERE ug.group_id = $1
       ORDER BY u.full_name`,
      [req.params.id],
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/groups/:id/members  { userIds: [...] }
router.put("/:id/members", checkGroupOwnership(), async (req, res) => {
  const { userIds = [] } = req.body;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // مدیر گروه فقط می‌تواند کاربرانی را اضافه کند که خودش ساخته
    if (req.user.roles?.includes("group_manager") && userIds.length) {
      const owned = await client.query(
        `SELECT id FROM users WHERE id = ANY($1::bigint[]) AND created_by = $2`,
        [userIds, req.user.id],
      );
      const ownedIds = owned.rows.map(r => r.id);
      const invalid = userIds.filter(id => !ownedIds.includes(id));
      if (invalid.length) {
        await client.query("ROLLBACK");
        return res.status(403).json({
          success: false,
          error: "شما به برخی از این کاربران دسترسی ندارید",
        });
      }
    }

    await client.query("DELETE FROM user_groups WHERE group_id = $1", [req.params.id]);
    for (const userId of userIds) {
      await client.query(
        "INSERT INTO user_groups (user_id, group_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [userId, req.params.id],
      );
    }
    await client.query("COMMIT");
    res.json({ success: true, message: "اعضای گروه به‌روزرسانی شدند" });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

export default router;
