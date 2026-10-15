import { Router } from 'express';
import multer from 'multer';
import {
  listAnnouncements,
  postAnnouncement,
  uploadMaterialController,
} from '../controllers/announcement.controller.js';
import { authMiddleware, requireRole } from '../middlewares/auth.middleware.js';

const router = Router();

// Khởi tạo multer xử lý buffer bộ nhớ (Memory Storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // Giới hạn tối đa 10MB
  },
});

router.use(authMiddleware);

// 1. Lấy danh sách thông báo bảng tin
router.get('/courses/:courseId/announcements', listAnnouncements);

// 2. Giảng viên đăng thông báo mới (kèm link Google Meet và tài liệu)
router.post('/courses/:courseId/announcements', requireRole('TEACHER'), postAnnouncement);

// 3. Giảng viên tải lên tệp học liệu HTML tương tác
router.post(
  '/courses/:courseId/upload-material',
  requireRole('TEACHER'),
  upload.single('file'),
  uploadMaterialController
);

export default router;
