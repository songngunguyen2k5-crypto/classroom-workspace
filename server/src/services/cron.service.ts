import cron from 'node-cron';
import { supabaseAdmin } from '../config/supabase.js';
import { syncFullCourse } from './sync.service.js';

/**
 * Khởi động Worker chạy ngầm đồng bộ định kỳ (Background Cron Job)
 * Chạy mỗi 30 phút một lần (Từ phút 0 và 30 mỗi giờ)
 */
export const initSyncCronWorker = (): void => {
  // Biểu thức cron: Chạy mỗi 30 phút
  cron.schedule('*/30 * * * *', async () => {
    console.log('[CronWorker] ⏰ Bắt đầu tiến trình đồng bộ tự động ngầm...');

    try {
      // 1. Lấy danh sách các lớp học đang bật chế độ đồng bộ (is_synced = true)
      const { data: courses, error } = await supabaseAdmin
        .from('courses')
        .select('id, name, owner_id')
        .eq('is_synced', true);

      if (error || !courses || courses.length === 0) {
        console.log('[CronWorker] Không có lớp học nào đang bật tính năng đồng bộ tự động.');
        return;
      }

      console.log(`[CronWorker] Tìm thấy ${courses.length} lớp học cần đồng bộ.`);

      // 2. Chạy đồng bộ tuần tự cho từng lớp học
      for (const course of courses) {
        try {
          console.log(`[CronWorker] Đang đồng bộ lớp: "${course.name}" (ID: ${course.id})...`);
          const result = await syncFullCourse(course.id, course.owner_id, 'SCHEDULED_CRON');
          console.log(
            `[CronWorker] ✅ Đồng bộ lớp "${course.name}" thành công: ${result.courseworkCount} bài tập, ${result.submissionsCount} bài nộp.`
          );
        } catch (courseError: any) {
          console.error(
            `[CronWorker] ❌ Lỗi khi đồng bộ lớp "${course.name}":`,
            courseError.message || courseError
          );
          // Tiếp tục đồng bộ các lớp tiếp theo, không dừng tiến trình
        }
      }

      console.log('[CronWorker] 🏁 Hoàn thành phiên đồng bộ tự động ngầm.');
    } catch (globalError: any) {
      console.error('[CronWorker] Lỗi nghiêm trọng trong Cron Worker:', globalError.message || globalError);
    }
  });

  console.log('⏰ Sync Cron Worker đã được kích hoạt (chu kỳ 30 phút/lần).');
};
