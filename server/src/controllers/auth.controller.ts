import { Request, Response, NextFunction } from 'express';
import { generateAuthUrl } from '../config/google.js';
import { handleGoogleCallback } from '../services/auth.service.js';
import type { ApiResponse } from '../types/index.js';

/**
 * GET /api/auth/google/url
 * Trả về URL trang Google Consent Screen để Frontend redirect người dùng đến đó
 */
export const getGoogleAuthUrl = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const url = generateAuthUrl();
    const response: ApiResponse<{ url: string }> = {
      success: true,
      status: 200,
      message: 'Lấy URL xác thực Google thành công',
      data: { url },
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/auth/google/callback
 * Google redirect về đây sau khi người dùng đồng ý cấp quyền.
 * Xử lý toàn bộ luồng: đổi code → tokens → profile → role → lưu DB → JWT
 */
export const handleGoogleOAuthCallback = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { code, error: googleError } = req.query;

    // Người dùng từ chối cấp quyền hoặc Google trả về lỗi
    if (googleError || !code) {
      const errorMsg = (googleError as string) || 'Không nhận được Authorization Code từ Google';
      res.redirect(`${process.env.CLIENT_URL}/login?error=${encodeURIComponent(errorMsg)}`);
      return;
    }

    const { jwtToken, user } = await handleGoogleCallback(code as string);

    const isProduction = process.env.NODE_ENV === 'production';

    // Lưu JWT vào HttpOnly Cookie để bảo mật (Frontend không đọc được qua JS)
    // Trong production (cross-site giữa Vercel & Render), bắt buộc sameSite: 'none' và secure: true
    res.cookie('auth_token', jwtToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày
    });

    // Redirect về Frontend kèm thông tin user cơ bản (không chứa token nhạy cảm)
    const userQuery = encodeURIComponent(JSON.stringify({
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      avatar_url: user.avatar_url,
      role: user.role,
    }));
    res.redirect(`${process.env.CLIENT_URL}/dashboard?user=${userQuery}`);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/auth/me
 * Kiểm tra phiên đăng nhập hiện tại và trả về thông tin user (dựa trên JWT trong cookie)
 */
export const getMe = (req: Request, res: Response, next: NextFunction): void => {
  try {
    // req.user được gắn bởi authMiddleware (sẽ tạo ở bước sau)
    const user = (req as any).user;
    if (!user) {
      const response: ApiResponse<null> = {
        success: false,
        status: 401,
        message: 'Chưa đăng nhập hoặc phiên làm việc đã hết hạn',
        data: null,
      };
      res.status(401).json(response);
      return;
    }
    const response: ApiResponse = {
      success: true,
      status: 200,
      message: 'Lấy thông tin người dùng thành công',
      data: user,
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/logout
 * Xóa HttpOnly Cookie phiên đăng nhập
 */
export const logout = (_req: Request, res: Response): void => {
  const isProduction = process.env.NODE_ENV === 'production';
  res.clearCookie('auth_token', {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
  });
  const response: ApiResponse<null> = {
    success: true,
    status: 200,
    message: 'Đăng xuất thành công',
    data: null,
  };
  res.status(200).json(response);
};
