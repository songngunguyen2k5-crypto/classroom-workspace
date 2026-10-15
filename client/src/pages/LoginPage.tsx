import { useEffect } from 'react';
import { BookOpen, GraduationCap, Shield, Zap, Sparkles } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const features = [
  { icon: BookOpen, title: 'Quản lý lớp học', desc: 'Đồng bộ 2 chiều với Google Classroom' },
  { icon: GraduationCap, title: 'Chấm điểm tự động', desc: 'Tính GPA, trả điểm trực tiếp lên Google' },
  { icon: Shield, title: 'Điểm danh chuyên cần', desc: 'Hệ thống điểm danh nội bộ, cảnh báo vắng' },
  { icon: Zap, title: 'Đồng bộ thông minh', desc: 'Local-First, cập nhật tự động định kỳ' },
];

export default function LoginPage() {
  // Kiểm tra nếu đã đăng nhập thì redirect hoặc hiển thị lỗi
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get('error');
    if (error) {
      alert(`Đăng nhập thất bại: ${decodeURIComponent(error)}`);
    }
  }, []);

  const handleGoogleLogin = async () => {
    try {
      const res = await fetch(`${API_URL}/auth/google/url`);
      const json = await res.json();
      if (json.success && json.data?.url) {
        window.location.href = json.data.url;
      }
    } catch {
      alert('Không kết nối được đến máy chủ. Hãy kiểm tra server đang chạy.');
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAF8] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Hiệu ứng nền tự nhiên (Soft Natural Glows) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-[#EAF2EC] rounded-full blur-3xl opacity-70" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-[#F4E8C1] rounded-full blur-3xl opacity-40" />
      </div>

      <div className="relative z-10 w-full max-w-4xl grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">

        {/* Cột trái: Giới thiệu */}
        <div className="space-y-8">
          <div>
            <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-[#EAF2EC] border border-[#D6E6DC] text-[#16382B] font-semibold text-xs mb-4">
              <Sparkles className="w-3.5 h-3.5" />
              <span>KHÔNG GIAN HỌC TẬP & ĐỒNG BỘ</span>
            </div>
            <h1 className="text-4xl font-extrabold text-[#15241E] leading-tight tracking-tight">
              Quản lý lớp học<br />
              <span className="text-[#16382B]">
                thông minh & bản chất
              </span>
            </h1>
            <p className="mt-4 text-[#485952] text-base sm:text-lg leading-relaxed">
              Mở rộng Google Classroom với chuyên cần điểm danh, tính toán GPA và cảnh báo học vụ thời gian thực theo mô hình Local-First.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {features.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="bg-white border border-[#E5ECE7] rounded-2xl p-4 shadow-sm hover:border-[#16382B]/30 hover:shadow-md transition-all duration-200"
              >
                <div className="w-8 h-8 rounded-lg bg-[#EAF2EC] flex items-center justify-center mb-2.5">
                  <Icon className="w-4 h-4 text-[#16382B]" />
                </div>
                <p className="text-[#15241E] font-semibold text-sm">{title}</p>
                <p className="text-[#61746B] text-xs mt-1 leading-normal">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Cột phải: Form đăng nhập */}
        <div className="bg-white border border-[#E5ECE7] rounded-3xl p-8 sm:p-10 shadow-xl shadow-[#16382B]/5">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-[#16382B] flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[#16382B]/20">
              <GraduationCap className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-[#15241E]">Chào mừng bạn</h2>
            <p className="text-[#61746B] mt-1.5 text-sm">
              Đăng nhập bằng tài khoản Google để đồng bộ lớp học
            </p>
          </div>

          <button
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-[#F8FAF8] text-[#15241E] font-semibold py-3.5 px-6 rounded-2xl transition-all duration-200 border border-[#D6E6DC] hover:border-[#16382B] hover:shadow-md active:scale-[0.99] group cursor-pointer"
          >
            {/* Google Logo SVG */}
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            <span className="text-sm sm:text-base">Đăng nhập với Google</span>
          </button>

          <div className="mt-8 pt-6 border-t border-[#E5ECE7]">
            <p className="text-center text-xs text-[#7B8B84] leading-relaxed">
              Bằng cách đăng nhập, bạn đồng ý cho phép ứng dụng truy xuất dữ liệu Google Classroom theo{' '}
              <span className="text-[#16382B] font-semibold cursor-pointer hover:underline">Quy định Bảo mật</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
