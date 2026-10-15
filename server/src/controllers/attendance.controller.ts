import { Request, Response, NextFunction } from 'express';
import {
  getAttendanceByDate,
  saveBulkAttendance,
  getCourseAttendanceStats,
  getStudentAttendanceHistory,
} from '../services/attendance.service.js';
import { getCourseUserRole } from '../services/coursework.service.js';
import { AppError } from '../middlewares/errorHandler.js';
import type { ApiResponse } from '../types/index.js';

/**
 * GET /api/courses/:courseId/attendance?date=YYYY-MM-DD
 * Lấy danh sách điểm danh của lớp theo ngày (Mặc định là ngày hôm nay)
 * Học sinh chỉ nhận được trạng thái điểm danh của chính mình
 */
export const getCourseAttendance = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { courseId } = req.params;
    const user = (req as any).user;
    const userId = user?.userId || user?.id;
    const today = new Date().toISOString().split('T')[0];
    const date = (req.query.date as string) || today;

    const userRole = await getCourseUserRole(courseId, userId);
    let data = await getAttendanceByDate(courseId, date);

    if (userRole === 'STUDENT') {
      data = {
        ...data,
        total_students: 1,
        students: data.students.filter((s: any) => s.student_id === userId),
      };
    }

    const response: ApiResponse = {
      success: true,
      status: 200,
      message: `Lấy dữ liệu điểm danh ngày ${date} thành công`,
      data,
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/courses/:courseId/attendance
 * Lưu hoặc cập nhật điểm danh hàng loạt (Dành riêng cho Giảng viên)
 * Chặn học sinh với HTTP 403 Forbidden
 */
export const saveCourseAttendance = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { courseId } = req.params;
    const { date, records } = req.body;
    const user = (req as any).user;
    const userId = user?.userId || user?.id;

    const userRole = await getCourseUserRole(courseId, userId);
    if (userRole !== 'TEACHER') {
      throw new AppError('Bạn không có quyền thực hiện điểm danh cho lớp học này. Yêu cầu quyền Giảng viên.', 403);
    }

    const today = new Date().toISOString().split('T')[0];
    const attendanceDate = date || today;

    const result = await saveBulkAttendance(courseId, attendanceDate, records, userId);

    const response: ApiResponse = {
      success: true,
      status: 200,
      message: `Đã lưu điểm danh thành công cho ${result.saved_count} sinh viên vào ngày ${attendanceDate}.`,
      data: result,
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/courses/:courseId/attendance/stats
 * Lấy bảng thống kê chuyên cần và danh sách cảnh báo cấm thi
 * Học sinh chỉ nhận được thống kê của chính mình
 */
export const getCourseStats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { courseId } = req.params;
    const user = (req as any).user;
    const userId = user?.userId || user?.id;

    const userRole = await getCourseUserRole(courseId, userId);
    let stats = await getCourseAttendanceStats(courseId);

    if (userRole === 'STUDENT') {
      stats = {
        ...stats,
        stats: stats.stats.filter((s: any) => s.student.id === userId),
      };
    }

    const response: ApiResponse = {
      success: true,
      status: 200,
      message: 'Lấy thống kê chuyên cần thành công',
      data: stats,
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/courses/:courseId/attendance/my
 * Dành cho sinh viên: Xem lịch sử chuyên cần của chính mình
 */
export const getMyAttendance = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { courseId } = req.params;
    const user = (req as any).user;
    const userId = user?.userId || user?.id;

    const history = await getStudentAttendanceHistory(courseId, userId);

    const response: ApiResponse = {
      success: true,
      status: 200,
      message: 'Lấy lịch sử chuyên cần cá nhân thành công',
      data: history,
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};
