import type { AnnouncementItem } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * Lấy danh sách thông báo bảng tin của lớp học
 */
export const fetchAnnouncements = async (courseId: string): Promise<AnnouncementItem[]> => {
  const res = await fetch(`${API_URL}/courses/${courseId}/announcements`, {
    credentials: 'include',
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message || 'Lỗi khi tải thông báo lớp học');
  return json.data || [];
};

/**
 * Giảng viên đăng thông báo mới lên lớp học (đồng bộ 2 chiều lên Google Classroom)
 */
export const createAnnouncement = async (
  courseId: string,
  text: string
): Promise<AnnouncementItem> => {
  const res = await fetch(`${API_URL}/courses/${courseId}/announcements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ text }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message || 'Lỗi khi đăng thông báo');
  return json.data;
};
