import * as XLSX from 'xlsx';
import { ChurchBranch, ChurchAdminAccount, Member, Leader, AttendanceRecord } from '../types';
import { csvQ, safeRows } from './csvSafe';

export interface ExportDataPayload {
  churches: ChurchBranch[];
  churchAdmins: ChurchAdminAccount[];
  members: Member[];
  leaders: Leader[];
  attendanceRecords: AttendanceRecord[];
}

function normalizeExportPayload(
  arg1: ExportDataPayload | Member[],
  arg2?: AttendanceRecord[] | string,
  arg3?: ChurchBranch[],
  arg4?: ChurchAdminAccount[],
  arg5?: string
): { data: ExportDataPayload; filenamePrefix: string } {
  if (Array.isArray(arg1)) {
    const members = arg1 as Member[];
    const attendanceRecords = (Array.isArray(arg2) ? arg2 : []) as AttendanceRecord[];
    const churches = (arg3 || []) as ChurchBranch[];
    const churchAdmins = (arg4 || []) as ChurchAdminAccount[];
    const filenamePrefix = typeof arg2 === 'string' ? arg2 : (arg5 || 'CEKB_Church_Network_Report');
    return {
      data: {
        members,
        attendanceRecords,
        churches: churches.length > 0 ? churches : Array.from(new Set(members.map(m => m.church).filter(Boolean))).map(name => ({
          id: name,
          name,
          pastor: 'Branch Pastor',
          zone: 'Zone 1 (Korle Bu)',
          code: name.slice(0, 3).toUpperCase(),
          established: '2024',
          membersCount: members.filter(m => m.church === name).length,
          status: 'Healthy' as const,
          pcfCount: 1,
          cellCount: 3,
          bsctCount: 1
        })),
        churchAdmins,
        leaders: []
      },
      filenamePrefix
    };
  } else {
    const payload = arg1 as ExportDataPayload;
    return {
      data: {
        churches: payload.churches || [],
        churchAdmins: payload.churchAdmins || [],
        members: payload.members || [],
        leaders: payload.leaders || [],
        attendanceRecords: payload.attendanceRecords || []
      },
      filenamePrefix: typeof arg2 === 'string' ? arg2 : 'CEKB_Church_Network_Report'
    };
  }
}

/**
 * Generates and downloads a multi-sheet Excel workbook (.xlsx) containing:
 * 1. Total Members per Church (Admin)
 * 2. Total Attendance per Service Date
 * 3. New Members per Service
 */
export function exportMultiSheetExcel(
  arg1: ExportDataPayload | Member[],
  arg2?: AttendanceRecord[] | string,
  arg3?: ChurchBranch[],
  arg4?: ChurchAdminAccount[],
  arg5?: string
): void {
  const { data, filenamePrefix } = normalizeExportPayload(arg1, arg2, arg3, arg4, arg5);
  const wb = XLSX.utils.book_new();

  // =========================================================================
  // SHEET 1: Total Members per Church (Admin)
  // =========================================================================
  const churchSummaryRows: any[] = [];

  // Summary Table Header & Rows
  churchSummaryRows.push({
    'Church Branch Name': '=== SUMMARY OF MEMBERS PER CHURCH ===',
    'Head Pastor / Admin': '',
    'Admin Contact Email': '',
    'Admin Phone': '',
    'Total Registered Members': '',
    'First Timers Count': '',
    'General Members Count': '',
    'Foundation School Enrolled': '',
    'Foundation School Graduated': ''
  });

  data.churches.forEach(church => {
    const matchingAdmin = data.churchAdmins.find(
      a => (a?.churchName || '').toLowerCase() === (church?.name || '').toLowerCase()
    );
    const churchMembers = data.members.filter(
      m => (m?.church || '').toLowerCase() === (church?.name || '').toLowerCase()
    );

    const firstTimers = churchMembers.filter(m => m.status === 'First Timer' || (m.serviceCount || 0) <= 1).length;
    const generalMembers = churchMembers.filter(m => m.status === 'General Member' || (m.serviceCount || 0) > 1).length;
    const enrolledFs = churchMembers.filter(m => (m.foundationClass || 0) > 0 && (m.foundationClass || 0) < 7).length;
    const graduatedFs = churchMembers.filter(m => (m.foundationClass || 0) >= 7).length;

    churchSummaryRows.push({
      'Church Branch Name': church.name,
      'Head Pastor / Admin': church.pastor || matchingAdmin?.adminName || 'Branch Pastor',
      'Admin Contact Email': matchingAdmin?.adminEmail || `${church.name.toLowerCase().replace(/\s+/g, '')}@cekorlebu.org`,
      'Admin Phone': matchingAdmin?.adminPhone || '+233 24 000 0000',
      'Total Registered Members': churchMembers.length,
      'First Timers Count': firstTimers,
      'General Members Count': generalMembers,
      'Foundation School Enrolled': enrolledFs,
      'Foundation School Graduated': graduatedFs
    });
  });

  // Empty separator row
  churchSummaryRows.push({});
  churchSummaryRows.push({
    'Church Branch Name': '=== DETAILED MEMBER ROSTER ===',
    'Head Pastor / Admin': '',
    'Admin Contact Email': '',
    'Admin Phone': '',
    'Total Registered Members': '',
    'First Timers Count': '',
    'General Members Count': '',
    'Foundation School Enrolled': '',
    'Foundation School Graduated': ''
  });

  // Detailed Member Roster
  data.members.forEach(m => {
    churchSummaryRows.push({
      'Church Branch Name': m.church || 'Unassigned',
      'Head Pastor / Admin': m.fullName,
      'Admin Contact Email': m.email || 'N/A',
      'Admin Phone': m.phone || 'N/A',
      'Total Registered Members': m.id,
      'First Timers Count': m.role || 'Member',
      'General Members Count': m.status || 'General Member',
      'Foundation School Enrolled': `Class ${m.foundationClass || 0}`,
      'Foundation School Graduated': m.joinDate || new Date().toISOString().slice(0, 10)
    });
  });

  const ws1 = XLSX.utils.json_to_sheet(safeRows(churchSummaryRows as any[]));
  // Auto column widths
  ws1['!cols'] = [
    { wch: 28 },
    { wch: 24 },
    { wch: 28 },
    { wch: 18 },
    { wch: 22 },
    { wch: 25 },
    { wch: 18 },
    { wch: 20 },
    { wch: 24 },
    { wch: 24 }
  ];
  XLSX.utils.book_append_sheet(wb, ws1, 'Members Per Church');

  // =========================================================================
  // SHEET 2: Total Attendance per Service Date
  // =========================================================================
  // Aggregate attendance grouped by (Date + Church + ServiceType)
  const attendanceAggMap = new Map<string, {
    date: string;
    church: string;
    serviceType: string;
    totalAttendees: number;
    firstTimers: number;
    regularMembers: number;
    verifiedBy: Set<string>;
  }>();

  data.attendanceRecords.forEach(att => {
    const dateStr = att.date || new Date().toISOString().slice(0, 10);
    const churchStr = att.church || 'Unassigned';
    const srvStr = att.serviceType || 'Sunday Service';
    const key = `${dateStr}__${churchStr}__${srvStr}`;

    const existing = attendanceAggMap.get(key) || {
      date: dateStr,
      church: churchStr,
      serviceType: srvStr,
      totalAttendees: 0,
      firstTimers: 0,
      regularMembers: 0,
      verifiedBy: new Set<string>()
    };

    existing.totalAttendees += 1;
    if (att.memberRole === 'First Timer') {
      existing.firstTimers += 1;
    } else {
      existing.regularMembers += 1;
    }
    if (att.verifiedBy) existing.verifiedBy.add(att.verifiedBy);

    attendanceAggMap.set(key, existing);
  });

  const attendanceSummaryRows: any[] = [];
  attendanceSummaryRows.push({
    'Attendance Date': '=== SERVICE ATTENDANCE SUMMARY PER DATE ===',
    'Church Branch': '',
    'Service Program': '',
    'Total Attendees': '',
    'First Timers Checked-In': '',
    'Regular Members Checked-In': '',
    'Verification Officer(s)': ''
  });

  Array.from(attendanceAggMap.values())
    .sort((a, b) => b.date.localeCompare(a.date))
    .forEach(item => {
      attendanceSummaryRows.push({
        'Attendance Date': item.date,
        'Church Branch': item.church,
        'Service Program': item.serviceType,
        'Total Attendees': item.totalAttendees,
        'First Timers Checked-In': item.firstTimers,
        'Regular Members Checked-In': item.regularMembers,
        'Verification Officer(s)': Array.from(item.verifiedBy).join(', ') || 'QR / Self Check-In'
      });
    });

  // Empty separator and raw logs
  attendanceSummaryRows.push({});
  attendanceSummaryRows.push({
    'Attendance Date': '=== DETAILED ATTENDANCE LOG RECORDS ===',
    'Church Branch': '',
    'Service Program': '',
    'Total Attendees': '',
    'First Timers Checked-In': '',
    'Regular Members Checked-In': '',
    'Verification Officer(s)': ''
  });

  data.attendanceRecords.forEach(att => {
    attendanceSummaryRows.push({
      'Attendance Date': att.date || new Date().toISOString().slice(0, 10),
      'Church Branch': att.church || 'Unassigned',
      'Service Program': att.serviceType || 'Sunday Service',
      'Total Attendees': att.memberName || 'Attendee',
      'First Timers Checked-In': att.memberId || 'N/A',
      'Regular Members Checked-In': att.memberRole || 'Member',
      'Verification Officer(s)': `${att.verifiedBy || 'QR Station'} (${att.timestamp || '09:00 AM'})`
    });
  });

  const ws2 = XLSX.utils.json_to_sheet(safeRows(attendanceSummaryRows as any[]));
  ws2['!cols'] = [
    { wch: 18 },
    { wch: 24 },
    { wch: 22 },
    { wch: 22 },
    { wch: 22 },
    { wch: 24 },
    { wch: 30 }
  ];
  XLSX.utils.book_append_sheet(wb, ws2, 'Attendance Per Date');

  // =========================================================================
  // SHEET 3: New Members per Service
  // =========================================================================
  // Extract all members with status 'First Timer' or serviceCount <= 1 or matching check-in
  const newMembersRows: any[] = [];
  newMembersRows.push({
    'Service / Join Date': '=== FIRST TIMERS & NEW MEMBERS DIRECTORY ===',
    'Member ID': '',
    'Full Name': '',
    'Phone Contact': '',
    'Email Address': '',
    'Church Branch': '',
    'Service Type Attended': '',
    'Occupation': '',
    'Educational Level': '',
    'Foundation Class': '',
    'Invited By / Leader': '',
    'Status': ''
  });

  const firstTimerList = data.members.filter(
    m => m.status === 'First Timer' || (m.serviceCount || 0) <= 1
  );

  firstTimerList.forEach(m => {
    // Find matching attendance record if any to get service type
    const attMatch = data.attendanceRecords.find(
      a => a.memberId === m.id || (a.memberName || '').toLowerCase() === (m.fullName || '').toLowerCase()
    );

    newMembersRows.push({
      'Service / Join Date': m.joinDate || attMatch?.date || new Date().toISOString().slice(0, 10),
      'Member ID': m.id,
      'Full Name': m.fullName,
      'Phone Contact': m.phone || 'N/A',
      'Email Address': m.email || 'N/A',
      'Church Branch': m.church || 'Unassigned',
      'Service Type Attended': attMatch?.serviceType || 'Sunday Service',
      'Occupation': m.occupation || 'General',
      'Educational Level': m.education || 'Tertiary',
      'Foundation Class': `Class ${m.foundationClass || 0}`,
      'Invited By / Leader': m.invitedBy || 'Self Walk-In',
      'Status': m.status || 'First Timer'
    });
  });

  const ws3 = XLSX.utils.json_to_sheet(safeRows(newMembersRows as any[]));
  ws3['!cols'] = [
    { wch: 18 },
    { wch: 16 },
    { wch: 24 },
    { wch: 18 },
    { wch: 25 },
    { wch: 22 },
    { wch: 20 },
    { wch: 20 },
    { wch: 20 },
    { wch: 18 },
    { wch: 24 },
    { wch: 16 }
  ];
  XLSX.utils.book_append_sheet(wb, ws3, 'New Members Per Service');

  // Generate binary and trigger download
  const today = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `${filenamePrefix}_${today}.xlsx`);
}

/**
 * Multi-section structured CSV export fallback
 */
export function exportMultiSectionCSV(
  arg1: ExportDataPayload | Member[],
  arg2?: AttendanceRecord[] | string,
  arg3?: ChurchBranch[],
  arg4?: ChurchAdminAccount[],
  arg5?: string
): void {
  const { data, filenamePrefix } = normalizeExportPayload(arg1, arg2, arg3, arg4, arg5);
  const lines: string[] = [];

  // SECTION 1
  lines.push('=== SHEET 1: TOTAL MEMBERS PER CHURCH (ADMIN) ===');
  lines.push('Church Name,Head Pastor / Admin,Admin Email,Admin Phone,Total Members,First Timers,General Members');
  data.churches.forEach(church => {
    const matchingAdmin = data.churchAdmins.find(
      a => (a?.churchName || '').toLowerCase() === (church?.name || '').toLowerCase()
    );
    const churchMembers = data.members.filter(
      m => (m?.church || '').toLowerCase() === (church?.name || '').toLowerCase()
    );
    const firstTimers = churchMembers.filter(m => m.status === 'First Timer' || (m.serviceCount || 0) <= 1).length;
    const generalMembers = churchMembers.filter(m => m.status === 'General Member' || (m.serviceCount || 0) > 1).length;

    lines.push(
      `${csvQ(church.name)},${csvQ(church.pastor || matchingAdmin?.adminName || '')},${csvQ(matchingAdmin?.adminEmail || '')},${csvQ(matchingAdmin?.adminPhone || '')},${churchMembers.length},${firstTimers},${generalMembers}`
    );
  });

  lines.push('');
  lines.push('=== SHEET 2: TOTAL ATTENDANCE PER SERVICE DATE ===');
  lines.push('Attendance Date,Church Branch,Service Program,Attendee Name,Member ID,Member Role,Verified By');
  data.attendanceRecords.forEach(att => {
    lines.push(
      `${csvQ(att.date || '')},${csvQ(att.church || '')},${csvQ(att.serviceType || '')},${csvQ(att.memberName || '')},${csvQ(att.memberId || '')},${csvQ(att.memberRole || '')},${csvQ(att.verifiedBy || '')}`
    );
  });

  lines.push('');
  lines.push('=== SHEET 3: NEW MEMBERS PER SERVICE ===');
  lines.push('Join Date,Member ID,Full Name,Phone,Email,Church,Occupation,Education,Foundation Class,Invited By,Status');
  const firstTimerList = data.members.filter(
    m => m.status === 'First Timer' || (m.serviceCount || 0) <= 1
  );
  firstTimerList.forEach(m => {
    lines.push(
      `${csvQ(m.joinDate || '')},${csvQ(m.id)},${csvQ(m.fullName)},${csvQ(m.phone || '')},${csvQ(m.email || '')},${csvQ(m.church || '')},${csvQ(m.occupation || '')},${csvQ(m.education || '')},"Class ${m.foundationClass || 0}",${csvQ(m.invitedBy || '')},${csvQ(m.status || '')}`
    );
  });

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filenamePrefix}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
