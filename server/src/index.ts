import express, { Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { ENV } from './config/env.js';
import { errorHandler } from './middlewares/errorHandler.js';
import authRoutes from './routes/auth.routes.js';
import syncRoutes from './routes/sync.routes.js';
import attendanceRoutes from './routes/attendance.routes.js';
import courseworkRoutes from './routes/coursework.routes.js';
import announcementRoutes from './routes/announcement.routes.js';
import { initSyncCronWorker } from './services/cron.service.js';
import type { ApiResponse } from './types/index.js';

const app = express();

// Tin tưởng reverse proxy (Render, Railway, Heroku) để nhận diện đúng giao thức HTTPS
app.set('trust proxy', 1);

// Middlewares
app.use(cors({
  origin: ENV.CLIENT_URL,
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Health Check Endpoint (Phải đặt TRƯỚC các router có authMiddleware)
app.get('/api/health', (_req: Request, res: Response) => {
  const response: ApiResponse<{ timestamp: string; status: string }> = {
    success: true,
    status: 200,
    message: 'Classroom Sync Server đang hoạt động bình thường',
    data: {
      timestamp: new Date().toISOString(),
      status: 'UP',
    },
  };
  res.status(200).json(response);
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api', syncRoutes);
app.use('/api', attendanceRoutes);
app.use('/api', courseworkRoutes);
app.use('/api', announcementRoutes);

// Centralized Error Handling Middleware (phải đặt CUỐI CÙNG)
app.use(errorHandler);

// Khởi chạy Server
const PORT = Number(ENV.PORT) || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
  console.log(`📡 Chế độ môi trường: ${ENV.NODE_ENV}`);
  console.log(`✅ Auth routes: /api/auth/google/url | /api/auth/google/callback`);
  console.log(`✅ Sync routes: /api/courses | /api/sync/courses | /api/sync/courses/:courseId`);

  // Kích hoạt worker đồng bộ ngầm định kỳ
  initSyncCronWorker();
});

export default app;

