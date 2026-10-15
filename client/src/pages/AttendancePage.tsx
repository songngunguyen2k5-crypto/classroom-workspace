import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Calendar, 
  Save, 
  CheckCheck, 
  AlertTriangle, 
  BarChart3, 
  UserCheck, 
  Clock, 
  ShieldAlert,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { 
  fetchAttendanceByDate, 
  saveBulkAttendance, 
  fetchCourseAttendanceStats,
  type StudentAttendanceItem,
  type StudentStatsItem,
  type AttendanceStatus 
} from '../services/attendance.service';

export default function AttendancePage() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();

  // Tab: 'take' (Điểm danh) | 'stats' (Báo cáo thống kê)
  const [activeTab, setActiveTab] = useState<'take' | 'stats'>('take');
  
  // Ngày đang chọn (mặc định hôm nay YYYY-MM-DD)
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  const [courseName, setCourseName] = useState<string>('Lớp học');
  const [students, setStudents] = useState<StudentAttendanceItem[]>([]);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Dữ liệu thống kê
  const [statsData, setStatsData] = useState<{
    total_sessions: number;
    stats: StudentStatsItem[];
  } | null>(null);
  const [loadingStats, setLoadingStats] = useState<boolean>(false);

  // 1. Tải dữ liệu điểm danh theo ngày
  const loadAttendanceForDate = async (date: string) => {
    if (!courseId) return;
    try {
      setLoading(true);
      const data = await fetchAttendanceByDate(courseId, date);
      setCourseName(data.course_name);
      setStudents(data.students);
      setIsSubmitted(data.is_submitted);
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Lỗi khi tải danh sách điểm danh' });
    } finally {
      setLoading(false);
    }
  };

  // 2. Tải dữ liệu thống kê
  const loadStats = async () => {
    if (!courseId) return;
    try {
      setLoadingStats(true);
      const data = await fetchCourseAttendanceStats(courseId);
      setStatsData(data);
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Lỗi khi tải bảng thống kê' });
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    loadAttendanceForDate(selectedDate);
  }, [courseId, selectedDate]);

  useEffect(() => {
    if (activeTab === 'stats') {
      loadStats();
    }
  }, [activeTab]);

  // Tự tắt thông báo sau 4 giây
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  // Cập nhật trạng thái của 1 sinh viên trong bộ nhớ
  const handleStatusChange = (studentId: string, newStatus: AttendanceStatus) => {
    setStudents((prev) =>
      prev.map((s) => (s.student_id === studentId ? { ...s, status: newStatus } : s))
    );
  };

  // Cập nhật ghi chú của 1 sinh viên
  const handleNoteChange = (studentId: string, note: string) => {
    setStudents((prev) =>
      prev.map((s) => (s.student_id === studentId ? { ...s, note } : s))
    );
  };

  // Nhanh: Đánh dấu tất cả có mặt
  const handleMarkAllPresent = () => {
    setStudents((prev) => prev.map((s) => ({ ...s, status: 'PRESENT' })));
    setFeedback({ type: 'success', text: 'Đã đánh dấu tất cả sinh viên Có mặt!' });
  };

  // Lưu điểm danh lên DB
  const handleSaveAttendance = async () => {
    if (!courseId) return;
    try {
      setSaving(true);
      setFeedback(null);

      const records = students.map((s) => ({
        student_id: s.student_id,
        status: s.status,
        note: s.note,
      }));

      await saveBulkAttendance(courseId, selectedDate, records);
      setIsSubmitted(true);
      setFeedback({
        type: 'success',
        text: `Đã lưu điểm danh thành công cho ${records.length} sinh viên ngày ${selectedDate}!`,
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err.message || 'Lỗi khi lưu điểm danh.',
      });
    } finally {
      setSaving(false);
    }
  };

  // Đổi ngày: tiến/lùi 1 ngày
  const changeDateByDays = (deltaDays: number) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + deltaDays);
    setSelectedDate(current.toISOString().split('T')[0]);
  };

  const getStatusButtonClass = (
    currentStatus: AttendanceStatus,
    targetStatus: AttendanceStatus
  ) => {
    const isSelected = currentStatus === targetStatus;
    switch (targetStatus) {
      case 'PRESENT':
        return isSelected
          ? 'bg-[#16382B] text-white font-semibold shadow-sm'
          : 'bg-[#EAF2EC] text-[#16382B] hover:bg-[#d8e7df] border border-[#D6E6DC]';
      case 'LATE':
        return isSelected
          ? 'bg-[#D4A373] text-white font-semibold shadow-sm'
          : 'bg-[#F4E8C1] text-[#7A5816] hover:bg-[#ebd9a7] border border-[#E6D49F]';
      case 'ABSENT_EXCUSED':
        return isSelected
          ? 'bg-[#407B91] text-white font-semibold shadow-sm'
          : 'bg-[#E0EFF5] text-[#20556B] hover:bg-[#cee3ec] border border-[#C5DFE9]';
      case 'ABSENT_UNEXCUSED':
        return isSelected
          ? 'bg-[#C84B4B] text-white font-semibold shadow-sm'
          : 'bg-[#FDE8E8] text-[#9B2C2C] hover:bg-[#fad0d0] border border-[#F8B4B4]';
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAF8] text-[#15241E] flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="border-b border-[#E5ECE7] bg-white/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[#61746B] hover:text-[#16382B] hover:bg-[#EAF2EC] transition-colors text-sm font-medium cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Dashboard</span>
            </button>
            <div className="h-5 w-px bg-[#E5ECE7]" />
            <div>
              <h1 className="font-bold text-base sm:text-lg text-[#15241E] line-clamp-1">
                {courseName}
              </h1>
              <div className="flex items-center gap-2 text-xs text-[#16382B] font-semibold">
                <span>Chuyên cần (Điểm danh nội bộ)</span>
              </div>
            </div>
          </div>

          {/* Tab selector */}
          <div className="flex items-center bg-[#F4F8F5] p-1 rounded-2xl border border-[#D6E6DC] text-xs">
            <button
              onClick={() => setActiveTab('take')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-semibold transition-colors cursor-pointer ${
                activeTab === 'take'
                  ? 'bg-[#16382B] text-white shadow-sm'
                  : 'text-[#61746B] hover:text-[#16382B]'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Điểm danh</span>
            </button>
            <button
              onClick={() => setActiveTab('stats')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-semibold transition-colors cursor-pointer ${
                activeTab === 'stats'
                  ? 'bg-[#16382B] text-white shadow-sm'
                  : 'text-[#61746B] hover:text-[#16382B]'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Thống kê & Cảnh báo</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full space-y-6">
        {/* Toast Feedback */}
        {feedback && (
          <div className={`p-4 rounded-2xl flex items-center gap-3 border shadow-sm transition-all animate-in fade-in slide-in-from-top-2 ${
            feedback.type === 'success'
              ? 'bg-[#EAF2EC] border-[#B7D1C2] text-[#16382B]'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}>
            <span className="text-sm font-medium">{feedback.text}</span>
          </div>
        )}

        {/* =========================================================================
            TAB 1: ĐIỂM DANH THEO NGÀY
           ========================================================================= */}
        {activeTab === 'take' && (
          <>
            {/* Toolbar: Chọn ngày & Nút hành động */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-5 rounded-3xl bg-white border border-[#E5ECE7] shadow-sm">
              {/* Date Controls */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => changeDateByDays(-1)}
                  className="p-2.5 rounded-xl bg-[#F4F8F5] hover:bg-[#EAF2EC] text-[#16382B] border border-[#D6E6DC] transition-colors cursor-pointer"
                  title="Ngày trước"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#F8FAF8] border border-[#D6E6DC] text-sm">
                  <Calendar className="w-4 h-4 text-[#16382B] shrink-0" />
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="bg-transparent text-[#15241E] font-medium focus:outline-none cursor-pointer"
                  />
                </div>

                <button
                  onClick={() => changeDateByDays(1)}
                  className="p-2.5 rounded-xl bg-[#F4F8F5] hover:bg-[#EAF2EC] text-[#16382B] border border-[#D6E6DC] transition-colors cursor-pointer"
                  title="Ngày tiếp theo"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                <button
                  onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
                  className="px-3 py-2 rounded-xl bg-[#EAF2EC] hover:bg-[#d8e7df] text-xs text-[#16382B] font-semibold transition-colors cursor-pointer"
                >
                  Hôm nay
                </button>
              </div>

              {/* Status and Actions */}
              <div className="flex items-center gap-3 justify-end">
                <span className={`text-xs px-3 py-1 rounded-full font-semibold ${
                  isSubmitted
                    ? 'bg-[#EAF2EC] text-[#16382B] border border-[#D6E6DC]'
                    : 'bg-[#F4E8C1] text-[#7A5816] border border-[#E6D49F]'
                }`}>
                  {isSubmitted ? 'Đã lưu điểm danh' : 'Chưa lưu điểm danh'}
                </span>

                <button
                  onClick={handleMarkAllPresent}
                  disabled={students.length === 0}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#F4F8F5] hover:bg-[#EAF2EC] text-xs font-semibold text-[#16382B] border border-[#D6E6DC] transition-all disabled:opacity-50 cursor-pointer"
                  title="Đánh dấu tất cả học sinh là có mặt"
                >
                  <CheckCheck className="w-3.5 h-3.5 text-[#2D6A4F]" />
                  <span>Tất cả có mặt</span>
                </button>

                <button
                  onClick={handleSaveAttendance}
                  disabled={saving || students.length === 0}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#16382B] hover:bg-[#1f4a3a] text-white font-semibold text-xs sm:text-sm shadow-md shadow-[#16382B]/20 transition-all disabled:opacity-50 shrink-0 cursor-pointer"
                >
                  <Save className={`w-4 h-4 ${saving ? 'animate-spin' : ''}`} />
                  <span>{saving ? 'Đang lưu...' : 'Lưu điểm danh'}</span>
                </button>
              </div>
            </div>

            {/* Attendance Student List */}
            {loading ? (
              <div className="p-16 text-center text-[#61746B] flex items-center justify-center gap-3">
                <div className="w-6 h-6 border-2 border-[#16382B] border-t-transparent rounded-full animate-spin" />
                <span className="text-sm">Đang tải danh sách sinh viên...</span>
              </div>
            ) : students.length === 0 ? (
              <div className="p-12 text-center rounded-3xl bg-white border border-[#E5ECE7] space-y-3 shadow-sm">
                <UserCheck className="w-12 h-12 text-[#7B8B84] mx-auto" />
                <h3 className="text-base font-bold text-[#15241E]">Chưa có sinh viên nào trong lớp</h3>
                <p className="text-xs text-[#61746B] max-w-sm mx-auto">
                  Hãy quay lại Dashboard và bấm <strong>"Đồng bộ chi tiết"</strong> để tải danh sách học sinh từ Google Classroom về hệ thống.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {students.map((student, idx) => (
                  <div
                    key={student.student_id}
                    className="p-4 rounded-2xl bg-white border border-[#E5ECE7] hover:border-[#16382B]/30 flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-all shadow-sm"
                  >
                    {/* Student Info */}
                    <div className="flex items-center gap-3 min-w-[240px]">
                      <span className="text-xs font-mono text-[#7B8B84] w-5">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <img
                        src={student.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg'}
                        alt={student.full_name}
                        className="w-10 h-10 rounded-full border border-[#cbd8cf] object-cover shrink-0"
                      />
                      <div>
                        <h4 className="text-sm font-semibold text-[#15241E]">
                          {student.full_name}
                        </h4>
                        <p className="text-xs text-[#61746B]">{student.email}</p>
                      </div>
                    </div>

                    {/* 4 Status Toggle Buttons */}
                    <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
                      <button
                        onClick={() => handleStatusChange(student.student_id, 'PRESENT')}
                        className={`px-3 py-1.5 rounded-xl text-xs cursor-pointer transition-all ${getStatusButtonClass(
                          student.status,
                          'PRESENT'
                        )}`}
                      >
                        Có mặt
                      </button>

                      <button
                        onClick={() => handleStatusChange(student.student_id, 'LATE')}
                        className={`px-3 py-1.5 rounded-xl text-xs cursor-pointer transition-all ${getStatusButtonClass(
                          student.status,
                          'LATE'
                        )}`}
                      >
                        Đi muộn
                      </button>

                      <button
                        onClick={() => handleStatusChange(student.student_id, 'ABSENT_EXCUSED')}
                        className={`px-3 py-1.5 rounded-xl text-xs cursor-pointer transition-all ${getStatusButtonClass(
                          student.status,
                          'ABSENT_EXCUSED'
                        )}`}
                      >
                        Có phép
                      </button>

                      <button
                        onClick={() => handleStatusChange(student.student_id, 'ABSENT_UNEXCUSED')}
                        className={`px-3 py-1.5 rounded-xl text-xs cursor-pointer transition-all ${getStatusButtonClass(
                          student.status,
                          'ABSENT_UNEXCUSED'
                        )}`}
                      >
                        Vắng
                      </button>
                    </div>

                    {/* Note input */}
                    <div className="lg:w-64">
                      <input
                        type="text"
                        placeholder="Ghi chú (lý do nghỉ/muộn)..."
                        value={student.note || ''}
                        onChange={(e) => handleNoteChange(student.student_id, e.target.value)}
                        className="w-full px-3 py-1.5 rounded-xl bg-[#F8FAF8] border border-[#D6E6DC] text-xs text-[#15241E] placeholder-[#7B8B84] focus:outline-none focus:border-[#16382B]"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* =========================================================================
            TAB 2: THỐNG KÊ CHUYÊN CẦN & CẢNH BÁO CẤM THI
           ========================================================================= */}
        {activeTab === 'stats' && (
          <div className="space-y-6">
            {loadingStats ? (
              <div className="p-16 text-center text-[#61746B] flex items-center justify-center gap-3">
                <div className="w-6 h-6 border-2 border-[#16382B] border-t-transparent rounded-full animate-spin" />
                <span className="text-sm">Đang tính toán tỷ lệ chuyên cần...</span>
              </div>
            ) : !statsData || statsData.stats.length === 0 ? (
              <div className="p-12 text-center rounded-3xl bg-white border border-[#E5ECE7] space-y-2 shadow-sm">
                <Clock className="w-10 h-10 text-[#7B8B84] mx-auto" />
                <h3 className="text-base font-bold text-[#15241E]">Chưa có dữ liệu thống kê</h3>
                <p className="text-xs text-[#61746B]">
                  Hãy thực hiện điểm danh ít nhất một buổi học để xem phân tích chuyên cần.
                </p>
              </div>
            ) : (
              <>
                {/* Metrics Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-5 rounded-3xl bg-white border border-[#E5ECE7] shadow-sm">
                    <span className="text-xs text-[#61746B] uppercase tracking-wider font-semibold">
                      Tổng số buổi đã điểm danh
                    </span>
                    <div className="mt-2 text-2xl font-extrabold text-[#15241E]">
                      {statsData.total_sessions} buổi
                    </div>
                  </div>

                  <div className="p-5 rounded-3xl bg-white border border-[#E5ECE7] shadow-sm">
                    <span className="text-xs text-[#61746B] uppercase tracking-wider font-semibold">
                      Tổng sinh viên
                    </span>
                    <div className="mt-2 text-2xl font-extrabold text-[#16382B]">
                      {statsData.stats.length} sinh viên
                    </div>
                  </div>

                  <div className="p-5 rounded-3xl bg-white border border-[#E5ECE7] shadow-sm">
                    <span className="text-xs text-[#61746B] uppercase tracking-wider font-semibold">
                      Sinh viên bị cảnh báo cấm thi
                    </span>
                    <div className="mt-2 text-2xl font-extrabold text-[#C84B4B] flex items-center gap-2">
                      <ShieldAlert className="w-5 h-5 text-[#C84B4B]" />
                      <span>{statsData.stats.filter((s) => s.is_warning).length} em</span>
                    </div>
                  </div>
                </div>

                {/* Table Ranking */}
                <div className="overflow-x-auto rounded-3xl border border-[#E5ECE7] bg-white shadow-sm">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F8FAF8] text-[#61746B] uppercase text-[11px] font-semibold border-b border-[#E5ECE7]">
                      <tr>
                        <th className="py-3 px-4">Sinh viên</th>
                        <th className="py-3 px-3 text-center">Có mặt</th>
                        <th className="py-3 px-3 text-center">Đi muộn</th>
                        <th className="py-3 px-3 text-center">Vắng có phép</th>
                        <th className="py-3 px-3 text-center">Vắng không phép</th>
                        <th className="py-3 px-3 text-center">Tỷ lệ vắng</th>
                        <th className="py-3 px-4 text-center">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5ECE7] text-[#15241E]">
                      {statsData.stats.map((row) => (
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
                            {row.present_count}
                          </td>
                          <td className="py-3.5 px-3 text-center font-semibold text-[#7A5816]">
                            {row.late_count}
                          </td>
                          <td className="py-3.5 px-3 text-center font-semibold text-[#20556B]">
                            {row.absent_excused_count}
                          </td>
                          <td className="py-3.5 px-3 text-center font-semibold text-[#C84B4B]">
                            {row.absent_unexcused_count}
                          </td>
                          <td className="py-3.5 px-3 text-center font-bold">
                            <span className={row.absence_rate >= 20 ? 'text-[#C84B4B]' : 'text-[#485952]'}>
                              {row.absence_rate}%
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            {row.is_warning ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#FDE8E8] text-[#9B2C2C] border border-[#F8B4B4] text-[11px] font-bold">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                Cảnh báo cấm thi
                              </span>
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
            )}
          </div>
        )}
      </main>
    </div>
  );
}
