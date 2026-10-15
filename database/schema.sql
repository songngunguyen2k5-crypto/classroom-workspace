-- ==============================================================================
-- DATABASE SCHEMA: HỆ THỐNG QUẢN LÝ HỌC TẬP ĐỒNG BỘ GOOGLE CLASSROOM
-- TARGET PLATFORM: PostgreSQL / Supabase
-- SPECIFICATION: tailieukientruc.md
-- ==============================================================================

-- 1. KÍCH HOẠT EXTENSION CẦN THIẾT
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. KHỞI TẠO BẢNG DỮ LIỆU (ENTITIES)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 2.1. Bảng users (Tài khoản người dùng)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    google_id VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    role VARCHAR(50) NOT NULL CHECK (role IN ('TEACHER', 'STUDENT', 'ADMIN')),
    refresh_token TEXT, -- Mã hóa AES-256 ở tầng Backend trước khi lưu
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE users IS 'Quản lý tài khoản người dùng đăng nhập bằng Google OAuth 2.0';
COMMENT ON COLUMN users.refresh_token IS 'OAuth Refresh Token (bắt buộc cho Teacher để phục vụ Sync ngầm)';

-- ------------------------------------------------------------------------------
-- 2.2. Bảng courses (Lớp học)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    google_course_id VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    section VARCHAR(255),
    room VARCHAR(100),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_synced BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE courses IS 'Danh sách lớp học được đồng bộ từ Google Classroom API';

-- ------------------------------------------------------------------------------
-- 2.3. Bảng course_members (Thành viên lớp học)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS course_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_in_course VARCHAR(50) NOT NULL CHECK (role_in_course IN ('TEACHER', 'STUDENT')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_course_member UNIQUE(course_id, user_id)
);

COMMENT ON TABLE course_members IS 'Bảng liên kết Nhiều - Nhiều giữa Users và Courses';

-- ------------------------------------------------------------------------------
-- 2.4. Bảng coursework (Bài tập & Bài giảng)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS coursework (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    google_coursework_id VARCHAR(255) NOT NULL UNIQUE,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    max_points NUMERIC(5,2) DEFAULT 100.00,
    due_date TIMESTAMPTZ,
    work_type VARCHAR(50) CHECK (work_type IN ('ASSIGNMENT', 'SHORT_ANSWER_QUESTION', 'MULTIPLE_CHOICE_QUESTION')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE coursework IS 'Danh sách bài tập và bài giảng đồng bộ từ Google Classroom';

-- ------------------------------------------------------------------------------
-- 2.5. Bảng submissions (Bài nộp & Điểm số)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    google_submission_id VARCHAR(255) NOT NULL UNIQUE,
    coursework_id UUID NOT NULL REFERENCES coursework(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    state VARCHAR(50) CHECK (state IN ('NEW', 'CREATED', 'TURNED_IN', 'RETURNED', 'RECLAIMED_BY_STUDENT')),
    assigned_grade NUMERIC(5,2),
    sync_status VARCHAR(50) NOT NULL DEFAULT 'SYNCED' CHECK (sync_status IN ('PENDING', 'SYNCED', 'FAILED')),
    submitted_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_coursework_student UNIQUE(coursework_id, student_id)
);

COMMENT ON TABLE submissions IS 'Trạng thái bài nộp và điểm số từng học sinh cho từng bài tập';

-- ------------------------------------------------------------------------------
-- 2.6. Bảng attendances (Chuyên cần - Pure Local)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attendances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('PRESENT', 'ABSENT_UNEXCUSED', 'ABSENT_EXCUSED', 'LATE')),
    note TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_course_student_date UNIQUE(course_id, student_id, attendance_date)
);

COMMENT ON TABLE attendances IS 'Bảng điểm danh chuyên cần theo ngày (Tính năng độc quyền mở rộng Local)';

-- ------------------------------------------------------------------------------
-- 2.7. Bảng sync_logs (Nhật ký đồng bộ)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    sync_type VARCHAR(50) NOT NULL CHECK (sync_type IN ('MANUAL', 'SCHEDULED_CRON')),
    status VARCHAR(50) NOT NULL CHECK (status IN ('SUCCESS', 'FAILED', 'PARTIAL')),
    message TEXT,
    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE sync_logs IS 'Lịch sử theo dõi tiến trình đồng bộ 2 chiều phục vụ giám sát và debug';

-- ------------------------------------------------------------------------------
-- 2.8. Bảng coursework_materials (Tài liệu đính kèm bài giảng & bài tập)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS coursework_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coursework_id UUID NOT NULL REFERENCES coursework(id) ON DELETE CASCADE,
    material_type VARCHAR(50) NOT NULL CHECK (material_type IN ('drive_file', 'youtube_video', 'link', 'form')),
    title VARCHAR(500) NOT NULL,
    url TEXT NOT NULL,
    thumbnail_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE coursework_materials IS 'Danh sách tài liệu đính kèm (Drive, YouTube, Link, Form) của bài học';

-- ------------------------------------------------------------------------------
-- 2.9. Bảng announcements (Bảng tin thông báo & Cuộc họp trực tuyến)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    google_announcement_id VARCHAR(255) NOT NULL UNIQUE,
    text TEXT NOT NULL,
    creator_name VARCHAR(255),
    creator_avatar TEXT,
    meet_link TEXT, -- Tự động bóc tách link Google Meet nếu có
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE announcements IS 'Danh sách bài đăng thông báo trên Bảng tin lớp học (hỗ trợ link Google Meet)';

-- ==============================================================================
-- 3. CHỈ MỤC TỐI ƯU TRUY VẤN (INDEXES)
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

CREATE INDEX IF NOT EXISTS idx_courses_owner_id ON courses(owner_id);
CREATE INDEX IF NOT EXISTS idx_courses_google_id ON courses(google_course_id);

CREATE INDEX IF NOT EXISTS idx_course_members_course ON course_members(course_id);
CREATE INDEX IF NOT EXISTS idx_course_members_user ON course_members(user_id);

CREATE INDEX IF NOT EXISTS idx_coursework_course ON coursework(course_id);
CREATE INDEX IF NOT EXISTS idx_coursework_google_id ON coursework(google_coursework_id);
CREATE INDEX IF NOT EXISTS idx_coursework_due_date ON coursework(due_date);

CREATE INDEX IF NOT EXISTS idx_submissions_coursework ON submissions(coursework_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student ON submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_submissions_sync_status ON submissions(sync_status);

CREATE INDEX IF NOT EXISTS idx_attendances_course_date ON attendances(course_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendances_student ON attendances(student_id);

CREATE INDEX IF NOT EXISTS idx_sync_logs_course ON sync_logs(course_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_executed ON sync_logs(executed_at DESC);

CREATE INDEX IF NOT EXISTS idx_materials_coursework_id ON coursework_materials(coursework_id);

CREATE INDEX IF NOT EXISTS idx_announcements_course_id ON announcements(course_id);
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON announcements(created_at DESC);

-- ==============================================================================
-- 4. FUNCTION & TRIGGER TỰ ĐỘNG CẬP NHẬT UPDATED_AT
-- ==============================================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_courses_updated_at ON courses;
CREATE TRIGGER trg_courses_updated_at
BEFORE UPDATE ON courses
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_coursework_updated_at ON coursework;
CREATE TRIGGER trg_coursework_updated_at
BEFORE UPDATE ON coursework
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_submissions_updated_at ON submissions;
CREATE TRIGGER trg_submissions_updated_at
BEFORE UPDATE ON submissions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_announcements_updated_at ON announcements;
CREATE TRIGGER trg_announcements_updated_at
BEFORE UPDATE ON announcements
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ==============================================================================
-- 5. CHÍNH SÁCH BẢO MẬT (SUPABASE ROW LEVEL SECURITY - RLS)
-- ==============================================================================

-- Kích hoạt RLS trên tất cả 7 bảng
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE coursework ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendances ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 5.1. RLS cho bảng users
-- ------------------------------------------------------------------------------
-- Mọi user đã xác thực đều được đọc thông tin cơ bản (tên, avatar, email) của thành viên khác
CREATE POLICY "users_select_authenticated"
ON users FOR SELECT
TO authenticated
USING (true);

-- User chỉ có quyền cập nhật thông tin của chính mình
CREATE POLICY "users_update_own"
ON users FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- ------------------------------------------------------------------------------
-- 5.2. RLS cho bảng courses
-- ------------------------------------------------------------------------------
-- Giáo viên sở hữu hoặc học sinh là thành viên trong lớp được quyền xem thông tin lớp
CREATE POLICY "courses_select_members"
ON courses FOR SELECT
TO authenticated
USING (
    owner_id = auth.uid() OR
    id IN (SELECT course_id FROM course_members WHERE user_id = auth.uid())
);

-- Chỉ Giáo viên sở hữu lớp mới có quyền sửa/xóa lớp
CREATE POLICY "courses_modify_owner"
ON courses FOR ALL
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

-- ------------------------------------------------------------------------------
-- 5.3. RLS cho bảng course_members
-- ------------------------------------------------------------------------------
-- Thành viên hoặc chủ sở hữu lớp học được xem danh sách thành viên lớp
CREATE POLICY "members_select"
ON course_members FOR SELECT
TO authenticated
USING (
    course_id IN (
        SELECT id FROM courses WHERE owner_id = auth.uid()
        UNION
        SELECT course_id FROM course_members WHERE user_id = auth.uid()
    )
);

-- Chỉ giáo viên chủ sở hữu lớp mới có quyền thêm/bớt thành viên local
CREATE POLICY "members_modify_owner"
ON course_members FOR ALL
TO authenticated
USING (
    course_id IN (SELECT id FROM courses WHERE owner_id = auth.uid())
)
WITH CHECK (
    course_id IN (SELECT id FROM courses WHERE owner_id = auth.uid())
);

-- ------------------------------------------------------------------------------
-- 5.4. RLS cho bảng coursework (Bài tập)
-- ------------------------------------------------------------------------------
-- Thành viên của lớp được xem bài tập
CREATE POLICY "coursework_select_members"
ON coursework FOR SELECT
TO authenticated
USING (
    course_id IN (
        SELECT id FROM courses WHERE owner_id = auth.uid()
        UNION
        SELECT course_id FROM course_members WHERE user_id = auth.uid()
    )
);

-- Giáo viên tạo và quản lý bài tập
CREATE POLICY "coursework_modify_owner"
ON coursework FOR ALL
TO authenticated
USING (
    course_id IN (SELECT id FROM courses WHERE owner_id = auth.uid())
)
WITH CHECK (
    course_id IN (SELECT id FROM courses WHERE owner_id = auth.uid())
);

-- ------------------------------------------------------------------------------
-- 5.5. RLS cho bảng submissions (Bài nộp & Điểm)
-- ------------------------------------------------------------------------------
-- Học sinh xem bài của chính mình; Giáo viên xem bài của cả lớp
CREATE POLICY "submissions_select"
ON submissions FOR SELECT
TO authenticated
USING (
    student_id = auth.uid() OR
    coursework_id IN (
        SELECT cw.id FROM coursework cw
        JOIN courses c ON cw.course_id = c.id
        WHERE c.owner_id = auth.uid()
    )
);

-- Học sinh cập nhật nộp bài của mình
CREATE POLICY "submissions_update_student"
ON submissions FOR UPDATE
TO authenticated
USING (student_id = auth.uid())
WITH CHECK (student_id = auth.uid());

-- Giáo viên chấm điểm bài nộp của lớp mình
CREATE POLICY "submissions_grade_teacher"
ON submissions FOR ALL
TO authenticated
USING (
    coursework_id IN (
        SELECT cw.id FROM coursework cw
        JOIN courses c ON cw.course_id = c.id
        WHERE c.owner_id = auth.uid()
    )
)
WITH CHECK (
    coursework_id IN (
        SELECT cw.id FROM coursework cw
        JOIN courses c ON cw.course_id = c.id
        WHERE c.owner_id = auth.uid()
    )
);

-- ------------------------------------------------------------------------------
-- 5.6. RLS cho bảng attendances (Chuyên cần)
-- ------------------------------------------------------------------------------
-- Học sinh chỉ xem chuyên cần của mình; Giáo viên xem chuyên cần cả lớp
CREATE POLICY "attendances_select"
ON attendances FOR SELECT
TO authenticated
USING (
    student_id = auth.uid() OR
    course_id IN (SELECT id FROM courses WHERE owner_id = auth.uid())
);

-- Chỉ Giáo viên phụ trách lớp mới được điểm danh / sửa điểm danh
CREATE POLICY "attendances_modify_teacher"
ON attendances FOR ALL
TO authenticated
USING (
    course_id IN (SELECT id FROM courses WHERE owner_id = auth.uid())
)
WITH CHECK (
    course_id IN (SELECT id FROM courses WHERE owner_id = auth.uid())
);

-- ------------------------------------------------------------------------------
-- 5.7. RLS cho bảng sync_logs (Nhật ký đồng bộ)
-- ------------------------------------------------------------------------------
-- Chỉ Giáo viên sở hữu lớp được xem logs đồng bộ
CREATE POLICY "sync_logs_select_teacher"
ON sync_logs FOR SELECT
TO authenticated
USING (
    course_id IN (SELECT id FROM courses WHERE owner_id = auth.uid())
);

-- Ghi chú: Backend Node.js sử dụng Supabase `service_role` key sẽ tự động bypass các RLS policies
-- để thực hiện các tác vụ Sync ngầm, tạo user, quét bài tập mà không bị giới hạn.
