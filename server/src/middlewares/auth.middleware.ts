import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env.js';
import { AppError } from './errorHandler.js';
import type { ApiResponse } from '../types/index.js';

interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

/**
 * Middleware xác thực JWT từ HttpOnly Cookie.
 * Gắn thông tin user vào req.user để các route sau sử dụng.
 */
export const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const token = req.cookies?.auth_token;

    if (!token) {
      const response: ApiResponse<null> = {
        success: false,
        status: 401,
        message: 'Bạn chưa đăng nhập. Vui lòng đăng nhập để tiếp tục.',
        data: null,
      };
      res.status(401).json(response);
      return;
    }

    const decoded = jwt.verify(token, ENV.JWT_SECRET) as JwtPayload;
    (req as any).user = decoded;
    next();
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      status: 401,
      message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.',
      data: null,
    };
    res.status(401).json(response);
  }
};

/**
 * Middleware kiểm tra quyền theo Role.
 * Sử dụng sau authMiddleware: requireRole('TEACHER') hoặc requireRole('TEACHER', 'ADMIN')
 */
export const requireRole = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user;
    if (!user || !roles.includes(user.role)) {
      const response: ApiResponse<null> = {
        success: false,
        status: 403,
        message: `Bạn không có quyền thực hiện hành động này. Yêu cầu vai trò: ${roles.join(', ')}.`,
        data: null,
      };
      res.status(403).json(response);
      return;
    }
    next();
  };
};
