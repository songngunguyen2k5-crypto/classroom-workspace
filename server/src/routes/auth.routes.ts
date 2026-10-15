import { Router } from 'express';
import {
  getGoogleAuthUrl,
  handleGoogleOAuthCallback,
  getMe,
  logout,
} from '../controllers/auth.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = Router();

// GET /api/auth/google/url - Lấy URL Google Consent Screen
router.get('/google/url', getGoogleAuthUrl);

// GET /api/auth/google/callback - Google redirect về đây sau khi user đồng ý
router.get('/google/callback', handleGoogleOAuthCallback);

// GET /api/auth/me - Lấy thông tin người dùng hiện tại (yêu cầu đăng nhập)
router.get('/me', authMiddleware, getMe);

// POST /api/auth/logout - Đăng xuất (xóa cookie)
router.post('/logout', logout);

export default router;
