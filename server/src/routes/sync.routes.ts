import { Router } from 'express';
import {
  getMyCourses,
  syncMyCourses,
  syncCourseDetails,
  getCourseSyncLogs,
} from '../controllers/sync.controller.js';
import { authMiddleware, requireRole } from '../middlewares/auth.middleware.js';

const router = Router();

// Tất cả các route bên dưới đều yêu cầu đăng nhập
router.use(authMiddleware);

// 1. Lấy danh sách lớp học (Local-First: cả Giảng viên và Học sinh đều đọc được lớp của mình)
router.get('/courses', getMyCourses);

// 2. On-Demand Sync: Giảng viên yêu cầu đồng bộ danh sách lớp học từ Google
router.post('/sync/courses', requireRole('TEACHER'), syncMyCourses);

// 3. On-Demand Sync: Giảng viên yêu cầu đồng bộ chi tiết 1 lớp học (Roster, Bài tập, Bài nộp)
router.post('/sync/courses/:courseId', requireRole('TEACHER'), syncCourseDetails);

// 4. Lấy nhật ký các lần đồng bộ của 1 lớp học
router.get('/sync/logs/:courseId', getCourseSyncLogs);

export default router;
