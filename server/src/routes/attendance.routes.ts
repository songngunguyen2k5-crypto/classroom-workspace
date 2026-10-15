import { Router } from 'express';
import {
  getCourseAttendance,
  saveCourseAttendance,
  getCourseStats,
  getMyAttendance,
} from '../controllers/attendance.controller.js';
import { authMiddleware, requireRole } from '../middlewares/auth.middleware.js';

const router = Router();

// Yêu cầu xác thực tài khoản
router.use(authMiddleware);

// 1. Lấy dữ liệu điểm danh theo ngày (Giảng viên & Sinh viên)
router.get('/courses/:courseId/attendance', getCourseAttendance);

// 2. Lưu điểm danh hàng loạt theo ngày (Chỉ dành cho Giảng viên)
router.post('/courses/:courseId/attendance', requireRole('TEACHER'), saveCourseAttendance);

// 3. Thống kê chuyên cần và cảnh báo cấm thi của lớp học
router.get('/courses/:courseId/attendance/stats', getCourseStats);

// 4. Lịch sử điểm danh cá nhân của sinh viên
router.get('/courses/:courseId/attendance/my', getMyAttendance);

export default router;
