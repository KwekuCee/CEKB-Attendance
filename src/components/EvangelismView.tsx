import React, { useEffect, useMemo, useState } from 'react';
import type { AuthSessionUser, EvangelismRecord, Leader, Member, ChurchBranch } from '../types';
import { Button } from './Button';
import {
  fetchEvangelismRecords,
  convertEvangelismToMember,
  exportEvangelismRecords,
  downloadEvangelismTemplate,
} from '../lib/evangelism';
import { useToast } from '../context/ToastContext';

interface EvangelismViewProps {
  user: AuthSessionUser;
  leaders?: Leader[];
  members?: Member[];
  churches?: ChurchBranch[];
  onAddMember?: (member: Member) => void;
  onStartPageTour?: () => void;
}

export const EvangelismView: React.FC<EvangelismViewProps> = ({
  user,
  leaders = [],
  members = [],
  churches = [],
  onAddMember,
  onStartPageTour,
}) => {
  const toast = useToast();
  const [records, setRecords] = useState<EvangelismRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLeader, setSelectedLeader] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const isSuperadmin = user.role === 'Superadmin';
  const targetChurch = isSuperadmin ? 'All' : user.church;

  const loadData = async () => {
    setLoading(true);
    const data = await fetchEvangelismRecords(targetChurch);
    setRecords(data);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [user.church, isSuperadmin]);

  // Leaders belonging to this church
  const churchLeaders = useMemo(() => {
    return leaders.filter(l => isSuperadmin || (l.church || '').toLowerCase() === user.church.toLowerCase());
  }, [leaders, user.church, isSuperadmin]);

  // Metrics
  const stats = useMemo(() => {
    const total = records.length;
    const attended = records.filter(r => r.status === 'Attended Church').length;
    const followUps = records.filter(r => r.status !== 'Attended Church').length;
    const conversion = total > 0 ? Math.round((attended / total) * 100) : 0;
    const uniqueLeaders = new Set(records.map(r => r.leaderName)).size;
    return { total, attended, followUps, conversion, uniqueLeaders };
  }, [records]);

  // Leader breakdown
  const leaderBreakdown = useMemo(() => {
    const map = new Map<string, { leaderName: string; cell: string; totalWon: number; attended: number }>();
    records.forEach(r => {
      const key = r.leaderName || 'Unknown Leader';
      const existing = map.get(key) || {
        leaderName: key,
        cell: r.cellOrPcfName || 'Cell',
        totalWon: 0,
        attended: 0,
      };
      existing.totalWon += 1;
      if (r.status === 'Attended Church') existing.attended += 1;
      map.set(key, existing);
    });
    return Array.from(map.values()).sort((a, b) => b.totalWon - a.totalWon);
  }, [records]);

  // Filtered records
  const filtered = useMemo(() => {
    return records.filter(r => {
      if (selectedLeader !== 'All' && r.leaderName !== selectedLeader) return false;
      if (selectedStatus !== 'All' && r.status !== selectedStatus) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = (r.fullName || '').toLowerCase().includes(q);
        const matchesPhone = (r.phone || '').toLowerCase().includes(q);
        const matchesLeader = (r.leaderName || '').toLowerCase().includes(q);
        const matchesLocation = (r.location || '').toLowerCase().includes(q);
        if (!matchesName && !matchesPhone && !matchesLeader && !matchesLocation) return false;
      }
      return true;
    });
  }, [records, selectedLeader, selectedStatus, searchQuery]);

  const handleMoveToMembers = async (rec: EvangelismRecord) => {
    if (!onAddMember) {
      toast.showError('Action Unavailable', 'Member database connection is currently read-only.');
      return;
    }

    try {
      const newMember = await convertEvangelismToMember(rec, onAddMember);
      toast.showCheckIn(
        newMember.fullName,
        `Added to ${rec.church} Member Database as First Timer (Soul won by ${rec.leaderName})`
      );
      loadData();
    } catch (err: any) {
      toast.showError('Could Not Move Member', err?.message || 'Failed to update member database.');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 block mb-1">
            {isSuperadmin ? 'All Churches' : user.church} • Soul Winning Portal
          </span>
          <h1 className="text-xl md:text-2xl font-headline font-bold text-slate-900 tracking-tight">
            Evangelism & Soulwinning Analytics
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Monitor outreach data submitted by cell leaders, track soul winning performance, and see who has attended church.
          </p>
        </div>

        <div data-tour="evangelism-actions" className="flex flex-wrap items-center gap-2">
          {onStartPageTour && (
            <Button
              variant="secondary"
              onClick={onStartPageTour}
              className="border border-blue-200 bg-blue-50/70 hover:bg-blue-100 text-blue-700 text-xs font-bold py-2 px-3 rounded-xl flex items-center gap-1.5 shadow-xs"
              title="Tour this page step-by-step"
            >
              <span className="material-symbols-outlined text-[17px]">tour</span>
              <span className="hidden sm:inline">Tour Page</span>
            </Button>
          )}

          <Button
            variant="secondary"
            onClick={() => downloadEvangelismTemplate('xlsx')}
            title="Download blank template"
          >
            <span className="material-symbols-outlined text-base">download</span>
            <span>Download Template</span>
          </Button>

          {records.length > 0 && (
            <Button
              onClick={() => exportEvangelismRecords(records, `${user.church}_Evangelism_Report`)}
            >
              <span className="material-symbols-outlined text-base">file_download</span>
              <span>Export Evangelism Data</span>
            </Button>
          )}
        </div>
      </div>

      {/* Metric Cards */}
      <div data-tour="evangelism-stats" className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Total Souls Won</span>
            <span className="material-symbols-outlined text-blue-600 text-lg">campaign</span>
          </div>
          <p className="font-stat text-2xl font-bold text-slate-900 mt-2">{stats.total}</p>
          <span className="text-[11px] text-slate-400">Total outreach contacts</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Joined Church</span>
            <span className="material-symbols-outlined text-emerald-600 text-lg">how_to_reg</span>
          </div>
          <p className="font-stat text-2xl font-bold text-emerald-700 mt-2">{stats.attended}</p>
          <span className="text-[11px] text-emerald-600">Moved into member database</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Follow-ups In Progress</span>
            <span className="material-symbols-outlined text-amber-600 text-lg">phone_in_talk</span>
          </div>
          <p className="font-stat text-2xl font-bold text-amber-700 mt-2">{stats.followUps}</p>
          <span className="text-[11px] text-slate-400">Awaiting first church visit</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Conversion Rate</span>
            <span className="material-symbols-outlined text-purple-600 text-lg">trending_up</span>
          </div>
          <p className="font-stat text-2xl font-bold text-purple-700 mt-2">{stats.conversion}%</p>
          <span className="text-[11px] text-slate-400">From {stats.uniqueLeaders} active leaders</span>
        </div>
      </div>

      {/* Leader Performance Breakdown */}
      {leaderBreakdown.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="font-headline font-bold text-sm text-slate-900">
                Outreach Leader Breakdown
              </h2>
              <p className="text-xs text-slate-500">Totals won and brought to church by cell leaders</p>
            </div>
            <span className="text-xs font-semibold text-slate-500">
              {leaderBreakdown.length} reporting leaders
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {leaderBreakdown.map(l => {
              const rate = l.totalWon > 0 ? Math.round((l.attended / l.totalWon) * 100) : 0;
              return (
                <div
                  key={l.leaderName}
                  className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2 hover:border-blue-300 transition"
                >
                  <div className="flex justify-between items-start">
                    <div className="min-w-0 flex-1">
                      <strong className="block text-xs text-slate-900 truncate font-headline">
                        {l.leaderName}
                      </strong>
                      <span className="block text-[11px] text-slate-400 truncate">{l.cell}</span>
                    </div>
                    <span className="text-[11px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                      {l.totalWon} won
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-[11px] pt-1 border-t border-slate-200/60">
                    <span className="text-emerald-700 font-semibold">{l.attended} joined church</span>
                    <span className="text-slate-500">{rate}% conv.</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto">
            {(['All', 'Soul Won', 'Follow-up', 'Attended Church'] as const).map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => setSelectedStatus(tab)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                  selectedStatus === tab
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab === 'All' ? 'All Contacts' : tab}
              </button>
            ))}
          </div>

          {/* Leader Filter */}
          {churchLeaders.length > 0 && (
            <select
              value={selectedLeader}
              onChange={e => setSelectedLeader(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-blue-500/30"
            >
              <option value="All">All Leaders</option>
              {churchLeaders.map(l => (
                <option key={l.id} value={l.fullName}>{l.fullName}</option>
              ))}
            </select>
          )}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[220px]">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-base">
            search
          </span>
          <input
            type="text"
            placeholder="Search contact, phone, leader..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        </div>
      </div>

      {/* Evangelism Contacts Table */}
      <div data-tour="evangelism-table" className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">
            <span className="material-symbols-outlined animate-spin text-xl text-blue-600 mb-1 block">
              sync
            </span>
            Loading evangelism records…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500 space-y-2">
            <span className="material-symbols-outlined text-4xl text-slate-300 block mb-2">campaign</span>
            <p className="font-bold text-slate-700">No evangelism records match the filter.</p>
            <p className="text-slate-400">Leaders can download the template from their portal and upload data after weekly outreaches.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Soul Won Name</th>
                  <th className="py-3 px-4">Phone</th>
                  <th className="py-3 px-4">Leader / Cell</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Date Won</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(item => {
                  const isAttended = item.status === 'Attended Church';
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {item.fullName}
                        {item.gender && (
                          <span className="text-[10px] text-slate-400 font-normal ml-1.5">
                            ({item.gender})
                          </span>
                        )}
                        {item.notes && (
                          <div className="text-[11px] text-slate-500 font-normal truncate max-w-xs mt-0.5">
                            {item.notes}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700 whitespace-nowrap">
                        <a href={`tel:${item.phone}`} className="hover:text-blue-600">
                          {item.phone}
                        </a>
                      </td>
                      <td className="py-3 px-4 text-slate-800">
                        <strong className="block">{item.leaderName}</strong>
                        <span className="text-[10px] text-slate-400">{item.cellOrPcfName || 'Cell'}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">{item.location || '—'}</td>
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap">{item.dateWon}</td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {isAttended ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <span className="material-symbols-outlined text-xs">verified</span>
                            In Member DB {item.memberId ? `(${item.memberId})` : ''}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                            <span className="material-symbols-outlined text-xs">flag</span>
                            Soul Won
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {!isAttended ? (
                          <Button
                            variant="secondary"
                            className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 text-xs py-1 px-2.5 font-bold"
                            onClick={() => handleMoveToMembers(item)}
                            title="Move to Church Member Database"
                          >
                            <span className="material-symbols-outlined text-sm">how_to_reg</span>
                            <span>Move to Members</span>
                          </Button>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Added</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
