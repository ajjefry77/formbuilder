import { Router } from "express";
import { pool } from "../db/index.js";
import {
  authenticate,
  requireAdmin,
  checkFormAccess,
  requireGroupManagerOrAdmin,
} from "../middleware/auth.js";
import { encrypt, decrypt } from "../utils/crypto.js";
import rateLimit from 'express-rate-limit';
import {
  createFormSchema,
  updateFormSchema,
  submitFormSchema,
  validate,
} from '../utils/validation.js';

const router = Router();

const submitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'تعداد درخواست‌ها بیش از حد مجاز است. کمی بعد دوباره تلاش کنید',
  },
});

// GET all forms
router.get("/", authenticate, async (req, res) => {
  try {
    let result;
    if (req.user.role === "admin") {
      result = await pool.query("SELECT * FROM forms ORDER BY created_at DESC");
    } else if (req.user.role === "group_manager") {
      result = await pool.query(
        `
        SELECT * FROM forms 
        WHERE created_by = $1 OR group_id IN (
          SELECT id FROM groups WHERE created_by = $1
        )
        ORDER BY created_at DESC`,
        [req.user.id],
      );
    } else {
      result = await pool.query(
        `SELECT * FROM forms WHERE id IN (
           SELECT form_id FROM form_user_permissions WHERE user_id = $1
           UNION
           SELECT fgp.form_id FROM form_group_permissions fgp
             JOIN users u ON u.group_id = fgp.group_id WHERE u.id = $1
         )
         ORDER BY created_at DESC`,
        [req.user.id],
      );
    }
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET single form
router.get("/:id", authenticate, checkFormAccess("id"), async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM forms WHERE id = $1", [
      req.params.id,
    ]);
    if (!result.rows.length)
      return res.status(404).json({ success: false, error: "فرم یافت نشد" });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET public form
router.get("/:id/public", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, title, description, fields, is_active FROM forms WHERE id = $1 AND is_active = true",
      [req.params.id],
    );
    if (!result.rows.length)
      return res
        .status(404)
        .json({ success: false, error: "فرم فعال یافت نشد" });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST create form
router.post("/", authenticate, requireGroupManagerOrAdmin, async (req, res) => {
  const parsed = validate(createFormSchema, req.body);

  if (!parsed.success) {
    return res.status(400).json(parsed);
  }

  const {
    title,
    description,
    fields,
    settings,
    group_id = null,
  } = parsed.data;

  try {
    // مدیر گروه فقط می‌تواند به گروه خودش اختصاص دهد
    if (req.user.role === "group_manager" && group_id) {
      const { rows } = await pool.query(
        "SELECT 1 FROM groups WHERE id = $1 AND created_by = $2",
        [group_id, req.user.id],
      );
      if (!rows.length) {
        return res
          .status(403)
          .json({ success: false, error: "شما مالک این گروه نیستید" });
      }
    }

    const result = await pool.query(
      `INSERT INTO forms (title, description, fields, settings, created_by, group_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        title,
        description,
        JSON.stringify(fields),
        JSON.stringify(settings),
        req.user.id,
        group_id,
      ],
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT update form
router.put("/:id", authenticate, checkFormAccess("id"), async (req, res) => {
  const parsed = validate(updateFormSchema, req.body);

  if (!parsed.success) {
    return res.status(400).json(parsed);
  }

  const { title, description, fields, settings, group_id, is_active } = parsed.data;

  try {
    // مدیر گروه فقط می‌تواند فرم را به یکی از گروه‌های خودش اختصاص دهد
    const groupIdProvided = group_id !== undefined;
    if (groupIdProvided && req.user.role === "group_manager" && group_id !== null) {
      const { rows } = await pool.query(
        "SELECT 1 FROM groups WHERE id = $1 AND created_by = $2",
        [group_id, req.user.id],
      );
      if (!rows.length) {
        return res
          .status(403)
          .json({ success: false, error: "شما مالک این گروه نیستید" });
      }
    }

    const result = await pool.query(
      `UPDATE forms
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           fields = COALESCE($3, fields),
           settings = COALESCE($4, settings),
           is_active = COALESCE($5, is_active),
           group_id = CASE WHEN $6 THEN $7 ELSE group_id END,
           updated_at = NOW()
       WHERE id = $8 RETURNING *`,
      [
        title,
        description,
        fields ? JSON.stringify(fields) : null,
        settings ? JSON.stringify(settings) : null,
        is_active,
        groupIdProvided,
        group_id ?? null,
        req.params.id,
      ],
    );
    if (!result.rows.length)
      return res.status(404).json({ success: false, error: "فرم یافت نشد" });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE form (مدیر سیستم همه‌ی فرم‌ها را می‌تواند حذف کند؛ مدیر گروه فقط فرم‌های خودش را)
router.delete(
  "/:id",
  authenticate,
  requireGroupManagerOrAdmin,
  checkFormAccess("id"),
  async (req, res) => {
    try {
    const result = await pool.query(
      "DELETE FROM forms WHERE id = $1 RETURNING id",
      [req.params.id],
    );
    if (!result.rows.length)
      return res.status(404).json({ success: false, error: "فرم یافت نشد" });
    res.json({ success: true, message: "فرم با موفقیت حذف شد" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET submissions
router.get(
  "/:id/submissions",
  authenticate,
  checkFormAccess("id"),
  async (req, res) => {
    try {
      const { sort = "desc", from, to, filters: filtersJson, filter_logic = "AND" } = req.query;

      const conditions = ["fs.form_id = $1"];
      const params = [req.params.id];
      let idx = 2;

      if (from) {
        conditions.push(`fs.submitted_at >= $${idx++}`);
        params.push(from);
      }

      if (to) {
        conditions.push(`fs.submitted_at <= $${idx++}`);
        params.push(to);
      }

      let filters = [];
      if (filtersJson) {
        try {
          filters = JSON.parse(filtersJson);
        } catch {
          return res.status(400).json({ success: false, error: "فیلترها معتبر نیستند" });
        }
      }

      if (filters.length > 0) {
        const fieldConditions = filters.map((f) => {
          const { field_key, operator, value } = f;
          const logic = operator || "contains";

          const keyParam = `$${idx++}`;
          let cond = "";

          switch (logic) {
            case "eq":
              cond = `EXISTS (SELECT 1 FROM response_values rv WHERE rv.response_id = fs.id AND rv.field_key = ${keyParam} AND rv.value_text = $${idx++})`;
              params.push(field_key, value);
              break;
            case "neq":
              cond = `EXISTS (SELECT 1 FROM response_values rv WHERE rv.response_id = fs.id AND rv.field_key = ${keyParam} AND rv.value_text != $${idx++})`;
              params.push(field_key, value);
              break;
            case "contains":
              cond = `EXISTS (SELECT 1 FROM response_values rv WHERE rv.response_id = fs.id AND rv.field_key = ${keyParam} AND rv.value_text ILIKE $${idx++})`;
              params.push(field_key, `%${value}%`);
              break;
            case "not_contains":
              cond = `EXISTS (SELECT 1 FROM response_values rv WHERE rv.response_id = fs.id AND rv.field_key = ${keyParam} AND rv.value_text NOT ILIKE $${idx++})`;
              params.push(field_key, `%${value}%`);
              break;
            case "gt":
              cond = `EXISTS (SELECT 1 FROM response_values rv WHERE rv.response_id = fs.id AND rv.field_key = ${keyParam} AND (rv.value_number > $${idx++} OR rv.value_date > $${idx++} OR rv.value_datetime > $${idx++}))`;
              params.push(field_key, value, value, value);
              break;
            case "gte":
              cond = `EXISTS (SELECT 1 FROM response_values rv WHERE rv.response_id = fs.id AND rv.field_key = ${keyParam} AND (rv.value_number >= $${idx++} OR rv.value_date >= $${idx++} OR rv.value_datetime >= $${idx++}))`;
              params.push(field_key, value, value, value);
              break;
            case "lt":
              cond = `EXISTS (SELECT 1 FROM response_values rv WHERE rv.response_id = fs.id AND rv.field_key = ${keyParam} AND (rv.value_number < $${idx++} OR rv.value_date < $${idx++} OR rv.value_datetime < $${idx++}))`;
              params.push(field_key, value, value, value);
              break;
            case "lte":
              cond = `EXISTS (SELECT 1 FROM response_values rv WHERE rv.response_id = fs.id AND rv.field_key = ${keyParam} AND (rv.value_number <= $${idx++} OR rv.value_date <= $${idx++} OR rv.value_datetime <= $${idx++}))`;
              params.push(field_key, value, value, value);
              break;
            case "is_empty":
              cond = `NOT EXISTS (SELECT 1 FROM response_values rv WHERE rv.response_id = fs.id AND rv.field_key = ${keyParam} AND rv.value_text IS NOT NULL AND rv.value_text != '')`;
              params.push(field_key);
              break;
            case "is_not_empty":
              cond = `EXISTS (SELECT 1 FROM response_values rv WHERE rv.response_id = fs.id AND rv.field_key = ${keyParam} AND rv.value_text IS NOT NULL AND rv.value_text != '')`;
              params.push(field_key);
              break;
            default:
              cond = `EXISTS (SELECT 1 FROM response_values rv WHERE rv.response_id = fs.id AND rv.field_key = ${keyParam} AND rv.value_text ILIKE $${idx++})`;
              params.push(field_key, `%${value}%`);
          }

          return cond;
        });

        const joinLogic = filter_logic.toUpperCase() === "OR" ? "OR" : "AND";
        conditions.push(`(${fieldConditions.join(` ${joinLogic} `)})`);
      }

      const order = sort === "asc" ? "ASC" : "DESC";

      const result = await pool.query(
        `SELECT fs.id, fs.form_id, fs.data, fs.submitted_at
         FROM form_submissions fs
         WHERE ${conditions.join(" AND ")}
         ORDER BY fs.submitted_at ${order}`,
        params,
      );

      const rows = result.rows.map((r) => ({ ...r, data: decrypt(r.data) }));
      res.json({ success: true, data: rows });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  },
);

// POST submit form (با ذخیره در response_values)
// POST submit form
router.post("/:id/submit", submitLimiter, async (req, res) => {
  const parsed = validate(submitFormSchema, req.body);

  if (!parsed.success) {
    return res.status(400).json(parsed);
  }

  const { data } = parsed.data;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const formResult = await client.query(
      "SELECT id, fields FROM forms WHERE id = $1 AND is_active = true",
      [req.params.id],
    );

    if (!formResult.rows.length) {
      await client.query("ROLLBACK");
      return res
        .status(404)
        .json({ success: false, error: "فرم فعال یافت نشد" });
    }

    const form = formResult.rows[0];
    const encryptedData = encrypt(data || {});

    const submissionResult = await client.query(
      "INSERT INTO form_submissions (form_id, data) VALUES ($1, $2) RETURNING id",
      [req.params.id, encryptedData],
    );

    const submissionId = submissionResult.rows[0].id;

    if (data && typeof data === "object") {
      const fields = Array.isArray(form.fields) ? form.fields : [];
      const inserts = [];

      for (const [key, value] of Object.entries(data)) {
        const fieldInfo = fields.find(
          (f) => String(f.id) === String(key) || f.key === key,
        );

        let value_text = null,
          value_number = null,
          value_boolean = null,
          value_date = null,
          value_datetime = null,
          value_json = null;

        if (value == null || value === "") continue;

        if (typeof value === "string") {
          value_text = value;
          if (/^\d{4}-\d{2}-\d{2}/.test(value)) value_date = value;
        } else if (typeof value === "number") {
          value_number = value;
          value_text = String(value);
        } else if (typeof value === "boolean") {
          value_boolean = value;
          value_text = String(value);
        } else {
          value_json = value;
          value_text = JSON.stringify(value);
        }

        inserts.push([
          req.params.id,
          submissionId,
          fieldInfo?.id ? Number(fieldInfo.id) : null,
          key,
          fieldInfo?.type || null,
          value_text,
          value_number,
          value_boolean,
          value_date,
          value_datetime,
          value_json,
        ]);
      }

      if (inserts.length) {
        const values = [];
        const placeholders = inserts.map((row, rowIndex) => {
          const start = rowIndex * 11;
          values.push(...row);

          return `($${start + 1}, $${start + 2}, $${start + 3}, $${start + 4}, $${start + 5}, $${start + 6}, $${start + 7}, $${start + 8}, $${start + 9}, $${start + 10}, $${start + 11})`;
        });

        await client.query(
          `INSERT INTO response_values
            (form_id, response_id, field_id, field_key, field_type,
             value_text, value_number, value_boolean, value_date, value_datetime, value_json)
           VALUES ${placeholders.join(', ')}`,
          values,
        );
      }
    }

    await client.query("COMMIT");
    res.status(201).json({ success: true, data: { id: submissionId } });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Submit Error:", err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

export default router;
