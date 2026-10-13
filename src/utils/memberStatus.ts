import type { AttendanceRecord, Member } from '../types';

export function getMemberAttendanceCount(
  member: Member,
  attendanceRecords: AttendanceRecord[] = [],
): number {
  const recordedVisits = attendanceRecords.filter(record =>
    record.memberId === member.id &&
    (!record.church || record.church.toLowerCase() === member.church.toLowerCase()),
  ).length;

  return Math.max(recordedVisits, Number.isFinite(member.serviceCount) ? member.serviceCount : 0);
}

export function isFirstTimer(
  member: Member,
  attendanceRecords: AttendanceRecord[] = [],
): boolean {
  return getMemberAttendanceCount(member, attendanceRecords) < 2;
}
