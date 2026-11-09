import type { CalendarMarks, CalendarStatus } from '../components/Calendar';
import type { StoredAttendance, StoredRequest } from '../store/Classes';

export function attendanceCalendarMarks(requests: StoredRequest[], attendance: StoredAttendance[], teacher: boolean, student: string): CalendarMarks {
  const marks: CalendarMarks = {};
  const add = (date: string, status: CalendarStatus) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    const day = marks[date] ??= [];
    if (!day.includes(status)) day.push(status);
  };
  requests.forEach(request => {
    if (!teacher && request.student !== student) return;
    if (request.status === 'approved') add(request.date, request.kind === 'absence' ? 'absence' : 'makeup');
    else if (request.status === 'pending' && request.kind === 'makeup') add(request.date, 'pending');
  });
  attendance.forEach(item => {
    if (teacher || item.student === student) add(item.date, item.status === 'present' ? 'attendance' : 'absence');
  });
  return marks;
}
