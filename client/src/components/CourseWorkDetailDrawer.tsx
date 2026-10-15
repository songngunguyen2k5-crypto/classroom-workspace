import React, { useEffect } from 'react';
import { 
  X, 
  ExternalLink, 
  FileText, 
  Link2, 
  FileSpreadsheet, 
  Calendar, 
  Award, 
  Layers,
  Sparkles
} from 'lucide-react';
import type { CourseworkDetailData, CourseworkMaterial } from '../services/coursework.service';

interface CourseWorkDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  coursework: CourseworkDetailData | null;
  isLoading?: boolean;
}

export const CourseWorkDetailDrawer: React.FC<CourseWorkDetailDrawerProps> = ({
  isOpen,
  onClose,
  coursework,
  isLoading = false,
}) => {
  // Lắng nghe phím ESC để đóng Drawer nhanh
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Ngăn cuộn trang phía sau khi Drawer đang mở
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Helper render icon và màu sắc cho từng loại tài liệu
  const renderMaterialBadge = (material: CourseworkMaterial) => {
    switch (material.material_type) {
      case 'youtube_video':
        return (
          <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-white border border-[#FEE2E2] hover:border-[#DC2626]/40 hover:shadow-md transition-all group">
            <div className="w-10 h-10 rounded-xl bg-[#FEF2F2] flex items-center justify-center text-[#DC2626] shrink-0 group-hover:scale-105 transition-transform">
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#DC2626] bg-[#FEF2F2] px-2 py-0.5 rounded-md">
                  YouTube
                </span>
              </div>
              <h5 className="text-sm font-semibold text-[#15241E] truncate mt-1 group-hover:text-[#DC2626] transition-colors">
                {material.title}
              </h5>
              <p className="text-[11px] text-[#7B8B84] truncate mt-0.5">{material.url}</p>
            </div>
            <a
              href={material.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-[#7B8B84] hover:text-[#DC2626] hover:bg-[#FEF2F2] rounded-xl transition-colors shrink-0"
              title="Mở xem trên YouTube"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        );

      case 'drive_file':
        return (
          <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-white border border-[#D1FAE5] hover:border-[#059669]/40 hover:shadow-md transition-all group">
            <div className="w-10 h-10 rounded-xl bg-[#ECFDF5] flex items-center justify-center text-[#059669] shrink-0 group-hover:scale-105 transition-transform">
              <FileText className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#059669] bg-[#ECFDF5] px-2 py-0.5 rounded-md">
                  Google Drive
                </span>
              </div>
              <h5 className="text-sm font-semibold text-[#15241E] truncate mt-1 group-hover:text-[#059669] transition-colors">
                {material.title}
              </h5>
              <p className="text-[11px] text-[#7B8B84] truncate mt-0.5">{material.url}</p>
            </div>
            <a
              href={material.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-[#7B8B84] hover:text-[#059669] hover:bg-[#ECFDF5] rounded-xl transition-colors shrink-0"
              title="Mở tài liệu Google Drive"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        );

      case 'form':
        return (
          <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-white border border-[#EDE9FE] hover:border-[#7C3AED]/40 hover:shadow-md transition-all group">
            <div className="w-10 h-10 rounded-xl bg-[#F5F3FF] flex items-center justify-center text-[#7C3AED] shrink-0 group-hover:scale-105 transition-transform">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#7C3AED] bg-[#F5F3FF] px-2 py-0.5 rounded-md">
                  Google Form
                </span>
              </div>
              <h5 className="text-sm font-semibold text-[#15241E] truncate mt-1 group-hover:text-[#7C3AED] transition-colors">
                {material.title}
              </h5>
              <p className="text-[11px] text-[#7B8B84] truncate mt-0.5">{material.url}</p>
            </div>
            <a
              href={material.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-[#7B8B84] hover:text-[#7C3AED] hover:bg-[#F5F3FF] rounded-xl transition-colors shrink-0"
              title="Mở Google Form"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        );

      case 'link':
      default:
        return (
          <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-white border border-[#DBEAFE] hover:border-[#2563EB]/40 hover:shadow-md transition-all group">
            <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] flex items-center justify-center text-[#2563EB] shrink-0 group-hover:scale-105 transition-transform">
              <Link2 className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#2563EB] bg-[#EFF6FF] px-2 py-0.5 rounded-md">
                  Liên kết
                </span>
              </div>
              <h5 className="text-sm font-semibold text-[#15241E] truncate mt-1 group-hover:text-[#2563EB] transition-colors">
                {material.title}
              </h5>
              <p className="text-[11px] text-[#7B8B84] truncate mt-0.5">{material.url}</p>
            </div>
            <a
              href={material.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-[#7B8B84] hover:text-[#2563EB] hover:bg-[#EFF6FF] rounded-xl transition-colors shrink-0"
              title="Mở liên kết"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop mờ */}
      <div 
        className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity animate-fadeIn"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-xl bg-[#FBFBFA] border-l border-[#E5ECE7] shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out">
          
          {/* Header Drawer */}
          <div className="p-6 bg-white border-b border-[#E5ECE7] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#EAF2EC] flex items-center justify-center text-[#16382B]">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#61746B]">
                  Chi tiết nội dung bài học
                </span>
                <h3 className="text-base font-bold text-[#15241E] line-clamp-1">
                  {coursework?.title || 'Đang tải thông tin...'}
                </h3>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-[#7B8B84] hover:text-[#15241E] hover:bg-[#F0F4F1] rounded-xl transition-colors"
              title="Đóng (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {isLoading ? (
              <div className="p-12 text-center text-[#61746B] flex flex-col items-center justify-center gap-3">
                <div className="w-8 h-8 border-3 border-[#16382B] border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-medium">Đang tải chi tiết bài học & tài liệu...</span>
              </div>
            ) : !coursework ? (
              <div className="p-8 text-center text-[#61746B] text-xs">
                Không tìm thấy dữ liệu bài học này.
              </div>
            ) : (
              <>
                {/* Thanh thông tin tóm tắt bài học */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-2xl bg-white border border-[#E5ECE7]">
                    <div className="flex items-center gap-1.5 text-[11px] text-[#7B8B84] mb-1">
                      <Award className="w-3.5 h-3.5 text-[#7A5816]" />
                      <span>Thang điểm</span>
                    </div>
                    <div className="text-sm font-bold text-[#7A5816]">
                      {coursework.max_points} điểm
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-white border border-[#E5ECE7]">
                    <div className="flex items-center gap-1.5 text-[11px] text-[#7B8B84] mb-1">
                      <Calendar className="w-3.5 h-3.5 text-[#16382B]" />
                      <span>Hạn nộp</span>
                    </div>
                    <div className="text-xs font-semibold text-[#15241E] truncate">
                      {coursework.due_date 
                        ? new Date(coursework.due_date).toLocaleDateString('vi-VN', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })
                        : 'Không giới hạn'}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-white border border-[#E5ECE7] col-span-2 sm:col-span-1">
                    <div className="flex items-center gap-1.5 text-[11px] text-[#7B8B84] mb-1">
                      <Layers className="w-3.5 h-3.5 text-[#16382B]" />
                      <span>Hình thức</span>
                    </div>
                    <div className="text-xs font-semibold text-[#15241E] truncate">
                      {coursework.work_type === 'ASSIGNMENT' ? 'Bài tập' : coursework.work_type}
                    </div>
                  </div>
                </div>

                {/* Hướng dẫn & Mô tả bài giảng */}
                <div className="p-5 rounded-3xl bg-white border border-[#E5ECE7] space-y-2.5">
                  <h4 className="text-xs font-bold text-[#15241E] uppercase tracking-wider flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#16382B]" />
                    Mô tả / Hướng dẫn bài học
                  </h4>
                  <div className="text-xs text-[#2A3B33] leading-relaxed whitespace-pre-line">
                    {coursework.description ? (
                      coursework.description
                    ) : (
                      <span className="italic text-[#7B8B84]">
                        Giảng viên chưa cập nhật phần mô tả hoặc hướng dẫn cho bài học này.
                      </span>
                    )}
                  </div>
                </div>

                {/* Danh sách tài liệu đính kèm (Materials) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-[#15241E] uppercase tracking-wider flex items-center gap-2">
                      <Layers className="w-4 h-4 text-[#16382B]" />
                      Tài liệu đính kèm ({coursework.materials?.length || 0})
                    </h4>
                  </div>

                  {(!coursework.materials || coursework.materials.length === 0) ? (
                    <div className="p-8 text-center rounded-2xl bg-white border border-dashed border-[#CBD8CF] text-xs text-[#7B8B84] space-y-1">
                      <p>Không có tài liệu, video hoặc liên kết nào được đính kèm trong bài giảng này.</p>
                      <p className="text-[11px] text-[#A0AFA6]">
                        (Nếu bạn vừa thêm tài liệu trên Google Classroom, hãy bấm "Đồng bộ" ở trang chủ để cập nhật dữ liệu mới nhất).
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {coursework.materials.map((mat) => (
                        <div key={mat.id || mat.url}>
                          {renderMaterialBadge(mat)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Footer Drawer */}
          <div className="p-4 bg-white border-t border-[#E5ECE7] flex items-center justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-[#EAF2EC] text-[#16382B] text-xs font-bold hover:bg-[#d8e7dc] transition-colors"
            >
              Đóng cửa sổ
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
