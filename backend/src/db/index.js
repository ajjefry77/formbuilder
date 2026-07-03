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

    // جداول بدون وابستگی حلقوی ساخته می‌شوند، FKها بعداً اضافه می‌شوند
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
        role VARCHAR(20) NOT NULL DEFAULT 'user' 
          CHECK (role IN ('admin', 'group_manager', 'user')),
        group_id BIGINT,
        created_by BIGINT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
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

    // اضافه کردن FKهای حلقوی
    try {
      await client.query(`ALTER TABLE groups ADD CONSTRAINT fk_groups_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL`);
    } catch (e) { if (!e.message.includes('already exists')) throw e; }
    try {
      await client.query(`ALTER TABLE users ADD CONSTRAINT fk_users_group_id FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE SET NULL`);
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

    const { rows } = await client.query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
    if (!rows.length) {
      const phone = process.env.DEFAULT_ADMIN_PHONE || "09120000000";
      const pass = process.env.DEFAULT_ADMIN_PASSWORD || "Admin@12345";
      const hash = await bcrypt.hash(pass, 12);
      await client.query(
        `INSERT INTO users (full_name, phone, password_hash, role, is_active)
         VALUES ($1, $2, $3, 'admin', true)
         ON CONFLICT (phone) DO NOTHING`,
        ["مدیر سیستم", phone, hash]
      );
      console.log(`👤 کاربر مدیر پیش‌فرض ساخته شد → شماره: ${phone} | رمز: ${pass}`);
    }
  } finally {
    client.release();
  }
}