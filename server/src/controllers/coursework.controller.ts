import { Request, Response, NextFunction } from 'express';
import {
  getCourseDetailWithMembers,
  getCourseworkList,
  getCourseworkDetail,
  getCourseworkSubmissions,
  gradeSubmission,
  getCourseAnalytics,
  getCourseUserRole,
} from '../services/coursework.service.js';
import { AppError } from '../middlewares/errorHandler.js';
import type { ApiResponse } from '../types/index.js';

/**
 * GET /api/courses/:courseId/detail
 * Lấy chi tiết lớp học kèm danh sách thành viên (giảng viên & học sinh)
 */
export const getCourseDetail = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { courseId } = req.params;
    const data = await getCourseDetailWithMembers(courseId);

    const response: ApiResponse = {
      success: true,
      status: 200,
      message: 'Lấy thông tin chi tiết lớp học thành công',
      data,
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/courses/:courseId/coursework
 * Lấy danh sách bài tập của lớp kèm số lượng bài nộp
 */
export const listCoursework = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { courseId } = req.params;
    const data = await getCourseworkList(courseId);

    const response: ApiResponse = {
      success: true,
      status: 200,
      message: 'Lấy danh sách bài tập thành công',
      data,
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/courses/:courseId/coursework/:courseworkId
 * Lấy thông tin chi tiết bài học kèm danh sách tài liệu đính kèm (Materials)
 */
export const getDetailCoursework = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { courseId, courseworkId } = req.params;
    const data = await getCourseworkDetail(courseId, courseworkId);

    const response: ApiResponse = {
      success: true,
      status: 200,
      message: 'Lấy chi tiết bài học thành công',
      data,
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/courses/:courseId/coursework/:courseworkId/submissions
 * Lấy danh sách bài nộp và điểm của học sinh cho bài tập cụ thể
 * Học sinh chỉ nhận được bài nộp của chính mình, Giảng viên nhận được toàn bộ lớp
 */
export const getSubmissions = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { courseId, courseworkId } = req.params;
    const user = (req as any).user;
    const userId = user?.userId || user?.id;
    const userRole = await getCourseUserRole(courseId, userId);

    const data = await getCourseworkSubmissions(courseId, courseworkId, userId, userRole);

    const response: ApiResponse = {
      success: true,
      status: 200,
      message: 'Lấy danh sách bài nộp thành công',
      data,
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/courses/:courseId/submissions/:submissionId/grade
 * Giảng viên chấm điểm: Lưu Supabase và đồng bộ 2 chiều lên Google Classroom
 * Chặn học sinh với HTTP 403 Forbidden
 */
export const submitGrade = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { courseId, submissionId } = req.params;
    const { grade } = req.body;
    const user = (req as any).user;
    const userId = user?.userId || user?.id;

    const userRole = await getCourseUserRole(courseId, userId);
    if (userRole !== 'TEACHER') {
      throw new AppError('Bạn không có quyền chấm điểm. Yêu cầu quyền Giảng viên.', 403);
    }

    const data = await gradeSubmission(courseId, submissionId, Number(grade), userId);

    const response: ApiResponse = {
      success: true,
      status: 200,
      message: `Đã chấm ${grade} điểm và đồng bộ lên Google Classroom thành công.`,
      data,
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/courses/:courseId/analytics
 * Báo cáo thống kê toàn diện: GPA, tỷ lệ chuyên cần, cảnh báo cấm thi & học vụ
 * Học sinh chỉ nhận dữ liệu cá nhân, Giảng viên nhận toàn cảnh lớp học
 */
export const getAnalytics = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { courseId } = req.params;
    const user = (req as any).user;
    const userId = user?.userId || user?.id;
    const userRole = await getCourseUserRole(courseId, userId);

    const data = await getCourseAnalytics(courseId, userId, userRole);

    const response: ApiResponse = {
      success: true,
      status: 200,
      message: 'Lấy báo cáo phân tích lớp học thành công',
      data,
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};
