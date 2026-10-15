import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  ArrowLeft, 
  ExternalLink, 
  Users, 
  BookOpen, 
  FileText, 
  UserCheck, 
  BarChart3, 
  CheckCircle2, 
  Calendar, 
  Save, 
  CheckCheck, 
  AlertTriangle, 
  GraduationCap,
  Sparkles,
  Send,
  ShieldAlert
} from 'lucide-react';
import { 
  fetchCourseDetail, 
  fetchCourseworkList, 
  fetchCourseworkDetail,
  fetchCourseworkSubmissions, 
  submitGrade, 
  fetchCourseAnalytics,
  type CourseDetailData,
  type CourseworkItem,
  type CourseworkDetailData,
  type CourseworkSubmissionsData,
  type CourseAnalyticsData
} from '../services/coursework.service';
import { CourseWorkDetailDrawer } from '../components/CourseWorkDetailDrawer';
import { AnnouncementStream } from '../components/AnnouncementStream';
import { 
  fetchAttendanceByDate, 
  saveBulkAttendance,
  type StudentAttendanceItem,
  type AttendanceStatus 
} from '../services/attendance.service';

export default function CourseDetailPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Active Tab: 'overview' | 'coursework' | 'attendance' | 'analytics'
  const defaultTab = (searchParams.get('tab') as any) || 'overview';
  const [activeTab, setActiveTab] = useState<'overview' | 'coursework' | 'attendance' | 'analytics'>(defaultTab);

  const [detailData, setDetailData] = useState<CourseDetailData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Current logged in user info
  const [currentUser] = useState<any>(() => {
    try {
      const saved = localStorage.getItem('user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const isTeacher = 
    currentUser?.role === 'TEACHER' || 
    detailData?.teachers?.some((t) => t.email === currentUser?.email || t.id === currentUser?.id);

  // Tab Coursework state
  const [courseworks, setCourseworks] = useState<CourseworkItem[]>([]);
  const [selectedCoursework, setSelectedCoursework] = useState<CourseworkItem | null>(null);
  const [submissionsData, setSubmissionsData] = useState<CourseworkSubmissionsData | null>(null);
  const [loadingSubs, setLoadingSubs] = useState<boolean>(false);
  const [gradingScores, setGradingScores] = useState<Record<string, number>>({});
  const [gradingSubmittingId, setGradingSubmittingId] = useState<string | null>(null);

  // Coursework Detail Drawer state
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [drawerData, setDrawerData] = useState<CourseworkDetailData | null>(null);
  const [loadingDrawer, setLoadingDrawer] = useState<boolean>(false);

  // Tab Attendance state
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [attendanceStudents, setAttendanceStudents] = useState<StudentAttendanceItem[]>([]);
  const [isAttendanceSubmitted, setIsAttendanceSubmitted] = useState<boolean>(false);
  const [loadingAttendance, setLoadingAttendance] = useState<boolean>(false);
  const [savingAttendance, setSavingAttendance] = useState<boolean>(false);

  // Tab Analytics state
  const [analyticsData, setAnalyticsData] = useState<CourseAnalyticsData | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState<boolean>(false);

  // Auto dismiss feedback toast
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  // Load Course Detail
  useEffect(() => {
    if (!courseId) return;
    setLoading(true);
    fetchCourseDetail(courseId)
      .then((data) => setDetailData(data))
      .catch((err) => setFeedback({ type: 'error', text: err.message }))
      .finally(() => setLoading(false));
  }, [courseId]);

  // Load tab-specific data
  useEffect(() => {
    if (!courseId) return;

    if (activeTab === 'coursework') {
      fetchCourseworkList(courseId)
        .then((items) => {
          setCourseworks(items);
          if (items.length > 0 && !selectedCoursework) {
            handleSelectCoursework(items[0]);
          }
        })
        .catch((err) => setFeedback({ type: 'error', text: err.message }));
    }

    if (activeTab === 'attendance') {
      loadAttendance(selectedDate);
    }

    if (activeTab === 'analytics') {
      setLoadingAnalytics(true);
      fetchCourseAnalytics(courseId)
        .then((data) => setAnalyticsData(data))
        .catch((err) => setFeedback({ type: 'error', text: err.message }))
        .finally(() => setLoadingAnalytics(false));
    }
  }, [courseId, activeTab]);

  // Handler for Selecting a Coursework item
  const handleSelectCoursework = async (cw: CourseworkItem) => {
    if (!courseId) return;
    setSelectedCoursework(cw);
    setLoadingSubs(true);
    try {
      const data = await fetchCourseworkSubmissions(courseId, cw.id);
      setSubmissionsData(data);
      // Pre-fill gradingScores with existing scores
      const initialScores: Record<string, number> = {};
      data.submissions.forEach((s) => {
        if (s.assigned_grade !== null && s.submission_id) {
          initialScores[s.submission_id] = s.assigned_grade;
        }
      });
      setGradingScores(initialScores);
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setLoadingSubs(false);
    }
  };

  // Handler for Opening Coursework Details Drawer
  const handleOpenDrawer = async (cw: CourseworkItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsDrawerOpen(true);
    setDrawerData(cw as any); // Render ngay thông tin cơ bản có sẵn
    if (!courseId) return;

    setLoadingDrawer(true);
    try {
      const detail = await fetchCourseworkDetail(courseId, cw.id);
      setDrawerData(detail);
    } catch (err: any) {
      console.warn('Lỗi khi tải chi tiết bài giảng:', err.message);
    } finally {
      setLoadingDrawer(false);
    }
  };

  // Handler for Submitting a Grade
  const handleGradeSubmit = async (submissionId: string) => {
    if (!courseId || !selectedCoursework) return;
    const grade = gradingScores[submissionId];
    if (grade === undefined || isNaN(grade)) {
      setFeedback({ type: 'error', text: 'Vui lòng nhập điểm số hợp lệ.' });
      return;
    }
    if (grade < 0 || grade > selectedCoursework.max_points) {
      setFeedback({
        type: 'error',
        text: `Điểm số phải nằm trong khoảng từ 0 đến ${selectedCoursework.max_points}.`,
      });
      return;
    }

    setGradingSubmittingId(submissionId);
    try {
      await submitGrade(courseId, submissionId, grade);
      setFeedback({
        type: 'success',
        text: `Đã cập nhật điểm ${grade}/${selectedCoursework.max_points} và đồng bộ lên Google Classroom!`,
      });
      // Refresh submissions
      const refreshed = await fetchCourseworkSubmissions(courseId, selectedCoursework.id);
      setSubmissionsData(refreshed);
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setGradingSubmittingId(null);
    }
  };

  // Handler for Loading Attendance by Date
  const loadAttendance = async (dateStr: string) => {
    if (!courseId) return;
    setLoadingAttendance(true);
    try {
      const res = await fetchAttendanceByDate(courseId, dateStr);
      setAttendanceStudents(res.students);
      setIsAttendanceSubmitted(res.is_submitted);
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setLoadingAttendance(false);
    }
  };

  const handleAttendanceStatusChange = (studentId: string, status: AttendanceStatus) => {
    setAttendanceStudents((prev) =>
      prev.map((s) => (s.student_id === studentId ? { ...s, status } : s))
    );
  };

  const handleAttendanceNoteChange = (studentId: string, note: string) => {
    setAttendanceStudents((prev) =>
      prev.map((s) => (s.student_id === studentId ? { ...s, note } : s))
    );
  };

  const handleMarkAllPresent = () => {
    setAttendanceStudents((prev) => prev.map((s) => ({ ...s, status: 'PRESENT' })));
    setFeedback({ type: 'success', text: 'Đã đánh dấu tất cả có mặt!' });
  };

  const handleSaveAttendance = async () => {
    if (!courseId) return;
    setSavingAttendance(true);
    try {
      const records = attendanceStudents.map((s) => ({
        student_id: s.student_id,
        status: s.status,
        note: s.note,
      }));
      await saveBulkAttendance(courseId, selectedDate, records);
      setIsAttendanceSubmitted(true);
      setFeedback({
        type: 'success',
        text: `Đã lưu điểm danh thành công cho ${records.length} sinh viên ngày ${selectedDate}!`,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setSavingAttendance(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAF8] flex items-center justify-center">
        <div className="flex items-center gap-3 bg-white px-6 py-4 rounded-2xl border border-[#E5ECE7] shadow-sm">
          <div className="w-5 h-5 border-2 border-[#16382B] border-t-transparent rounded-full animate-spin" />
          <span className="text-[#485952] text-sm font-medium">Đang tải không gian lớp học...</span>
        </div>
      </div>
    );
  }

  const course = detailData?.course;

  return (
    <div className="min-h-screen bg-[#F8FAF8] text-[#15241E] flex flex-col font-sans">
      {/* Top Header & Breadcrumbs */}
      <header className="border-b border-[#E5ECE7] bg-white/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[#61746B] hover:text-[#16382B] hover:bg-[#EAF2EC] transition-colors text-sm font-medium cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Quay lại Dashboard</span>
            </button>
            <div className="h-4 w-px bg-[#E5ECE7]" />
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-[#15241E] line-clamp-1">
                {course?.name}
              </span>
              <a
                href={`https://classroom.google.com/c/${course?.google_course_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 rounded-md text-[#61746B] hover:text-[#16382B] hover:bg-[#EAF2EC] transition-colors"
                title="Mở trên Google Classroom"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center bg-[#F4F8F5] p-1 rounded-2xl border border-[#D6E6DC] text-xs overflow-x-auto">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-semibold transition-all shrink-0 cursor-pointer ${
                activeTab === 'overview' 
                  ? 'bg-[#16382B] text-white shadow-sm' 
                  : 'text-[#61746B] hover:text-[#16382B] hover:bg-white/60'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Tổng quan</span>
            </button>
            <button
              onClick={() => setActiveTab('coursework')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-semibold transition-all shrink-0 cursor-pointer ${
                activeTab === 'coursework' 
                  ? 'bg-[#16382B] text-white shadow-sm' 
                  : 'text-[#61746B] hover:text-[#16382B] hover:bg-white/60'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Bài tập & Chấm điểm</span>
            </button>
            <button
              onClick={() => setActiveTab('attendance')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-semibold transition-all shrink-0 cursor-pointer ${
                activeTab === 'attendance' 
                  ? 'bg-[#16382B] text-white shadow-sm' 
                  : 'text-[#61746B] hover:text-[#16382B] hover:bg-white/60'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Chuyên cần</span>
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-semibold transition-all shrink-0 cursor-pointer ${
                activeTab === 'analytics' 
                  ? 'bg-[#16382B] text-white shadow-sm' 
                  : 'text-[#61746B] hover:text-[#16382B] hover:bg-white/60'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Thống kê & GPA</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full space-y-6">
        {/* Toast Feedback */}
        {feedback && (
          <div
            className={`p-4 rounded-2xl flex items-center gap-3 border shadow-sm transition-all animate-in fade-in slide-in-from-top-2 ${
              feedback.type === 'success'
                ? 'bg-[#EAF2EC] border-[#B7D1C2] text-[#16382B]'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            <span className="text-sm font-medium">{feedback.text}</span>
          </div>
        )}

        {/* =========================================================================
            TAB 1: TỔNG QUAN & THÀNH VIÊN
           ========================================================================= */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Banner Lớp học */}
            <div className="relative overflow-hidden rounded-3xl bg-[#EAF2EC] border border-[#D6E6DC] p-6 sm:p-8 shadow-sm">
              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/80 border border-[#D6E6DC] text-[#16382B] text-xs font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#2D6A4F]" />
                    Đồng bộ 2 chiều đang hoạt động
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-[#15241E] tracking-tight">{course?.name}</h1>
                  <p className="text-[#485952] text-sm max-w-xl leading-relaxed">
                    Phân đoạn: <span className="text-[#15241E] font-medium">{course?.section || 'Mặc định'}</span> | 
                    Phòng học: <span className="text-[#15241E] font-medium">{course?.room || 'Trực tuyến'}</span> | 
                    Google ID: <span className="font-mono text-[#16382B] font-semibold">{course?.google_course_id}</span>
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="p-4 rounded-2xl bg-white border border-[#D6E6DC] text-center min-w-[120px] shadow-sm">
                    <div className="text-xs text-[#61746B] font-semibold uppercase tracking-wider">Học sinh</div>
                    <div className="mt-1 text-2xl font-bold text-[#16382B]">{detailData?.total_students}</div>
                  </div>
                  <div className="p-4 rounded-2xl bg-white border border-[#D6E6DC] text-center min-w-[120px] shadow-sm">
                    <div className="text-xs text-[#61746B] font-semibold uppercase tracking-wider">Giảng viên</div>
                    <div className="mt-1 text-2xl font-bold text-[#7A5816]">{detailData?.total_teachers}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bố cục 2 Cột: Bảng tin thông báo & Meet (Trái) + Thành viên lớp học (Phải) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              {/* Cột Trái: Bảng tin thông báo & Cuộc họp Google Meet */}
              <div className="lg:col-span-2">
                <AnnouncementStream
                  courseId={courseId || ''}
                  isTeacher={!!isTeacher}
                  currentUser={currentUser}
                />
              </div>

              {/* Cột Phải: Thông tin Giảng viên & Sinh viên */}
              <div className="lg:col-span-1 space-y-5">
                {/* Giảng viên */}
                <div className="p-5 rounded-3xl bg-white border border-[#E5ECE7] shadow-sm space-y-3.5">
                  <div className="flex items-center gap-2 text-[#15241E] font-bold text-sm">
                    <GraduationCap className="w-4 h-4 text-[#7A5816]" />
                    <span>Giảng viên ({detailData?.teachers.length})</span>
                  </div>
                  <div className="divide-y divide-[#E5ECE7]">
                    {detailData?.teachers.map((t) => (
                      <div key={t.id} className="py-2.5 flex items-center gap-3">
                        <img
                          src={t.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg'}
                          alt={t.full_name}
                          className="w-8 h-8 rounded-full border border-[#cbd8cf] object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold text-[#15241E] truncate">{t.full_name}</div>
                          <div className="text-[11px] text-[#61746B] truncate">{t.email}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sinh viên */}
                <div className="p-5 rounded-3xl bg-white border border-[#E5ECE7] shadow-sm space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[#15241E] font-bold text-sm">
                      <Users className="w-4 h-4 text-[#16382B]" />
                      <span>Sinh viên ({detailData?.students.length})</span>
                    </div>
                  </div>

                  {detailData?.students.length === 0 ? (
                    <p className="text-xs text-[#7B8B84] py-3 text-center">Chưa có sinh viên nào trong lớp.</p>
                  ) : (
                    <div className="divide-y divide-[#E5ECE7] max-h-80 overflow-y-auto pr-1 space-y-1">
                      {detailData?.students.map((s, idx) => (
                        <div key={s.id} className="py-2.5 flex items-center justify-between gap-2.5">
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <span className="text-[11px] font-mono text-[#7B8B84] w-4 shrink-0">
                              {String(idx + 1).padStart(2, '0')}
                            </span>
                            <img
                              src={s.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg'}
                              alt={s.full_name}
                              className="w-7 h-7 rounded-full border border-[#cbd8cf] object-cover shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-semibold text-[#15241E] truncate">{s.full_name}</div>
                              <div className="text-[10px] text-[#61746B] truncate">{s.email}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 2: BÀI TẬP & CHẤM ĐIỂM 2 CHIỀU
           ========================================================================= */}
        {activeTab === 'coursework' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Cột trái: Danh sách bài tập */}
            <div className="lg:col-span-1 space-y-3">
              <div className="flex items-center justify-between pb-1">
                <h3 className="font-bold text-xs text-[#61746B] uppercase tracking-wider">
                  Danh sách bài tập ({courseworks.length})
                </h3>
              </div>

              {courseworks.length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-white border border-[#E5ECE7] text-xs text-[#61746B] shadow-sm">
                  Chưa có bài tập nào được đồng bộ từ Google Classroom.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {courseworks.map((cw) => {
                    const isSelected = selectedCoursework?.id === cw.id;
                    return (
                      <div
                        key={cw.id}
                        onClick={() => handleSelectCoursework(cw)}
                        className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-[#EAF2EC] border-[#16382B] shadow-sm ring-1 ring-[#16382B]/20'
                            : 'bg-white border-[#E5ECE7] hover:border-[#16382B]/30 hover:shadow-sm'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <h4 className="text-sm font-bold text-[#15241E] line-clamp-1">{cw.title}</h4>
                          <span className="text-[11px] font-bold text-[#7A5816] shrink-0">
                            {cw.max_points} đ
                          </span>
                        </div>
                        <p className="text-xs text-[#61746B] line-clamp-2 mb-2 leading-relaxed">
                          {cw.description || 'Không có hướng dẫn chi tiết.'}
                        </p>
                        
                        {/* Huy hiệu tài liệu đính kèm & Nút mở Drawer xem nhanh */}
                        <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#E5ECE7]/60">
                          {cw.materials && cw.materials.length > 0 ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#16382B] bg-[#EAF2EC] px-2 py-0.5 rounded-md border border-[#D6E6DC]">
                              <FileText className="w-3 h-3 text-[#16382B]" />
                              {cw.materials.length} tài liệu
                            </span>
                          ) : (
                            <span className="text-[10px] text-[#A0AFA6] italic">
                              Không có tệp đính kèm
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={(e) => handleOpenDrawer(cw, e)}
                            className="text-[11px] font-semibold text-[#16382B] hover:text-[#0f271e] hover:underline flex items-center gap-1 px-1.5 py-0.5 rounded"
                          >
                            Xem bài giảng
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-[#7B8B84] pt-1">
                          <span>
                            Đã nộp: <strong className="text-[#15241E]">{cw.turned_in_count}</strong>/{cw.total_students}
                          </span>
                          <span>
                            Đã chấm: <strong className="text-[#16382B]">{cw.graded_count}</strong>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Cột phải: Bảng chấm điểm bài nộp (Giảng viên) HOẶC Thẻ kết quả cá nhân (Học sinh) */}
            <div className="lg:col-span-2 space-y-4">
              {selectedCoursework ? (
                <div className="p-6 rounded-3xl bg-white border border-[#E5ECE7] shadow-sm space-y-5">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-[#16382B] font-semibold uppercase tracking-wider mb-1">
                      <Sparkles className="w-3.5 h-3.5" />
                      {isTeacher ? 'Chấm điểm & Đồng bộ 2 chiều' : 'Kết quả bài tập cá nhân'}
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <h2 className="text-xl font-bold text-[#15241E]">{selectedCoursework.title}</h2>
                      
                      {/* Nút Xem chi tiết nội dung & tài liệu đính kèm */}
                      <button
                        type="button"
                        onClick={() => handleOpenDrawer(selectedCoursework)}
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#EAF2EC] text-[#16382B] text-xs font-bold hover:bg-[#d8e7dc] transition-all border border-[#cbd8cf] shadow-2xs hover:shadow-sm shrink-0 cursor-pointer"
                      >
                        <BookOpen className="w-4 h-4 text-[#16382B]" />
                        <span>Xem tài liệu & bài giảng</span>
                        {selectedCoursework.materials && selectedCoursework.materials.length > 0 && (
                          <span className="w-5 h-5 rounded-full bg-[#16382B] text-white text-[10px] flex items-center justify-center font-bold">
                            {selectedCoursework.materials.length}
                          </span>
                        )}
                      </button>
                    </div>

                    <p className="text-xs text-[#61746B] mt-2 leading-relaxed">
                      Điểm tối đa: <strong className="text-[#7A5816]">{selectedCoursework.max_points} điểm</strong>. 
                      {isTeacher 
                        ? ' Khi nhập điểm và bấm "Trả điểm", điểm sẽ tự động đồng bộ lên Google Classroom của học sinh.'
                        : ' Kết quả bài nộp và đánh giá từ giảng viên.'}
                    </p>
                  </div>

                  {loadingSubs ? (
                    <div className="p-12 text-center text-[#61746B] flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-[#16382B] border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs">Đang tải thông tin bài nộp...</span>
                    </div>
                  ) : isTeacher ? (
                    /* Giao diện dành riêng cho Giảng viên: Bảng chấm điểm toàn bộ lớp */
                    <div className="overflow-x-auto rounded-2xl border border-[#E5ECE7]">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#F8FAF8] text-[#61746B] uppercase text-[11px] font-semibold border-b border-[#E5ECE7]">
                          <tr>
                            <th className="py-3 px-4">Sinh viên</th>
                            <th className="py-3 px-3 text-center">Trạng thái</th>
                            <th className="py-3 px-3 text-center">Điểm số</th>
                            <th className="py-3 px-4 text-center">Hành động</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E5ECE7] text-[#15241E]">
                          {submissionsData?.submissions.map((sub) => {
                            const subId = sub.submission_id || '';
                            const isSubmitting = gradingSubmittingId === subId;

                            return (
                              <tr key={sub.student_id} className="hover:bg-[#F8FAF8] transition-colors">
                                <td className="py-3.5 px-4">
                                  <div className="flex items-center gap-3">
                                    <img
                                      src={sub.student_avatar || 'https://api.dicebear.com/7.x/avataaars/svg'}
                                      alt={sub.student_name}
                                      className="w-8 h-8 rounded-full border border-[#cbd8cf] object-cover"
                                    />
                                    <div>
                                      <div className="font-semibold text-[#15241E]">{sub.student_name}</div>
                                      <div className="text-[11px] text-[#61746B]">{sub.student_email}</div>
                                    </div>
                                  </div>
                                </td>

                                <td className="py-3.5 px-3 text-center">
                                  <span
                                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                                      sub.state === 'TURNED_IN'
                                        ? 'bg-[#EAF2EC] text-[#16382B] border border-[#D6E6DC]'
                                        : sub.state === 'RETURNED'
                                        ? 'bg-[#F4E8C1] text-[#7A5816] border border-[#E6D49F]'
                                        : 'bg-[#F4F8F5] text-[#7B8B84] border border-[#E5ECE7]'
                                    }`}
                                  >
                                    {sub.state === 'TURNED_IN'
                                      ? 'Đã nộp bài'
                                      : sub.state === 'RETURNED'
                                      ? 'Đã chấm điểm'
                                      : 'Chưa nộp'}
                                  </span>
                                </td>

                                <td className="py-3.5 px-3 text-center">
                                  <div className="inline-flex items-center gap-1.5">
                                    <input
                                      type="number"
                                      min={0}
                                      max={selectedCoursework.max_points}
                                      value={subId in gradingScores ? gradingScores[subId] : ''}
                                      onChange={(e) =>
                                        setGradingScores((prev) => ({
                                          ...prev,
                                          [subId]: Number(e.target.value),
                                        }))
                                      }
                                      placeholder="-"
                                      disabled={!sub.submission_id}
                                      className="w-16 px-2 py-1 text-center bg-white border border-[#D6E6DC] rounded-xl text-[#15241E] font-bold focus:outline-none focus:border-[#16382B] disabled:opacity-40"
                                    />
                                    <span className="text-[#7B8B84] text-[11px]">
                                      /{selectedCoursework.max_points}
                                    </span>
                                  </div>
                                </td>

                                <td className="py-3.5 px-4 text-center">
                                  <button
                                    onClick={() => handleGradeSubmit(subId)}
                                    disabled={!sub.submission_id || isSubmitting}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#16382B] hover:bg-[#1f4a3a] text-white font-semibold text-xs transition-colors shadow-sm disabled:opacity-40 cursor-pointer"
                                    title="Lưu điểm và đẩy lên Google Classroom"
                                  >
                                    <Send className={`w-3 h-3 ${isSubmitting ? 'animate-spin' : ''}`} />
                                    <span>{isSubmitting ? 'Đang gửi...' : 'Trả điểm'}</span>
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    /* Giao diện dành riêng cho Học sinh: Thẻ kết quả bài nộp cá nhân */
                    (() => {
                      const mySub =
                        submissionsData?.submissions?.find(
                          (s) => s.student_id === currentUser?.id || s.student_email === currentUser?.email
                        ) || submissionsData?.submissions?.[0];

                      return (
                        <div className="p-6 rounded-2xl bg-[#F8FAF8] border border-[#D6E6DC] space-y-5">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-white border border-[#E5ECE7] shadow-xs">
                            <div className="flex items-center gap-3.5">
                              <img
                                src={currentUser?.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg'}
                                alt="Học sinh"
                                className="w-12 h-12 rounded-full border border-[#cbd8cf] object-cover"
                              />
                              <div>
                                <div className="text-sm font-bold text-[#15241E]">
                                  {currentUser?.full_name || 'Học sinh'}
                                </div>
                                <div className="text-xs text-[#61746B]">{currentUser?.email}</div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <span
                                className={`px-3 py-1 rounded-full text-xs font-bold ${
                                  mySub?.state === 'RETURNED'
                                    ? 'bg-[#EAF2EC] text-[#16382B] border border-[#D6E6DC]'
                                    : mySub?.state === 'TURNED_IN'
                                    ? 'bg-[#E0EFF5] text-[#20556B] border border-[#C5DFE9]'
                                    : 'bg-[#FDE8E8] text-[#9B2C2C] border border-[#F8B4B4]'
                                }`}
                              >
                                {mySub?.state === 'RETURNED'
                                  ? 'Đã chấm điểm'
                                  : mySub?.state === 'TURNED_IN'
                                  ? 'Đã nộp bài'
                                  : 'Chưa nộp bài'}
                              </span>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="p-4 rounded-xl bg-white border border-[#E5ECE7]">
                              <span className="text-xs text-[#61746B] font-semibold uppercase tracking-wider">
                                Điểm số của bạn
                              </span>
                              <div className="mt-2 flex items-baseline gap-1.5">
                                {mySub?.assigned_grade !== null && mySub?.assigned_grade !== undefined ? (
                                  <>
                                    <span className="text-3xl font-extrabold text-[#16382B]">
                                      {mySub.assigned_grade}
                                    </span>
                                    <span className="text-sm text-[#7B8B84] font-medium">
                                      /{selectedCoursework.max_points} điểm
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-base font-bold text-[#7A5816]">
                                    Giảng viên chưa chấm điểm
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="p-4 rounded-xl bg-white border border-[#E5ECE7]">
                              <span className="text-xs text-[#61746B] font-semibold uppercase tracking-wider">
                                Trạng thái đồng bộ
                              </span>
                              <div className="mt-2 text-xs font-semibold text-[#15241E]">
                                {mySub?.sync_status === 'SYNCED' ? (
                                  <span className="text-[#16382B] flex items-center gap-1.5">
                                    <CheckCircle2 className="w-4 h-4 text-[#16382B]" />
                                    Đã kết nối với Google Classroom
                                  </span>
                                ) : (
                                  <span className="text-[#7B8B84]">Lưu trữ cục bộ</span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="p-4 rounded-xl bg-[#EAF2EC]/60 border border-[#D6E6DC] text-xs text-[#16382B] leading-relaxed">
                            💡 <strong>Lưu ý dành cho học sinh:</strong> Học sinh thực hiện nộp bài tập trực tiếp trên hệ thống Google Classroom của lớp. Điểm số và nhận xét từ giảng viên sẽ được cập nhật tự động tại đây.
                          </div>
                        </div>
                      );
                    })()
                  )}
                </div>
              ) : (
                <div className="p-12 text-center rounded-3xl bg-white border border-[#E5ECE7] text-[#61746B] text-sm shadow-sm">
                  Hãy chọn một bài tập ở danh sách bên trái để xem kết quả.
                </div>
              )}
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 3: CHUYÊN CẦN (ĐIỂM DANH THEO NGÀY)
           ========================================================================= */}
        {activeTab === 'attendance' && (
          <div className="space-y-4">
            {/* Toolbar chọn ngày & Lưu */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-5 rounded-3xl bg-white border border-[#E5ECE7] shadow-sm">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#F8FAF8] border border-[#D6E6DC] text-sm">
                  <Calendar className="w-4 h-4 text-[#16382B] shrink-0" />
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => {
                      setSelectedDate(e.target.value);
                      loadAttendance(e.target.value);
                    }}
                    className="bg-transparent text-[#15241E] font-medium focus:outline-none cursor-pointer"
                  />
                </div>
                <button
                  onClick={() => {
                    const today = new Date().toISOString().split('T')[0];
                    setSelectedDate(today);
                    loadAttendance(today);
                  }}
                  className="px-3 py-2 rounded-xl bg-[#EAF2EC] hover:bg-[#d8e7df] text-xs text-[#16382B] font-semibold transition-colors cursor-pointer"
                >
                  Hôm nay
                </button>
              </div>

              <div className="flex items-center gap-3 justify-end">
                {isTeacher ? (
                  <>
                    <span
                      className={`text-xs px-3 py-1 rounded-full font-semibold ${
                        isAttendanceSubmitted
                          ? 'bg-[#EAF2EC] text-[#16382B] border border-[#D6E6DC]'
                          : 'bg-[#F4E8C1] text-[#7A5816] border border-[#E6D49F]'
                      }`}
                    >
                      {isAttendanceSubmitted ? 'Đã lưu điểm danh' : 'Chưa lưu điểm danh'}
                    </span>

                    <button
                      onClick={handleMarkAllPresent}
                      disabled={attendanceStudents.length === 0}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#F4F8F5] hover:bg-[#EAF2EC] text-xs font-semibold text-[#16382B] border border-[#D6E6DC] transition-colors cursor-pointer"
                    >
                      <CheckCheck className="w-3.5 h-3.5 text-[#2D6A4F]" />
                      <span>Tất cả có mặt</span>
                    </button>

                    <button
                      onClick={handleSaveAttendance}
                      disabled={savingAttendance || attendanceStudents.length === 0}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#16382B] hover:bg-[#1f4a3a] text-white font-semibold text-xs shadow-md shadow-[#16382B]/20 disabled:opacity-50 transition-all cursor-pointer"
                    >
                      <Save className={`w-3.5 h-3.5 ${savingAttendance ? 'animate-spin' : ''}`} />
                      <span>{savingAttendance ? 'Đang lưu...' : 'Lưu điểm danh'}</span>
                    </button>
                  </>
                ) : (
                  <span className="text-xs px-3 py-1.5 rounded-full font-semibold bg-[#EAF2EC] text-[#16382B] border border-[#D6E6DC] flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-[#16382B]" />
                    Chế độ xem lịch sử chuyên cần cá nhân (Chỉ đọc)
                  </span>
                )}
              </div>
            </div>

            {/* Danh sách học sinh điểm danh */}
            {loadingAttendance ? (
              <div className="p-12 text-center text-[#61746B] flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-[#16382B] border-t-transparent rounded-full animate-spin" />
                <span className="text-xs">Đang tải danh sách điểm danh...</span>
              </div>
            ) : attendanceStudents.length === 0 ? (
              <div className="p-10 text-center rounded-3xl bg-white border border-[#E5ECE7] text-xs text-[#61746B] shadow-sm">
                {isTeacher
                  ? 'Chưa có học sinh nào trong lớp để điểm danh.'
                  : 'Không có dữ liệu điểm danh của bạn vào ngày này.'}
              </div>
            ) : (
              <div className="space-y-3">
                {attendanceStudents.map((st, idx) => (
                  <div
                    key={st.student_id}
                    className="p-4 rounded-2xl bg-white border border-[#E5ECE7] shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3 min-w-[220px]">
                      <span className="text-xs font-mono text-[#7B8B84]">{String(idx + 1).padStart(2, '0')}</span>
                      <img
                        src={st.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg'}
                        alt={st.full_name}
                        className="w-9 h-9 rounded-full border border-[#cbd8cf] object-cover"
                      />
                      <div>
                        <div className="text-sm font-semibold text-[#15241E]">{st.full_name}</div>
                        <div className="text-xs text-[#61746B]">{st.email}</div>
                      </div>
                    </div>

                    {/* Trạng thái điểm danh: Có thể chọn nếu là Giảng viên, Chỉ đọc nếu là Học sinh */}
                    {isTeacher ? (
                      <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
                        <button
                          onClick={() => handleAttendanceStatusChange(st.student_id, 'PRESENT')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                            st.status === 'PRESENT'
                              ? 'bg-[#16382B] text-white shadow-sm'
                              : 'bg-[#EAF2EC] text-[#16382B] border border-[#D6E6DC]'
                          }`}
                        >
                          Có mặt
                        </button>
                        <button
                          onClick={() => handleAttendanceStatusChange(st.student_id, 'LATE')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                            st.status === 'LATE'
                              ? 'bg-[#D4A373] text-white shadow-sm'
                              : 'bg-[#F4E8C1] text-[#7A5816] border border-[#E6D49F]'
                          }`}
                        >
                          Đi muộn
                        </button>
                        <button
                          onClick={() => handleAttendanceStatusChange(st.student_id, 'ABSENT_EXCUSED')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                            st.status === 'ABSENT_EXCUSED'
                              ? 'bg-[#407B91] text-white shadow-sm'
                              : 'bg-[#E0EFF5] text-[#20556B] border border-[#C5DFE9]'
                          }`}
                        >
                          Có phép
                        </button>
                        <button
                          onClick={() => handleAttendanceStatusChange(st.student_id, 'ABSENT_UNEXCUSED')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                            st.status === 'ABSENT_UNEXCUSED'
                              ? 'bg-[#C84B4B] text-white shadow-sm'
                              : 'bg-[#FDE8E8] text-[#9B2C2C] border border-[#F8B4B4]'
                          }`}
                        >
                          Vắng
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[#61746B] font-semibold">Trạng thái:</span>
                        <span
                          className={`px-3.5 py-1 rounded-full text-xs font-bold ${
                            st.status === 'PRESENT'
                              ? 'bg-[#EAF2EC] text-[#16382B] border border-[#D6E6DC]'
                              : st.status === 'LATE'
                              ? 'bg-[#F4E8C1] text-[#7A5816] border border-[#E6D49F]'
                              : st.status === 'ABSENT_EXCUSED'
                              ? 'bg-[#E0EFF5] text-[#20556B] border border-[#C5DFE9]'
                              : 'bg-[#FDE8E8] text-[#9B2C2C] border border-[#F8B4B4]'
                          }`}
                        >
                          {st.status === 'PRESENT'
                            ? 'Có mặt'
                            : st.status === 'LATE'
                            ? 'Đi muộn'
                            : st.status === 'ABSENT_EXCUSED'
                            ? 'Nghỉ có phép'
                            : 'Vắng không phép'}
                        </span>
                      </div>
                    )}

                    {/* Ghi chú */}
                    {isTeacher ? (
                      <input
                        type="text"
                        placeholder="Ghi chú lý do..."
                        value={st.note}
                        onChange={(e) => handleAttendanceNoteChange(st.student_id, e.target.value)}
                        className="lg:w-64 px-3 py-1.5 rounded-xl bg-[#F8FAF8] border border-[#D6E6DC] text-xs text-[#15241E] placeholder-[#7B8B84] focus:outline-none focus:border-[#16382B]"
                      />
                    ) : (
                      st.note && (
                        <div className="text-xs text-[#61746B] bg-[#F8FAF8] px-3 py-1.5 rounded-xl border border-[#E5ECE7] lg:max-w-xs truncate">
                          Ghi chú: {st.note}
                        </div>
                      )
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            TAB 4: THỐNG KÊ TOÀN DIỆN & CẢNH BÁO
           ========================================================================= */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            {loadingAnalytics ? (
              <div className="p-12 text-center text-[#61746B] flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-[#16382B] border-t-transparent rounded-full animate-spin" />
                <span className="text-xs">Đang tổng hợp báo cáo học tập...</span>
              </div>
            ) : analyticsData ? (
              isTeacher ? (
                /* Giao diện dành riêng cho Giảng viên: Toàn cảnh lớp học */
                <>
                  {/* Metrics Cards Toàn Lớp */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div className="p-5 rounded-3xl bg-white border border-[#E5ECE7] shadow-sm">
                      <span className="text-xs text-[#61746B] uppercase font-semibold tracking-wider">Điểm GPA Lớp</span>
                      <div className="mt-2 text-3xl font-extrabold text-[#16382B]">
                        {analyticsData.class_gpa || '--'}{' '}
                        <span className="text-sm text-[#7B8B84] font-normal">/100</span>
                      </div>
                    </div>
                    <div className="p-5 rounded-3xl bg-white border border-[#E5ECE7] shadow-sm">
                      <span className="text-xs text-[#61746B] uppercase font-semibold tracking-wider">Tổng sinh viên</span>
                      <div className="mt-2 text-3xl font-extrabold text-[#15241E]">
                        {analyticsData.total_students}
                      </div>
                    </div>
                    <div className="p-5 rounded-3xl bg-white border border-[#E5ECE7] shadow-sm">
                      <span className="text-xs text-[#61746B] uppercase font-semibold tracking-wider">Tổng bài tập</span>
                      <div className="mt-2 text-3xl font-extrabold text-[#7A5816]">
                        {analyticsData.total_assignments}
                      </div>
                    </div>
                    <div className="p-5 rounded-3xl bg-white border border-[#E5ECE7] shadow-sm">
                      <span className="text-xs text-[#61746B] uppercase font-semibold tracking-wider">Cảnh báo rủi ro</span>
                      <div className="mt-2 text-3xl font-extrabold text-[#C84B4B] flex items-center gap-2">
                        <ShieldAlert className="w-6 h-6 text-[#C84B4B]" />
                        <span>{analyticsData.at_risk_count} em</span>
                      </div>
                    </div>
                  </div>

                  {/* Bảng phân tích chi tiết từng sinh viên */}
                  <div className="overflow-x-auto rounded-3xl border border-[#E5ECE7] bg-white shadow-sm">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#F8FAF8] text-[#61746B] uppercase text-[11px] font-semibold border-b border-[#E5ECE7]">
                        <tr>
                          <th className="py-3 px-4">Sinh viên</th>
                          <th className="py-3 px-3 text-center">Điểm TB (GPA)</th>
                          <th className="py-3 px-3 text-center">Tiến độ bài tập</th>
                          <th className="py-3 px-3 text-center">Tỷ lệ vắng</th>
                          <th className="py-3 px-4 text-center">Cảnh báo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E5ECE7] text-[#15241E]">
                        {analyticsData.students.map((row) => (
                          <tr
                            key={row.student.id}
                            className={`hover:bg-[#F8FAF8] transition-colors ${
                              row.is_warning ? 'bg-rose-50/50' : ''
                            }`}
                          >
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-3">
                                <img
                                  src={row.student.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg'}
                                  alt={row.student.full_name}
                                  className="w-8 h-8 rounded-full border border-[#cbd8cf] object-cover"
                                />
                                <div>
                                  <div className="font-semibold text-[#15241E]">{row.student.full_name}</div>
                                  <div className="text-[11px] text-[#61746B]">{row.student.email}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 px-3 text-center font-bold text-[#16382B]">
                              {row.avg_grade !== null ? `${row.avg_grade} đ` : 'Chưa chấm'}
                            </td>
                            <td className="py-3.5 px-3 text-center font-medium">
                              {row.turned_in_count}/{row.total_assignments} bài
                            </td>
                            <td className="py-3.5 px-3 text-center font-semibold">
                              <span className={row.absence_rate >= 20 ? 'text-[#C84B4B]' : 'text-[#485952]'}>
                                {row.absence_rate}% ({row.unexcused_absences} buổi không phép)
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              {row.is_warning ? (
                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#FDE8E8] text-[#9B2C2C] border border-[#F8B4B4] text-[11px] font-bold">
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  <span>{row.warning_reasons.join(', ') || 'Cảnh báo học vụ'}</span>
                                </div>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#EAF2EC] text-[#16382B] border border-[#D6E6DC] text-[11px] font-semibold">
                                  Bình thường
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                /* Giao diện dành riêng cho Học sinh: Bảng điều khiển Học tập Cá nhân */
                (() => {
                  const myStudent =
                    analyticsData.students.find(
                      (s) => s.student.id === currentUser?.id || s.student.email === currentUser?.email
                    ) || analyticsData.students[0];

                  return (
                    <div className="space-y-6">
                      {/* Banner chào mừng học sinh */}
                      <div className="p-6 rounded-3xl bg-gradient-to-r from-[#16382B] to-[#2D6A4F] text-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <h3 className="text-lg font-bold">Bảng điều khiển Học tập Cá nhân</h3>
                          <p className="text-xs text-white/80">
                            Theo dõi tổng quan điểm số trung bình, tiến độ nộp bài và tình trạng chuyên cần của bạn.
                          </p>
                        </div>
                        <div className="px-4 py-2 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/20 text-xs font-semibold self-start sm:self-auto">
                          Học sinh: {currentUser?.full_name || myStudent?.student.full_name}
                        </div>
                      </div>

                      {/* 4 Chỉ số cá nhân */}
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                        <div className="p-5 rounded-3xl bg-white border border-[#E5ECE7] shadow-sm">
                          <span className="text-xs text-[#61746B] uppercase font-semibold tracking-wider">
                            Điểm GPA của bạn
                          </span>
                          <div className="mt-2 text-3xl font-extrabold text-[#16382B]">
                            {myStudent?.avg_grade !== null && myStudent?.avg_grade !== undefined
                              ? `${myStudent.avg_grade}`
                              : '--'}
                            <span className="text-sm text-[#7B8B84] font-normal"> /100</span>
                          </div>
                        </div>

                        <div className="p-5 rounded-3xl bg-white border border-[#E5ECE7] shadow-sm">
                          <span className="text-xs text-[#61746B] uppercase font-semibold tracking-wider">
                            Tiến độ bài tập
                          </span>
                          <div className="mt-2 text-3xl font-extrabold text-[#7A5816]">
                            {myStudent?.turned_in_count || 0}
                            <span className="text-sm text-[#7B8B84] font-normal">
                              /{analyticsData.total_assignments} bài
                            </span>
                          </div>
                        </div>

                        <div className="p-5 rounded-3xl bg-white border border-[#E5ECE7] shadow-sm">
                          <span className="text-xs text-[#61746B] uppercase font-semibold tracking-wider">
                            Tỷ lệ vắng mặt
                          </span>
                          <div
                            className={`mt-2 text-3xl font-extrabold ${
                              (myStudent?.absence_rate || 0) >= 20 ? 'text-[#C84B4B]' : 'text-[#15241E]'
                            }`}
                          >
                            {myStudent?.absence_rate || 0}%
                          </div>
                          <span className="text-[11px] text-[#7B8B84] mt-1 block">
                            {myStudent?.unexcused_absences || 0} buổi không phép
                          </span>
                        </div>

                        <div className="p-5 rounded-3xl bg-white border border-[#E5ECE7] shadow-sm">
                          <span className="text-xs text-[#61746B] uppercase font-semibold tracking-wider">
                            Trạng thái học vụ
                          </span>
                          <div className="mt-2">
                            {myStudent?.is_warning ? (
                              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FDE8E8] text-[#9B2C2C] border border-[#F8B4B4] text-xs font-bold">
                                <AlertTriangle className="w-4 h-4" />
                                <span>Cảnh báo rủi ro</span>
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EAF2EC] text-[#16382B] border border-[#D6E6DC] text-xs font-bold">
                                <CheckCircle2 className="w-4 h-4" />
                                <span>Tiến độ học tốt</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Hộp tư vấn và cảnh báo học sinh */}
                      {myStudent?.is_warning ? (
                        <div className="p-5 rounded-3xl bg-[#FDE8E8]/70 border border-[#F8B4B4] text-[#9B2C2C] space-y-2">
                          <div className="flex items-center gap-2 font-bold text-sm">
                            <AlertTriangle className="w-5 h-5 text-[#C84B4B]" />
                            <span>Cảnh báo học vụ quan trọng</span>
                          </div>
                          <p className="text-xs leading-relaxed">
                            {myStudent.warning_reasons.join('. ') || 'Bạn có nguy cơ bị cấm thi hoặc điểm học phần thấp.'}{' '}
                            Vui lòng liên hệ giảng viên phụ trách môn học sớm nhất có thể để được hỗ trợ.
                          </p>
                        </div>
                      ) : (
                        <div className="p-5 rounded-3xl bg-[#EAF2EC]/60 border border-[#D6E6DC] text-[#16382B] space-y-2">
                          <div className="flex items-center gap-2 font-bold text-sm">
                            <CheckCircle2 className="w-5 h-5 text-[#16382B]" />
                            <span>Bạn đang duy trì phong độ học tập rất tốt!</span>
                          </div>
                          <p className="text-xs text-[#485952] leading-relaxed">
                            Hãy tiếp tục hoàn thành các bài tập đúng hạn và tham dự đầy đủ các buổi học để đạt kết quả xuất sắc trong học phần này.
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })()
              )
            ) : null}
          </div>
        )}
      </main>

      {/* Coursework Details Drawer (Slide-over) */}
      <CourseWorkDetailDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        coursework={drawerData}
        isLoading={loadingDrawer}
      />
    </div>
  );
}
