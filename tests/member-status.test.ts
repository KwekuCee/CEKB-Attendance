import assert from 'node:assert/strict';
import test from 'node:test';
import type { AttendanceRecord, Member } from '../src/types.ts';
import { getMemberAttendanceCount, isFirstTimer } from '../src/utils/memberStatus.ts';

const member: Member = {
  id: 'CE-1001',
  fullName: 'Test Member',
  phone: '',
  role: 'First Timer',
  occupation: '',
  education: '',
  location: '',
  church: 'Korle Bu',
  joinDate: '2026-01-01',
  initials: 'TM',
  serviceCount: 1,
  foundationClass: 0,
  status: 'First Timer',
};

const attendance = (id: string): AttendanceRecord => ({
  id,
  memberId: member.id,
  memberName: member.fullName,
  memberRole: 'First Timer',
  serviceType: 'Sunday Service',
  timestamp: '10:00',
  date: '2026-01-04',
  verifiedBy: 'Usher',
  status: 'Confirmed',
  church: member.church,
  checkInMethod: 'Manual Admin',
});

test('a member remains a first timer until two attendance records exist', () => {
  assert.equal(isFirstTimer(member), true);
  assert.equal(isFirstTimer(member, [attendance('attendance-1')]), true);
  assert.equal(isFirstTimer(member, [attendance('attendance-1'), attendance('attendance-2')]), false);
});

test('stored visit counts remain authoritative when attendance history is incomplete', () => {
  const staleMember = { ...member, serviceCount: 5 };
  assert.equal(getMemberAttendanceCount(staleMember, [attendance('attendance-1')]), 5);
  assert.equal(isFirstTimer(staleMember, [attendance('attendance-1')]), false);
});

test('attendance records from another church do not affect the member visit count', () => {
  const otherChurchAttendance = { ...attendance('attendance-1'), church: 'Another Church' };
  assert.equal(getMemberAttendanceCount(member, [otherChurchAttendance]), 1);
});
