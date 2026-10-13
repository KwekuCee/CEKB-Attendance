import * as XLSX from 'xlsx';
import type { AttendanceRecord, ChurchAdminAccount, ChurchBranch, Leader, Member } from '../types';
import { csvQ, neutralizeCell } from './csvSafe';
import { isFirstTimer } from './memberStatus';

export interface ExportDataPayload {
  churches: ChurchBranch[];
  churchAdmins: ChurchAdminAccount[];
  members: Member[];
  leaders: Leader[];
  attendanceRecords: AttendanceRecord[];
}

export interface AggregateReportOptions {
  attendanceDate?: string;
  serviceType?: string;
  churchScope?: string;
  filenamePrefix?: string;
}

interface ChurchAggregate {
  church: ChurchBranch;
  members: Member[];
  attendance: AttendanceRecord[];
  presentIds: Set<string>;
  serviceSummary: Array<[string, string, number]>;
  memberLeaderSummary: Array<[string, number]>;
  leaderSummary: Array<[string, number]>;
  leaderTypeGrowth: Array<[string, number]>;
  leaderTypeMonthlyGrowth: Array<[string, string, number]>;
  monthlyGrowth: Array<[string, number, number]>;
  arrivalHours: Array<[number, number]>;
  arrivalByLeader: Array<[string, string, number]>;
  firstTimers: number;
  leadersCount: number;
}

function normalizeExportPayload(
  arg1: ExportDataPayload | Member[],
  arg2?: AttendanceRecord[] | string,
  arg3?: ChurchBranch[],
  arg4?: ChurchAdminAccount[],
  _arg5?: string,
  arg6?: Leader[],
): ExportDataPayload {
  if (!Array.isArray(arg1)) {
    return {
      churches: arg1.churches || [],
      churchAdmins: arg1.churchAdmins || [],
      members: arg1.members || [],
      leaders: arg1.leaders || [],
      attendanceRecords: arg1.attendanceRecords || [],
    };
  }
  return {
    members: arg1,
    attendanceRecords: Array.isArray(arg2) ? arg2 : [],
    churches: arg3 || [],
    churchAdmins: arg4 || [],
    leaders: arg6 || [],
  };
}

const sameChurch = (left?: string, right?: string) =>
  (left || '').trim().toLowerCase() === (right || '').trim().toLowerCase();

function memberIdForAttendance(record: AttendanceRecord, members: Member[]): string | null {
  if (record.memberId && members.some(member => member.id === record.memberId)) return record.memberId;
  const name = (record.memberName || '').trim().toLowerCase();
  return members.find(member => member.fullName.trim().toLowerCase() === name)?.id || null;
}

function attendanceHour(timestamp?: string): number | null {
  const value = timestamp || '';
  const isoTime = value.match(/T(\d{2}):(\d{2})/);
  const time = isoTime || value.match(/(\d{1,2}):(\d{2})(?:\s*(AM|PM))?/i);
  if (!time) return null;
  let hour = Number(time[1]);
  const meridiem = time[3]?.toUpperCase();
  if (meridiem === 'PM' && hour < 12) hour += 12;
  if (meridiem === 'AM' && hour === 12) hour = 0;
  return hour >= 0 && hour <= 23 ? hour : null;
}

function monthKey(value?: string): string {
  return value && /^\d{4}-\d{2}/.test(value) ? value.slice(0, 7) : '';
}

function getLeaderForMember(member: Member, leaders: Leader[]): Leader | undefined {
  return leaders.find(leader =>
    leader.id === member.invitedByLeaderId ||
    (!member.invitedByLeaderId && leader.fullName.toLowerCase() === (member.invitedBy || '').toLowerCase()),
  );
}

function filteredAttendance(
  records: AttendanceRecord[],
  churchName: string,
  date?: string,
  serviceType?: string,
): AttendanceRecord[] {
  return records.filter(record =>
    sameChurch(record.church, churchName) &&
    (!date || (record.date || '').slice(0, 10) === date) &&
    (!serviceType || serviceType === 'All' || record.serviceType === serviceType),
  );
}

function summarizeChurch(
  church: ChurchBranch,
  data: ExportDataPayload,
  date: string,
  serviceType?: string,
): ChurchAggregate {
  const members = data.members.filter(member => sameChurch(member.church, church.name));
  const attendance = filteredAttendance(data.attendanceRecords, church.name, date, serviceType);
  const presentIds = new Set(
    attendance.map(record => memberIdForAttendance(record, members)).filter((id): id is string => !!id),
  );
  const allVisits = data.attendanceRecords.filter(record => sameChurch(record.church, church.name));

  const services = new Map<string, number>();
  allVisits.forEach(record => {
    const key = `${(record.date || '').slice(0, 10)}|${record.serviceType || 'Unspecified service'}`;
    services.set(key, (services.get(key) || 0) + 1);
  });

  const leaders = new Map<string, Set<string>>();
  const membersByLeader = new Map<string, number>();
  members.forEach(member => {
    const leaderName = getLeaderForMember(member, data.leaders)?.fullName ||
      (member.invitedBy || '').trim() ||
      'Direct / Self';
    membersByLeader.set(leaderName, (membersByLeader.get(leaderName) || 0) + 1);
  });
  attendance.forEach((record, index) => {
    const leaderName = (record.leaderName || '').trim() || 'Direct / Self';
    const leaderMembers = leaders.get(leaderName) || new Set<string>();
    leaderMembers.add(memberIdForAttendance(record, members) || `record-${index}`);
    leaders.set(leaderName, leaderMembers);
  });

  const leaderTypeGrowth = new Map<string, number>();
  const leaderTypeByMonth = new Map<string, number>();
  members.forEach(member => {
    const leader = getLeaderForMember(member, data.leaders);
    const type = leader?.leaderType || 'Unassigned';
    leaderTypeGrowth.set(type, (leaderTypeGrowth.get(type) || 0) + 1);
    const month = monthKey(member.joinDate);
    if (month) {
      const key = `${month}|${type}`;
      leaderTypeByMonth.set(key, (leaderTypeByMonth.get(key) || 0) + 1);
    }
  });

  const monthCounts = new Map<string, number>();
  members.forEach(member => {
    const key = monthKey(member.joinDate);
    if (key) monthCounts.set(key, (monthCounts.get(key) || 0) + 1);
  });
  const monthKeys = Array.from(monthCounts.keys()).sort();
  let cumulative = 0;
  const monthlyGrowth = monthKeys.map(key => {
    const joined = monthCounts.get(key) || 0;
    cumulative += joined;
    return [key, joined, cumulative] as [string, number, number];
  });

  const hours = new Map<number, number>();
  const hoursByLeader = new Map<string, Map<number, number>>();
  attendance.forEach(record => {
    const hour = attendanceHour(record.timestamp);
    if (hour !== null) {
      hours.set(hour, (hours.get(hour) || 0) + 1);
      const leaderName = (record.leaderName || '').trim() || 'Direct / Self';
      const leaderHours = hoursByLeader.get(leaderName) || new Map<number, number>();
      leaderHours.set(hour, (leaderHours.get(hour) || 0) + 1);
      hoursByLeader.set(leaderName, leaderHours);
    }
  });

  return {
    church,
    members,
    attendance,
    presentIds,
    serviceSummary: Array.from(services.entries())
      .map(([key, count]) => {
        const [attendanceDate, service] = key.split('|');
        return [attendanceDate, service, count] as [string, string, number];
      })
      .sort((a, b) => b[0].localeCompare(a[0]) || a[1].localeCompare(b[1])),
    memberLeaderSummary: Array.from(membersByLeader.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
    leaderSummary: Array.from(leaders.entries())
      .map(([name, visits]) => [name, visits.size] as [string, number])
      .sort((a, b) => b[1] - a[1]),
    leaderTypeGrowth: Array.from(leaderTypeGrowth.entries()).sort((a, b) => b[1] - a[1]),
    leaderTypeMonthlyGrowth: Array.from(leaderTypeByMonth.entries())
      .map(([key, count]) => {
        const [month, type] = key.split('|');
        return [month, type, count] as [string, string, number];
      })
      .sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1])),
    monthlyGrowth,
    arrivalHours: Array.from(hours.entries()).sort(([a], [b]) => a - b),
    arrivalByLeader: Array.from(hoursByLeader.entries()).map(([name, byHour]) => {
      const peak = Array.from(byHour.entries()).sort((a, b) => b[1] - a[1])[0];
      return [
        name,
        `${String(peak[0] % 12 || 12).padStart(2, '0')}:00 ${peak[0] >= 12 ? 'PM' : 'AM'}`,
        peak[1],
      ] as [string, string, number];
    }).sort((a, b) => b[2] - a[2]),
    firstTimers: members.filter(member => isFirstTimer(member, data.attendanceRecords)).length,
    leadersCount: data.leaders.filter(leader => sameChurch(leader.church, church.name)).length,
  };
}

function resolveReportDate(records: AttendanceRecord[], configuredDate?: string): string {
  if (configuredDate) return configuredDate;
  const latest = records.map(record => (record.date || '').slice(0, 10)).filter(Boolean).sort().pop();
  return latest || new Date().toISOString().slice(0, 10);
}

function makeGroupRows(reports: ChurchAggregate[], date: string, serviceType?: string): unknown[][] {
  const attended = reports.reduce((sum, report) => sum + report.presentIds.size, 0);
  const members = reports.reduce((sum, report) => sum + report.members.length, 0);
  const firstTimers = reports.reduce((sum, report) => sum + report.firstTimers, 0);
  return [
    ['Group attendance and growth summary'],
    ['Reference service date', date],
    ['Service filter', serviceType || 'All services'],
    [],
    ['Registered church', 'Registered members', 'First timers (<2 visits)', 'General members', 'Present members', 'Absentees', 'Registered leaders'],
    ...reports.map(report => [
      report.church.name,
      report.members.length,
      report.firstTimers,
      report.members.length - report.firstTimers,
      report.presentIds.size,
      Math.max(0, report.members.length - report.presentIds.size),
      report.leadersCount,
    ]),
    ['GROUP TOTAL', members, firstTimers, members - firstTimers, attended, Math.max(0, members - attended), reports.reduce((sum, report) => sum + report.leadersCount, 0)],
    [],
    ['Monthly member growth', 'New members', 'Cumulative total'],
    ...combineMonthlyGrowth(reports),
  ];
}

function combineMonthlyGrowth(reports: ChurchAggregate[]): Array<[string, number, number]> {
  const counts = new Map<string, number>();
  reports.forEach(report => report.monthlyGrowth.forEach(([month, count]) => counts.set(month, (counts.get(month) || 0) + count)));
  let cumulative = 0;
  return Array.from(counts.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([month, count]) => {
    cumulative += count;
    return [month, count, cumulative];
  });
}

function makeChurchRows(
  report: ChurchAggregate,
  data: ExportDataPayload,
  date: string,
  serviceType?: string,
): unknown[][] {
  const serviceLabel = serviceType && serviceType !== 'All' ? serviceType : 'All services';
  const absenteeCount = Math.max(0, report.members.length - report.presentIds.size);
  const leaderCount = data.leaders.filter(leader => sameChurch(leader.church, report.church.name)).length;
  return [
    [`${report.church.name} — aggregate report`],
    ['Reference service date', date],
    ['Service filter', serviceLabel],
    [],
    ['Church totals', 'Count'],
    ['Registered members', report.members.length],
    ['First timers (<2 recorded attendances)', report.firstTimers],
    ['General members', report.members.length - report.firstTimers],
    ['Present members for reference date', report.presentIds.size],
    ['Absentees for reference date', absenteeCount],
    ['Registered leaders', leaderCount],
    ['Raw check-ins for reference date', report.attendance.length],
    [],
    ['Registered members by assigned leader', 'Members'],
    ...report.memberLeaderSummary,
    [],
    ['Attendance history by date and service', 'Service', 'Check-ins'],
    ...report.serviceSummary,
    [],
    ['Attendance by leader for reference date', 'Present members'],
    ...report.leaderSummary,
    [],
    ['Member counts by leader type', 'Members'],
    ...report.leaderTypeGrowth,
    [],
    ['Monthly new members by leader type', 'Leader type', 'New members'],
    ...report.leaderTypeMonthlyGrowth,
    [],
    ['Monthly church growth', 'New members', 'Cumulative members'],
    ...report.monthlyGrowth,
    [],
    ['Arrival time activity for reference date', 'Check-ins'],
    ...report.arrivalHours.map(([hour, count]) => [`${String(hour % 12 || 12).padStart(2, '0')}:00 ${hour >= 12 ? 'PM' : 'AM'}`, count]),
    [],
    ['Peak arrival time by leader for reference date', 'Peak check-in time', 'Check-ins'],
    ...report.arrivalByLeader,
  ];
}

function formulaSafeRows(rows: unknown[][]): unknown[][] {
  return rows.map(row => row.map(value => typeof value === 'string' ? neutralizeCell(value) : value));
}

function sheetName(name: string, used: Set<string>): string {
  const base = (name || 'Church').replace(/[\\/?*:[\]]/g, ' ').trim().slice(0, 25) || 'Church';
  let candidate = base;
  let suffix = 2;
  while (used.has(candidate.toLowerCase())) {
    candidate = `${base.slice(0, 27 - String(suffix).length)} ${suffix++}`;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

export function exportAggregateAnalyticsExcel(
  data: ExportDataPayload,
  options: AggregateReportOptions = {},
): void {
  const workbook = createAggregateAnalyticsWorkbook(data, options);
  const date = resolveReportDate(data.attendanceRecords, options.attendanceDate);
  const filename = options.filenamePrefix || 'CEKB_Aggregate_Attendance_Report';
  XLSX.writeFile(workbook, `${filename}_${date}.xlsx`);
}

export function createAggregateAnalyticsWorkbook(
  data: ExportDataPayload,
  options: AggregateReportOptions = {},
): XLSX.WorkBook {
  const date = resolveReportDate(data.attendanceRecords, options.attendanceDate);
  const churches = data.churches.filter(church =>
    !options.churchScope || sameChurch(church.name, options.churchScope),
  );
  const reports = churches.map(church => summarizeChurch(church, data, date, options.serviceType));
  const workbook = XLSX.utils.book_new();
  const usedNames = new Set<string>();

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(formulaSafeRows(makeGroupRows(reports, date, options.serviceType))),
    sheetName('Group Overview', usedNames),
  );
  reports.forEach(report => {
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet(formulaSafeRows(makeChurchRows(report, data, date, options.serviceType))),
      sheetName(report.church.name, usedNames),
    );
  });
  return workbook;
}

function downloadAggregateCsv(data: ExportDataPayload, filenamePrefix = 'CEKB_Aggregate_Report'): void {
  const date = resolveReportDate(data.attendanceRecords);
  const reports = data.churches.map(church => summarizeChurch(church, data, date));
  const rows = makeGroupRows(reports, date);
  const csv = rows.map(row => row.map(csvQ).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filenamePrefix}_${date}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Creates an aggregate workbook: one group overview, then one sheet per church. */
export function exportMultiSheetExcel(
  arg1: ExportDataPayload | Member[],
  arg2?: AttendanceRecord[] | string,
  arg3?: ChurchBranch[],
  arg4?: ChurchAdminAccount[],
  arg5?: string,
  arg6?: Leader[],
): void {
  exportAggregateAnalyticsExcel(normalizeExportPayload(arg1, arg2, arg3, arg4, arg5, arg6), {
    filenamePrefix: typeof arg2 === 'string' ? arg2 : (arg5 || 'CEKB_Aggregate_Attendance_Report'),
  });
}

/** Privacy-preserving summary CSV used only if Excel generation is unavailable. */
export function exportMultiSectionCSV(
  arg1: ExportDataPayload | Member[],
  arg2?: AttendanceRecord[] | string,
  arg3?: ChurchBranch[],
  arg4?: ChurchAdminAccount[],
  arg5?: string,
  arg6?: Leader[],
): void {
  downloadAggregateCsv(
    normalizeExportPayload(arg1, arg2, arg3, arg4, arg5, arg6),
    typeof arg2 === 'string' ? arg2 : (arg5 || 'CEKB_Aggregate_Report'),
  );
}
