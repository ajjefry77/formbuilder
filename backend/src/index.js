import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { initDB } from './db/index.js';
import formsRouter from './routes/forms.js';
import authRouter from './routes/auth.js';
import usersRouter from './routes/users.js';
import groupsRouter from './routes/groups.js';

dotenv.config();

// بررسی متغیرهای حیاتی پیش از بالا آمدن سرور
const required = ['JWT_SECRET', 'ENCRYPTION_KEY', 'DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`❌ متغیر محیطی ${key} تنظیم نشده است. فایل .env را بررسی کنید.`);
    process.exit(1);
  }
}

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/groups', groupsRouter);
app.use('/api/forms', formsRouter);

app.get('/health', (_, res) => res.json({ status: 'ok' }));

// Start
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('❌ DB init failed:', err.message);
  process.exit(1);
});
