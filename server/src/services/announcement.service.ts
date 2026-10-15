import { supabaseAdmin } from '../config/supabase.js';
import { getClassroomClientForUser } from './classroom.client.js';
import { AppError } from '../middlewares/errorHandler.js';
import type { AnnouncementEntity } from '../types/index.js';

/**
 * Trích xuất link Google Meet từ văn bản
 */
export const extractMeetLinkFromText = (text: string): string | null => {
  if (!text) return null;
  const match = text.match(/https:\/\/meet\.google\.com\/[a-zA-Z0-9?&=_-]+/i);
  return match ? match[0] : null;
};

/**
 * 1. Lấy danh sách thông báo của lớp học (Sắp xếp mới nhất trước)
 */
export const getCourseAnnouncements = async (courseId: string): Promise<AnnouncementEntity[]> => {
  try {
    const { data, error } = await supabaseAdmin
      .from('announcements')
      .select('*')
      .eq('course_id', courseId)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('⚠️ Lỗi khi lấy danh sách announcements:', error.message);
      return [];
    }

    return data || [];
  } catch (err: any) {
    console.warn('⚠️ Ngoại lệ khi truy vấn announcements:', err.message);
    return [];
  }
};

/**
 * 2. Giảng viên đăng thông báo mới cho lớp học (Đẩy lên Google Classroom + Lưu DB Local)
 */
export const createCourseAnnouncement = async (
  courseId: string,
  userId: string,
  text: string
): Promise<AnnouncementEntity> => {
  if (!text || text.trim().length === 0) {
    throw new AppError('Nội dung thông báo không được để trống.', 400);
  }

  // 1. Lấy thông tin lớp học và người đăng
  const { data: course, error: courseErr } = await supabaseAdmin
    .from('courses')
    .select('id, google_course_id')
    .eq('id', courseId)
    .single();

  if (courseErr || !course) {
    throw new AppError('Không tìm thấy thông tin lớp học.', 404);
  }

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('full_name, avatar_url')
    .eq('id', userId)
    .single();

  const classroom = await getClassroomClientForUser(userId);

  // 2. Gọi Google Classroom API để tạo bài đăng thông báo
  let googleAnnouncementId: string = `local_${Date.now()}`;
  let creationTime = new Date().toISOString();

  try {
    const { data: created } = await classroom.courses.announcements.create({
      courseId: course.google_course_id,
      requestBody: {
        text: text.trim(),
        state: 'PUBLISHED',
      },
    });

    if (created && created.id) {
      googleAnnouncementId = created.id;
      creationTime = created.creationTime || creationTime;
    }
  } catch (apiErr: any) {
    console.error('Lỗi khi đăng thông báo lên Google Classroom API:', apiErr.message);
    throw new AppError(`Không thể đăng lên Google Classroom: ${apiErr.message}`, 502);
  }

  // 3. Trích xuất link Google Meet (nếu có)
  const meetLink = extractMeetLinkFromText(text);

  const announcementPayload = {
    google_announcement_id: googleAnnouncementId,
    course_id: course.id,
    text: text.trim(),
    creator_name: user?.full_name || 'Giảng viên',
    creator_avatar: user?.avatar_url || null,
    meet_link: meetLink,
    created_at: creationTime,
    updated_at: creationTime,
  };

  // 4. Lưu vào CSDL Supabase
  try {
    const { data: saved, error: dbErr } = await supabaseAdmin
      .from('announcements')
      .upsert(announcementPayload, { onConflict: 'google_announcement_id' })
      .select()
      .single();

    if (dbErr) {
      console.warn('⚠️ Lỗi khi lưu announcement vào DB:', dbErr.message);
      return announcementPayload as AnnouncementEntity;
    }

    return saved;
  } catch (dbErr: any) {
    console.warn('⚠️ Ngoại lệ DB khi lưu announcement:', dbErr.message);
    return announcementPayload as AnnouncementEntity;
  }
};
