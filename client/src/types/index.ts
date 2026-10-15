export interface ApiResponse<T = any> {
  success: boolean;
  status: number;
  message: string;
  data: T;
}

export type UserRole = 'TEACHER' | 'STUDENT' | 'ADMIN';

export interface User {
  id: string;
  google_id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  role: UserRole;
  created_at: string;
}

export interface Course {
  id: string;
  google_course_id: string;
  name: string;
  section?: string;
  room?: string;
  owner_id: string;
  is_synced: boolean;
  created_at: string;
  updated_at: string;
}

export interface Attendance {
  id: string;
  course_id: string;
  student_id: string;
  attendance_date: string;
  status: 'PRESENT' | 'ABSENT_UNEXCUSED' | 'ABSENT_EXCUSED' | 'LATE';
  note?: string;
  created_at: string;
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

export interface Coursework {
  id: string;
  google_coursework_id: string;
  course_id: string;
  title: string;
  description?: string;
  max_points: number;
  due_date?: string;
  work_type: 'ASSIGNMENT' | 'SHORT_ANSWER_QUESTION' | 'MULTIPLE_CHOICE_QUESTION';
  created_at: string;
  materials?: CourseworkMaterial[];
}

export interface Submission {
  id: string;
  google_submission_id: string;
  coursework_id: string;
  student_id: string;
  state: 'NEW' | 'CREATED' | 'TURNED_IN' | 'RETURNED' | 'RECLAIMED_BY_STUDENT';
  assigned_grade?: number;
  sync_status: 'PENDING' | 'SYNCED' | 'FAILED';
  submitted_at?: string;
  updated_at: string;
}

export interface AnnouncementItem {
  id: string;
  course_id: string;
  google_announcement_id: string;
  text: string;
  creator_name?: string;
  creator_avatar?: string;
  meet_link?: string | null;
  created_at: string;
  updated_at: string;
}
