import { Router } from 'express';
import {
  listAnnouncements,
  postAnnouncement,
} from '../controllers/announcement.controller.js';
import { authMiddleware, requireRole } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authMiddleware);

// 1. Lấy danh sách thông báo bảng tin
router.get('/courses/:courseId/announcements', listAnnouncements);

// 2. Giảng viên đăng thông báo mới (kèm link Google Meet)
router.post('/courses/:courseId/announcements', requireRole('TEACHER'), postAnnouncement);

export default router;
