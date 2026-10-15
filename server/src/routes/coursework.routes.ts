import { Router } from 'express';
import {
  getCourseDetail,
  listCoursework,
  getDetailCoursework,
  getSubmissions,
  submitGrade,
  getAnalytics,
} from '../controllers/coursework.controller.js';
import { authMiddleware, requireRole } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authMiddleware);

// 1. Chi tiết lớp học & thành viên
router.get('/courses/:courseId/detail', getCourseDetail);

// 2. Danh sách bài tập
router.get('/courses/:courseId/coursework', listCoursework);

// 2.1. Chi tiết 1 bài tập kèm tài liệu đính kèm (Materials)
router.get('/courses/:courseId/coursework/:courseworkId', getDetailCoursework);

// 3. Danh sách bài nộp của 1 bài tập
router.get('/courses/:courseId/coursework/:courseworkId/submissions', getSubmissions);

// 4. Chấm điểm sinh viên & Đẩy điểm 2 chiều lên Google Classroom
router.patch('/courses/:courseId/submissions/:submissionId/grade', requireRole('TEACHER'), submitGrade);

// 5. Thống kê toàn diện GPA & Cảnh báo học vụ
router.get('/courses/:courseId/analytics', getAnalytics);

export default router;
