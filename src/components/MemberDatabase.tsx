import React, { useState } from 'react';
import { Member, RoleType, ViewType, ChurchBranch, Leader } from '../types';
import { MemberPhoto } from './MemberPhoto';
import { EditRecordModal, ConfirmDeleteDialog } from './EditRecordModal';
import { getGroupNamesForLeader, findLeaderByName } from '../utils/analyticsUtils';

interface MemberDatabaseProps {
  members: Member[];
  user?: {
    name: string;
    role: 'Superadmin' | 'Church Admin';
    church: string;
  };
  onNavigate: (view: ViewType) => void;
  onSelectMemberForCard: (member: Member) => void;
  onDeleteMember?: (id: string) => void;
  onUpdateMember?: (member: Member) => void;
  churches?: ChurchBranch[];
  leaders?: Leader[];
}

export const MemberDatabase: React.FC<MemberDatabaseProps> = ({
  members,
  user,
  onNavigate,
  onSelectMemberForCard,
  onDeleteMember,
  onUpdateMember,
  churches,
  leaders = []
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleType | 'All'>('All');
  const [churchFilter, setChurchFilter] = useState<string>('All');
  const [foundationFilter, setFoundationFilter] = useState<string>('All');
  const [leaderFilter, setLeaderFilter] = useState<string>('All');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [deletingMember, setDeletingMember] = useState<Member | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const toggleSel = (id: string) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const bulkUpdate = (patch: (m: Member) => Member) => {
    members.filter(m => selectedIds.has(m.id)).forEach(m => onUpdateMember?.(patch(m)));
    setSelectedIds(new Set());
  };
  const bulkDelete = () => {
    if (!window.confirm(`Delete ${selectedIds.size} selected member(s)? This cannot be undone.`)) return;
    selectedIds.forEach(id => onDeleteMember?.(id));
    setSelectedIds(new Set());
  };
  const itemsPerPage = 8;

  const isChurchAdmin = user?.role === 'Church Admin';
  const targetChurch = user?.church || '';

  // Bible study class / cell / PCF names a member belongs to, via their leader
  const groupNamesForMember = (m: Member) => {
    const leaderId = m.invitedByLeaderId || findLeaderByName(m.invitedBy, leaders)?.id;
    return getGroupNamesForLeader(leaderId, leaders);
  };

  // Restrict pool to branch members if Church Admin
  const scopedMembers = isChurchAdmin
    ? members.filter(m => m.church === targetChurch)
    : members;

  // Filtering
  const cleanSearch = (searchTerm || '').trim().toLowerCase();
  const filtered = scopedMembers.filter(m => {
    if (!m) return false;
    const fullName = (m.fullName || '').toLowerCase();
    const role = (m.role || '').toLowerCase();
    const phone = m.phone || '';
    const email = (m.email || '').toLowerCase();
    const id = (m.id || '').toLowerCase();
    const location = (m.location || '').toLowerCase();
    const occupation = (m.occupation || '').toLowerCase();

    const matchesSearch =
      !cleanSearch ||
      fullName.includes(cleanSearch) ||
      role.includes(cleanSearch) ||
      phone.includes((searchTerm || '').trim()) ||
      email.includes(cleanSearch) ||
      id.includes(cleanSearch) ||
      location.includes(cleanSearch) ||
      occupation.includes(cleanSearch);

    const matchesRole = roleFilter === 'All' || m.role === roleFilter;
    const matchesChurch = isChurchAdmin ? true : (churchFilter === 'All' || m.church === churchFilter);

    const fClass = m.foundationClass || 0;
    const matchesFoundation =
      foundationFilter === 'All' ||
      (foundationFilter === 'none' && fClass === 0) ||
      (foundationFilter === 'incomplete' && fClass > 0 && fClass < 7) ||
      (foundationFilter === 'done' && fClass >= 7) ||
      (/^[1-7]$/.test(foundationFilter) && fClass === Number(foundationFilter));

    const matchesLeader =
      leaderFilter === 'All' ||
      (leaderFilter === 'none' && !(m.invitedBy && m.invitedBy !== 'Self-Walkin / Self Invited')) ||
      m.invitedBy === leaderFilter;

    return matchesSearch && matchesRole && matchesChurch && matchesFoundation && matchesLeader;
  });

  const leaderOptions = Array.from(
    new Set(
      scopedMembers
        .map(m => m.invitedBy)
        .filter((n): n is string => !!n && n !== 'Self-Walkin / Self Invited' && n !== 'Direct / Self')
    )
  ).sort();

  const churchOptions = Array.from(
    new Set([
      ...(churches || []).map(c => c?.name).filter((n): n is string => !!n),
      ...members.map(m => m?.church).filter((n): n is string => !!n)
    ])
  ).sort();

  const totalResults = filtered.length;
  const totalPages = Math.ceil(totalResults / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedMembers = filtered.slice(startIndex, startIndex + itemsPerPage);

  const handleExportCSV = () => {
    const headers = ['ID', 'Full Name', 'Role', 'Phone', 'Email', 'Occupation', 'Education', 'Location', 'Church', 'Foundation Class', 'Leader / Cell', 'Date of Birth', 'Join Date'];
    const rows = filtered.map(m => [
      m.id,
      `"${m.fullName}"`,
      m.role,
      `"${m.phone}"`,
      m.email || '',
      `"${m.occupation}"`,
      `"${m.education}"`,
      `"${m.location}"`,
      `"${m.church}"`,
      m.foundationClass || 0,
      `"${m.invitedBy || ''}"`,
      m.dob || '',
      m.joinDate
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `CE_Korle_Bu_Members_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 flex flex-col h-full">

      {/* Header & Main Actions */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 shrink-0">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full mb-1">
            <span className="material-symbols-outlined text-[14px]">database</span>
            {isChurchAdmin ? `${targetChurch} Directory • ${scopedMembers.length} Branch Members` : `Group Directory • ${members.length} Total Records`}
          </div>
          <h1 className="font-display text-2xl md:text-4xl font-extrabold text-slate-900 tracking-tight">
            Member Database
          </h1>
          <p className="font-body text-xs md:text-sm text-slate-500 mt-1">
            Filter, manage, export, and inspect digital ID passes for members across Korle Bu group.
          </p>
        </div>

        {/* Search, Filter, Export CSV */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search Box with Real-Time Filtering by Name, Role, Phone */}
          <div className="relative flex-1 sm:flex-none">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
              search
            </span>
            <input
              type="text"
              placeholder="Search by name, role, or phone number..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-9 pr-9 py-2 w-full sm:w-80 bg-white border border-slate-200 rounded-xl font-body text-xs text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none transition-all placeholder:text-slate-400 font-medium shadow-sm"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setCurrentPage(1);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full w-5 h-5 flex items-center justify-center text-[12px] cursor-pointer transition-colors"
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filter Toggle */}
          <div className="relative">
            <button
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              className={`flex items-center gap-1.5 px-3 py-2 border rounded-xl bg-white text-xs font-semibold transition-all cursor-pointer ${roleFilter !== 'All' || churchFilter !== 'All' || foundationFilter !== 'All' || leaderFilter !== 'All'
                  ? 'border-blue-600 bg-blue-50 text-blue-600'
                  : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
            >
              <span className="material-symbols-outlined text-[18px]">tune</span>
              <span>Filter</span>
              {(roleFilter !== 'All' || churchFilter !== 'All' || foundationFilter !== 'All' || leaderFilter !== 'All') && (
                <span className="w-2 h-2 rounded-full bg-blue-600"></span>
              )}
            </button>

            {showFilterDropdown && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-sm z-50 p-4 space-y-4 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <h4 className="font-semibold text-xs text-slate-900">Filter Directory</h4>
                  <button
                    onClick={() => { setRoleFilter('All'); setChurchFilter('All'); setFoundationFilter('All'); setLeaderFilter('All'); }}
                    className="text-xs text-blue-600 hover:underline font-semibold"
                  >
                    Reset All
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Role Type</label>
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value as any)}
                    className="w-full border border-slate-200 rounded-xl p-2 text-xs bg-slate-50 font-medium"
                  >
                    <option value="All">All Roles</option>
                    <option value="Leader">Leader</option>
                    <option value="Member">Member</option>
                    <option value="First Timer">First Timer</option>

                  </select>
                </div>

                {!isChurchAdmin && (
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Church Branch</label>
                    <select
                      value={churchFilter}
                      onChange={(e) => setChurchFilter(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl p-2 text-xs bg-slate-50 font-medium"
                    >
                      <option value="All">All Churches</option>
                      {churchOptions.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Foundation School</label>
                  <select
                    value={foundationFilter}
                    onChange={(e) => { setFoundationFilter(e.target.value); setCurrentPage(1); }}
                    className="w-full border border-slate-200 rounded-xl p-2 text-xs bg-slate-50 font-medium"
                  >
                    <option value="All">All members</option>
                    <option value="none">Not enrolled</option>
                    <option value="incomplete">Not yet finished</option>
                    <option value="done">Finished all 7</option>
                    {[1, 2, 3, 4, 5, 6, 7].map(n => (
                      <option key={n} value={String(n)}>Class {n}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Leader / Cell</label>
                  <select
                    value={leaderFilter}
                    onChange={(e) => { setLeaderFilter(e.target.value); setCurrentPage(1); }}
                    className="w-full border border-slate-200 rounded-xl p-2 text-xs bg-slate-50 font-medium"
                  >
                    <option value="All">All leaders</option>
                    <option value="none">No leader yet</option>
                    {leaderOptions.map(l => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={() => setShowFilterDropdown(false)}
                  className="w-full bg-slate-900 text-white py-2 rounded-xl text-xs font-bold cursor-pointer hover:bg-slate-800 transition-colors"
                >
                  Apply Filters
                </button>
              </div>
            )}
          </div>

          {/* Export CSV Button */}
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-100 font-bold text-xs rounded-xl transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            <span>Export CSV</span>
          </button>

          {/* Add New Member Button */}
          <button
            onClick={() => onNavigate('register')}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-slate-800 transition-all cursor-pointer shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">person_add</span>
            <span>New Member</span>
          </button>
        </div>
      </div>

      {/* Active Search & Filter Feedback Bar */}
      {(searchTerm || roleFilter !== 'All' || foundationFilter !== 'All' || leaderFilter !== 'All' || (!isChurchAdmin && churchFilter !== 'All')) && (
        <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 text-xs text-blue-900">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="material-symbols-outlined text-[16px] text-blue-700">filter_alt</span>
            <span className="font-semibold">Real-Time Results:</span>
            <span className="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-md">
              {totalResults} {totalResults === 1 ? 'member' : 'members'} found
            </span>
            {searchTerm && (
              <span className="bg-white border border-blue-200 px-2 py-0.5 rounded-md text-xs text-blue-950">
                Search: <strong className="font-semibold text-blue-700">"{searchTerm}"</strong>
              </span>
            )}
            {roleFilter !== 'All' && (
              <span className="bg-white border border-blue-200 px-2 py-0.5 rounded-md text-xs text-blue-950">
                Role: <strong className="font-semibold text-blue-700">{roleFilter}</strong>
              </span>
            )}
            {!isChurchAdmin && churchFilter !== 'All' && (
              <span className="bg-white border border-blue-200 px-2 py-0.5 rounded-md text-xs text-blue-950">
                Church: <strong className="font-semibold text-blue-700">{churchFilter}</strong>
              </span>
            )}
            {foundationFilter !== 'All' && (
              <span className="bg-white border border-blue-200 px-2 py-0.5 rounded-md text-xs text-blue-950">
                Foundation School: <strong className="font-semibold text-blue-700">{
                  foundationFilter === 'none' ? 'Not enrolled'
                    : foundationFilter === 'incomplete' ? 'Not yet finished'
                      : foundationFilter === 'done' ? 'Finished all 7'
                        : `Class ${foundationFilter}`
                }</strong>
              </span>
            )}
            {leaderFilter !== 'All' && (
              <span className="bg-white border border-blue-200 px-2 py-0.5 rounded-md text-xs text-blue-950">
                Leader: <strong className="font-semibold text-blue-700">{leaderFilter === 'none' ? 'No leader yet' : leaderFilter}</strong>
              </span>
            )}
          </div>
          <button
            onClick={() => {
              setSearchTerm('');
              setRoleFilter('All');
              setChurchFilter('All');
              setFoundationFilter('All');
              setLeaderFilter('All');
              setCurrentPage(1);
            }}
            className="text-xs text-blue-700 hover:text-blue-900 font-bold underline cursor-pointer"
          >
            Clear Filters
          </button>
        </div>
      )}

      {selectedIds.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-bold text-blue-900">{selectedIds.size} selected</span>
          <select defaultValue="" onChange={(e) => { const v = Number(e.target.value); if (e.target.value !== '') bulkUpdate(m => ({ ...m, foundationClass: v })); e.target.value = ''; }} aria-label="Set Foundation School class" className="bg-white border border-slate-200 rounded-xl px-2 py-1.5 font-semibold">
            <option value="">Set Foundation class…</option>
            {[0,1,2,3,4,5,6,7].map(n => <option key={n} value={n}>{n === 7 ? 'Completed (7/7)' : `Class ${n}`}</option>)}
          </select>
          {leaders.length > 0 && (
            <select defaultValue="" onChange={(e) => { const l = leaders.find(x => x.id === e.target.value); if (l) bulkUpdate(m => ({ ...m, invitedBy: l.fullName, invitedByLeaderId: l.id })); e.target.value = ''; }} aria-label="Assign leader" className="bg-white border border-slate-200 rounded-xl px-2 py-1.5 font-semibold">
              <option value="">Assign leader…</option>
              {leaders.map(l => <option key={l.id} value={l.id}>{l.fullName}</option>)}
            </select>
          )}
          {onDeleteMember && <button onClick={bulkDelete} className="px-3 py-1.5 rounded-xl bg-red-600 text-white font-bold cursor-pointer">Delete</button>}
          <button onClick={() => setSelectedIds(new Set())} className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 font-bold cursor-pointer">Clear</button>
        </div>
      )}

      {/* Table Container */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col shadow-sm flex-1">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead className="bg-slate-50/80 sticky top-0 z-10 border-b border-slate-200">
              <tr>
                <th className="py-3.5 pl-4 w-8">
                  <input type="checkbox" aria-label="Select all on this page" checked={paginatedMembers.length > 0 && paginatedMembers.every(m => selectedIds.has(m.id))} onChange={(e) => setSelectedIds(prev => { const n = new Set(prev); paginatedMembers.forEach(m => e.target.checked ? n.add(m.id) : n.delete(m.id)); return n; })} />
                </th>
                <th className="py-3.5 px-4 text-xs font-bold text-slate-400 ">
                  Member Details
                </th>
                <th className="py-3.5 px-4 text-xs font-bold text-slate-400 ">
                  Contact
                </th>
                <th className="py-3.5 px-4 text-xs font-bold text-slate-400 ">
                  Occupation & Edu
                </th>
                <th className="py-3.5 px-4 text-xs font-bold text-slate-400 ">
                  Gender & Status
                </th>
                <th className="py-3.5 px-4 text-xs font-bold text-slate-400 ">
                  Residential Area
                </th>
                <th className="py-3.5 px-4 text-xs font-bold text-slate-400 ">
                  Church
                </th>
                <th className="py-3.5 px-4 text-xs font-bold text-slate-400 text-right">
                  Action
                </th>
              </tr>
            </thead>

            <tbody className="font-body text-xs divide-y divide-slate-100">
              {paginatedMembers.length > 0 ? (
                paginatedMembers.map((member) => (
                  <tr
                    key={member.id}
                    className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                    onClick={() => onSelectMemberForCard(member)}
                  >
                    <td className="py-3.5 pl-4" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" aria-label={`Select ${member.fullName}`} checked={selectedIds.has(member.id)} onChange={() => toggleSel(member.id)} />
                    </td>
                    {/* Name + Role Badge */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <MemberPhoto
                          photoUrl={member.photoUrl}
                          size={36}
                          initials={member.initials || (member.fullName ? member.fullName.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'MB')}
                        />
                        <div>
                          <div className="font-bold text-xs text-slate-900 group-hover:text-blue-600 transition-colors flex items-center gap-2">
                            <span>{member.fullName}</span>
                            <span className="text-xs text-slate-400 font-normal">{member.id}</span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {member.role === 'Leader' && (
                              <span className="bg-blue-100 text-blue-900 text-xs font-bold px-2 py-0.5 rounded-md border border-blue-100">
                                Leader
                              </span>
                            )}
                            {member.role === 'Member' && (
                              <span className="bg-emerald-50 text-emerald-800 text-xs font-bold px-2 py-0.5 rounded-md border border-emerald-200">
                                Member
                              </span>
                            )}
                            {member.role === 'First Timer' && (
                              <span className="bg-amber-50 text-amber-800 text-xs font-bold px-2 py-0.5 rounded-md border border-amber-200">
                                First Timer
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Contact */}
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-800">{member.phone}</div>
                      <div className="text-slate-400 mt-0.5">{member.email || '--'}</div>
                    </td>

                    {/* Occupation & Education */}
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-800">{member.occupation}</div>
                      <div className="text-slate-400 text-xs">{member.education}</div>
                    </td>

                    {/* Gender & marital status */}
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-800">{member.gender || '—'}</div>
                      <div className="text-slate-400 text-xs">{member.maritalStatus || '—'}</div>
                    </td>

                    {/* Location */}
                    <td className="py-3.5 px-4 font-medium text-slate-700">
                      {member.location}
                    </td>

                    {/* Church Tag + group names */}
                    <td className="py-3.5 px-4">
                      {member.church === 'Unassigned' ? (
                        <span className="text-slate-400 italic">Unassigned</span>
                      ) : (
                        <span className="px-2.5 py-1 bg-slate-100 rounded-lg font-medium text-slate-800 border border-slate-200">
                          {member.church}
                        </span>
                      )}
                      {(() => {
                        const g = groupNamesForMember(member);
                        const parts = [g.className, g.cellName, g.pcfName].filter(Boolean);
                        if (parts.length === 0) return null;
                        return (
                          <div className="text-[11px] text-slate-500 mt-1 leading-snug">
                            {parts.join(' • ')}
                          </div>
                        );
                      })()}
                    </td>

                    {/* Actions Menu */}
                    <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => onSelectMemberForCard(member)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                        title="View Digital ID Pass"
                      >
                        <span className="material-symbols-outlined text-[16px]">badge</span>
                        <span>Pass</span>
                      </button>
                      <button
                        onClick={() => setEditingMember(member)}
                        className="ml-1.5 inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                        title="Edit member"
                      >
                        <span className="material-symbols-outlined text-[16px]">edit</span>
                      </button>
                      <button
                        onClick={() => setDeletingMember(member)}
                        className="ml-1.5 inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                        title="Delete member"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-xs text-slate-500">
                    <div className="max-w-md mx-auto space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                        <span className="material-symbols-outlined text-[24px]">search_off</span>
                      </div>
                      <p className="font-semibold text-slate-800 text-sm">No members found</p>
                      <p className="text-slate-500 leading-relaxed text-xs">
                        {searchTerm ? (
                          <>
                            No records match <strong className="text-slate-900">"{searchTerm}"</strong>. Check for typos or search by full name, specific role (e.g. Leader, First Timer), or phone number.
                          </>
                        ) : (
                          'No records match the selected filter criteria.'
                        )}
                      </p>
                      {(searchTerm || roleFilter !== 'All' || foundationFilter !== 'All' || leaderFilter !== 'All' || (!isChurchAdmin && churchFilter !== 'All')) && (
                        <button
                          type="button"
                          onClick={() => {
                            setSearchTerm('');
                            setRoleFilter('All');
                            setChurchFilter('All');
                            setCurrentPage(1);
                          }}
                          className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 cursor-pointer shadow-xs"
                        >
                          <span className="material-symbols-outlined text-[14px]">refresh</span>
                          <span>Reset Search & Filters</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer / Pagination */}
        <div className="border-t border-slate-200 px-4 py-3 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="text-xs text-slate-500">
            Showing <span className="font-bold text-slate-900">{totalResults > 0 ? startIndex + 1 : 0}</span> to{' '}
            <span className="font-bold text-slate-900">{Math.min(startIndex + itemsPerPage, totalResults)}</span> of{' '}
            <span className="font-bold text-slate-900">{totalResults}</span> entries
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="p-1.5 border border-slate-200 bg-white rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            </button>
            <span className="text-xs font-bold px-2 text-slate-900">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="p-1.5 border border-slate-200 bg-white rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </div>
        </div>
      </div>


      {editingMember && (
        <EditRecordModal
          title="Edit Member"
          subtitle={`${editingMember.fullName} • ${editingMember.id}`}
          icon="person"
          values={editingMember as any}
          fields={[
            { key: 'fullName', label: 'Full Name', required: true },
            { key: 'phone', label: 'Phone', type: 'tel' },
            { key: 'email', label: 'Email', type: 'email' },
            { key: 'dob', label: 'Date of Birth', type: 'date' },
            { key: 'role', label: 'Role', type: 'select', options: ['Member', 'Leader', 'First Timer'] },
            { key: 'gender', label: 'Gender', type: 'select', options: ['Male', 'Female'] },
            { key: 'maritalStatus', label: 'Marital Status', type: 'select', options: ['Single', 'Married', 'Engaged', 'Divorced', 'Widowed'] },
            { key: 'occupation', label: 'Occupation' },
            { key: 'education', label: 'Education' },
            { key: 'location', label: 'Location' },
            ...(isChurchAdmin
              ? []
              : [(churches && churches.length > 0
                ? { key: 'church', label: 'Church Branch', type: 'select' as const, options: churches.map(c => c.name) }
                : { key: 'church', label: 'Church Branch' })]),
            ...(leaders && leaders.length > 0
              ? [{
                  key: 'invitedBy',
                  label: 'Assigned Leader',
                  type: 'select' as const,
                  options: ['Self-Walkin / Self Invited', ...leaders.map(l => `${l.fullName} — ${l.church || 'Unassigned'}`)]
                }]
              : []),
            { key: 'serviceCount', label: 'Service Count', type: 'number' },
            { key: 'foundationClass', label: 'Foundation Class', type: 'number' }
          ]}
          onCancel={() => setEditingMember(null)}
          onSave={(vals) => {
            const next = { ...editingMember, ...vals } as Member;
            // Turn the "Name — Church" choice back into a real leader link
            const chosen = String((vals as any).invitedBy || '');
            if (chosen === 'Self-Walkin / Self Invited') {
              next.invitedBy = 'Self-Walkin / Self Invited';
              next.invitedByLeaderId = undefined;
            } else if (chosen) {
              const cleanName = chosen.split(' — ')[0].trim();
              const match = (leaders || []).find(l => `${l.fullName} — ${l.church || 'Unassigned'}` === chosen)
                || (leaders || []).find(l => l.fullName === cleanName);
              next.invitedBy = cleanName;
              next.invitedByLeaderId = match?.id;
              // Moving a member to a leader also moves them to that leader's church
              if (match?.church && !(vals as any).church) next.church = match.church;
            }
            onUpdateMember?.(next);
            setEditingMember(null);
          }}
        />
      )}

      {deletingMember && (
        <ConfirmDeleteDialog
          title="Delete Member"
          message={`This permanently removes ${deletingMember.fullName} and their attendance history from the database.`}
          onCancel={() => setDeletingMember(null)}
          onConfirm={() => {
            onDeleteMember?.(deletingMember.id);
            setDeletingMember(null);
          }}
        />
      )}
    </div>
  );
};
