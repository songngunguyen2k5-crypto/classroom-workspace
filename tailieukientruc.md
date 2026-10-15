# TÀI LIỆU THIẾT KẾ KIẾN TRÚC VÀ KẾ HOẠCH SẢN PHẨM (SRS)
**Hệ thống Quản lý Học tập Đồng bộ Google Classroom (Classroom Management System)**

---

## TỔNG QUAN HỆ THỐNG
* **Chức danh thực hiện:** Software Architect & Product Manager
* **Mục tiêu hệ thống:** Cung cấp giải pháp quản lý học tập tối ưu, mở rộng các tính năng còn thiếu trên Google Classroom (điểm danh chuyên cần, tính điểm trung bình, dashboard tiến độ), đồng bộ 2 chiều (Read & Write) với Google Classroom API.
* **Tiêu chí thiết kế cốt lõi:** Dễ triển khai (Deploy 1-click), Giao diện tối giản, Phản hồi nhanh (Local-first view), Dễ bảo trì vận hành.
* **Tech Stack:**
  * **Frontend:** React (Vite / Next.js SPA mode) + Tailwind CSS (UI đơn giản, thân thiện).
  * **Backend:** Node.js (Express / NestJS) RESTful API.
  * **Database & Auth:** Supabase (PostgreSQL + Supabase Auth / Row Level Security).
  * **Deployment:** Vercel/Netlify (Frontend), Render/Railway (Backend Node.js), Supabase Cloud (Database).

---

## 1. PHÂN TÍCH LUỒNG XÁC THỰC & PHÂN QUYỀN (AUTH & PERMISSIONS)

### 1.1. Luồng Google OAuth 2.0 (Authorization Code Flow with PKCE)

Do hệ thống cần quyền **Write** (chấm điểm, tạo bài tập) và chạy đồng bộ ngầm (Background Sync), luồng OAuth 2.0 bắt buộc phải xin `offline access` để nhận `Refresh Token`.

```text
[User (Teacher/Student)] 
       │
       ▼
[React Frontend] ──(1) Click "Đăng nhập Google"──► [Node.js Backend]
                                                           │
                                             (2) Generate Auth URL (Scopes + access_type=offline)
                                                           │
       ┌───────────────────────────────────────────────────┘
       ▼
[Google OAuth 2.0 Consent Screen] 
       │
       ├─► User đồng ý cấp quyền
       │
       ▼
[Node.js Backend Callback] ◄──(3) Trả về Authorization Code
       │
       ├─► (4) Exchange Auth Code lấy Access Token + Refresh Token + ID Token
       ├─► (5) Verify ID Token ──► Lấy Email, Name, Avatar, Google User ID
       ├─► (6) Mã hóa & Lưu Refresh Token vào Supabase DB (`users` table)
       ├─► (7) Tạo/Cập nhật User & Quyền hạn trong DB
       │
       ▼
[React Frontend] ◄──(8) Trả về JWT Session / Supabase Token
```

#### Các bước xử lý chi tiết tại Backend:
1. **Khởi tạo:** Khi người dùng chọn "Đăng nhập với Google", Backend sinh OAuth Redirect URL đi kèm tham số `access_type=offline` và `prompt=consent` (để đảm bảo luôn lấy được Refresh Token ở lần đăng nhập đầu).
2. **Cấp quyền & Xử lý Token:** Backend nhận `authorization_code` từ Google, đổi lấy `access_token` (hạn 1 giờ) và `refresh_token` (vĩnh viễn trừ khi bị revoke).
3. **Phân định Role (Xác định vai trò):**
   * Hệ thống sẽ gọi Google Classroom API (`/v1/courses`) để kiểm tra người dùng là `TEACHER` hay `STUDENT` trong các lớp học hiện có.
   * Nếu người dùng sở hữu/giảng dạy ít nhất 1 lớp $\rightarrow$ Gán Role mặc định trên hệ thống là **Teacher** (vẫn có thể tham gia lớp khác với tư cách Student).
4. **Bảo mật Refresh Token:** `refresh_token` được mã hóa AES-256 trước khi lưu vào database Supabase, chỉ phục vụ cho các tiến trình Cron/Sync Service ở Backend.

---

### 1.2. Danh sách Scopes Google Cloud Console

Để đáp ứng đầy đủ tính năng Đọc & Ghi (Read/Write) cho cả Bài giảng, Bài tập, Chấm điểm và Danh sách lớp, dự án cần cấu hình các Scope sau trên Google Cloud Console:

| Scope URI | Phương thức | Mục đích sử dụng |
| :--- | :--- | :--- |
| `openid` | Read | Xác thực danh tính người dùng cơ bản |
| `https://www.googleapis.com/auth/userinfo.profile` | Read | Lấy Họ tên, Ảnh đại diện (Avatar) |
| `https://www.googleapis.com/auth/userinfo.email` | Read | Lấy Địa chỉ Email chính thức |
| `https://www.googleapis.com/auth/classroom.courses.readonly` | Read | Đọc danh sách Lớp học mà User tham gia/giảng dạy |
| `https://www.googleapis.com/auth/classroom.rosters.readonly` | Read | Đọc danh sách Giáo viên và Học sinh trong lớp |
| `https://www.googleapis.com/auth/classroom.coursework.students` | Read / Write | **[Quan trọng]** Tạo, sửa, xóa Bài tập/Bài giảng. Học sinh xem & nộp bài. |
| `https://www.googleapis.com/auth/classroom.student-submissions.students.readonly` | Read | Đọc bài nộp và trạng thái làm bài của học sinh |
| `https://www.googleapis.com/auth/classroom.coursework.me` | Read / Write | Cho phép Học sinh quản lý bài nộp cá nhân |
| `https://www.googleapis.com/auth/classroom.student-submissions.me.readonly` | Read | Cho phép Học sinh xem điểm & bài làm của chính mình |

> **Lưu ý cho Vận hành:** Do hệ thống xin các quyền ghi nhạy cảm (`coursework.students`), ứng dụng trên Google Cloud Console cần trải qua quá trình **Google App Verification** (Xác minh ứng dụng) trước khi công khai cho người dùng bên ngoài domain tổ chức.

---

## 2. DANH SÁCH TÍNH NĂNG CỐT LÕI (FEATURE MATRIX)

| Nhóm chức năng | Tính năng chi tiết | Role Giáo viên (Teacher) | Role Học sinh (Student) | Tương tác Google API |
| :--- | :--- | :---: | :---: | :---: |
| **Quản lý Lớp** | Xem danh sách lớp học | ✅ | ✅ | Read (`courses`) |
| | Bật/Tắt đồng bộ lớp vào Hệ thống Local | ✅ | ❌ | Read Local / DB write |
| **Chuyên cần** | Điểm danh học sinh theo ngày (Có mặt / Vắng / Muộn / Có phép) | ✅ | ❌ | Pure Local Feature |
| | Xem lịch sử chuyên cần & Thống kê vắng | ✅ (Xem cả lớp) | ✅ (Xem cá nhân) | Pure Local Feature |
| **Bài tập & Chấm điểm** | Đồng bộ Bài giảng & Bài tập từ Google Classroom | ✅ | ✅ | Read (`coursework`) |
| | Tạo/Sửa bài tập trực tiếp từ Website (Đẩy sang Google) | ✅ | ❌ | Write (`coursework.create`) |
| | Xem bài nộp của học sinh | ✅ | ✅ (Chỉ xem bài mình) | Read (`studentSubmissions`) |
| | Chấm điểm & Trả bài (Nhập điểm đồng bộ lên Google Classroom) | ✅ | ❌ | Write (`studentSubmissions.patch`) |
| **Báo cáo & Thống kê** | Bảng tổng hợp điểm trung bình tích lũy (GPA Lớp) | ✅ (Toàn lớp) | ✅ (Cá nhân) | Local Calculation |
| | Dashboard cảnh báo học sinh có nguy cơ cấm thi/trễ deadline | ✅ | ✅ | Local Analytics |
| | Xuất Báo cáo (Export Excel/PDF) điểm & chuyên cần | ✅ | ❌ | Local Feature |

---

## 3. KIẾN TRÚC ĐỒNG BỘ DỮ LIỆU (CLASSROOM SYNC STRATEGY)

Để tối ưu chi phí vận hành, tránh giới hạn băng thông/lượt gọi API của Google (Quota Rate Limit: 50 QPS/project), hệ thống áp dụng **Chiến lược Đồng bộ Hỗn hợp (Hybrid Sync Strategy) với Mô hình Local-First**.

```text
                           ┌───────────────────────────┐
                           │   Google Classroom API    │
                           └─────────────┬─────────────┘
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 │                                               │
     (A) Polling Cron Job                             (B) On-Demand Sync
     (Tự động ngầm: 15-30p)                           (Nút bấm Giáo viên)
                 │                                               │
                 └───────────────────────┬───────────────────────┘
                                         │
                                         ▼
                            ┌─────────────────────────┐
                            │  Node.js Sync Engine    │
                            └────────────┬────────────┘
                                         │ Upsert Data
                                         ▼
                            ┌─────────────────────────┐
                            │   Supabase PostgreSQL   │
                            └────────────┬────────────┘
                                         │ Fast Read/Write
                                         ▼
                            ┌─────────────────────────┐
                            │     React Frontend      │
                            └─────────────────────────┘
```

### 3.1. Cơ chế đồng bộ (When & How)

1. **Đồng bộ chủ động qua Nút bấm (On-Demand Sync - Manual):**
   * **Kịch bản:** Giáo viên vừa đăng bài mới hoặc chấm điểm trên Google Classroom và muốn hiển thị ngay trên Website local (hoặc ngược lại).
   * **Cơ chế:** Giáo viên nhấn nút "Đồng bộ ngay". Frontend gửi request lên Node.js Backend $\rightarrow$ Backend dùng Access Token của Giáo viên để kéo delta data mới nhất từ Google API và ghi đè/Cập nhật (`UPSERT`) vào Supabase DB.

2. **Đồng bộ tự động ngầm (Scheduled Background Sync - Cron Job):**
   * **Kịch bản:** Học sinh nộp bài trên Google Classroom rải rác trong ngày.
   * **Cơ chế:** Node.js Backend chạy Worker (`node-cron` hoặc BullMQ Queue) định kỳ **15 - 30 phút/lần** trong khung giờ hành chính (7h00 - 18h00).
   * Worker lấy `refresh_token` của Giáo viên tạo lớp $\rightarrow$ Đổi lấy `access_token` $\rightarrow$ Quét các bài tập/bài nộp có thay đổi kể từ lần sync cuối (`states` & `updateTime`) $\rightarrow$ Cập nhật CSDL Supabase.

3. **Ghi dữ liệu 2 chiều (Write-Through Pattern):**
   * Khi Giáo viên **chấm điểm** hoặc **điểm danh** trên Website:
     * *Điểm số:* Lưu ngay vào Supabase DB $\rightarrow$ Gọi API Google Classroom cập nhật điểm (`studentSubmissions.patch`). Nếu Google API lỗi, đưa vào Queue thử lại sau (Retry Queue).
     * *Điểm danh:* Chỉ lưu tại Supabase DB (vì Google Classroom không hỗ trợ API điểm danh chuyên cần).

### 3.2. Giải pháp Chống Xung đột & Tối ưu Rate Limit

* **Local-First Rendering:** Frontend **luôn tải dữ liệu trực tiếp từ Supabase DB** (Response time < 100ms). Không gọi trực tiếp Google API từ Frontend để tránh nghẽn giao diện.
* **Smart Upserting:** Sử dụng thuộc tính `google_id` làm Unique Identifier. Chỉ cập nhật bản ghi khi `updated_at` của Google mới hơn `updated_at` trong Supabase DB.
* **Exponential Backoff:** Nếu gặp lỗi HTTP `429 Too Many Requests` từ Google, Backend sẽ tự động hoãn và thử lại sau $2^n$ giây.

---

## 4. BẢN BÀN GIAO CHO AI CƠ SỞ DỮ LIỆU (DATABASE HANDOVER BLUEPRINT)

> **Hướng dẫn cho AI Database Designer:** Hãy sử dụng danh sách Thực thể (Entities) và Trường dữ liệu (Fields) bên dưới để viết file kịch bản khởi tạo cơ sở dữ liệu (SQL Schema Definition/Migration File) cho **PostgreSQL / Supabase**. Khai báo đầy đủ các ràng buộc Khóa chính (PK), Khóa ngoại (FK), Unique Index và Trigger cập nhật `updated_at`.

### 4.1. Sơ đồ Thực thể (Entities & Fields Specification)

#### 1. Entity: `users` (Tài khoản người dùng)
Mục đích: Lưu trữ thông tin tài khoản người dùng đăng nhập qua Google.
* `id`: `UUID` (Primary Key, default: `gen_random_uuid()`)
* `google_id`: `VARCHAR(255)` (UNIQUE, NOT NULL) - ID người dùng từ Google ID Token
* `email`: `VARCHAR(255)` (UNIQUE, NOT NULL)
* `full_name`: `VARCHAR(255)` (NOT NULL)
* `avatar_url`: `TEXT`
* `role`: `VARCHAR(50)` (NOT NULL, Enum: `'TEACHER'`, `'STUDENT'`, `'ADMIN'`)
* `refresh_token`: `TEXT` (Encrypted, Nullable - Chỉ bắt buộc với Teacher)
* `created_at`: `TIMESTAMPTZ` (default: `NOW()`)
* `updated_at`: `TIMESTAMPTZ` (default: `NOW()`)

#### 2. Entity: `courses` (Lớp học)
Mục đích: Quản lý danh sách lớp học được đồng bộ từ Google Classroom.
* `id`: `UUID` (Primary Key, default: `gen_random_uuid()`)
* `google_course_id`: `VARCHAR(255)` (UNIQUE, NOT NULL) - ID lớp trên Google Classroom
* `name`: `VARCHAR(255)` (NOT NULL) - Tên lớp học
* `section`: `VARCHAR(255)` - Học kỳ / Phân đoạn lớp
* `room`: `VARCHAR(100)` - Phòng học
* `owner_id`: `UUID` (Foreign Key $\rightarrow$ `users.id`, ON DELETE CASCADE) - Giáo viên chủ nhiệm lớp
* `is_synced`: `BOOLEAN` (default: `true`) - Trạng thái kích hoạt đồng bộ trên hệ thống
* `created_at`: `TIMESTAMPTZ` (default: `NOW()`)
* `updated_at`: `TIMESTAMPTZ` (default: `NOW()`)

#### 3. Entity: `course_members` (Thành viên lớp học)
Mục đích: Bảng trung gian lưu mối quan hệ Nhiều-Nhiều giữa Users và Courses.
* `id`: `UUID` (Primary Key, default: `gen_random_uuid()`)
* `course_id`: `UUID` (Foreign Key $\rightarrow$ `courses.id`, ON DELETE CASCADE)
* `user_id`: `UUID` (Foreign Key $\rightarrow$ `users.id`, ON DELETE CASCADE)
* `role_in_course`: `VARCHAR(50)` (NOT NULL, Enum: `'TEACHER'`, `'STUDENT'`)
* `joined_at`: `TIMESTAMPTZ` (default: `NOW()`)
* *Ràng buộc:* `UNIQUE(course_id, user_id)`

#### 4. Entity: `coursework` (Bài tập & Bài giảng)
Mục đích: Quản lý danh sách bài tập/nhiệm vụ của từng lớp.
* `id`: `UUID` (Primary Key, default: `gen_random_uuid()`)
* `google_coursework_id`: `VARCHAR(255)` (UNIQUE, NOT NULL) - ID bài tập trên Google
* `course_id`: `UUID` (Foreign Key $\rightarrow$ `courses.id`, ON DELETE CASCADE)
* `title`: `VARCHAR(500)` (NOT NULL)
* `description`: `TEXT`
* `max_points`: `DECIMAL(5,2)` (default: `100.00`) - Điểm tối đa
* `due_date`: `TIMESTAMPTZ` (Nullable) - Hạn nộp bài
* `work_type`: `VARCHAR(50)` (Enum: `'ASSIGNMENT'`, `'SHORT_ANSWER_QUESTION'`, `'MULTIPLE_CHOICE_QUESTION'`)
* `created_at`: `TIMESTAMPTZ` (default: `NOW()`)
* `updated_at`: `TIMESTAMPTZ` (default: `NOW()`)

#### 5. Entity: `submissions` (Bài nộp & Điểm số)
Mục đích: Quản lý chi tiết bài nộp và điểm số của từng học sinh cho mỗi bài tập.
* `id`: `UUID` (Primary Key, default: `gen_random_uuid()`)
* `google_submission_id`: `VARCHAR(255)` (UNIQUE, NOT NULL) - ID bài nộp trên Google
* `coursework_id`: `UUID` (Foreign Key $\rightarrow$ `coursework.id`, ON DELETE CASCADE)
* `student_id`: `UUID` (Foreign Key $\rightarrow$ `users.id`, ON DELETE CASCADE)
* `state`: `VARCHAR(50)` (Enum: `'NEW'`, `'CREATED'`, `'TURNED_IN'`, `'RETURNED'`, `'RECLAIMED_BY_STUDENT'`)
* `assigned_grade`: `DECIMAL(5,2)` (Nullable) - Điểm số giáo viên chấm trên hệ thống/Google
* `sync_status`: `VARCHAR(50)` (default: `'SYNCED'`, Enum: `'PENDING'`, `'SYNCED'`, `'FAILED'`)
* `submitted_at`: `TIMESTAMPTZ`
* `updated_at`: `TIMESTAMPTZ` (default: `NOW()`)
* *Ràng buộc:* `UNIQUE(coursework_id, student_id)`

#### 6. Entity: `attendances` (Chuyên cần - Pure Local)
Mục đích: Quản lý danh sách điểm danh theo buổi học (Tính năng mở rộng).
* `id`: `UUID` (Primary Key, default: `gen_random_uuid()`)
* `course_id`: `UUID` (Foreign Key $\rightarrow$ `courses.id`, ON DELETE CASCADE)
* `student_id`: `UUID` (Foreign Key $\rightarrow$ `users.id`, ON DELETE CASCADE)
* `attendance_date`: `DATE` (NOT NULL) - Ngày điểm danh
* `status`: `VARCHAR(50)` (NOT NULL, Enum: `'PRESENT'`, `'ABSENT_UNEXCUSED'`, `'ABSENT_EXCUSED'`, `'LATE'`)
* `note`: `TEXT` - Ghi chú (VD: Lý do nghỉ)
* `created_by`: `UUID` (Foreign Key $\rightarrow$ `users.id`) - Giáo viên thực hiện điểm danh
* `created_at`: `TIMESTAMPTZ` (default: `NOW()`)
* *Ràng buộc:* `UNIQUE(course_id, student_id, attendance_date)`

#### 7. Entity: `sync_logs` (Nhật ký đồng bộ)
Mục đích: Giám sát lịch sử đồng bộ dữ liệu với Google API để phục vụ Debug/Bảo trì.
* `id`: `UUID` (Primary Key, default: `gen_random_uuid()`)
* `course_id`: `UUID` (Foreign Key $\rightarrow$ `courses.id`, ON DELETE CASCADE)
* `sync_type`: `VARCHAR(50)` (Enum: `'MANUAL'`, `'SCHEDULED_CRON'`)
* `status`: `VARCHAR(50)` (Enum: `'SUCCESS'`, `'FAILED'`, `'PARTIAL'`)
* `message`: `TEXT` - Chi tiết lỗi (nếu có)
* `executed_at`: `TIMESTAMPTZ` (default: `NOW()`)

---

### 4.2. Yêu cầu Bảo mật Dữ liệu (Supabase Row Level Security - RLS Rules)

Để đảm bảo nguyên tắc phân quyền dữ liệu an toàn trên Supabase:
1. **Bảng `attendances` & `submissions` (Ghi điểm):**
   * **Teacher:** Quản lý toàn bộ dữ liệu thuộc lớp học do mình sở hữu (`owner_id = auth.uid()`).
   * **Student:** Chỉ có quyền đọc (`SELECT`) bản ghi liên quan đến chính `student_id = auth.uid()`.
2. **Bảng `users`:**
   * User chỉ được phép cập nhật (`UPDATE`) thông tin cá nhân của chính mình.