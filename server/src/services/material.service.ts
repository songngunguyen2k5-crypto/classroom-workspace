import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middlewares/errorHandler.js';

const BUCKET_NAME = 'course-materials';

/**
 * Đảm bảo Bucket course-materials tồn tại trên Supabase Storage
 */
export const ensureMaterialBucketExists = async (): Promise<void> => {
  try {
    const { data: buckets } = await supabaseAdmin.storage.listBuckets();
    const exists = (buckets || []).some((b) => b.name === BUCKET_NAME);

    if (!exists) {
      const { error } = await supabaseAdmin.storage.createBucket(BUCKET_NAME, {
        public: true,
        fileSizeLimit: 10485760, // 10MB
        allowedMimeTypes: ['text/html', 'application/xhtml+xml'],
      });
      if (error) {
        console.warn(`[StorageService] ⚠️ Không thể tạo bucket ${BUCKET_NAME}:`, error.message);
      } else {
        console.log(`[StorageService] ✅ Đã tạo thành công public bucket: ${BUCKET_NAME}`);
      }
    }
  } catch (err: any) {
    console.warn('[StorageService] Lỗi kiểm tra bucket storage:', err.message);
  }
};

export interface UploadedMaterialResult {
  type: 'HTML_FILE' | 'FILE';
  title: string;
  url: string;
  size: number;
}

/**
 * Tải lên tệp học liệu HTML tương tác lên Supabase Storage
 */
export const uploadMaterialFile = async (
  courseId: string,
  file: Express.Multer.File
): Promise<UploadedMaterialResult> => {
  if (!file) {
    throw new AppError('Vui lòng chọn tệp tin để tải lên.', 400);
  }

  // 1. Kiểm tra định dạng tệp: bắt buộc là .html hoặc .htm
  const ext = file.originalname.split('.').pop()?.toLowerCase();
  if (ext !== 'html' && ext !== 'htm') {
    throw new AppError('Định dạng tệp không hợp lệ. Chỉ chấp nhận tệp học liệu HTML (.html, .htm).', 400);
  }

  // 2. Giới hạn dung lượng: 10MB
  if (file.size > 10 * 1024 * 1024) {
    throw new AppError('Dung lượng tệp vượt quá giới hạn cho phép (Tối đa 10MB).', 400);
  }

  // 3. Đảm bảo bucket sẵn sàng
  await ensureMaterialBucketExists();

  // 4. Chuẩn hóa tên tệp và tạo đường dẫn lưu trữ
  const cleanFilename = file.originalname
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `courses/${courseId}/announcements/${Date.now()}_${cleanFilename}`;

  // 5. Tải tệp lên Supabase Storage với Content-Type chuẩn để trình duyệt mở trực tiếp
  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .upload(storagePath, file.buffer, {
      contentType: 'text/html; charset=utf-8',
      upsert: true,
    });

  if (uploadError) {
    throw new AppError(`Lỗi tải tệp lên Supabase Storage: ${uploadError.message}`, 500);
  }

  // 6. Lấy đường dẫn công khai (Public URL)
  const { data: urlData } = supabaseAdmin.storage
    .from(BUCKET_NAME)
    .getPublicUrl(storagePath);

  return {
    type: 'HTML_FILE',
    title: file.originalname,
    url: urlData.publicUrl,
    size: file.size,
  };
};
