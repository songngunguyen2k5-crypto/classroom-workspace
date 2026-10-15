import { supabaseAdmin } from '../config/supabase.js';
import { getClassroomClientForUser } from './classroom.client.js';
import { AppError } from '../middlewares/errorHandler.js';

// ============================================================================
// CourseworkService: Nghiệp vụ bài tập, chấm điểm 2 chiều và phân tích GPA
// ============================================================================

/**
 * Xác định vai trò của người dùng trong một lớp học cụ thể:
 * - 'TEACHER': Nếu user là chủ sở hữu lớp (owner_id) hoặc có role_in_course = 'TEACHER'
 * - 'STUDENT': Các trường hợp còn lại
 */
export const getCourseUserRole = async (
  courseId: string,
  userId: string
): Promise<'TEACHER' | 'STUDENT'> => {
  const { data: course } = await supabaseAdmin
    .from('courses')
    .select('owner_id')
    .eq('id', courseId)
    .single();

  if (course && course.owner_id === userId) {
    return 'TEACHER';
  }

  const { data: member } = await supabaseAdmin
    .from('course_members')
    .select('role_in_course')
    .eq('course_id', courseId)
    .eq('user_id', userId)
    .single();

  if (member && member.role_in_course === 'TEACHER') {
    return 'TEACHER';
  }

  return 'STUDENT';
};

/**
 * 1. Lấy thông tin chi tiết lớp học kèm toàn bộ thành viên
 */
export const getCourseDetailWithMembers = async (courseId: string) => {
  const { data: course, error: courseErr } = await supabaseAdmin
    .from('courses')
    .select('*')
    .eq('id', courseId)
    .single();

  if (courseErr || !course) {
    throw new AppError('Không tìm thấy lớp học trong cơ sở dữ liệu.', 404);
  }

  // Lấy toàn bộ thành viên kèm thông tin user
  const { data: members, error: memErr } = await supabaseAdmin
    .from('course_members')
    .select(`
      id,
      role_in_course,
      joined_at,
      users (id, full_name, email, avatar_url, role)
    `)
    .eq('course_id', courseId);

  if (memErr) {
    throw new AppError(`Lỗi khi lấy danh sách thành viên: ${memErr.message}`, 500);
  }

  const teachers = (members || [])
    .filter((m: any) => m.role_in_course === 'TEACHER')
    .map((m: any) => m.users);

  const students = (members || [])
    .filter((m: any) => m.role_in_course === 'STUDENT')
    .map((m: any) => m.users);

  return {
    course,
    teachers,
    students,
    total_students: students.length,
    total_teachers: teachers.length,
  };
};

/**
 * 2. Lấy danh sách bài tập của lớp học kèm số liệu thống kê nộp bài
 */
export const getCourseworkList = async (courseId: string) => {
  const { data: courseworks, error } = await supabaseAdmin
    .from('coursework')
    .select('*')
    .eq('course_id', courseId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new AppError(`Lỗi khi lấy danh sách bài tập: ${error.message}`, 500);
  }

  // Đếm số lượng học sinh trong lớp
  const { count: studentCount } = await supabaseAdmin
    .from('course_members')
    .select('*', { count: 'exact', head: true })
    .eq('course_id', courseId)
    .eq('role_in_course', 'STUDENT');

  // Đính kèm thống kê bài nộp & tài liệu cho từng bài tập
  const cwIds = (courseworks || []).map((cw) => cw.id);
  const materialsMap = new Map<string, any[]>();
  try {
    if (cwIds.length > 0) {
      const { data: mats } = await supabaseAdmin
        .from('coursework_materials')
        .select('*')
        .in('coursework_id', cwIds)
        .order('created_at', { ascending: true });
      (mats || []).forEach((m) => {
        const list = materialsMap.get(m.coursework_id) || [];
        list.push(m);
        materialsMap.set(m.coursework_id, list);
      });
    }
  } catch (err) {
    // Không làm gián đoạn nếu bảng chưa tạo
  }

  const items = await Promise.all(
    (courseworks || []).map(async (cw) => {
      const { data: subs } = await supabaseAdmin
        .from('submissions')
        .select('state, assigned_grade')
        .eq('coursework_id', cw.id);

      const turnedInCount = (subs || []).filter(
        (s) => s.state === 'TURNED_IN' || s.state === 'RETURNED'
      ).length;

      const gradedCount = (subs || []).filter(
        (s) => s.assigned_grade !== null && s.assigned_grade !== undefined
      ).length;

      return {
        ...cw,
        total_students: studentCount || 0,
        turned_in_count: turnedInCount,
        graded_count: gradedCount,
        materials: materialsMap.get(cw.id) || [],
      };
    })
  );

  return items;
};

/**
 * 2.1. Lấy chi tiết một bài tập kèm danh sách tài liệu đính kèm (Materials)
 */
export const getCourseworkDetail = async (courseId: string, courseworkId: string) => {
  const { data: cw, error } = await supabaseAdmin
    .from('coursework')
    .select('*')
    .eq('id', courseworkId)
    .eq('course_id', courseId)
    .single();

  if (error || !cw) {
    throw new AppError('Không tìm thấy bài tập yêu cầu.', 404);
  }

  let materials: any[] = [];
  try {
    const { data: mats, error: matErr } = await supabaseAdmin
      .from('coursework_materials')
      .select('*')
      .eq('coursework_id', courseworkId)
      .order('created_at', { ascending: true });
    if (!matErr && mats) {
      materials = mats;
    }
  } catch (err) {
    // Fallback nếu có lỗi
  }

  return {
    ...cw,
    materials,
  };
};

/**
 * 3. Lấy danh sách bài nộp và điểm của học sinh cho một bài tập cụ thể
 */
export const getCourseworkSubmissions = async (
  courseId: string,
  courseworkId: string,
  userId?: string,
  userRole: 'TEACHER' | 'STUDENT' = 'TEACHER'
) => {
  // Lấy thông tin bài tập
  const { data: cw, error: cwErr } = await supabaseAdmin
    .from('coursework')
    .select('*')
    .eq('id', courseworkId)
    .eq('course_id', courseId)
    .single();

  if (cwErr || !cw) {
    throw new AppError('Không tìm thấy bài tập.', 404);
  }

  // Lấy toàn bộ sinh viên trong lớp
  const { data: members } = await supabaseAdmin
    .from('course_members')
    .select(`users (id, full_name, email, avatar_url)`)
    .eq('course_id', courseId)
    .eq('role_in_course', 'STUDENT');

  // Lấy bài nộp hiện có trong DB
  const { data: submissions } = await supabaseAdmin
    .from('submissions')
    .select('*')
    .eq('coursework_id', courseworkId);

  const subMap = new Map<string, any>();
  submissions?.forEach((s) => subMap.set(s.student_id, s));

  // Ghép toàn bộ sinh viên (dù chưa nộp bài cũng hiển thị để giáo viên theo dõi)
  const results = (members || []).map((m: any) => {
    const student = m.users;
    const sub = subMap.get(student.id);

    return {
      submission_id: sub?.id || null,
      google_submission_id: sub?.google_submission_id || null,
      student_id: student.id,
      student_name: student.full_name,
      student_email: student.email,
      student_avatar: student.avatar_url,
      state: sub?.state || 'NEW',
      assigned_grade: sub?.assigned_grade !== undefined ? sub.assigned_grade : null,
      max_points: cw.max_points,
      sync_status: sub?.sync_status || 'PENDING',
      submitted_at: sub?.submitted_at || null,
    };
  });

  // Nếu là HỌC SINH, chỉ trả về bài nộp của chính mình
  const filteredSubmissions =
    userRole === 'STUDENT' && userId
      ? results.filter((r) => r.student_id === userId)
      : results;

  return {
    coursework: cw,
    submissions: filteredSubmissions,
  };
};

/**
 * 4. Chấm điểm sinh viên & Đẩy điểm 2 chiều (Write-Through) lên Google Classroom
 */
export const gradeSubmission = async (
  courseId: string,
  submissionId: string,
  grade: number,
  teacherId: string
) => {
  // Xác thực quyền Giảng viên trong lớp
  const role = await getCourseUserRole(courseId, teacherId);
  if (role !== 'TEACHER') {
    throw new AppError('Bạn không có quyền thực hiện hành động này. Yêu cầu quyền Giảng viên.', 403);
  }
  // 1. Lấy thông tin submission và bài tập liên quan
  const { data: sub, error: subErr } = await supabaseAdmin
    .from('submissions')
    .select(`
      id,
      google_submission_id,
      state,
      coursework_id,
      coursework (id, google_coursework_id, course_id, max_points, courses (id, google_course_id))
    `)
    .eq('id', submissionId)
    .single();

  if (subErr || !sub) {
    throw new AppError('Không tìm thấy bài nộp để chấm điểm.', 404);
  }

  const cw: any = sub.coursework;
  const course: any = cw.courses;

  if (grade < 0 || grade > (cw.max_points || 100)) {
    throw new AppError(`Điểm số phải nằm trong khoảng từ 0 đến ${cw.max_points || 100}.`, 400);
  }

  // 2. Cập nhật điểm số vào CSDL Supabase (Local-First: Phản hồi tức thì)
  const { data: updatedSub, error: updateErr } = await supabaseAdmin
    .from('submissions')
    .update({
      assigned_grade: grade,
      state: 'RETURNED', // Trạng thái đã trả bài sau khi chấm
      sync_status: 'SYNCED',
      updated_at: new Date().toISOString(),
    })
    .eq('id', submissionId)
    .select()
    .single();

  if (updateErr) {
    throw new AppError(`Lỗi khi lưu điểm vào DB: ${updateErr.message}`, 500);
  }

  // 3. Đẩy điểm đồng bộ lên Google Classroom API (Write-Through Pattern)
  try {
    const classroom = await getClassroomClientForUser(teacherId);

    await classroom.courses.courseWork.studentSubmissions.patch({
      courseId: course.google_course_id,
      courseWorkId: cw.google_coursework_id,
      id: sub.google_submission_id,
      updateMask: 'assignedGrade,draftGrade',
      requestBody: {
        assignedGrade: grade,
        draftGrade: grade,
      },
    });

    console.log(`[GradeService] ✅ Đã đồng bộ điểm (${grade}) lên Google Classroom thành công!`);
  } catch (googleError: any) {
    console.error('[GradeService] ⚠️ Lỗi khi đẩy điểm lên Google Classroom:', googleError.message);
    // Nếu Google API lỗi, cập nhật trạng thái PENDING để sync lại sau
    await supabaseAdmin
      .from('submissions')
      .update({ sync_status: 'PENDING' })
      .eq('id', submissionId);
  }

  return updatedSub;
};

/**
 * 5. Thống kê toàn diện lớp học (GPA lớp, tỷ lệ nộp bài, cảnh báo rủi ro)
 */
export const getCourseAnalytics = async (
  courseId: string,
  userId?: string,
  userRole: 'TEACHER' | 'STUDENT' = 'TEACHER'
) => {
  // 1. Lấy danh sách học sinh
  const { data: members } = await supabaseAdmin
    .from('course_members')
    .select(`users (id, full_name, email, avatar_url)`)
    .eq('course_id', courseId)
    .eq('role_in_course', 'STUDENT');

  const students = (members || []).map((m: any) => m.users).filter(Boolean);
  const totalStudents = students.length;

  // 2. Lấy toàn bộ bài tập
  const { data: courseworks } = await supabaseAdmin
    .from('coursework')
    .select('id, title, max_points')
    .eq('course_id', courseId);

  const totalAssignments = (courseworks || []).length;
  const cwIds = (courseworks || []).map((cw) => cw.id);

  // 3. Lấy toàn bộ điểm bài nộp
  let submissions: any[] = [];
  if (cwIds.length > 0) {
    const { data: subData } = await supabaseAdmin
      .from('submissions')
      .select('student_id, assigned_grade, coursework_id, state')
      .in('coursework_id', cwIds);
    submissions = subData || [];
  }

  // 4. Lấy dữ liệu điểm danh
  const { data: attendances } = await supabaseAdmin
    .from('attendances')
    .select('student_id, status, attendance_date')
    .eq('course_id', courseId);

  const uniqueDates = new Set((attendances || []).map((a) => a.attendance_date));
  const totalSessions = uniqueDates.size;

  // 5. Tính toán chỉ số cho từng học sinh
  let classTotalGrade = 0;
  let gradedCount = 0;

  const studentAnalytics = students.map((st: any) => {
    // Điểm bài tập của học sinh
    const mySubs = submissions.filter((s) => s.student_id === st.id);
    const validGrades = mySubs
      .filter((s) => s.assigned_grade !== null && s.assigned_grade !== undefined)
      .map((s) => Number(s.assigned_grade));

    const avgGrade =
      validGrades.length > 0
        ? Number((validGrades.reduce((a, b) => a + b, 0) / validGrades.length).toFixed(1))
        : null;

    if (avgGrade !== null) {
      classTotalGrade += avgGrade;
      gradedCount++;
    }

    const turnedInCount = mySubs.filter(
      (s) => s.state === 'TURNED_IN' || s.state === 'RETURNED'
    ).length;

    // Chuyên cần của học sinh
    const myAtt = (attendances || []).filter((a) => a.student_id === st.id);
    const unexcused = myAtt.filter((a) => a.status === 'ABSENT_UNEXCUSED').length;
    const excused = myAtt.filter((a) => a.status === 'ABSENT_EXCUSED').length;
    const late = myAtt.filter((a) => a.status === 'LATE').length;
    const absenceScore = unexcused + excused + late * 0.5;
    const absenceRate = totalSessions > 0 ? Math.round((absenceScore / totalSessions) * 100) : 0;

    // Cảnh báo: Vắng >= 20% hoặc có điểm trung bình < 50
    const isAttendanceWarning = totalSessions >= 3 && (absenceRate >= 20 || unexcused >= 3);
    const isAcademicWarning = avgGrade !== null && avgGrade < 50;

    const reasons: string[] = [];
    if (isAttendanceWarning) reasons.push('Nguy cơ cấm thi do vắng nhiều');
    if (isAcademicWarning) reasons.push('Điểm trung bình dưới chuẩn (< 50%)');

    return {
      student: st,
      avg_grade: avgGrade,
      turned_in_count: turnedInCount,
      total_assignments: totalAssignments,
      absence_rate: absenceRate,
      unexcused_absences: unexcused,
      is_warning: isAttendanceWarning || isAcademicWarning,
      warning_reasons: reasons,
    };
  });

  const classGpa = gradedCount > 0 ? Number((classTotalGrade / gradedCount).toFixed(1)) : 0;

  // Nếu là HỌC SINH, chỉ trả về dữ liệu cá nhân của chính mình
  const filteredStudents =
    userRole === 'STUDENT' && userId
      ? studentAnalytics.filter((s) => s.student.id === userId)
      : studentAnalytics;

  return {
    course_id: courseId,
    total_students: totalStudents,
    total_assignments: totalAssignments,
    total_sessions: totalSessions,
    class_gpa: classGpa,
    at_risk_count: studentAnalytics.filter((s) => s.is_warning).length,
    students: filteredStudents,
  };
};
