import React, { useState, useEffect } from 'react';
import { 
  Send, 
  Video, 
  ExternalLink, 
  Sparkles, 
  RefreshCw, 
  MessageSquare, 
  Calendar,
  AlertCircle
} from 'lucide-react';
import { fetchAnnouncements, createAnnouncement } from '../services/announcement.service';
import type { AnnouncementItem } from '../types';

interface AnnouncementStreamProps {
  courseId: string;
  isTeacher: boolean;
  currentUser?: {
    full_name?: string;
    avatar_url?: string;
  };
}

export const AnnouncementStream: React.FC<AnnouncementStreamProps> = ({
  courseId,
  isTeacher,
  currentUser,
}) => {
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [isComposing, setIsComposing] = useState<boolean>(false);
  const [newText, setNewText] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load danh sách thông báo
  const loadData = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const items = await fetchAnnouncements(courseId);
      setAnnouncements(items);
    } catch (err: any) {
      console.warn('Lỗi khi tải thông báo:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (courseId) {
      loadData();
    }
  }, [courseId]);

  // Xử lý đăng thông báo mới
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newText.trim()) return;

    setSubmitting(true);
    setFeedback(null);
    try {
      const created = await createAnnouncement(courseId, newText);
      setAnnouncements((prev) => [created, ...prev]);
      setNewText('');
      setIsComposing(false);
      setFeedback({
        type: 'success',
        text: 'Đã đăng thông báo thành công và đồng bộ lên Google Classroom!',
      });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err.message || 'Không thể đăng thông báo.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Nút tiện ích dán nhanh mẫu link Google Meet
  const handleInsertMeetSnippet = () => {
    const meetSnippet = '\nTham gia cuộc họp Google Meet: https://meet.google.com/new';
    setNewText((prev) => (prev ? prev + meetSnippet : 'Tham gia cuộc họp Google Meet: https://meet.google.com/new'));
  };

  // Format ngày giờ thân thiện
  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-5">
      {/* Thanh tiêu đề Bảng tin & Nút làm mới */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-[#16382B]" />
          <h3 className="font-bold text-xs text-[#61746B] uppercase tracking-wider">
            Bảng tin & Thông báo lớp học ({announcements.length})
          </h3>
        </div>

        <button
          type="button"
          onClick={() => loadData(true)}
          disabled={refreshing || loading}
          className="text-xs text-[#16382B] hover:text-[#0f271e] font-semibold flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-[#EAF2EC] transition-colors"
          title="Làm mới bảng tin"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span>Làm mới</span>
        </button>
      </div>

      {/* Thông báo phản hồi (Toast inline) */}
      {feedback && (
        <div
          className={`p-3.5 rounded-2xl text-xs flex items-center gap-2.5 transition-all ${
            feedback.type === 'success'
              ? 'bg-[#EAF2EC] text-[#16382B] border border-[#CBD8CF]'
              : 'bg-[#FEE2E2] text-[#DC2626] border border-[#FECACA]'
          }`}
        >
          {feedback.type === 'error' && <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* KHUNG SOẠN THẢO THÔNG BÁO (Dành riêng cho Giảng viên) */}
      {isTeacher && (
        <div className="p-5 rounded-3xl bg-white border border-[#E5ECE7] shadow-sm transition-all">
          {!isComposing ? (
            <div
              onClick={() => setIsComposing(true)}
              className="flex items-center gap-3.5 cursor-pointer p-2 rounded-2xl hover:bg-[#F8FAF8] transition-colors"
            >
              <img
                src={currentUser?.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg'}
                alt={currentUser?.full_name || 'Avatar'}
                className="w-9 h-9 rounded-full border border-[#cbd8cf] object-cover shrink-0"
              />
              <span className="text-xs text-[#7B8B84] font-medium flex-1">
                Thông báo nội dung nào đó cho lớp học của bạn hoặc chia sẻ link Google Meet...
              </span>
              <span className="text-xs font-bold text-[#16382B] bg-[#EAF2EC] px-3 py-1.5 rounded-xl border border-[#D6E6DC]">
                Đăng bài
              </span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="flex items-center gap-2.5 pb-2 border-b border-[#E5ECE7]">
                <img
                  src={currentUser?.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg'}
                  alt={currentUser?.full_name || 'Avatar'}
                  className="w-8 h-8 rounded-full border border-[#cbd8cf] object-cover"
                />
                <div>
                  <div className="text-xs font-bold text-[#15241E]">{currentUser?.full_name || 'Giảng viên'}</div>
                  <div className="text-[10px] text-[#61746B]">Đăng công khai lên Google Classroom</div>
                </div>
              </div>

              <textarea
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                placeholder="Nhập nội dung thông báo cho học sinh... Dán link Google Meet (ví dụ https://meet.google.com/abc-defg-hij) để tự động tạo phòng họp trực tuyến!"
                rows={4}
                className="w-full text-xs text-[#15241E] placeholder-[#7B8B84] bg-[#FBFBFA] p-3.5 rounded-2xl border border-[#CBD8CF] focus:outline-none focus:ring-2 focus:ring-[#16382B]/20 focus:border-[#16382B] transition-all leading-relaxed"
                autoFocus
              />

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                {/* Nút tiện ích thêm Meet */}
                <button
                  type="button"
                  onClick={handleInsertMeetSnippet}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#EAF2EC] text-[#16382B] text-xs font-semibold hover:bg-[#d8e7dc] transition-colors border border-[#cbd8cf]"
                >
                  <Video className="w-3.5 h-3.5 text-[#16382B]" />
                  <span>Chèn link Google Meet</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsComposing(false);
                      setNewText('');
                    }}
                    disabled={submitting}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-[#61746B] hover:bg-[#F0F4F1] transition-colors"
                  >
                    Hủy
                  </button>

                  <button
                    type="submit"
                    disabled={submitting || !newText.trim()}
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#16382B] text-white text-xs font-bold hover:bg-[#0f271e] disabled:opacity-50 transition-all shadow-sm"
                  >
                    {submitting ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Đang đăng...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Đăng thông báo</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      )}

      {/* DANH SÁCH BÀI ĐĂNG THÔNG BÁO (STREAM CARDS) */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="p-6 rounded-3xl bg-white border border-[#E5ECE7] shadow-sm animate-pulse space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#E5ECE7]" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-3 w-32 bg-[#E5ECE7] rounded" />
                  <div className="h-2.5 w-20 bg-[#E5ECE7] rounded" />
                </div>
              </div>
              <div className="h-4 w-3/4 bg-[#E5ECE7] rounded" />
              <div className="h-3 w-1/2 bg-[#E5ECE7] rounded" />
            </div>
          ))}
        </div>
      ) : announcements.length === 0 ? (
        <div className="p-10 text-center rounded-3xl bg-white border border-dashed border-[#CBD8CF] shadow-xs space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-[#EAF2EC] text-[#16382B] flex items-center justify-center mx-auto">
            <Sparkles className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-[#15241E]">Chưa có thông báo nào</h4>
          <p className="text-xs text-[#7B8B84] max-w-sm mx-auto leading-relaxed">
            Các bài đăng và thông báo kèm link phòng học Google Meet từ Google Classroom sẽ xuất hiện ở đây.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {announcements.map((item) => (
            <div
              key={item.id}
              className="p-6 rounded-3xl bg-white border border-[#E5ECE7] hover:border-[#CBD8CF] shadow-sm space-y-4 transition-all"
            >
              {/* Header bài đăng: Tác giả & Ngày giờ */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <img
                    src={item.creator_avatar || 'https://api.dicebear.com/7.x/avataaars/svg'}
                    alt={item.creator_name || 'Giảng viên'}
                    className="w-10 h-10 rounded-full border border-[#cbd8cf] object-cover"
                  />
                  <div>
                    <h4 className="text-sm font-bold text-[#15241E]">
                      {item.creator_name || 'Giảng viên'}
                    </h4>
                    <div className="flex items-center gap-1.5 text-[11px] text-[#7B8B84] mt-0.5">
                      <Calendar className="w-3 h-3 text-[#16382B]" />
                      <span>{formatDate(item.created_at)}</span>
                    </div>
                  </div>
                </div>

                <span className="text-[10px] font-bold uppercase tracking-wider text-[#16382B] bg-[#EAF2EC] px-2.5 py-1 rounded-full border border-[#D6E6DC]">
                  Thông báo
                </span>
              </div>

              {/* Nội dung thông báo */}
              <div className="text-xs text-[#15241E] leading-relaxed whitespace-pre-line font-normal">
                {item.text}
              </div>

              {/* 🎯 BANNER CUỘC HỌP GOOGLE MEET NỔI BẬT */}
              {item.meet_link && (
                <div className="p-4 rounded-2xl bg-[#EAF2EC] border border-[#CBD8CF] flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 shadow-xs">
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-[#16382B] text-white flex items-center justify-center shrink-0 shadow-sm">
                      <Video className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#16382B] bg-white px-2 py-0.5 rounded-md border border-[#CBD8CF]">
                          Google Meet
                        </span>
                        <span className="text-[11px] font-semibold text-[#16382B]">Phòng học trực tuyến</span>
                      </div>
                      <p className="text-[11px] text-[#485952] truncate font-mono mt-0.5">
                        {item.meet_link}
                      </p>
                    </div>
                  </div>

                  <a
                    href={item.meet_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#16382B] hover:bg-[#0f271e] text-white text-xs font-bold transition-all shadow-sm shrink-0"
                  >
                    <span>Tham gia cuộc họp ngay</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
