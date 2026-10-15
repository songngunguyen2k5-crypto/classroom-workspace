import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import {
  syncTeacherCourses,
  syncFullCourse,
} from '../services/sync.service.js';
import type { ApiResponse } from '../types/index.js';

/**
 * GET /api/courses
 * Lấy danh sách lớp học từ Supabase Local DB (Local-First pattern)
 */
export const getMyCourses = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = (req as any).user;
    let query = supabaseAdmin.from('courses').select('*');

    if (user.role === 'TEACHER') {
      query = query.eq('owner_id', user.userId);
    } else {
      // Nếu là học sinh, lấy các lớp học mà học sinh này đã tham gia qua course_members
      const { data: memberOf } = await supabaseAdmin
        .from('course_members')
        .select('course_id')
        .eq('user_id', user.userId);

      const courseIds = (memberOf || []).map((m) => m.course_id);
      query = query.in('id', courseIds.length > 0 ? courseIds : ['00000000-0000-0000-0000-000000000000']);
    }

    const { data: courses, error } = await query.order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Lỗi truy vấn danh sách lớp: ${error.message}`);
    }

    // Lấy thêm số lượng học sinh và bài tập cho mỗi lớp
    const enhancedCourses = await Promise.all(
      (courses || []).map(async (c) => {
        const [{ count: studentCount }, { count: courseworkCount }] = await Promise.all([
          supabaseAdmin
            .from('course_members')
            .select('*', { count: 'exact', head: true })
            .eq('course_id', c.id)
            .eq('role_in_course', 'STUDENT'),
          supabaseAdmin
            .from('coursework')
            .select('*', { count: 'exact', head: true })
            .eq('course_id', c.id),
        ]);

        return {
          ...c,
          student_count: studentCount || 0,
          coursework_count: courseworkCount || 0,
        };
      })
    );

    const response: ApiResponse = {
      success: true,
      status: 200,
      message: 'Lấy danh sách lớp học thành công',
      data: enhancedCourses,
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/sync/courses
 * On-Demand Sync: Giảng viên bấm nút đồng bộ danh sách khóa học từ Google Classroom
 */
export const syncMyCourses = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = (req as any).user;
    const courses = await syncTeacherCourses(user.userId);

    const response: ApiResponse = {
      success: true,
      status: 200,
      message: `Đã đồng bộ thành công ${courses.length} lớp học từ Google Classroom.`,
      data: courses,
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/sync/courses/:courseId
 * On-Demand Sync: Đồng bộ toàn bộ dữ liệu chi tiết (Roster, Bài tập, Bài nộp) của 1 lớp
 */
export const syncCourseDetails = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { courseId } = req.params;
    const user = (req as any).user;

    const result = await syncFullCourse(courseId, user.userId, 'MANUAL');

    const response: ApiResponse = {
      success: true,
      status: 200,
      message: 'Đồng bộ chi tiết lớp học thành công.',
      data: result,
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/sync/logs/:courseId
 * Lấy lịch sử đồng bộ gần nhất của lớp học
 */
export const getCourseSyncLogs = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { courseId } = req.params;
    const { data: logs, error } = await supabaseAdmin
      .from('sync_logs')
      .select('*')
      .eq('course_id', courseId)
      .order('executed_at', { ascending: false })
      .limit(10);

    if (error) {
      throw new Error(`Lỗi truy vấn lịch sử sync: ${error.message}`);
    }

    const response: ApiResponse = {
      success: true,
      status: 200,
      message: 'Lấy nhật ký đồng bộ thành công',
      data: logs || [],
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};
