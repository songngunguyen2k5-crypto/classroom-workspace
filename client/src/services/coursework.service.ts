const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export interface UserSummary {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
  role: 'TEACHER' | 'STUDENT';
}

export interface CourseDetailData {
  course: {
    id: string;
    google_course_id: string;
    name: string;
    section?: string;
    room?: string;
    owner_id: string;
    is_synced: boolean;
    created_at: string;
    updated_at: string;
  };
  teachers: UserSummary[];
  students: UserSummary[];
  total_students: number;
  total_teachers: number;
}

export type MaterialType = 'drive_file' | 'youtube_video' | 'link' | 'form';

export interface CourseworkMaterial {
  id: string;
  coursework_id: string;
  material_type: MaterialType;
  title: string;
  url: string;
  thumbnail_url?: string | null;
  created_at?: string;
}

export interface CourseworkItem {
  id: string;
  google_coursework_id: string;
  course_id: string;
  title: string;
  description?: string;
  max_points: number;
  due_date?: string;
  work_type: 'ASSIGNMENT' | 'SHORT_ANSWER_QUESTION' | 'MULTIPLE_CHOICE_QUESTION';
  total_students: number;
  turned_in_count: number;
  graded_count: number;
  created_at: string;
  updated_at: string;
  materials?: CourseworkMaterial[];
}

export interface CourseworkDetailData extends CourseworkItem {
  materials: CourseworkMaterial[];
}

export interface SubmissionItem {
  submission_id: string | null;
  google_submission_id: string | null;
  student_id: string;
  student_name: string;
  student_email: string;
  student_avatar?: string;
  state: 'NEW' | 'CREATED' | 'TURNED_IN' | 'RETURNED' | 'RECLAIMED_BY_STUDENT';
  assigned_grade: number | null;
  max_points: number;
  sync_status: 'PENDING' | 'SYNCED' | 'FAILED';
  submitted_at: string | null;
}

export interface CourseworkSubmissionsData {
  coursework: CourseworkItem;
  submissions: SubmissionItem[];
}

export interface StudentAnalyticItem {
  student: UserSummary;
  avg_grade: number | null;
  turned_in_count: number;
  total_assignments: number;
  absence_rate: number;
  unexcused_absences: number;
  is_warning: boolean;
  warning_reasons: string[];
}

export interface CourseAnalyticsData {
  course_id: string;
  total_students: number;
  total_assignments: number;
  total_sessions: number;
  class_gpa: number;
  at_risk_count: number;
  students: StudentAnalyticItem[];
}

/**
 * Lấy chi tiết lớp học và toàn bộ thành viên
 */
export const fetchCourseDetail = async (courseId: string): Promise<CourseDetailData> => {
  const res = await fetch(`${API_URL}/courses/${courseId}/detail`, {
    credentials: 'include',
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message || 'Lỗi khi tải thông tin lớp');
  return json.data;
};

/**
 * Lấy danh sách bài tập của lớp
 */
export const fetchCourseworkList = async (courseId: string): Promise<CourseworkItem[]> => {
  const res = await fetch(`${API_URL}/courses/${courseId}/coursework`, {
    credentials: 'include',
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message || 'Lỗi khi tải danh sách bài tập');
  return json.data;
};

/**
 * Lấy danh sách bài nộp và điểm của 1 bài tập
 */
export const fetchCourseworkSubmissions = async (
  courseId: string,
  courseworkId: string
): Promise<CourseworkSubmissionsData> => {
  const res = await fetch(`${API_URL}/courses/${courseId}/coursework/${courseworkId}/submissions`, {
    credentials: 'include',
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message || 'Lỗi khi tải danh sách bài nộp');
  return json.data;
};

/**
 * Chấm điểm sinh viên & Đẩy điểm lên Google Classroom (Write-Through)
 */
export const submitGrade = async (
  courseId: string,
  submissionId: string,
  grade: number
) => {
  const res = await fetch(`${API_URL}/courses/${courseId}/submissions/${submissionId}/grade`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ grade }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message || 'Lỗi khi chấm điểm');
  return json.data;
};

/**
 * Lấy thống kê tổng hợp lớp học (GPA, chuyên cần, cảnh báo)
 */
export const fetchCourseAnalytics = async (courseId: string): Promise<CourseAnalyticsData> => {
  const res = await fetch(`${API_URL}/courses/${courseId}/analytics`, {
    credentials: 'include',
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message || 'Lỗi khi tải phân tích lớp');
  return json.data;
};

/**
 * Lấy chi tiết 1 bài giảng kèm danh sách tài liệu đính kèm (Materials)
 */
export const fetchCourseworkDetail = async (
  courseId: string,
  courseworkId: string
): Promise<CourseworkDetailData> => {
  const res = await fetch(`${API_URL}/courses/${courseId}/coursework/${courseworkId}`, {
    credentials: 'include',
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message || 'Lỗi khi tải chi tiết bài giảng');
  return json.data;
};
