const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export type AttendanceStatus = 'PRESENT' | 'ABSENT_UNEXCUSED' | 'ABSENT_EXCUSED' | 'LATE';

export interface StudentAttendanceItem {
  student_id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
  status: AttendanceStatus;
  note: string;
  is_recorded: boolean;
}

export interface AttendanceDateData {
  course_id: string;
  course_name: string;
  attendance_date: string;
  is_submitted: boolean;
  total_students: number;
  students: StudentAttendanceItem[];
}

export interface StudentStatsItem {
  student: {
    id: string;
    full_name: string;
    email: string;
    avatar_url?: string;
  };
  total_sessions: number;
  present_count: number;
  late_count: number;
  absent_excused_count: number;
  absent_unexcused_count: number;
  absence_rate: number;
  is_warning: boolean;
}

export interface CourseAttendanceStatsResponse {
  total_sessions: number;
  stats: StudentStatsItem[];
}

/**
 * Lấy dữ liệu điểm danh theo ngày cho một lớp học
 */
export const fetchAttendanceByDate = async (
  courseId: string,
  date: string
): Promise<AttendanceDateData> => {
  const response = await fetch(`${API_URL}/courses/${courseId}/attendance?date=${date}`, {
    credentials: 'include',
  });
  const json = await response.json();
  if (!json.success) {
    throw new Error(json.message || 'Lỗi khi lấy dữ liệu điểm danh');
  }
  return json.data;
};

/**
 * Lưu dữ liệu điểm danh hàng loạt cho lớp học
 */
export const saveBulkAttendance = async (
  courseId: string,
  date: string,
  records: Array<{ student_id: string; status: AttendanceStatus; note?: string }>
) => {
  const response = await fetch(`${API_URL}/courses/${courseId}/attendance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ date, records }),
  });
  const json = await response.json();
  if (!json.success) {
    throw new Error(json.message || 'Lỗi khi lưu điểm danh');
  }
  return json.data;
};

/**
 * Lấy bảng thống kê chuyên cần và cảnh báo cấm thi của lớp học
 */
export const fetchCourseAttendanceStats = async (
  courseId: string
): Promise<CourseAttendanceStatsResponse> => {
  const response = await fetch(`${API_URL}/courses/${courseId}/attendance/stats`, {
    credentials: 'include',
  });
  const json = await response.json();
  if (!json.success) {
    throw new Error(json.message || 'Lỗi khi lấy thống kê chuyên cần');
  }
  return json.data;
};

/**
 * Lấy lịch sử chuyên cần của chính học sinh trong lớp học
 */
export const fetchMyAttendanceHistory = async (courseId: string) => {
  const response = await fetch(`${API_URL}/courses/${courseId}/attendance/my`, {
    credentials: 'include',
  });
  const json = await response.json();
  if (!json.success) {
    throw new Error(json.message || 'Lỗi khi lấy lịch sử chuyên cần cá nhân');
  }
  return json.data;
};
