import { Request, Response, NextFunction } from 'express';
import {
  getCourseAnnouncements,
  createCourseAnnouncement,
} from '../services/announcement.service.js';
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
 * Giảng viên đăng thông báo mới cho lớp học (hỗ trợ link Google Meet)
 */
export const postAnnouncement = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { courseId } = req.params;
    const { text } = req.body;
    const user = (req as any).user;
    const userId = user?.userId || user?.id;

    const data = await createCourseAnnouncement(courseId, userId, text);

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
