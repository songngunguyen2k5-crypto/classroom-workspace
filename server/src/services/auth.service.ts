import { google } from 'googleapis';
import jwt from 'jsonwebtoken';
import { supabaseAdmin } from '../config/supabase.js';
import { createOAuth2Client } from '../config/google.js';
import { encrypt } from '../utils/crypto.js';
import { ENV } from '../config/env.js';
import type { UserEntity, UserRole } from '../types/index.js';

// ============================================================================
// Interfaces nội bộ của AuthService
// ============================================================================

interface GoogleProfile {
  googleId: string;
  email: string;
  fullName: string;
  avatarUrl: string;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResult {
  jwtToken: string;
  user: Omit<UserEntity, 'refresh_token'>;
}

// ============================================================================
// AuthService: Toàn bộ nghiệp vụ xác thực Google OAuth 2.0
// ============================================================================

/**
 * Bước 1: Đổi Authorization Code → Access Token + Refresh Token + ID Token
 */
export const exchangeCodeForTokens = async (code: string): Promise<AuthTokens> => {
  const oauth2Client = createOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);

  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error('Không nhận được đầy đủ token từ Google. Vui lòng thử đăng nhập lại.');
  }

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
  };
};

/**
 * Bước 2: Lấy thông tin hồ sơ người dùng từ Google bằng Access Token
 */
export const getGoogleProfile = async (accessToken: string): Promise<GoogleProfile> => {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({ access_token: accessToken });

  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  const { data } = await oauth2.userinfo.get();

  if (!data.id || !data.email) {
    throw new Error('Không lấy được thông tin tài khoản từ Google.');
  }

  return {
    googleId: data.id,
    email: data.email,
    fullName: data.name || data.email,
    avatarUrl: data.picture || '',
  };
};

/**
 * Bước 3: Xác định Role người dùng (TEACHER / STUDENT)
 * Ưu tiên kiểm tra quan hệ trong CSDL hệ thống và số lượng lớp học sinh tham gia
 */
export const determineUserRole = async (
  accessToken: string,
  googleId?: string
): Promise<UserRole> => {
  try {
    // 1. Kiểm tra trong DB: Nếu user đã tồn tại và đã là STUDENT, giữ nguyên vai trò
    if (googleId) {
      const { data: existingUser } = await supabaseAdmin
        .from('users')
        .select('id, role')
        .eq('google_id', googleId)
        .single();

      if (existingUser) {
        if (existingUser.role === 'STUDENT') {
          return 'STUDENT';
        }

        // Kiểm tra xem user có phải là STUDENT trong các lớp học thuộc hệ thống
        const { data: memberRecord } = await supabaseAdmin
          .from('course_members')
          .select('role_in_course')
          .eq('user_id', existingUser.id);

        const isStudentInCourses = (memberRecord || []).some(
          (m) => m.role_in_course === 'STUDENT'
        );
        const isTeacherInCourses = (memberRecord || []).some(
          (m) => m.role_in_course === 'TEACHER'
        );

        if (isStudentInCourses && !isTeacherInCourses) {
          return 'STUDENT';
        }
      }
    }

    const oauth2Client = createOAuth2Client();
    oauth2Client.setCredentials({ access_token: accessToken });
    const classroom = google.classroom({ version: 'v1', auth: oauth2Client });

    // 2. Lấy danh sách lớp tham gia với vai trò học sinh và giảng viên trên Google Classroom
    const [teacherRes, studentRes] = await Promise.all([
      classroom.courses.list({ teacherId: 'me', courseStates: ['ACTIVE'] }).catch(() => ({ data: { courses: [] } })),
      classroom.courses.list({ studentId: 'me', courseStates: ['ACTIVE'] }).catch(() => ({ data: { courses: [] } })),
    ]);

    const teacherCourses = teacherRes.data.courses || [];
    const studentCourses = studentRes.data.courses || [];

    // Lấy danh sách ID lớp học của hệ thống
    const { data: systemCourses } = await supabaseAdmin
      .from('courses')
      .select('google_course_id');
    const systemGoogleIds = new Set((systemCourses || []).map((c) => c.google_course_id));

    // Nếu người dùng đang là học sinh trong bất kỳ lớp học nào của hệ thống -> Vai trò là STUDENT
    const isEnrolledInSystemCourse = studentCourses.some((sc) =>
      systemGoogleIds.has(sc.id || '')
    );
    if (isEnrolledInSystemCourse) {
      return 'STUDENT';
    }

    // Nếu số lớp học sinh tham gia nhiều hơn lớp dạy -> Vai trò là STUDENT
    if (studentCourses.length > teacherCourses.length) {
      return 'STUDENT';
    }

    // Mặc định: Nếu có sở hữu lớp dạy hợp lệ thì là TEACHER, ngược lại là STUDENT
    return teacherCourses.length > 0 ? 'TEACHER' : 'STUDENT';
  } catch (error) {
    console.warn('[AuthService] Không xác định được role qua Classroom API, mặc định là STUDENT:', error);
    return 'STUDENT';
  }
};

/**
 * Bước 4 & 5: Tạo hoặc cập nhật user trong Supabase DB (Upsert pattern)
 * Mã hóa Refresh Token bằng AES-256 trước khi lưu
 */
export const upsertUser = async (
  profile: GoogleProfile,
  role: UserRole,
  refreshToken: string
): Promise<UserEntity> => {
  const encryptedToken = encrypt(refreshToken);

  // Kiểm tra vai trò hiện có trong DB
  const { data: existing } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('google_id', profile.googleId)
    .single();

  // Bảo toàn vai trò STUDENT nếu tài khoản đã là học sinh trong hệ thống
  const finalRole = existing?.role === 'STUDENT' ? 'STUDENT' : (existing?.role || role);

  const { data, error } = await supabaseAdmin
    .from('users')
    .upsert(
      {
        google_id: profile.googleId,
        email: profile.email,
        full_name: profile.fullName,
        avatar_url: profile.avatarUrl,
        role: finalRole,
        refresh_token: encryptedToken,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'google_id',
        ignoreDuplicates: false,
      }
    )
    .select()
    .single();

  if (error) {
    throw new Error(`Lỗi lưu thông tin người dùng vào DB: ${error.message}`);
  }

  return data as UserEntity;
};

/**
 * Bước 6: Tạo JWT Session Token trả về cho Frontend
 */
export const generateJwtToken = (user: UserEntity): string => {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
    },
    ENV.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

/**
 * Luồng xử lý đầy đủ sau khi nhận Authorization Code từ Google
 * Kết hợp tất cả các bước vào một hàm duy nhất để Controller gọi
 */
export const handleGoogleCallback = async (code: string): Promise<LoginResult> => {
  // (4) Đổi code → tokens
  const { accessToken, refreshToken } = await exchangeCodeForTokens(code);

  // (5) Lấy profile người dùng
  const profile = await getGoogleProfile(accessToken);

  // (6) Xác định role
  const role = await determineUserRole(accessToken, profile.googleId);

  // (7) Lưu/cập nhật vào DB (với Refresh Token đã mã hóa AES-256)
  const user = await upsertUser(profile, role, refreshToken);

  // (8) Sinh JWT trả về Frontend
  const jwtToken = generateJwtToken(user);

  const { refresh_token: _, ...safeUser } = user;

  return {
    jwtToken,
    user: safeUser,
  };
};
