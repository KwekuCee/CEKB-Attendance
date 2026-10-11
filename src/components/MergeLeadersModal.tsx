import React, { useMemo, useState } from 'react';
import { Leader, Member, AttendanceRecord } from '../types';
import { Button } from './Button';
import { nameKey, toTitleCase } from '../utils/importUtils';

interface MergeLeadersModalProps {
  isOpen: boolean;
  onClose: () => void;
  leaders: Leader[];
  members: Member[];
  attendance: AttendanceRecord[];
  initialLeaderA?: Leader | null;
  initialLeaderB?: Leader | null;
  onMerge: (
    primaryLeader: Leader,
    duplicateLeader: Leader,
    transferredMembers: Member[],
    transferredAttendance: AttendanceRecord[],
    transferredChildLeaders: Leader[]
  ) => Promise<void> | void;
}

function calculateCompletenessScore(leader: Leader, memberCount: number): number {
  let score = 0;
  const name = (leader.fullName || '').trim();
  const isAllCaps = name === name.toUpperCase() && /[A-Z]/.test(name);
  if (!isAllCaps && name.length > 2) score += 3; // Title/mixed case is preferred
  if (leader.contact && leader.contact.trim() && !leader.contact.includes('000000')) score += 4;
  if (leader.email && leader.email.includes('@')) score += 4;
  if (leader.dob && leader.dob.trim()) score += 2;
  if (leader.location && leader.location.trim() && leader.location !== 'Not Specified') score += 2;
  if (leader.leaderType && leader.leaderType !== 'BSCT') score += 3;
  if (leader.cellOrPcfName && leader.cellOrPcfName.trim() && !leader.cellOrPcfName.includes('group')) score += 3;
  if (leader.parentLeaderId) score += 2;
  if (leader.isAppointed) score += 3;
  if (leader.photoUrl) score += 2;
  score += Math.min(memberCount * 2, 10);
  return score;
}

export const MergeLeadersModal: React.FC<MergeLeadersModalProps> = ({
  isOpen,
  onClose,
  leaders,
  members,
  attendance,
  initialLeaderA,
  initialLeaderB,
  onMerge,
}) => {
  const [selectedAId, setSelectedAId] = useState<string>(initialLeaderA?.id || '');
  const [selectedBId, setSelectedBId] = useState<string>(initialLeaderB?.id || '');
  const [primaryTarget, setPrimaryTarget] = useState<'A' | 'B'>('A');
  const [customName, setCustomName] = useState<string>('');
  const [isMerging, setIsMerging] = useState<boolean>(false);

  // Sync initial leaders when opened
  React.useEffect(() => {
    if (initialLeaderA) setSelectedAId(initialLeaderA.id);
    if (initialLeaderB) setSelectedBId(initialLeaderB.id);
  }, [initialLeaderA, initialLeaderB]);

  const leaderA = useMemo(() => leaders.find((l) => l.id === selectedAId), [leaders, selectedAId]);
  const leaderB = useMemo(() => leaders.find((l) => l.id === selectedBId), [leaders, selectedBId]);

  const membersCountFor = (ldr: Leader | undefined) => {
    if (!ldr) return 0;
    const ldrKey = nameKey(ldr.fullName);
    return members.filter(
      (m) =>
        m &&
        (m.invitedByLeaderId === ldr.id ||
          (m.invitedBy && m.invitedBy.trim().toLowerCase() === ldr.fullName.trim().toLowerCase()) ||
          (m.invitedBy && nameKey(m.invitedBy) === ldrKey))
    ).length;
  };

  const countA = useMemo(() => membersCountFor(leaderA), [leaderA, members]);
  const countB = useMemo(() => membersCountFor(leaderB), [leaderB, members]);

  const scoreA = useMemo(() => (leaderA ? calculateCompletenessScore(leaderA, countA) : 0), [leaderA, countA]);
  const scoreB = useMemo(() => (leaderB ? calculateCompletenessScore(leaderB, countB) : 0), [leaderB, countB]);

  // Set default recommendation
  React.useEffect(() => {
    if (leaderA && leaderB) {
      if (scoreB > scoreA) {
        setPrimaryTarget('B');
      } else {
        setPrimaryTarget('A');
      }
    }
  }, [leaderA?.id, leaderB?.id, scoreA, scoreB]);

  const primaryLeader = primaryTarget === 'A' ? leaderA : leaderB;
  const duplicateLeader = primaryTarget === 'A' ? leaderB : leaderA;

  // Auto-fill suggested name
  React.useEffect(() => {
    if (primaryLeader && duplicateLeader) {
      const pName = primaryLeader.fullName || '';
      const dName = duplicateLeader.fullName || '';
      const pAllCaps = pName === pName.toUpperCase() && /[A-Z]/.test(pName);
      const dAllCaps = dName === dName.toUpperCase() && /[A-Z]/.test(dName);

      if (pAllCaps && !dAllCaps) {
        setCustomName(dName);
      } else if (!pAllCaps) {
        setCustomName(pName);
      } else {
        setCustomName(toTitleCase(pName));
      }
    } else if (primaryLeader) {
      setCustomName(toTitleCase(primaryLeader.fullName));
    }
  }, [primaryLeader?.id, duplicateLeader?.id]);

  if (!isOpen) return null;

  const handleSwap = () => {
    setPrimaryTarget((prev) => (prev === 'A' ? 'B' : 'A'));
  };

  const executeMerge = async () => {
    if (!primaryLeader || !duplicateLeader || primaryLeader.id === duplicateLeader.id) return;
    setIsMerging(true);

    try {
      const dupKey = nameKey(duplicateLeader.fullName);
      const dupClean = (duplicateLeader.fullName || '').trim().toLowerCase();

      // 1. Identify members to transfer
      const membersToTransfer: Member[] = members
        .filter(
          (m) =>
            m &&
            (m.invitedByLeaderId === duplicateLeader.id ||
              (m.invitedBy && m.invitedBy.trim().toLowerCase() === dupClean) ||
              (m.invitedBy && nameKey(m.invitedBy) === dupKey))
        )
        .map((m) => ({
          ...m,
          invitedByLeaderId: primaryLeader.id,
          invitedBy: (customName || primaryLeader.fullName).trim(),
        }));

      // 2. Identify attendance records to transfer
      const attendanceToTransfer: AttendanceRecord[] = attendance
        .filter(
          (a) =>
            a &&
            (a.leaderName?.trim().toLowerCase() === dupClean ||
              membersToTransfer.some((m) => m.id === a.memberId))
        )
        .map((a) => ({
          ...a,
          leaderName: (customName || primaryLeader.fullName).trim(),
        }));

      // 3. Child leaders reporting to the duplicate leader
      const childLeadersToTransfer: Leader[] = leaders
        .filter((l) => l.id !== duplicateLeader.id && l.parentLeaderId === duplicateLeader.id)
        .map((l) => ({
          ...l,
          parentLeaderId: primaryLeader.id,
          parentLeaderName: (customName || primaryLeader.fullName).trim(),
        }));

      // 4. Merge best attributes into primary leader
      const mergedFinalLeader: Leader = {
        ...primaryLeader,
        fullName: (customName || primaryLeader.fullName).trim(),
        initials: (customName || primaryLeader.fullName)
          .split(' ')
          .filter(Boolean)
          .map((n) => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2) || primaryLeader.initials || 'LD',
        contact: primaryLeader.contact || duplicateLeader.contact || '',
        email: primaryLeader.email || duplicateLeader.email || '',
        dob: primaryLeader.dob || duplicateLeader.dob || '',
        location:
          primaryLeader.location && primaryLeader.location !== 'Not Specified'
            ? primaryLeader.location
            : duplicateLeader.location || primaryLeader.location || 'Not Specified',
        leaderType:
          primaryLeader.leaderType && primaryLeader.leaderType !== 'BSCT'
            ? primaryLeader.leaderType
            : duplicateLeader.leaderType || primaryLeader.leaderType || 'BSCT',
        cellOrPcfName:
          primaryLeader.cellOrPcfName && !primaryLeader.cellOrPcfName.includes('group')
            ? primaryLeader.cellOrPcfName
            : duplicateLeader.cellOrPcfName || primaryLeader.cellOrPcfName || '',
        church: primaryLeader.church || duplicateLeader.church || '',
        parentLeaderId: primaryLeader.parentLeaderId || duplicateLeader.parentLeaderId,
        parentLeaderName: primaryLeader.parentLeaderName || duplicateLeader.parentLeaderName,
        isAppointed: primaryLeader.isAppointed || duplicateLeader.isAppointed,
        photoUrl: primaryLeader.photoUrl || duplicateLeader.photoUrl,
        promotionStatus:
          primaryLeader.promotionStatus === 'Confirmed'
            ? 'Confirmed'
            : duplicateLeader.promotionStatus || primaryLeader.promotionStatus,
        downstreamCount: countA + countB,
      };

      await onMerge(
        mergedFinalLeader,
        duplicateLeader,
        membersToTransfer,
        attendanceToTransfer,
        childLeadersToTransfer
      );

      onClose();
    } catch (err) {
      console.error('Merge execution error:', err);
    } finally {
      setIsMerging(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl w-full max-w-2xl border border-slate-200 shadow-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-start justify-between bg-gradient-to-r from-blue-50/50 to-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
              <span className="material-symbols-outlined text-[22px]">merge_type</span>
            </div>
            <div>
              <h2 className="font-headline font-bold text-lg text-slate-900">Merge Duplicate Leaders</h2>
              <p className="text-xs text-slate-500">
                Consolidate duplicate leader entries into one master leader record and re-route all members.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Picker row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Leader 1 {primaryTarget === 'A' ? '(Master to Keep)' : '(Duplicate to Remove)'}
              </label>
              <select
                value={selectedAId}
                onChange={(e) => setSelectedAId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 outline-none focus:border-blue-600"
              >
                <option value="">Select a leader...</option>
                {leaders.map((l) => (
                  <option key={l.id} value={l.id} disabled={l.id === selectedBId}>
                    {l.fullName} • {l.leaderType} ({l.church})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Leader 2 {primaryTarget === 'B' ? '(Master to Keep)' : '(Duplicate to Remove)'}
              </label>
              <select
                value={selectedBId}
                onChange={(e) => setSelectedBId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 outline-none focus:border-blue-600"
              >
                <option value="">Select a leader to merge...</option>
                {leaders.map((l) => (
                  <option key={l.id} value={l.id} disabled={l.id === selectedAId}>
                    {l.fullName} • {l.leaderType} ({l.church})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {leaderA && leaderB && (
            <>
              {/* Swap and Recommendation notice */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-blue-50/80 border border-blue-200 rounded-2xl p-3.5">
                <div className="text-xs text-blue-900 flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-600 text-[18px]">auto_fix_high</span>
                  <span>
                    Primary Target is set to: <strong className="font-bold">{primaryLeader?.fullName}</strong>{' '}
                    <span className="text-blue-700 font-normal">
                      ({primaryTarget === 'A' ? (scoreA >= scoreB ? 'has more details' : 'selected') : (scoreB >= scoreA ? 'has more details' : 'selected')})
                    </span>
                  </span>
                </div>
                <Button
                  variant="secondary"
                  onClick={handleSwap}
                  className="text-xs font-bold py-1.5 px-3 rounded-xl border border-blue-200 bg-white hover:bg-blue-50 text-blue-900 shrink-0"
                >
                  <span className="material-symbols-outlined text-[16px]">swap_horiz</span>
                  <span>Swap Master ⇄ Duplicate</span>
                </Button>
              </div>

              {/* Side-by-side comparison */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Primary Card */}
                <div className="border-2 border-emerald-500 bg-emerald-50/30 rounded-2xl p-4 relative space-y-3">
                  <div className="flex justify-between items-start">
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                      <span className="material-symbols-outlined text-[14px]">check_circle</span>
                      Master Record (To Keep)
                    </span>
                    <span className="text-[11px] font-semibold text-slate-500">ID: {primaryLeader?.id}</span>
                  </div>

                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{primaryLeader?.fullName}</h4>
                    <p className="text-xs text-slate-500">{primaryLeader?.leaderType} • {primaryLeader?.church}</p>
                  </div>

                  <div className="text-xs space-y-1.5 text-slate-600 bg-white/80 p-3 rounded-xl border border-emerald-100">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Phone:</span>
                      <span className="font-medium text-slate-800">{primaryLeader?.contact || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Email:</span>
                      <span className="font-medium text-slate-800">{primaryLeader?.email || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Group / Cell:</span>
                      <span className="font-medium text-slate-800">{primaryLeader?.cellOrPcfName || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Current Members:</span>
                      <span className="font-bold text-blue-700">{primaryTarget === 'A' ? countA : countB}</span>
                    </div>
                  </div>
                </div>

                {/* Duplicate Card */}
                <div className="border border-rose-300 bg-rose-50/20 rounded-2xl p-4 relative space-y-3">
                  <div className="flex justify-between items-start">
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-800 bg-rose-100 px-2.5 py-0.5 rounded-full">
                      <span className="material-symbols-outlined text-[14px]">remove_circle</span>
                      Duplicate Record (Will be Removed)
                    </span>
                    <span className="text-[11px] font-semibold text-slate-500">ID: {duplicateLeader?.id}</span>
                  </div>

                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{duplicateLeader?.fullName}</h4>
                    <p className="text-xs text-slate-500">{duplicateLeader?.leaderType} • {duplicateLeader?.church}</p>
                  </div>

                  <div className="text-xs space-y-1.5 text-slate-600 bg-white/80 p-3 rounded-xl border border-rose-100">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Phone:</span>
                      <span className="font-medium text-slate-800">{duplicateLeader?.contact || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Email:</span>
                      <span className="font-medium text-slate-800">{duplicateLeader?.email || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Group / Cell:</span>
                      <span className="font-medium text-slate-800">{duplicateLeader?.cellOrPcfName || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Members to Transfer:</span>
                      <span className="font-bold text-rose-700">{primaryTarget === 'A' ? countB : countA}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Master Leader Name option */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                <label className="block text-xs font-bold text-slate-800">
                  Master Leader Display Name (Formatted Name)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="Enter clean leader name..."
                    className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 outline-none focus:border-blue-600"
                  />
                  <Button
                    variant="secondary"
                    onClick={() => setCustomName(toTitleCase(primaryLeader?.fullName || ''))}
                    className="text-xs px-3 py-2 bg-white hover:bg-slate-100 border border-slate-200"
                  >
                    Format Title Case
                  </Button>
                </div>
                <p className="text-[11px] text-slate-500">
                  This clean name will appear on attendance sheets, QR passes, check-in dropdowns, and weekly cell reports.
                </p>
              </div>

              {/* Summary of what happens */}
              <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 text-xs space-y-2 text-amber-900">
                <div className="font-bold flex items-center gap-1.5 text-amber-950">
                  <span className="material-symbols-outlined text-[16px] text-amber-700">info</span>
                  <span>What will happen upon merging:</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-amber-900/90 pl-1 text-[11px]">
                  <li>
                    All <strong className="font-bold">{primaryTarget === 'A' ? countB : countA} members</strong> currently under &quot;{duplicateLeader?.fullName}&quot; will be permanently transferred to &quot;{customName || primaryLeader?.fullName}&quot;.
                  </li>
                  <li>
                    Total members under the unified leader will become <strong className="font-bold">{countA + countB}</strong>.
                  </li>
                  <li>
                    The duplicate record &quot;{duplicateLeader?.fullName}&quot; will be deleted so church members won&apos;t see two names on the attendance self check-in page.
                  </li>
                  <li>
                    Any subordinate cell leaders or teachers will now report directly to &quot;{customName || primaryLeader?.fullName}&quot;.
                  </li>
                </ul>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={isMerging}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={executeMerge}
            disabled={!leaderA || !leaderB || leaderA.id === leaderB.id || isMerging}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
          >
            {isMerging ? (
              <>
                <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                <span>Merging Leaders...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">merge_type</span>
                <span>Confirm & Merge Leaders</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
