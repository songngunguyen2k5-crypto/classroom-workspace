import { google } from 'googleapis';
import { ENV } from '../config/env.js';

// Danh sách OAuth Scopes cần thiết theo tài liệu thiết kế kiến trúc (tailieukientruc.md)
const SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.rosters.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.students',
  'https://www.googleapis.com/auth/classroom.student-submissions.students.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.me',
  'https://www.googleapis.com/auth/classroom.student-submissions.me.readonly',
  'https://www.googleapis.com/auth/classroom.announcements',
  'https://www.googleapis.com/auth/classroom.announcements.readonly',
];

/**
 * Tạo OAuth2 Client được cấu hình sẵn với Client ID, Secret và Redirect URI
 */
export const createOAuth2Client = () => {
  return new google.auth.OAuth2(
    ENV.GOOGLE_CLIENT_ID,
    ENV.GOOGLE_CLIENT_SECRET,
    ENV.GOOGLE_REDIRECT_URI
  );
};

/**
 * Sinh URL trang Google Consent Screen.
 * Bắt buộc có access_type=offline để nhận Refresh Token,
 * và prompt=consent để đảm bảo luôn sinh Refresh Token mới ở mỗi lần đăng nhập.
 */
export const generateAuthUrl = (): string => {
  const oauth2Client = createOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
  });
};
