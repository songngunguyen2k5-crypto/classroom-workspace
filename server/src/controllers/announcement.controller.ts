import { Request, Response, NextFunction } from 'express';
import {
  getCourseAnnouncements,
  createCourseAnnouncement,
} from '../services/announcement.service.js';
import { uploadMaterialFile } from '../services/material.service.js';
import { getCourseUserRole } from '../services/coursework.service.js';
import { AppError } from '../middlewares/errorHandler.js';
import type { ApiResponse } from '../types/index.js';

/**
 * GET /api/courses/:courseId/announcements
 * Lấy danh sách thông báo bảng tin của lớp học
 */
export const listAnnouncements = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { courseId } = req.params;
    const data = await getCourseAnnouncements(courseId);

    const response: ApiResponse = {
      success: true,
      status: 200,
      message: 'Lấy danh sách thông báo thành công',
      data,
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/courses/:courseId/announcements
 * Giảng viên đăng thông báo mới cho lớp học (hỗ trợ link Google Meet và tệp đính kèm materials)
 */
export const postAnnouncement = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { courseId } = req.params;
    const { text, materials } = req.body;
    const user = (req as any).user;
    const userId = user?.userId || user?.id;

    const data = await createCourseAnnouncement(courseId, userId, text, materials || []);

    const response: ApiResponse = {
      success: true,
      status: 201,
      message: 'Đăng thông báo thành công và đã đồng bộ lên Google Classroom',
      data,
    };
    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/courses/:courseId/upload-material
 * Giảng viên tải lên tệp học liệu HTML tương tác hoặc tài liệu học tập
 */
export const uploadMaterialController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { courseId } = req.params;
    const user = (req as any).user;
    const userId = user?.userId || user?.id;

    // Kiểm tra quyền: Chỉ Giảng viên mới được upload tài liệu vào lớp
    const userRole = await getCourseUserRole(courseId, userId);
    if (userRole !== 'TEACHER') {
      throw new AppError('Bạn không có quyền tải lên tài liệu cho lớp học này. Yêu cầu quyền Giảng viên.', 403);
    }

    if (!req.file) {
      throw new AppError('Vui lòng chọn tệp tin để tải lên.', 400);
    }

    const data = await uploadMaterialFile(courseId, req.file);

    const response: ApiResponse = {
      success: true,
      status: 200,
      message: 'Tải lên tài liệu học tập thành công',
      data,
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

