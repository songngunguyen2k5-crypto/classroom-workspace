import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  GraduationCap, 
  LogOut, 
  CheckCircle2, 
  RefreshCw, 
  Users, 
  FileText, 
  Sparkles,
  Layers,
  AlertCircle,
  UserCheck,
  ExternalLink,
  Search,
  ArrowRight
} from 'lucide-react';
import { 
  fetchLocalCourses, 
  triggerSyncCourses, 
  triggerSyncCourseDetail,
  type CourseItem 
} from '../services/sync.service';

interface UserData {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string;
  role: 'TEACHER' | 'STUDENT';
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export default function DashboardPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [user, setUser] = useState<UserData | null>(null);
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingCourses, setSyncingCourses] = useState(false);
  const [syncingDetailId, setSyncingDetailId] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Lọc khóa học theo từ khóa tìm kiếm
  const filteredCourses = courses.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.section && c.section.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (c.room && c.room.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const totalStudents = courses.reduce((acc, c) => acc + (c.student_count || 0), 0);
  const totalCoursework = courses.reduce((acc, c) => acc + (c.coursework_count || 0), 0);

  // 1. Khởi tạo User và tải danh sách khóa học (Local-First)
  useEffect(() => {
    const initData = async () => {
      // Xác thực user
      const userParam = searchParams.get('user');
      let currentUser: UserData | null = null;

      if (userParam) {
        try {
          currentUser = JSON.parse(decodeURIComponent(userParam));
          setUser(currentUser);
          localStorage.setItem('user', JSON.stringify(currentUser));
          window.history.replaceState({}, document.title, '/dashboard');
        } catch (e) {
          console.error('Lỗi parse query user:', e);
        }
      }

      if (!currentUser) {
        const saved = localStorage.getItem('user');
        if (saved) {
          try {
            currentUser = JSON.parse(saved);
            setUser(currentUser);
          } catch (e) {
            console.error('Lỗi parse localStorage user:', e);
          }
        }
      }

      if (!currentUser) {
        try {
          const res = await fetch(`${API_URL}/auth/me`, { credentials: 'include' });
          const json = await res.json();
          if (json.success && json.data) {
            currentUser = json.data;
            setUser(currentUser);
            localStorage.setItem('user', JSON.stringify(json.data));
          } else {
            navigate('/login');
            return;
          }
        } catch {
          navigate('/login');
          return;
        }
      }

      // Tải danh sách lớp từ Supabase (Local-First pattern)
      try {
        const localCourses = await fetchLocalCourses();
        setCourses(localCourses);
      } catch (err: any) {
        console.warn('Chưa có lớp học hoặc lỗi tải lớp:', err.message);
      } finally {
        setLoading(false);
      }
    };

    initData();
  }, [searchParams, navigate]);

  // Thông báo tự tắt sau 5 giây
  useEffect(() => {
    if (feedbackMsg) {
      const timer = setTimeout(() => setFeedbackMsg(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [feedbackMsg]);

  // Đồng bộ toàn bộ danh sách lớp từ Google Classroom
  const handleSyncCourses = async () => {
    try {
      setSyncingCourses(true);
      setFeedbackMsg(null);
      const updated = await triggerSyncCourses();
      // Nạp lại danh sách lớp mới nhất từ DB
      const refreshed = await fetchLocalCourses();
      setCourses(refreshed);
      setFeedbackMsg({
        type: 'success',
        text: `Đã đồng bộ thành công ${updated.length} lớp học từ Google Classroom!`,
      });
    } catch (err: any) {
      setFeedbackMsg({
        type: 'error',
        text: err.message || 'Lỗi khi đồng bộ danh sách lớp học.',
      });
    } finally {
      setSyncingCourses(false);
    }
  };

  // Đồng bộ chi tiết 1 lớp học (Thành viên, Bài tập, Bài nộp)
  const handleSyncCourseDetail = async (courseId: string, courseName: string) => {
    try {
      setSyncingDetailId(courseId);
      setFeedbackMsg(null);
      const res = await triggerSyncCourseDetail(courseId);
      // Nạp lại danh sách để cập nhật số lượng sĩ số và bài tập
      const refreshed = await fetchLocalCourses();
      setCourses(refreshed);
      setFeedbackMsg({
        type: 'success',
        text: `Đã đồng bộ chi tiết lớp "${courseName}": ${res.roster?.studentCount || 0} sinh viên, ${res.courseworkCount || 0} bài tập!`,
      });
    } catch (err: any) {
      setFeedbackMsg({
        type: 'error',
        text: err.message || `Lỗi khi đồng bộ lớp ${courseName}.`,
      });
    } finally {
      setSyncingDetailId(null);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (e) {
      console.error('Lỗi khi đăng xuất:', e);
    } finally {
      localStorage.removeItem('user');
      navigate('/login');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAF8] flex items-center justify-center">
        <div className="flex items-center gap-3 bg-white px-6 py-4 rounded-2xl border border-[#E5ECE7] shadow-sm">
          <div className="w-5 h-5 border-2 border-[#16382B] border-t-transparent rounded-full animate-spin" />
          <span className="text-[#485952] text-sm font-medium">Đang khởi tạo không gian học tập...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAF8] text-[#15241E] flex flex-col font-sans">
      {/* Header / Navbar */}
      <header className="border-b border-[#E5ECE7] bg-white/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#16382B] flex items-center justify-center shadow-md shadow-[#16382B]/20">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-bold text-base sm:text-lg text-[#15241E]">Classroom Sync</span>
              <span className="ml-2 text-xs px-2.5 py-0.5 rounded-full bg-[#EAF2EC] text-[#16382B] border border-[#D6E6DC] font-semibold">
                Local-First
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            {user && (
              <div className="flex items-center gap-3 bg-[#F4F8F5] pl-3.5 pr-2 py-1.5 rounded-full border border-[#D6E6DC]">
                <span className="text-xs sm:text-sm font-semibold text-[#15241E] hidden sm:inline">
                  {user.full_name}
                </span>
                <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                  user.role === 'TEACHER' 
                    ? 'bg-[#F4E8C1] text-[#7A5816] border border-[#E6D49F]'
                    : 'bg-[#EAF2EC] text-[#16382B] border border-[#D6E6DC]'
                }`}>
                  {user.role === 'TEACHER' ? 'Giảng viên' : 'Sinh viên'}
                </span>
                <img
                  src={user.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg'}
                  alt={user.full_name}
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-[#cbd8cf] object-cover"
                />
              </div>
            )}

            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium text-[#61746B] hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors border border-transparent hover:border-rose-200"
              title="Đăng xuất"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Đăng xuất</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-8">
        
        {/* Banner thông báo Toast Feedback */}
        {feedbackMsg && (
          <div className={`p-4 rounded-2xl flex items-center gap-3 border shadow-sm transition-all animate-in fade-in slide-in-from-top-2 ${
            feedbackMsg.type === 'success'
              ? 'bg-[#EAF2EC] border-[#B7D1C2] text-[#16382B]'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}>
            {feedbackMsg.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-[#2D6A4F] shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span className="text-sm font-medium">{feedbackMsg.text}</span>
          </div>
        )}

        {/* Hero Section: Trạng thái & Nút On-Demand Sync */}
        <div className="relative overflow-hidden rounded-3xl bg-[#EAF2EC] border border-[#D6E6DC] p-6 sm:p-8 shadow-sm">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2.5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/80 border border-[#D6E6DC] text-[#16382B] text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Đồng bộ 2 chiều & Local-First (Sync Engine)</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#15241E] tracking-tight">
                Quản lý Lớp học & Dữ liệu Học tập
              </h1>
              <p className="text-[#485952] text-sm sm:text-base max-w-2xl leading-relaxed">
                Dữ liệu được lưu trữ và tải trực tiếp từ Supabase để tối ưu tốc độ và hạn chế Google Rate Limit. Sử dụng nút đồng bộ để cập nhật danh sách bài tập và sinh viên mới nhất từ Google Classroom.
              </p>
            </div>

            {user?.role === 'TEACHER' && (
              <button
                onClick={handleSyncCourses}
                disabled={syncingCourses}
                className="flex items-center justify-center gap-2.5 px-5 py-3 rounded-2xl bg-[#16382B] hover:bg-[#1f4a3a] text-white font-semibold text-sm shadow-md shadow-[#16382B]/20 transition-all transform active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed shrink-0 cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${syncingCourses ? 'animate-spin' : ''}`} />
                <span>{syncingCourses ? 'Đang đồng bộ...' : 'Đồng bộ từ Google Classroom'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Section Thống kê nhanh & Danh sách lớp học */}
        <section className="space-y-6">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl bg-white border border-[#E5ECE7] shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs text-[#61746B] font-semibold uppercase tracking-wider">Lớp học hoạt động</span>
                <div className="text-2xl font-bold text-[#15241E] mt-1">{courses.length} lớp</div>
              </div>
              <div className="w-11 h-11 rounded-xl bg-[#EAF2EC] border border-[#D6E6DC] text-[#16382B] flex items-center justify-center">
                <Layers className="w-5 h-5" />
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-[#E5ECE7] shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs text-[#61746B] font-semibold uppercase tracking-wider">Tổng sinh viên</span>
                <div className="text-2xl font-bold text-[#16382B] mt-1">{totalStudents} em</div>
              </div>
              <div className="w-11 h-11 rounded-xl bg-[#EAF2EC] border border-[#D6E6DC] text-[#16382B] flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-[#E5ECE7] shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs text-[#61746B] font-semibold uppercase tracking-wider">Tổng bài tập</span>
                <div className="text-2xl font-bold text-[#7A5816] mt-1">{totalCoursework} bài</div>
              </div>
              <div className="w-11 h-11 rounded-xl bg-[#F4E8C1] border border-[#E6D49F] text-[#7A5816] flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Header & Search Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <Layers className="w-5 h-5 text-[#16382B]" />
              <h2 className="text-xl font-bold text-[#15241E]">Khóa học của bạn</h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#EAF2EC] text-[#16382B] border border-[#D6E6DC] font-semibold">
                {filteredCourses.length} lớp
              </span>
            </div>

            {/* Search Input */}
            <div className="relative sm:w-72">
              <Search className="w-4 h-4 text-[#7B8B84] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm tên lớp, phòng học..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-2xl bg-white border border-[#D6E6DC] text-xs text-[#15241E] placeholder-[#7B8B84] focus:outline-none focus:border-[#16382B] focus:ring-1 focus:ring-[#16382B] shadow-sm transition-all"
              />
            </div>
          </div>

          {courses.length === 0 ? (
            /* Empty State */
            <div className="p-12 text-center rounded-3xl bg-white border border-[#E5ECE7] shadow-sm space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-[#EAF2EC] border border-[#D6E6DC] text-[#16382B] flex items-center justify-center mx-auto">
                <GraduationCap className="w-8 h-8" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-lg font-bold text-[#15241E]">Chưa có lớp học nào được đồng bộ</h3>
                <p className="text-sm text-[#61746B] max-w-md mx-auto">
                  Bạn có các lớp học trên Google Classroom? Hãy bấm nút bên dưới để tải danh sách lớp về hệ thống ngay bây giờ.
                </p>
              </div>
              {user?.role === 'TEACHER' && (
                <button
                  onClick={handleSyncCourses}
                  disabled={syncingCourses}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#16382B] hover:bg-[#1f4a3a] text-white font-semibold text-sm transition-all shadow-md shadow-[#16382B]/20"
                >
                  <RefreshCw className={`w-4 h-4 ${syncingCourses ? 'animate-spin' : ''}`} />
                  Đồng bộ ngay
                </button>
              )}
            </div>
          ) : filteredCourses.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-white border border-[#E5ECE7] text-[#61746B] text-sm shadow-sm">
              Không tìm thấy lớp học nào khớp với từ khóa "{searchQuery}".
            </div>
          ) : (
            /* Course Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCourses.map((course) => {
                const isDetailSyncing = syncingDetailId === course.id;

                return (
                  <div
                    key={course.id}
                    className="flex flex-col justify-between p-6 rounded-3xl bg-white border border-[#E5ECE7] hover:border-[#16382B]/40 hover:shadow-xl hover:shadow-[#16382B]/5 transition-all duration-200 group"
                  >
                    <div>
                      {/* Course Header */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <h3 
                          onClick={() => navigate(`/courses/${course.id}`)}
                          className="text-lg font-bold text-[#15241E] group-hover:text-[#16382B] transition-colors line-clamp-1 flex-1 cursor-pointer"
                        >
                          {course.name}
                        </h3>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#EAF2EC] text-[#16382B] border border-[#D6E6DC] font-semibold">
                            Active
                          </span>
                          <a
                            href={`https://classroom.google.com/c/${course.google_course_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 rounded-lg text-[#61746B] hover:text-[#16382B] hover:bg-[#EAF2EC] transition-colors"
                            title="Mở trực tiếp trên Google Classroom"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                      </div>

                      {/* Course Meta */}
                      <div className="space-y-1 text-xs text-[#61746B] mb-6">
                        {course.section && <p>Phân đoạn: {course.section}</p>}
                        {course.room && <p>Phòng: {course.room}</p>}
                        <p className="font-mono text-[#7B8B84]">Google ID: {course.google_course_id}</p>
                      </div>
                    </div>

                    <div>
                      {/* Counts / Metrics */}
                      <div className="grid grid-cols-2 gap-3 py-3 border-t border-[#E5ECE7] mb-4 text-xs">
                        <div className="flex items-center gap-2 text-[#485952]">
                          <Users className="w-4 h-4 text-[#16382B]" />
                          <span><strong>{course.student_count}</strong> sinh viên</span>
                        </div>
                        <div className="flex items-center gap-2 text-[#485952]">
                          <FileText className="w-4 h-4 text-[#7A5816]" />
                          <span><strong>{course.coursework_count}</strong> bài tập</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-2">
                        {/* Nút Vào không gian lớp học */}
                        <button
                          onClick={() => navigate(`/courses/${course.id}`)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-[#16382B] hover:bg-[#1f4a3a] text-white text-xs font-semibold shadow-sm shadow-[#16382B]/20 transition-all cursor-pointer"
                          title="Vào không gian chi tiết lớp học: Bài tập, Chấm điểm, Chuyên cần"
                        >
                          <span>Vào lớp</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>

                        {/* Nút Điểm danh nhanh */}
                        <button
                          onClick={() => navigate(`/courses/${course.id}?tab=attendance`)}
                          className="py-2.5 px-3 rounded-xl bg-[#EAF2EC] hover:bg-[#d8e7df] text-[#16382B] text-xs font-semibold border border-[#D6E6DC] transition-all flex items-center gap-1.5 cursor-pointer"
                          title="Điểm danh chuyên cần"
                        >
                          <UserCheck className="w-3.5 h-3.5 text-[#16382B]" />
                          <span className="hidden sm:inline">Điểm danh</span>
                        </button>

                        {/* Nút Sync chi tiết */}
                        {user?.role === 'TEACHER' && (
                          <button
                            onClick={() => handleSyncCourseDetail(course.id, course.name)}
                            disabled={isDetailSyncing}
                            className="p-2.5 rounded-xl bg-white hover:bg-[#F8FAF8] text-[#485952] text-xs border border-[#D6E6DC] hover:border-[#16382B] transition-all disabled:opacity-50 cursor-pointer"
                            title="Đồng bộ danh sách học sinh và bài tập mới nhất"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${isDetailSyncing ? 'animate-spin text-[#16382B]' : ''}`} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
