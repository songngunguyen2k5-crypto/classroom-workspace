import { createClient } from '@supabase/supabase-js';
import { ENV } from './env.js';

if (!ENV.SUPABASE_URL || !ENV.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('⚠️ Cảnh báo: SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY chưa được cấu hình trong file .env');
}

// Client dùng Service Role Key (toàn quyền, bypass RLS cho Backend Sync Service)
export const supabaseAdmin = createClient(
  ENV.SUPABASE_URL || 'https://placeholder.supabase.co',
  ENV.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
