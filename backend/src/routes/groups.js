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
    const isAdmin = req.user?.role === 'admin';
    let query = `
      SELECT g.id, g.name, g.description, g.created_at,
             COUNT(u.id)::int AS member_count
      FROM groups g 
      LEFT JOIN users u ON u.group_id = g.id`;

    const params = [];
    if (!isAdmin) {
      query += ' WHERE g.created_by = $1';
      params.push(req.user.id);
    }

    const { rows } = await pool.query(
      query + " GROUP BY g.id ORDER BY g.created_at DESC",
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
    if (req.user.role === "group_manager" && formIds.length) {
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

export default router;
