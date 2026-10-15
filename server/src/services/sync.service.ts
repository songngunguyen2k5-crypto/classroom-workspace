import { getClassroomClientForUser } from './classroom.client.js';
import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middlewares/errorHandler.js';
import type { CourseEntity } from '../types/index.js';

// ============================================================================
// SyncService: Toàn bộ nghiệp vụ đồng bộ dữ liệu với Google Classroom API
// ============================================================================

/**
 * 1. Đồng bộ danh sách các khóa học mà người dùng làm giảng viên (TEACHER)
 */
export const syncTeacherCourses = async (userId: string): Promise<CourseEntity[]> => {
  const classroom = await getClassroomClientForUser(userId);

  // Lấy các lớp học đang hoạt động từ Google Classroom
  const { data } = await classroom.courses.list({
    teacherId: 'me',
    courseStates: ['ACTIVE'],
  });

  const googleCourses = data.courses || [];
  if (googleCourses.length === 0) {
    return [];
  }

  // Chuẩn bị dữ liệu để Upsert vào Supabase
  const coursesToUpsert = googleCourses.map((c) => ({
    google_course_id: c.id as string,
    name: c.name || 'Lớp học không tên',
    section: c.section || null,
    room: c.room || null,
    owner_id: userId,
    is_synced: true,
    updated_at: new Date().toISOString(),
  }));

  const { data: upserted, error } = await supabaseAdmin
    .from('courses')
    .upsert(coursesToUpsert, { onConflict: 'google_course_id' })
    .select();

  if (error) {
    throw new AppError(`Lỗi khi lưu danh sách khóa học vào DB: ${error.message}`, 500);
  }

  const coursesList = (upserted || []) as CourseEntity[];

  // Tự động đồng bộ thành viên (roster) cho các lớp học để cập nhật ngay sĩ số
  for (const c of coursesList) {
    try {
      await syncCourseRoster(c.id, userId);
    } catch (rosterErr) {
      console.warn(`[SyncService] Không thể tự động đồng bộ roster cho lớp ${c.name}:`, rosterErr);
    }
  }

  return coursesList;
};

/**
 * 2. Đồng bộ danh sách thành viên (Giảng viên & Học sinh) của 1 lớp học
 */
export const syncCourseRoster = async (courseId: string, userId: string) => {
  const classroom = await getClassroomClientForUser(userId);

  // Lấy thông tin lớp học từ DB
  const { data: course, error: courseErr } = await supabaseAdmin
    .from('courses')
    .select('id, google_course_id, name')
    .eq('id', courseId)
    .single();

  if (courseErr || !course) {
    throw new AppError('Không tìm thấy lớp học trong cơ sở dữ liệu.', 404);
  }

  // Kéo danh sách học sinh từ Google Classroom
  const { data: studentsData } = await classroom.courses.students.list({
    courseId: course.google_course_id,
  });
  const students = studentsData.students || [];

  // Kéo danh sách giảng viên từ Google Classroom
  const { data: teachersData } = await classroom.courses.teachers.list({
    courseId: course.google_course_id,
  });
  const teachers = teachersData.teachers || [];

  // Upsert tài khoản học sinh vào bảng users và course_members
  for (const st of students) {
    const studentGoogleId = st.userId || st.profile?.id;
    if (!studentGoogleId) continue;

    const studentName = st.profile?.name?.fullName || st.profile?.name?.givenName || 'Sinh viên';
    // Nếu Google không trả về emailAddress (chính sách bảo mật tài khoản cá nhân), tạo email định danh duy nhất
    const studentEmail = st.profile?.emailAddress || `${studentGoogleId}@classroom.google.com`;
    const studentAvatar = st.profile?.photoUrl || null;

    // Upsert User
    const { data: studentUser, error: uErr } = await supabaseAdmin
      .from('users')
      .upsert(
        {
          google_id: studentGoogleId,
          email: studentEmail,
          full_name: studentName,
          avatar_url: studentAvatar,
          role: 'STUDENT',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'google_id' }
      )
      .select('id')
      .single();

    if (uErr) {
      console.warn(`[SyncService] Lỗi upsert student ${studentName}:`, uErr.message);
    }

    if (studentUser) {
      // Upsert vào course_members
      await supabaseAdmin.from('course_members').upsert(
        {
          course_id: course.id,
          user_id: studentUser.id,
          role_in_course: 'STUDENT',
        },
        { onConflict: 'course_id,user_id' }
      );
    }
  }

  // Upsert giảng viên vào course_members
  for (const tc of teachers) {
    const teacherGoogleId = tc.userId || tc.profile?.id;
    if (!teacherGoogleId) continue;

    const teacherName = tc.profile?.name?.fullName || tc.profile?.name?.givenName || 'Giảng viên';
    const teacherEmail = tc.profile?.emailAddress || `${teacherGoogleId}@classroom.google.com`;
    const teacherAvatar = tc.profile?.photoUrl || null;

    const { data: teacherUser } = await supabaseAdmin
      .from('users')
      .upsert(
        {
          google_id: teacherGoogleId,
          email: teacherEmail,
          full_name: teacherName,
          avatar_url: teacherAvatar,
          role: 'TEACHER',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'google_id' }
      )
      .select('id')
      .single();

    if (teacherUser) {
      await supabaseAdmin.from('course_members').upsert(
        {
          course_id: course.id,
          user_id: teacherUser.id,
          role_in_course: 'TEACHER',
        },
        { onConflict: 'course_id,user_id' }
      );
    }
  }

  return {
    studentCount: students.length,
    teacherCount: teachers.length,
  };
};

/**
 * 3. Đồng bộ danh sách bài tập (Coursework) của 1 lớp học
 */
export const syncCourseWork = async (courseId: string, userId: string) => {
  const classroom = await getClassroomClientForUser(userId);

  const { data: course, error: courseErr } = await supabaseAdmin
    .from('courses')
    .select('id, google_course_id')
    .eq('id', courseId)
    .single();

  if (courseErr || !course) {
    throw new AppError('Không tìm thấy lớp học trong cơ sở dữ liệu.', 404);
  }

  // Kéo danh sách bài tập từ Google Classroom
  const { data } = await classroom.courses.courseWork.list({
    courseId: course.google_course_id,
  });

  const courseWorkList = data.courseWork || [];
  if (courseWorkList.length === 0) {
    return [];
  }

  const itemsToUpsert = courseWorkList.map((cw) => {
    // Xử lý hạn nộp nếu có
    let dueDateStr: string | null = null;
    if (cw.dueDate) {
      const year = cw.dueDate.year || 2026;
      const month = String(cw.dueDate.month || 1).padStart(2, '0');
      const day = String(cw.dueDate.day || 1).padStart(2, '0');
      const hours = String(cw.dueTime?.hours || 23).padStart(2, '0');
      const minutes = String(cw.dueTime?.minutes || 59).padStart(2, '0');
      dueDateStr = new Date(`${year}-${month}-${day}T${hours}:${minutes}:00Z`).toISOString();
    }

    return {
      google_coursework_id: cw.id as string,
      course_id: course.id,
      title: cw.title || 'Bài tập không tiêu đề',
      description: cw.description || '',
      max_points: cw.maxPoints || 100,
      due_date: dueDateStr,
      work_type: cw.workType || 'ASSIGNMENT',
      updated_at: new Date().toISOString(),
    };
  });

  const { data: upserted, error } = await supabaseAdmin
    .from('coursework')
    .upsert(itemsToUpsert, { onConflict: 'google_coursework_id' })
    .select();

  if (error) {
    throw new AppError(`Lỗi khi lưu bài tập vào DB: ${error.message}`, 500);
  }

  // Bóc tách và đồng bộ tài liệu đính kèm (Materials)
  try {
    const cwMap = new Map<string, string>();
    (upserted || []).forEach((c) => cwMap.set(c.google_coursework_id, c.id));

    const allMaterials: Array<{
      coursework_id: string;
      material_type: 'drive_file' | 'youtube_video' | 'link' | 'form';
      title: string;
      url: string;
      thumbnail_url: string | null;
    }> = [];

    courseWorkList.forEach((cw) => {
      const localCwId = cwMap.get(cw.id as string);
      if (!localCwId || !cw.materials || !Array.isArray(cw.materials)) return;

      cw.materials.forEach((mat: any) => {
        if (mat.driveFile) {
          allMaterials.push({
            coursework_id: localCwId,
            material_type: 'drive_file',
            title: mat.driveFile.driveFile?.title || 'Tệp Google Drive',
            url: mat.driveFile.driveFile?.alternateLink || '',
            thumbnail_url: mat.driveFile.driveFile?.thumbnailUrl || null,
          });
        } else if (mat.youtubeVideo) {
          const ytUrl =
            mat.youtubeVideo.alternateLink ||
            (mat.youtubeVideo.id ? `https://www.youtube.com/watch?v=${mat.youtubeVideo.id}` : '');
          const ytThumb =
            mat.youtubeVideo.thumbnailUrl ||
            (mat.youtubeVideo.id ? `https://img.youtube.com/vi/${mat.youtubeVideo.id}/hqdefault.jpg` : null);

          allMaterials.push({
            coursework_id: localCwId,
            material_type: 'youtube_video',
            title: mat.youtubeVideo.title || 'Video YouTube',
            url: ytUrl,
            thumbnail_url: ytThumb,
          });
        } else if (mat.link) {
          const linkUrl = mat.link.url || '';
          const isYt = linkUrl.includes('youtube.com') || linkUrl.includes('youtu.be');

          allMaterials.push({
            coursework_id: localCwId,
            material_type: isYt ? 'youtube_video' : 'link',
            title: mat.link.title || linkUrl || (isYt ? 'Video YouTube' : 'Liên kết ngoài'),
            url: linkUrl,
            thumbnail_url: mat.link.thumbnailUrl || null,
          });
        } else if (mat.form) {
          allMaterials.push({
            coursework_id: localCwId,
            material_type: 'form',
            title: mat.form.title || 'Biểu mẫu Google Forms',
            url: mat.form.formUrl || '',
            thumbnail_url: mat.form.thumbnailUrl || null,
          });
        }
      });
    });

    const cwIds = (upserted || []).map((c) => c.id);
    if (cwIds.length > 0) {
      await supabaseAdmin.from('coursework_materials').delete().in('coursework_id', cwIds);
      if (allMaterials.length > 0) {
        const { error: matErr } = await supabaseAdmin.from('coursework_materials').insert(allMaterials);
        if (matErr) {
          console.warn('⚠️ Cảnh báo: Không thể lưu coursework_materials (có thể bảng chưa được tạo):', matErr.message);
        } else {
          console.log(`[Sync] ✅ Đã lưu ${allMaterials.length} tài liệu đính kèm cho ${cwIds.length} bài tập.`);
        }
      }
    }
  } catch (matErr: any) {
    console.warn('⚠️ Lỗi phụ khi đồng bộ tài liệu đính kèm:', matErr.message);
  }

  return upserted;
};

/**
 * 4. Đồng bộ bài nộp & điểm số (Submissions) của học sinh cho toàn bộ bài tập trong lớp
 */
export const syncCourseSubmissions = async (courseId: string, userId: string) => {
  const classroom = await getClassroomClientForUser(userId);

  const { data: course, error: courseErr } = await supabaseAdmin
    .from('courses')
    .select('id, google_course_id')
    .eq('id', courseId)
    .single();

  if (courseErr || !course) {
    throw new AppError('Không tìm thấy lớp học trong cơ sở dữ liệu.', 404);
  }

  // Kéo toàn bộ bài nộp của lớp học (dùng courseWorkId: '-')
  const { data } = await classroom.courses.courseWork.studentSubmissions.list({
    courseId: course.google_course_id,
    courseWorkId: '-',
  });

  const submissions = data.studentSubmissions || [];
  if (submissions.length === 0) {
    return { syncedCount: 0 };
  }

  // Lấy bản đồ mapping: google_coursework_id -> local coursework.id
  const { data: localCourseworks } = await supabaseAdmin
    .from('coursework')
    .select('id, google_coursework_id')
    .eq('course_id', course.id);

  const cwMap = new Map<string, string>();
  localCourseworks?.forEach((cw) => cwMap.set(cw.google_coursework_id, cw.id));

  // Lấy bản đồ mapping: google_id -> local users.id
  const { data: localUsers } = await supabaseAdmin
    .from('users')
    .select('id, google_id');

  const userMap = new Map<string, string>();
  localUsers?.forEach((u) => userMap.set(u.google_id, u.id));

  const submissionsToUpsert = [];
  for (const sub of submissions) {
    const localCwId = cwMap.get(sub.courseWorkId || '');
    const localStudentId = userMap.get(sub.userId || '');

    if (!localCwId || !localStudentId || !sub.id) continue;

    submissionsToUpsert.push({
      google_submission_id: sub.id,
      coursework_id: localCwId,
      student_id: localStudentId,
      state: sub.state || 'NEW',
      assigned_grade: sub.assignedGrade !== undefined ? sub.assignedGrade : null,
      sync_status: 'SYNCED',
      submitted_at: sub.updateTime || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  if (submissionsToUpsert.length > 0) {
    const { error } = await supabaseAdmin
      .from('submissions')
      .upsert(submissionsToUpsert, { onConflict: 'google_submission_id' });

    if (error) {
      console.error('[SyncService] Lỗi upsert submissions:', error.message);
    }
  }

  return { syncedCount: submissionsToUpsert.length };
};

/**
 * 4.5. Đồng bộ Bảng tin thông báo (Announcements) & Tự động trích xuất Google Meet
 */
export const syncAnnouncements = async (courseId: string, userId: string) => {
  const classroom = await getClassroomClientForUser(userId);

  const { data: course, error: courseErr } = await supabaseAdmin
    .from('courses')
    .select('id, google_course_id, users:owner_id(full_name, avatar_url)')
    .eq('id', courseId)
    .single();

  if (courseErr || !course) {
    throw new AppError('Không tìm thấy lớp học trong cơ sở dữ liệu.', 404);
  }

  try {
    const { data } = await classroom.courses.announcements.list({
      courseId: course.google_course_id,
    });

    const announcementsList = data.announcements || [];
    if (announcementsList.length === 0) {
      return [];
    }

    const extractMeet = (text: string, materials?: any[]): string | null => {
      const match = text?.match(/https:\/\/meet\.google\.com\/[a-zA-Z0-9?&=_-]+/i);
      if (match) return match[0];
      if (materials && Array.isArray(materials)) {
        for (const m of materials) {
          if (m.link?.url && /https:\/\/meet\.google\.com/i.test(m.link.url)) {
            return m.link.url;
          }
        }
      }
      return null;
    };

    const owner = (course.users as any) || {};

    const itemsToUpsert = announcementsList.map((ann) => ({
      google_announcement_id: ann.id as string,
      course_id: course.id,
      text: ann.text || '',
      creator_name: owner.full_name || 'Giảng viên',
      creator_avatar: owner.avatar_url || null,
      meet_link: extractMeet(ann.text || '', ann.materials),
      created_at: ann.creationTime || new Date().toISOString(),
      updated_at: ann.updateTime || new Date().toISOString(),
    }));

    const { data: upserted, error } = await supabaseAdmin
      .from('announcements')
      .upsert(itemsToUpsert, { onConflict: 'google_announcement_id' })
      .select();

    if (error) {
      console.warn('⚠️ Cảnh báo: Không thể lưu announcements (có thể bảng chưa được tạo):', error.message);
      return [];
    }

    console.log(`[Sync] ✅ Đã lưu ${upserted?.length || 0} thông báo bảng tin cho lớp ${course.id}.`);
    return upserted || [];
  } catch (err: any) {
    console.warn('⚠️ Lỗi phụ khi đồng bộ announcements từ Google Classroom API:', err.message);
    return [];
  }
};

/**
 * 5. Chuỗi đồng bộ toàn diện cho 1 lớp học (Roster -> Coursework -> Submissions -> Announcements) + Ghi log
 */
export const syncFullCourse = async (
  courseId: string,
  userId: string,
  syncType: 'MANUAL' | 'SCHEDULED_CRON' = 'MANUAL'
) => {
  try {
    // 1. Đồng bộ thành viên (Roster)
    const rosterResult = await syncCourseRoster(courseId, userId);

    // 2. Đồng bộ bài tập (Coursework)
    const courseworkList = await syncCourseWork(courseId, userId);

    // 3. Đồng bộ bài nộp và điểm số (Submissions)
    const submissionsResult = await syncCourseSubmissions(courseId, userId);

    // 4. Đồng bộ bảng tin thông báo (Announcements)
    const announcementsList = await syncAnnouncements(courseId, userId);

    // 5. Ghi vết thành công vào bảng sync_logs
    await supabaseAdmin.from('sync_logs').insert({
      course_id: courseId,
      sync_type: syncType,
      status: 'SUCCESS',
      message: `Đồng bộ thành công: ${rosterResult.studentCount} học sinh, ${courseworkList.length} bài tập, ${submissionsResult.syncedCount} bài nộp, ${announcementsList.length} thông báo.`,
      executed_at: new Date().toISOString(),
    });

    return {
      success: true,
      roster: rosterResult,
      courseworkCount: courseworkList.length,
      submissionsCount: submissionsResult.syncedCount,
      announcementsCount: announcementsList.length,
    };
  } catch (error: any) {
    // Ghi vết lỗi vào bảng sync_logs
    await supabaseAdmin.from('sync_logs').insert({
      course_id: courseId,
      sync_type: syncType,
      status: 'FAILED',
      message: error.message || 'Lỗi không xác định khi đồng bộ',
      executed_at: new Date().toISOString(),
    });

    throw error;
  }
};
