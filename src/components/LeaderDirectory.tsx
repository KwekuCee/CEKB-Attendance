import React, { useState } from 'react';
import { Leader, LeaderType, PromotionQueueItem, ViewType, ChurchBranch, Member } from '../types';
import { EditRecordModal, ConfirmDeleteDialog } from './EditRecordModal';
import { getGroupNamesForLeader } from '../utils/analyticsUtils';
import { IncompleteLeadersPanel } from './IncompleteLeadersPanel';
import { isIncompleteLeader } from '../utils/importUtils';

interface LeaderDirectoryProps {
  leaders: Leader[];
  promotionQueue: PromotionQueueItem[];
  user?: {
    name: string;
    role: 'Superadmin' | 'Church Admin';
    church: string;
  };
  onConfirmPromotion: (promotionId: string) => void;
  onDeclinePromotion?: (promotionId: string) => void;
  onNavigate: (view: ViewType) => void;
  churches?: ChurchBranch[];
  members?: Member[];
  onUpdateLeader?: (leader: Leader) => void;
  onDeleteLeader?: (leaderId: string) => void;
}

export const LeaderDirectory: React.FC<LeaderDirectoryProps> = ({
  leaders,
  promotionQueue,
  user,
  onConfirmPromotion,
  onDeclinePromotion,
  onNavigate,
  churches,
  members = [],
  onUpdateLeader,
  onDeleteLeader
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('All');
  const [selectedChurch, setSelectedChurch] = useState<string>('All');
  const [editingLeader, setEditingLeader] = useState<Leader | null>(null);
  const [deletingLeader, setDeletingLeader] = useState<Leader | null>(null);
  const [viewingLeader, setViewingLeader] = useState<Leader | null>(null);

  const isChurchAdmin = user?.role === 'Church Admin' || (user?.role as string) === 'Church Pastor';
  const targetChurch = user?.church || '';

  const scopedLeaders = isChurchAdmin
    ? leaders.filter(l => l.church === targetChurch)
    : leaders;

  const scopedPromotionQueue = isChurchAdmin
    ? promotionQueue.filter(p => p.church === targetChurch)
    : promotionQueue;

  const membersOfLeader = (ldr: Leader) =>
    members.filter(m =>
      m && (
        (m.invitedByLeaderId && m.invitedByLeaderId === ldr.id) ||
        (m.invitedBy && ldr.fullName && m.invitedBy.trim().toLowerCase() === ldr.fullName.trim().toLowerCase())
      )
    );

  const cleanLeaderSearch = (searchTerm || '').trim().toLowerCase();
  const filteredLeaders = scopedLeaders.filter(ldr => {
    if (!ldr) return false;
    const nameStr = (ldr.fullName || '').toLowerCase();
    const cellStr = (ldr.cellOrPcfName || '').toLowerCase();
    const idStr = (ldr.id || '').toLowerCase();

    const matchesSearch =
      !cleanLeaderSearch ||
      nameStr.includes(cleanLeaderSearch) ||
      cellStr.includes(cleanLeaderSearch) ||
      idStr.includes(cleanLeaderSearch);
    const matchesType = selectedType === 'All' || ldr.leaderType === selectedType;
    const matchesChurch = isChurchAdmin ? true : (selectedChurch === 'All' || ldr.church === selectedChurch);
    return matchesSearch && matchesType && matchesChurch;
  });

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-full mb-1 border border-blue-200">
            <span className="material-symbols-outlined text-[14px]">diversity_3</span>
            Leaders
          </div>
          <h1 className="font-display text-2xl md:text-4xl font-extrabold text-slate-900 tracking-tight">
            Leaders
          </h1>
          <p className="font-body text-xs md:text-sm text-slate-500 mt-1">
            Supervise Church Coordinators, PCF Leaders, Cell Leaders, and BSCTs across all network branches.
          </p>
        </div>

        <button
          onClick={() => onNavigate('leader_registration')}
          className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2.5 px-4 rounded-xl transition-all flex items-center gap-2 shadow-sm cursor-pointer shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]">person_add</span>
          <span>Register New Leader</span>
        </button>
      </div>

      {/* Promotion requests awaiting the group pastor */}
      {scopedPromotionQueue.length > 0 && (
        <div className="bg-blue-50 border border-blue-300 rounded-2xl p-5 md:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-blue-900 font-headline font-bold text-sm">
              <span className="material-symbols-outlined text-[20px] text-blue-700 icon-fill">military_tech</span>
              <span>Promotion requests ({scopedPromotionQueue.length})</span>
            </div>
            <span className="text-xs font-bold bg-blue-100/80 text-blue-900 px-2.5 py-0.5 rounded-full">
              {isChurchAdmin ? 'Waiting for the group pastor' : 'Your approval needed'}
            </span>
          </div>

          <p className="text-xs text-blue-800/90 font-body">
            {isChurchAdmin
              ? 'These people have been put forward for a leader role. Nothing changes until the group pastor approves.'
              : 'Approve or turn down each request. Only you can grant a leader role.'}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {scopedPromotionQueue.map(item => (
              <div key={item.id} className="bg-white p-4 rounded-2xl border border-blue-100 shadow-sm space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-headline font-bold text-sm text-slate-900">{item.leaderName}</h4>
                    <p className="text-xs text-slate-500">{item.church}</p>
                  </div>
                  <span className="bg-blue-100 text-blue-900 font-bold text-xs px-2 py-0.5 rounded-md">
                    {item.currentRole} ➔ {item.targetRole}
                  </span>
                </div>

                <p className="text-xs text-slate-600 font-body bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  {item.reason}
                </p>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-slate-400">Flagged: {item.flaggedAt}</span>
                  {isChurchAdmin ? (
                    <span className="text-xs font-bold text-blue-800 bg-blue-50 px-2.5 py-1 rounded-lg">Pending approval</span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onDeclinePromotion?.(item.id)}
                        className="border border-slate-200 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-slate-50 cursor-pointer"
                      >
                        Turn down
                      </button>
                      <button
                        onClick={() => onConfirmPromotion(item.id)}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3.5 py-1.5 rounded-xl transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[14px]">check</span>
                        <span>Approve</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {onUpdateLeader && (
        <IncompleteLeadersPanel
          leaders={scopedLeaders}
          members={members}
          onSave={(updated) => onUpdateLeader(updated)}
        />
      )}

      {/* Filter Controls */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
            search
          </span>
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search leader name, cell or PCF..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 outline-none focus:bg-white focus:border-blue-600"
          />
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          <select
            value={selectedType}
            onChange={e => setSelectedType(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-600 cursor-pointer"
          >
            <option value="All">All Leader Types</option>
            <option value="Church Coordinator">Church Coordinators</option>
            <option value="PCF Leader">PCF Leaders</option>
            <option value="Cell Leader">Cell Leaders</option>
            <option value="BSCT">BSCTs</option>
          </select>

          {isChurchAdmin ? (
            <div className="bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700">
              {targetChurch}
            </div>
          ) : (
            <select
              value={selectedChurch}
              onChange={e => setSelectedChurch(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-600 cursor-pointer"
            >
              <option value="All">All Churches</option>
              {(churches || []).map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Leaders Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 md:p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div>
            <h3 className="font-headline text-base font-bold text-slate-900">All leaders</h3>
            <p className="text-xs text-slate-500">{filteredLeaders.length} leader(s)</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/60 text-xs font-bold text-slate-400 border-b border-slate-200">
                <th className="py-3 px-4">Leader Name</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Group name</th>
                <th className="py-3 px-4">Church</th>
                <th className="py-3 px-4">Reports to</th>
                <th className="py-3 px-4 text-center">Members</th>
                <th className="py-3 px-4 text-center">Appointment</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="font-body text-xs divide-y divide-slate-100">
              {filteredLeaders.length > 0 ? (
                filteredLeaders.map(ldr => (
                  <tr key={ldr.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-900 font-display font-extrabold text-xs flex items-center justify-center border border-blue-100 shrink-0">
                          {ldr.initials || (ldr.fullName ? ldr.fullName.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'LD')}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{ldr.fullName}</p>
                          <p className="text-xs text-slate-400">{ldr.contact}</p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className={`
                        px-2.5 py-1 rounded-full text-xs font-bold border
                        ${ldr.leaderType === 'Church Coordinator' ? 'bg-purple-50 text-purple-800 border-purple-200' : ''}
                        ${ldr.leaderType === 'PCF Leader' ? 'bg-blue-50 text-blue-800 border-blue-200' : ''}
                        ${ldr.leaderType === 'Cell Leader' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : ''}
                        ${ldr.leaderType === 'BSCT' ? 'bg-blue-50 text-blue-800 border-blue-100' : ''}
                      `}>
                        {!ldr.isAppointed && isIncompleteLeader(ldr) ? 'Not set' : ldr.leaderType}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 font-semibold text-slate-800">
                      {ldr.cellOrPcfName || `${ldr.fullName}'s group`}
                      {(() => {
                        const g = getGroupNamesForLeader(ldr.parentLeaderId, leaders);
                        const parts = [g.cellName, g.pcfName].filter(Boolean);
                        if (parts.length === 0) return null;
                        return <div className="text-[11px] font-normal text-slate-500 mt-0.5">in {parts.join(' • ')}</div>;
                      })()}
                    </td>

                    <td className="py-3.5 px-4 text-slate-600">
                      {ldr.church}
                    </td>

                    <td className="py-3.5 px-4 text-slate-500 font-medium">
                      {ldr.parentLeaderName || 'Direct Pastor Report'}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => setViewingLeader(ldr)}
                        className="bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-100 px-2.5 py-1 rounded-lg font-bold cursor-pointer"
                        title="See this leader's members"
                      >
                        {membersOfLeader(ldr).length}
                      </button>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      {ldr.isAppointed ? (
                        <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                          Appointed
                        </span>
                      ) : (
                        <span className="text-xs font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">
                          Growth Cycle
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <button
                        onClick={() => setEditingLeader(ldr)}
                        className="inline-flex items-center px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
                        title="Edit leader"
                      >
                        <span className="material-symbols-outlined text-[16px]">edit</span>
                      </button>
                      <button
                        onClick={() => setDeletingLeader(ldr)}
                        className="ml-1.5 inline-flex items-center px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold cursor-pointer"
                        title="Delete leader"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-xs text-slate-400">
                    No leaders found in the database.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>


      {viewingLeader && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-start justify-between p-5 border-b border-slate-100">
              <div>
                <h3 className="font-headline font-bold text-base text-slate-900">{viewingLeader.fullName}'s members</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {viewingLeader.leaderType} • {viewingLeader.church} • {membersOfLeader(viewingLeader).length} member(s)
                </p>
              </div>
              <button
                onClick={() => setViewingLeader(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
              {membersOfLeader(viewingLeader).length > 0 ? (
                membersOfLeader(viewingLeader).map(m => (
                  <div key={m.id} className="px-5 py-3 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-semibold text-slate-900">{m.fullName}</p>
                      <p className="text-slate-500">{m.phone || 'No phone'} • {m.church}</p>
                    </div>
                    <span className="text-slate-500">{m.status}</span>
                  </div>
                ))
              ) : (
                <p className="px-5 py-10 text-center text-xs text-slate-400">
                  No members have chosen this leader yet.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {editingLeader && (
        <EditRecordModal
          title="Edit Leader"
          subtitle={`${editingLeader.fullName} • ${editingLeader.leaderType}`}
          icon="diversity_3"
          values={editingLeader as any}
          fields={[
            { key: 'fullName', label: 'Full Name', required: true },
            { key: 'email', label: 'Email', type: 'email' },
            { key: 'contact', label: 'Contact', type: 'tel' },
            { key: 'dob', label: 'Date of Birth', type: 'date' },
            { key: 'location', label: 'Location' },
            { key: 'cellOrPcfName', label: 'Bible Study Class / Cell / PCF Name' },
            ...(isChurchAdmin
              ? []
              : [(churches && churches.length > 0
                ? { key: 'church', label: 'Church Branch', type: 'select' as const, options: churches.map(c => c.name) }
                : { key: 'church', label: 'Church Branch' })]),
            { key: 'leaderType', label: 'Leader Type', type: 'select', options: ['BSCT', 'Cell Leader', 'PCF Leader', 'Church Coordinator'] }
          ]}
          onCancel={() => setEditingLeader(null)}
          onSave={(vals) => {
            onUpdateLeader?.({ ...editingLeader, ...vals, leaderType: vals.leaderType as LeaderType } as Leader);
            setEditingLeader(null);
          }}
        />
      )}

      {deletingLeader && (
        <ConfirmDeleteDialog
          title="Delete Leader"
          message={`This permanently removes ${deletingLeader.fullName} from the leadership directory.`}
          onCancel={() => setDeletingLeader(null)}
          onConfirm={() => {
            onDeleteLeader?.(deletingLeader.id);
            setDeletingLeader(null);
          }}
        />
      )}
    </div>
  );
};
