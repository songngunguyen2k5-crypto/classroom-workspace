const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export interface CourseItem {
  id: string;
  google_course_id: string;
  name: string;
  section?: string;
  room?: string;
  owner_id: string;
  is_synced: boolean;
  student_count: number;
  coursework_count: number;
  created_at: string;
  updated_at: string;
}

export interface SyncLogItem {
  id: string;
  course_id: string;
  sync_type: 'MANUAL' | 'SCHEDULED_CRON';
  status: 'SUCCESS' | 'FAILED' | 'PARTIAL';
  message?: string;
  executed_at: string;
}

/**
 * Lấy danh sách các lớp học được lưu trong Supabase (Local-First pattern)
 */
export const fetchLocalCourses = async (): Promise<CourseItem[]> => {
  const response = await fetch(`${API_URL}/courses`, {
    credentials: 'include',
  });
  const json = await response.json();
  if (!json.success) {
    throw new Error(json.message || 'Không thể lấy danh sách lớp học');
  }
  return json.data;
};

/**
 * On-Demand Sync: Gọi Google Classroom API kéo danh sách lớp học mới nhất
 */
export const triggerSyncCourses = async (): Promise<CourseItem[]> => {
  const response = await fetch(`${API_URL}/sync/courses`, {
    method: 'POST',
    credentials: 'include',
  });
  const json = await response.json();
  if (!json.success) {
    throw new Error(json.message || 'Lỗi khi đồng bộ danh sách lớp học từ Google');
  }
  return json.data;
};

/**
 * On-Demand Sync: Đồng bộ chi tiết 1 lớp học (Roster, Bài tập, Điểm số)
 */
export const triggerSyncCourseDetail = async (courseId: string) => {
  const response = await fetch(`${API_URL}/sync/courses/${courseId}`, {
    method: 'POST',
    credentials: 'include',
  });
  const json = await response.json();
  if (!json.success) {
    throw new Error(json.message || 'Lỗi khi đồng bộ chi tiết lớp học');
  }
  return json.data;
};

/**
 * Lấy lịch sử nhật ký đồng bộ của một lớp học
 */
export const fetchSyncLogs = async (courseId: string): Promise<SyncLogItem[]> => {
  const response = await fetch(`${API_URL}/sync/logs/${courseId}`, {
    credentials: 'include',
  });
  const json = await response.json();
  if (!json.success) {
    throw new Error(json.message || 'Lỗi khi lấy nhật ký đồng bộ');
  }
  return json.data;
};
