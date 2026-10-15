import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middlewares/errorHandler.js';
import type { AttendanceStatus, StudentAttendanceStats } from '../types/index.js';

export interface AttendanceRecordInput {
  student_id: string;
  status: AttendanceStatus;
  note?: string;
}

// ============================================================================
// AttendanceService: Nghiệp vụ điểm danh & Thống kê chuyên cần (Pure Local)
// ============================================================================

/**
 * 1. Lấy danh sách điểm danh của lớp học theo ngày cụ thể (YYYY-MM-DD)
 * Ghép toàn bộ sinh viên trong lớp với trạng thái điểm danh ngày hôm đó
 */
export const getAttendanceByDate = async (courseId: string, attendanceDate: string) => {
  // Lấy thông tin lớp học
  const { data: course, error: courseErr } = await supabaseAdmin
    .from('courses')
    .select('id, name')
    .eq('id', courseId)
    .single();

  if (courseErr || !course) {
    throw new AppError('Không tìm thấy lớp học trong cơ sở dữ liệu.', 404);
  }

  // Lấy danh sách sinh viên thuộc lớp
  const { data: members, error: memberErr } = await supabaseAdmin
    .from('course_members')
    .select(`
      user_id,
      users:user_id (id, full_name, email, avatar_url)
    `)
    .eq('course_id', courseId)
    .eq('role_in_course', 'STUDENT');

  if (memberErr) {
    throw new AppError(`Lỗi khi lấy danh sách sinh viên: ${memberErr.message}`, 500);
  }

  // Lấy các bản ghi điểm danh đã lưu trong ngày attendanceDate
  const { data: attendanceList, error: attErr } = await supabaseAdmin
    .from('attendances')
    .select('*')
    .eq('course_id', courseId)
    .eq('attendance_date', attendanceDate);

  if (attErr) {
    throw new AppError(`Lỗi khi lấy dữ liệu điểm danh: ${attErr.message}`, 500);
  }

  const attendanceMap = new Map<string, any>();
  attendanceList?.forEach((att) => attendanceMap.set(att.student_id, att));

  // Ghép dữ liệu cho từng sinh viên
  const isSubmitted = (attendanceList || []).length > 0;
  const students = (members || []).map((m: any) => {
    const studentUser = m.users;
    const existing = attendanceMap.get(studentUser.id);

    return {
      student_id: studentUser.id,
      full_name: studentUser.full_name,
      email: studentUser.email,
      avatar_url: studentUser.avatar_url,
      status: (existing?.status as AttendanceStatus) || 'PRESENT', // Mặc định là Có mặt
      note: existing?.note || '',
      is_recorded: !!existing,
    };
  });

  return {
    course_id: courseId,
    course_name: course.name,
    attendance_date: attendanceDate,
    is_submitted: isSubmitted,
    total_students: students.length,
    students,
  };
};

/**
 * 2. Lưu điểm danh hàng loạt (Bulk Upsert) cho một buổi học
 */
export const saveBulkAttendance = async (
  courseId: string,
  attendanceDate: string,
  records: AttendanceRecordInput[],
  teacherId: string
) => {
  if (!records || records.length === 0) {
    throw new AppError('Danh sách điểm danh không được để trống.', 400);
  }

  const payload = records.map((r) => ({
    course_id: courseId,
    student_id: r.student_id,
    attendance_date: attendanceDate,
    status: r.status,
    note: r.note?.trim() || null,
    created_by: teacherId,
  }));

  const { data, error } = await supabaseAdmin
    .from('attendances')
    .upsert(payload, {
      onConflict: 'course_id,student_id,attendance_date',
    })
    .select();

  if (error) {
    throw new AppError(`Lỗi khi lưu điểm danh vào DB: ${error.message}`, 500);
  }

  return {
    saved_count: data?.length || 0,
    attendance_date: attendanceDate,
  };
};

/**
 * 3. Thống kê tỷ lệ chuyên cần & Cảnh báo sinh viên có nguy cơ cấm thi
 */
export const getCourseAttendanceStats = async (courseId: string): Promise<{
  total_sessions: number;
  stats: StudentAttendanceStats[];
}> => {
  // Lấy danh sách học sinh
  const { data: members, error: memErr } = await supabaseAdmin
    .from('course_members')
    .select(`
      user_id,
      users:user_id (id, full_name, email, avatar_url)
    `)
    .eq('course_id', courseId)
    .eq('role_in_course', 'STUDENT');

  if (memErr) {
    throw new AppError(`Lỗi truy vấn học sinh: ${memErr.message}`, 500);
  }

  // Lấy toàn bộ bản ghi điểm danh của lớp
  const { data: allAttendances, error: attErr } = await supabaseAdmin
    .from('attendances')
    .select('*')
    .eq('course_id', courseId);

  if (attErr) {
    throw new AppError(`Lỗi truy vấn dữ liệu điểm danh: ${attErr.message}`, 500);
  }

  // Đếm tổng số buổi đã điểm danh (số ngày khác nhau)
  const uniqueDates = new Set((allAttendances || []).map((a) => a.attendance_date));
  const totalSessions = uniqueDates.size;

  // Gom nhóm theo từng sinh viên
  const stats: StudentAttendanceStats[] = (members || []).map((m: any) => {
    const student = m.users;
    const studentRecords = (allAttendances || []).filter((a) => a.student_id === student.id);

    let present = 0;
    let late = 0;
    let excused = 0;
    let unexcused = 0;

    studentRecords.forEach((rec) => {
      if (rec.status === 'PRESENT') present++;
      else if (rec.status === 'LATE') late++;
      else if (rec.status === 'ABSENT_EXCUSED') excused++;
      else if (rec.status === 'ABSENT_UNEXCUSED') unexcused++;
    });

    // Công thức tính tỷ lệ vắng: (Vắng không phép + Vắng có phép + 0.5 * Muộn) / Tổng số buổi
    const absenceScore = unexcused + excused + late * 0.5;
    const absenceRate = totalSessions > 0 ? Math.round((absenceScore / totalSessions) * 100) : 0;

    // Tiêu chí cảnh báo cấm thi: Tỷ lệ vắng >= 20% hoặc số buổi vắng không phép >= 3
    const isWarning = totalSessions >= 3 && (absenceRate >= 20 || unexcused >= 3);

    return {
      student: {
        id: student.id,
        full_name: student.full_name,
        email: student.email,
        avatar_url: student.avatar_url,
      },
      total_sessions: totalSessions,
      present_count: present,
      late_count: late,
      absent_excused_count: excused,
      absent_unexcused_count: unexcused,
      absence_rate: absenceRate,
      is_warning: isWarning,
    };
  });

  // Sắp xếp: Ưu tiên học sinh bị cảnh báo lên đầu, sau đó theo tỷ lệ vắng giảm dần
  stats.sort((a, b) => {
    if (a.is_warning && !b.is_warning) return -1;
    if (!a.is_warning && b.is_warning) return 1;
    return b.absence_rate - a.absence_rate;
  });

  return {
    total_sessions: totalSessions,
    stats,
  };
};

/**
 * 4. Dành cho Sinh viên: Xem lịch sử điểm danh của chính mình trong lớp học
 */
export const getStudentAttendanceHistory = async (courseId: string, studentId: string) => {
  const { data: records, error } = await supabaseAdmin
    .from('attendances')
    .select('*')
    .eq('course_id', courseId)
    .eq('student_id', studentId)
    .order('attendance_date', { ascending: false });

  if (error) {
    throw new AppError(`Lỗi truy vấn lịch sử chuyên cần cá nhân: ${error.message}`, 500);
  }

  return records || [];
};
