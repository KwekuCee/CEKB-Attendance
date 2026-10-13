import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { AuthSessionUser, EvangelismRecord, Leader, Member } from '../types';
import { Button } from './Button';
import {
  fetchEvangelismRecords,
  saveEvangelismRecords,
  saveEvangelismRecord,
  convertEvangelismToMember,
  downloadEvangelismTemplate,
  parseEvangelismFile,
  exportEvangelismRecords,
} from '../lib/evangelism';
import { useToast } from '../context/ToastContext';

interface LeaderEvangelismPanelProps {
  user: AuthSessionUser;
  leader?: Leader;
  onAddMember?: (member: Member) => void;
}

export const LeaderEvangelismPanel: React.FC<LeaderEvangelismPanelProps> = ({
  user,
  leader,
  onAddMember,
}) => {
  const toast = useToast();
  const [records, setRecords] = useState<EvangelismRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Soul Won' | 'Follow-up' | 'Attended Church'>('All');

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [parsedPreview, setParsedPreview] = useState<EvangelismRecord[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [isSavingUpload, setIsSavingUpload] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manual Add Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [addName, setAddName] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [addGender, setAddGender] = useState<'Male' | 'Female'>('Male');
  const [addLocation, setAddLocation] = useState('Korle Bu, Accra');
  const [addDateWon, setAddDateWon] = useState(() => new Date().toISOString().slice(0, 10));
  const [addNotes, setAddNotes] = useState('');
  const [isSavingManual, setIsSavingManual] = useState(false);

  // Load records
  const loadRecords = async () => {
    setLoading(true);
    const data = await fetchEvangelismRecords(user.church, leader?.id);
    setRecords(data);
    setLoading(false);
  };

  useEffect(() => {
    loadRecords();
  }, [user.church, leader?.id]);

  // Derived metrics
  const stats = useMemo(() => {
    const total = records.length;
    const attended = records.filter(r => r.status === 'Attended Church').length;
    const followUps = records.filter(r => r.status === 'Follow-up' || r.status === 'Soul Won').length;
    const conversionRate = total > 0 ? Math.round((attended / total) * 100) : 0;
    return { total, attended, followUps, conversionRate };
  }, [records]);

  // Filtered records
  const filtered = useMemo(() => {
    return records.filter(r => {
      if (statusFilter !== 'All' && r.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = (r.fullName || '').toLowerCase().includes(q);
        const matchesPhone = (r.phone || '').toLowerCase().includes(q);
        const matchesLocation = (r.location || '').toLowerCase().includes(q);
        const matchesNotes = (r.notes || '').toLowerCase().includes(q);
        if (!matchesName && !matchesPhone && !matchesLocation && !matchesNotes) return false;
      }
      return true;
    });
  }, [records, statusFilter, searchQuery]);

  // Handle file select
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadFile(file);
    setUploadError('');
    setIsParsing(true);

    const leaderPayload = {
      id: leader?.id || `LDR-${Date.now()}`,
      fullName: leader?.fullName || user.name,
      cellOrPcfName: leader?.cellOrPcfName || '',
      church: user.church,
    };

    const res = await parseEvangelismFile(file, leaderPayload);
    setIsParsing(false);

    if (!res.success || res.records.length === 0) {
      setUploadError(res.error || 'Failed to parse file. Please verify column headers.');
      setParsedPreview([]);
    } else {
      setParsedPreview(res.records);
    }
  };

  // Confirm upload
  const handleConfirmUpload = async () => {
    if (parsedPreview.length === 0) return;
    setIsSavingUpload(true);
    await saveEvangelismRecords(parsedPreview);
    setIsSavingUpload(false);
    toast.showSuccess(
      'Evangelism Data Uploaded!',
      `Successfully saved ${parsedPreview.length} soul winning contacts to your church records.`
    );
    setShowUploadModal(false);
    setUploadFile(null);
    setParsedPreview([]);
    loadRecords();
  };

  // Manual contact addition
  const handleSaveManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addName.trim() || !addPhone.trim()) return;

    setIsSavingManual(true);
    const newRecord: EvangelismRecord = {
      id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      fullName: addName.trim(),
      phone: addPhone.trim(),
      gender: addGender,
      location: addLocation.trim() || 'Korle Bu, Accra',
      dateWon: addDateWon || new Date().toISOString().slice(0, 10),
      leaderId: leader?.id || `LDR-${Date.now()}`,
      leaderName: leader?.fullName || user.name,
      cellOrPcfName: leader?.cellOrPcfName || '',
      church: user.church,
      notes: addNotes.trim() || undefined,
      status: 'Soul Won',
      createdAt: new Date().toISOString(),
    };

    await saveEvangelismRecord(newRecord);
    setIsSavingManual(false);
    toast.showSuccess('Soul Won Saved', `${newRecord.fullName} was added to your evangelism list.`);
    setShowAddModal(false);
    setAddName('');
    setAddPhone('');
    setAddNotes('');
    loadRecords();
  };

  // Move to Church Members
  const handleMoveToChurch = async (rec: EvangelismRecord) => {
    if (!onAddMember) {
      toast.showError('Action Unavailable', 'Member database connection is currently read-only.');
      return;
    }

    try {
      const newMember = await convertEvangelismToMember(rec, onAddMember);
      toast.showCheckIn(
        newMember.fullName,
        `Moved to ${rec.church} Member Database as First Timer (Invited by ${rec.leaderName})`
      );
      loadRecords();
    } catch (err: any) {
      toast.showError('Could Not Move Member', err?.message || 'Failed to update member database.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Actions */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 block mb-1">
            Soul Winning & Outreach Tracker
          </span>
          <h2 className="text-xl md:text-2xl font-headline font-bold text-slate-900 tracking-tight">
            Evangelism Data Management
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-xl">
            Download the standard template, fill in people won during outreach, and upload. When they attend church, click "Came to Church" to add them straight to the member database.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Template Download Dropdown/Button */}
          <Button
            variant="secondary"
            onClick={() => downloadEvangelismTemplate('xlsx')}
            title="Download Excel template (.xlsx)"
          >
            <span className="material-symbols-outlined text-base">download</span>
            <span>Download Template</span>
          </Button>

          {/* Upload Button */}
          <Button
            onClick={() => {
              setUploadFile(null);
              setParsedPreview([]);
              setUploadError('');
              setShowUploadModal(true);
            }}
          >
            <span className="material-symbols-outlined text-base">upload_file</span>
            <span>Upload Filled Data</span>
          </Button>

          {/* Manual Add */}
          <Button
            variant="secondary"
            onClick={() => setShowAddModal(true)}
            title="Log single soul won"
          >
            <span className="material-symbols-outlined text-base">person_add</span>
            <span>Add Single Contact</span>
          </Button>

          {/* Export */}
          {records.length > 0 && (
            <Button
              variant="ghost"
              onClick={() => exportEvangelismRecords(records, `${user.church.replace(/\s+/g, '_')}_Evangelism`)}
              title="Export all to Excel"
            >
              <span className="material-symbols-outlined text-base">file_download</span>
            </Button>
          )}
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Total Souls Won</span>
            <span className="material-symbols-outlined text-blue-600 text-lg">campaign</span>
          </div>
          <p className="font-stat text-2xl font-bold text-slate-900 mt-2">{stats.total}</p>
          <span className="text-[11px] text-slate-400">Recorded through outreach</span>
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
            <span className="text-xs text-slate-500 font-medium">Follow-ups Active</span>
            <span className="material-symbols-outlined text-amber-600 text-lg">phone_in_talk</span>
          </div>
          <p className="font-stat text-2xl font-bold text-amber-700 mt-2">{stats.followUps}</p>
          <span className="text-[11px] text-slate-400">Awaiting church arrival</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Conversion Rate</span>
            <span className="material-symbols-outlined text-purple-600 text-lg">trending_up</span>
          </div>
          <p className="font-stat text-2xl font-bold text-purple-700 mt-2">{stats.conversionRate}%</p>
          <span className="text-[11px] text-slate-400">Outreach to church attendance</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto">
          {(['All', 'Soul Won', 'Follow-up', 'Attended Church'] as const).map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                statusFilter === tab
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab === 'All' ? 'All Contacts' : tab}
              {tab === 'Attended Church' && stats.attended > 0 && ` (${stats.attended})`}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[220px]">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-base">
            search
          </span>
          <input
            type="text"
            placeholder="Search name, phone, area..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition"
          />
        </div>
      </div>

      {/* Contacts List / Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">
            <span className="material-symbols-outlined animate-spin text-xl text-blue-600 mb-1 block">
              sync
            </span>
            Loading evangelism contacts…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <span className="material-symbols-outlined text-4xl text-slate-300">campaign</span>
            <h3 className="font-headline text-sm font-bold text-slate-700">No evangelism contacts found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchQuery || statusFilter !== 'All'
                ? 'Try adjusting your filters or search keywords.'
                : 'Download the upload template, fill in your outreach data, and upload it here.'}
            </p>
            <div className="pt-2 flex justify-center gap-2">
              <Button variant="secondary" onClick={() => downloadEvangelismTemplate('xlsx')}>
                <span className="material-symbols-outlined text-sm">download</span> Download Template
              </Button>
              <Button onClick={() => setShowUploadModal(true)}>
                <span className="material-symbols-outlined text-sm">upload_file</span> Upload Data
              </Button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Contact Person</th>
                  <th className="py-3 px-4">Phone / Contact</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Date Won</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(item => {
                  const isAttended = item.status === 'Attended Church';
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3 px-4 font-bold text-slate-900">
                        <div>{item.fullName}</div>
                        {item.gender && (
                          <span className="text-[10px] text-slate-400 font-normal">
                            {item.gender}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700">
                        <a
                          href={`tel:${item.phone}`}
                          className="hover:text-blue-600 inline-flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-xs text-slate-400">call</span>
                          {item.phone}
                        </a>
                      </td>
                      <td className="py-3 px-4 text-slate-600">{item.location || '—'}</td>
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap">{item.dateWon}</td>
                      <td className="py-3 px-4">
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
                      <td className="py-3 px-4 text-right">
                        {!isAttended ? (
                          <Button
                            variant="secondary"
                            className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 text-xs py-1 px-2.5 font-bold"
                            onClick={() => handleMoveToChurch(item)}
                            title="Mark as arrived at church and add to member database"
                          >
                            <span className="material-symbols-outlined text-sm">how_to_reg</span>
                            <span>Came to Church</span>
                          </Button>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Member linked</span>
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

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600 text-2xl">upload_file</span>
                <h3 className="font-headline font-bold text-base text-slate-900">Upload Evangelism Data</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3.5 bg-blue-50 border border-blue-100 rounded-2xl text-xs text-blue-900 space-y-1.5">
                <p className="font-bold flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm">info</span> How to upload:
                </p>
                <ol className="list-decimal list-inside space-y-1 text-blue-800 text-[11px]">
                  <li>Download our Excel or CSV template if you haven't yet.</li>
                  <li>Fill in the full name, phone number, location, and date for each soul won.</li>
                  <li>Upload the saved file below. We will preview the records for verification.</li>
                </ol>
              </div>

              {/* Template Download Quick Links */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => downloadEvangelismTemplate('xlsx')}
                  className="flex-1 py-2 px-3 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm">table_view</span> Download Excel (.xlsx)
                </button>
                <button
                  type="button"
                  onClick={() => downloadEvangelismTemplate('csv')}
                  className="flex-1 py-2 px-3 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm">description</span> Download CSV (.csv)
                </button>
              </div>

              {/* Dropzone / File Picker */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl p-6 text-center cursor-pointer bg-slate-50 hover:bg-blue-50/30 transition space-y-2"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <span className="material-symbols-outlined text-3xl text-blue-600 block">cloud_upload</span>
                <p className="text-xs font-bold text-slate-800">
                  {uploadFile ? uploadFile.name : 'Click to select filled file (.xlsx, .csv)'}
                </p>
                <p className="text-[11px] text-slate-400">
                  {uploadFile ? `${(uploadFile.size / 1024).toFixed(1)} KB` : 'Supports Excel spreadsheet and standard CSV'}
                </p>
              </div>

              {isParsing && (
                <div className="p-3 text-center text-xs text-blue-600 font-medium">
                  <span className="material-symbols-outlined animate-spin text-sm align-middle mr-1">sync</span>
                  Reading and validating rows…
                </div>
              )}

              {uploadError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">error</span>
                  <span>{uploadError}</span>
                </div>
              )}

              {/* Preview */}
              {parsedPreview.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">
                      Found {parsedPreview.length} valid contacts:
                    </span>
                    <span className="text-[11px] text-slate-500">Ready to save</span>
                  </div>

                  <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 text-xs">
                    {parsedPreview.slice(0, 10).map((p, i) => (
                      <div key={i} className="p-2 flex justify-between items-center">
                        <span className="font-semibold text-slate-900">{p.fullName}</span>
                        <span className="font-mono text-slate-500 text-[11px]">{p.phone}</span>
                      </div>
                    ))}
                    {parsedPreview.length > 10 && (
                      <div className="p-2 text-center text-[11px] text-slate-400 italic">
                        + {parsedPreview.length - 10} more rows
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <Button variant="ghost" onClick={() => setShowUploadModal(false)}>
                Cancel
              </Button>
              <Button
                disabled={parsedPreview.length === 0 || isSavingUpload}
                onClick={handleConfirmUpload}
              >
                {isSavingUpload ? (
                  <span>Saving…</span>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-base">save</span>
                    <span>Save {parsedPreview.length} Contacts</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Single Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <form
            onSubmit={handleSaveManual}
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600 text-2xl">person_add</span>
                <h3 className="font-headline font-bold text-base text-slate-900">Add Soul Won</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Samuel Adjei"
                  value={addName}
                  onChange={e => setAddName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    placeholder="+233 24 123 4567"
                    value={addPhone}
                    onChange={e => setAddPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Gender</label>
                  <select
                    value={addGender}
                    onChange={e => setAddGender(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Location / Area</label>
                  <input
                    type="text"
                    placeholder="e.g. Korle Bu Campus"
                    value={addLocation}
                    onChange={e => setAddLocation(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Date Won</label>
                  <input
                    type="date"
                    value={addDateWon}
                    onChange={e => setAddDateWon(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Notes / Prayer Requests</label>
                <textarea
                  rows={2}
                  placeholder="Notes from interaction, prayer needs..."
                  value={addNotes}
                  onChange={e => setAddNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <Button type="button" variant="ghost" onClick={() => setShowAddModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSavingManual}>
                {isSavingManual ? 'Saving…' : 'Save Contact'}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
