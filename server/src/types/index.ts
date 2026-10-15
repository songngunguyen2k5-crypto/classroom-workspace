export interface ApiResponse<T = any> {
  success: boolean;
  status: number;
  message: string;
  data: T;
}

export type UserRole = 'TEACHER' | 'STUDENT' | 'ADMIN';

export interface UserEntity {
  id: string;
  google_id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  role: UserRole;
  refresh_token?: string;
  created_at: string;
  updated_at: string;
}

export interface CourseEntity {
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

export interface CourseMemberEntity {
  id: string;
  course_id: string;
  user_id: string;
  role_in_course: 'TEACHER' | 'STUDENT';
  joined_at: string;
  user?: UserEntity;
}

export interface CourseworkEntity {
  id: string;
  google_coursework_id: string;
  course_id: string;
  title: string;
  description?: string;
  max_points: number;
  due_date?: string;
  work_type: 'ASSIGNMENT' | 'SHORT_ANSWER_QUESTION' | 'MULTIPLE_CHOICE_QUESTION';
  created_at: string;
  updated_at: string;
  materials?: CourseworkMaterialEntity[];
}

export type MaterialType = 'drive_file' | 'youtube_video' | 'link' | 'form';

export interface CourseworkMaterialEntity {
  id?: string;
  coursework_id: string;
  material_type: MaterialType;
  title: string;
  url: string;
  thumbnail_url?: string | null;
  created_at?: string;
}

export interface SubmissionEntity {
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

export interface SyncLogEntity {
  id: string;
  course_id: string;
  sync_type: 'MANUAL' | 'SCHEDULED_CRON';
  status: 'SUCCESS' | 'FAILED' | 'PARTIAL';
  message?: string;
  executed_at: string;
}

export type AttendanceStatus = 'PRESENT' | 'ABSENT_UNEXCUSED' | 'ABSENT_EXCUSED' | 'LATE';

export interface AttendanceEntity {
  id: string;
  course_id: string;
  student_id: string;
  attendance_date: string;
  status: AttendanceStatus;
  note?: string;
  created_by?: string;
  created_at: string;
}

export interface StudentAttendanceStats {
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
  absence_rate: number; // Tỷ lệ phần trăm vắng (%)
  is_warning: boolean;  // Cảnh báo cấm thi (vắng >= 20% hoặc vắng không phép >= 3 buổi)
}

export interface AnnouncementEntity {
  id: string;
  course_id: string;
  google_announcement_id: string;
  text: string;
  creator_name?: string;
  creator_avatar?: string;
  meet_link?: string | null;
  materials?: any[] | null;
  created_at: string;
  updated_at: string;
}

