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
 * Nguyên tắc:
 * 1. Nếu tài khoản có bất kỳ lớp học nào với vai trò Giảng viên (teacherId: 'me') trên Google Classroom -> TEACHER
 * 2. Nếu tài khoản là chủ sở hữu (owner_id) hoặc là Giảng viên trong bất kỳ lớp nào của hệ thống -> TEACHER
 * 3. Nếu trong DB đã được thiết lập là TEACHER -> Giữ nguyên TEACHER
 * 4. Ngược lại -> STUDENT
 */
export const determineUserRole = async (
  accessToken: string,
  googleId?: string
): Promise<UserRole> => {
  try {
    const oauth2Client = createOAuth2Client();
    oauth2Client.setCredentials({ access_token: accessToken });
    const classroom = google.classroom({ version: 'v1', auth: oauth2Client });

    // 1. Kiểm tra trên Google Classroom: Có lớp nào người dùng là Giảng viên không?
    const teacherRes = await classroom.courses.list({
      teacherId: 'me',
      courseStates: ['ACTIVE', 'PROVISIONED'],
    }).catch((err) => {
      console.warn('[AuthService] Lỗi gọi Google Classroom teacher list:', err.message);
      return { data: { courses: [] } };
    });

    const teacherCourses = teacherRes.data.courses || [];
    if (teacherCourses.length > 0) {
      console.log(`[AuthService] ✅ Phát hiện ${teacherCourses.length} lớp giảng dạy trên Google Classroom -> Vai trò: TEACHER`);
      return 'TEACHER';
    }

    // 2. Kiểm tra trong CSDL Supabase: Có phải là chủ sở hữu hoặc giảng viên lớp nào không?
    if (googleId) {
      const { data: userRecord } = await supabaseAdmin
        .from('users')
        .select('id, role')
        .eq('google_id', googleId)
        .single();

      if (userRecord) {
        // Kiểm tra xem user có sở hữu lớp nào không
        const { data: ownedCourses } = await supabaseAdmin
          .from('courses')
          .select('id')
          .eq('owner_id', userRecord.id)
          .limit(1);

        if (ownedCourses && ownedCourses.length > 0) {
          console.log('[AuthService] ✅ Người dùng là chủ sở hữu lớp trong DB -> Vai trò: TEACHER');
          return 'TEACHER';
        }

        // Kiểm tra xem user có vai trò TEACHER trong bảng thành viên lớp không
        const { data: teachingMembers } = await supabaseAdmin
          .from('course_members')
          .select('id')
          .eq('user_id', userRecord.id)
          .eq('role_in_course', 'TEACHER')
          .limit(1);

        if (teachingMembers && teachingMembers.length > 0) {
          console.log('[AuthService] ✅ Người dùng là TEACHER trong thành viên lớp -> Vai trò: TEACHER');
          return 'TEACHER';
        }

        // Nếu admin hoặc hệ thống đã cấp quyền TEACHER trước đó
        if (userRecord.role === 'TEACHER') {
          return 'TEACHER';
        }
      }
    }

    // Mặc định: Nếu không giảng dạy lớp nào -> Vai trò là STUDENT
    console.log('[AuthService] ℹ️ Không phát hiện lớp giảng dạy -> Vai trò: STUDENT');
    return 'STUDENT';
  } catch (error: any) {
    console.warn('[AuthService] Lỗi khi xác định role qua Classroom API, mặc định là STUDENT:', error.message);
    return 'STUDENT';
  }
};

/**
 * Bước 4 & 5: Tạo hoặc cập nhật user trong Supabase DB (Upsert pattern)
 * Mã hóa Refresh Token bằng AES-256 trước khi lưu
 * Tự động nâng cấp tài khoản lên TEACHER nếu phát hiện quyền giảng dạy mới
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

  // Nâng cấp linh hoạt: Nếu lần đăng nhập này là TEACHER hoặc trong DB đã là TEACHER -> Đều là TEACHER
  const finalRole: UserRole = (role === 'TEACHER' || existing?.role === 'TEACHER') ? 'TEACHER' : 'STUDENT';

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
