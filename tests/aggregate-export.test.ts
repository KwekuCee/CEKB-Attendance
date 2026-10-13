import assert from 'node:assert/strict';
import test from 'node:test';
import * as XLSX from 'xlsx';
import type { AttendanceRecord, ChurchBranch, Leader, Member } from '../src/types.ts';
import { createAggregateAnalyticsWorkbook } from '../src/utils/exportUtils.ts';

const church: ChurchBranch = {
  id: 'church-1',
  name: 'Test Church',
  pastor: 'Pastor',
  membersCount: 2,
  status: 'Healthy',
  zone: 'Zone 1',
  pcfCount: 1,
  cellCount: 1,
  bsctCount: 1,
};

const leader: Leader = {
  id: 'leader-1',
  fullName: 'Leader Alpha',
  email: 'leader@example.com',
  contact: '',
  dob: '',
  location: '',
  leaderType: 'Cell Leader',
  cellOrPcfName: 'Cell One',
  church: church.name,
  isAppointed: false,
  downstreamCount: 0,
  promotionStatus: 'None',
  joinedDate: '2025-01-01',
  initials: 'LA',
};

const makeMember = (id: string, fullName: string, email: string, phone: string): Member => ({
  id,
  fullName,
  phone,
  email,
  role: 'Member',
  occupation: '',
  education: '',
  location: '',
  church: church.name,
  invitedByLeaderId: leader.id,
  joinDate: '2026-01-01',
  initials: 'TM',
  serviceCount: 2,
  foundationClass: 0,
  status: 'General Member',
});

const attendance: AttendanceRecord = {
  id: 'attendance-1',
  memberId: 'member-1',
  memberName: 'Private Member One',
  memberRole: 'Member',
  serviceType: 'Sunday Service',
  timestamp: '10:30 AM',
  date: '2026-01-04',
  verifiedBy: 'Usher',
  status: 'Confirmed',
  church: church.name,
  checkInMethod: 'Manual Admin',
  leaderName: leader.fullName,
};

test('aggregate workbook groups churches and exports totals without member personal details', () => {
  const members = [
    makeMember('member-1', 'Private Member One', 'one@example.com', '+233501111111'),
    makeMember('member-2', 'Private Member Two', 'two@example.com', '+233502222222'),
  ];
  const workbook = createAggregateAnalyticsWorkbook({
    churches: [church],
    churchAdmins: [],
    members,
    leaders: [leader],
    attendanceRecords: [attendance],
  }, { attendanceDate: '2026-01-04', serviceType: 'Sunday Service' });

  assert.deepEqual(workbook.SheetNames, ['Group Overview', 'Test Church']);

  const groupRows = XLSX.utils.sheet_to_json(workbook.Sheets['Group Overview'], { header: 1 }) as unknown[][];
  const churchRows = XLSX.utils.sheet_to_json(workbook.Sheets['Test Church'], { header: 1 }) as unknown[][];
  const groupText = JSON.stringify(groupRows);
  const churchText = JSON.stringify(churchRows);

  assert.match(groupText, /GROUP TOTAL/);
  assert.match(churchText, /Present members for reference date/);
  assert.match(churchText, /Absentees for reference date/);
  assert.match(churchText, /Registered members by assigned leader/);
  assert.match(churchText, /Leader Alpha/);
  assert.match(churchText, /Member counts by leader type/);
  assert.match(churchText, /Peak arrival time by leader/);
  for (const privateValue of ['Private Member One', 'Private Member Two', 'one@example.com', '+233501111111']) {
    assert.equal(groupText.includes(privateValue), false);
    assert.equal(churchText.includes(privateValue), false);
  }
  assert.equal(
    churchRows.some(row => Array.isArray(row) && row[0] === 'Leader Alpha' && row[1] === 2),
    true,
  );
});
