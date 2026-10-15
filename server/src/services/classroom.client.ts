import { google, classroom_v1 } from 'googleapis';
import { supabaseAdmin } from '../config/supabase.js';
import { createOAuth2Client } from '../config/google.js';
import { decrypt } from '../utils/crypto.js';
import { AppError } from '../middlewares/errorHandler.js';

/**
 * Khởi tạo Google Classroom API Client cho một người dùng cụ thể.
 * Tự động đọc Refresh Token từ Supabase DB, giải mã bằng AES-256,
 * và gắn vào OAuth2Client để tự động làm mới Access Token khi hết hạn.
 * 
 * @param userId - ID người dùng trong bảng users của hệ thống
 * @returns Classroom API client đã được chứng thực
 */
export const getClassroomClientForUser = async (userId: string): Promise<classroom_v1.Classroom> => {
  // Lấy thông tin user và refresh_token từ DB
  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('id, email, refresh_token, role')
    .eq('id', userId)
    .single();

  if (error || !user) {
    throw new AppError('Không tìm thấy thông tin tài khoản người dùng trong cơ sở dữ liệu.', 404);
  }

  if (!user.refresh_token) {
    throw new AppError(
      'Tài khoản chưa có Refresh Token từ Google. Vui lòng đăng xuất và đăng nhập lại bằng Google để cấp quyền.',
      400
    );
  }

  // Giải mã Refresh Token bằng AES-256-CBC
  const plainRefreshToken = decrypt(user.refresh_token);

  // Tạo OAuth2 Client và cấu hình Refresh Token
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({
    refresh_token: plainRefreshToken,
  });

  // Trả về Classroom API client
  return google.classroom({ version: 'v1', auth: oauth2Client });
};
