import pg from 'pg';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || "formbuilder",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "",
  ssl: false,
});

export async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS groups (
        id BIGSERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        description TEXT,
        created_by BIGINT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS users (
        id BIGSERIAL PRIMARY KEY,
        full_name VARCHAR(255) NOT NULL,
        phone VARCHAR(20) NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_by BIGINT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS user_roles (
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'group_manager', 'user')),
        PRIMARY KEY (user_id, role)
      );

      CREATE TABLE IF NOT EXISTS user_groups (
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        group_id BIGINT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        PRIMARY KEY (user_id, group_id)
      );

      CREATE TABLE IF NOT EXISTS forms (
        id BIGSERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        fields JSONB NOT NULL DEFAULT '[]',
        settings JSONB NOT NULL DEFAULT '{}',
        is_active BOOLEAN DEFAULT true,
        created_by BIGINT,
        group_id BIGINT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS form_submissions (
        id BIGSERIAL PRIMARY KEY,
        form_id BIGINT NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
        data TEXT NOT NULL,
        submitted_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS response_values (
        id BIGSERIAL PRIMARY KEY,
        form_id BIGINT NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
        response_id BIGINT NOT NULL REFERENCES form_submissions(id) ON DELETE CASCADE,
        field_id BIGINT,
        field_key TEXT,
        field_type TEXT,
        value_text TEXT,
        value_number NUMERIC,
        value_boolean BOOLEAN,
        value_date DATE,
        value_datetime TIMESTAMP,
        value_json JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS form_user_permissions (
        form_id BIGINT NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        PRIMARY KEY (form_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS form_group_permissions (
        form_id BIGINT NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
        group_id BIGINT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        PRIMARY KEY (form_id, group_id)
      );

      CREATE INDEX IF NOT EXISTS idx_submissions_form_id ON form_submissions(form_id);
      CREATE INDEX IF NOT EXISTS idx_response_values_form_id ON response_values(form_id);
      CREATE INDEX IF NOT EXISTS idx_response_values_response_id ON response_values(response_id);
      CREATE INDEX IF NOT EXISTS idx_response_values_field_id ON response_values(field_id);
    `);

    // مهاجرت داده‌های قدیمی به جدول‌های جدید
    // اگر ستون role هنوز وجود دارد، داده‌ها را به user_roles منتقل کن
    const hasRoleCol = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'role'
    `);
    if (hasRoleCol.rows.length) {
      await client.query(`
        INSERT INTO user_roles (user_id, role)
        SELECT id, role FROM users WHERE role IS NOT NULL
        ON CONFLICT DO NOTHING
      `);
      await client.query(`
        ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check
      `);
      await client.query(`
        ALTER TABLE users DROP COLUMN IF EXISTS role
      `);
    }

    // اگر ستون group_id هنوز وجود دارد، داده‌ها را به user_groups منتقل کن
    const hasGroupIdCol = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'group_id'
    `);
    if (hasGroupIdCol.rows.length) {
      await client.query(`
        INSERT INTO user_groups (user_id, group_id)
        SELECT id, group_id FROM users WHERE group_id IS NOT NULL
        ON CONFLICT DO NOTHING
      `);
      try {
        await client.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS fk_users_group_id`);
      } catch (e) {}
      await client.query(`
        ALTER TABLE users DROP COLUMN IF EXISTS group_id
      `);
    }

    // اضافه کردن FKهای حلقوی
    try {
      await client.query(`ALTER TABLE groups ADD CONSTRAINT fk_groups_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL`);
    } catch (e) { if (!e.message.includes('already exists')) throw e; }
    try {
      await client.query(`ALTER TABLE users ADD CONSTRAINT fk_users_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL`);
    } catch (e) { if (!e.message.includes('already exists')) throw e; }
    try {
      await client.query(`ALTER TABLE forms ADD CONSTRAINT fk_forms_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL`);
    } catch (e) { if (!e.message.includes('already exists')) throw e; }
    try {
      await client.query(`ALTER TABLE forms ADD CONSTRAINT fk_forms_group_id FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE SET NULL`);
    } catch (e) { if (!e.message.includes('already exists')) throw e; }

    console.log("✅ Database tables initialized with BIGINT IDs");

    // بررسی وجود ادمین از طریق user_roles
    const { rows } = await client.query(
      "SELECT user_id FROM user_roles WHERE role = 'admin' LIMIT 1"
    );
    if (!rows.length) {
      const phone = process.env.DEFAULT_ADMIN_PHONE || "09120000000";
      const pass = process.env.DEFAULT_ADMIN_PASSWORD || "Admin@12345";
      const hash = await bcrypt.hash(pass, 12);
      const result = await client.query(
        `INSERT INTO users (full_name, phone, password_hash, is_active)
         VALUES ($1, $2, $3, true)
         ON CONFLICT (phone) DO UPDATE SET password_hash = EXCLUDED.password_hash
         RETURNING id`,
        ["مدیر سیستم", phone, hash]
      );
      const adminId = result.rows[0].id;
      await client.query(
        `INSERT INTO user_roles (user_id, role) VALUES ($1, 'admin') ON CONFLICT DO NOTHING`,
        [adminId]
      );
      console.log(`👤 کاربر مدیر پیش‌فرض ساخته شد → شماره: ${phone} | رمز: ${pass}`);
    }
  } finally {
    client.release();
  }
}