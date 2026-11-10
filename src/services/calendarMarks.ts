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

export function latestAbsenceLabel(requests: StoredRequest[], attendance: StoredAttendance[], student: string, today: string): string {
  const dates = [
    ...requests.filter(item => item.student === student && item.kind === 'absence' && item.status === 'approved').map(item => item.date),
    ...attendance.filter(item => item.student === student && item.status === 'absent').map(item => item.date),
  ];
  const latest = dates.filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= today).reduce((current, date) => date > current ? date : current, '');
  if (!latest) return '—';
  const [, month, day] = latest.split('-').map(Number);
  return `${month}.${day}`;
}
