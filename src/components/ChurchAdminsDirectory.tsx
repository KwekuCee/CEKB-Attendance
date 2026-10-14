import React, { useState } from 'react';
import { ChurchAdminAccount, ViewType } from '../types';
import { motion } from 'motion/react';
import { EditRecordModal, ConfirmDeleteDialog } from './EditRecordModal';

interface ChurchAdminsDirectoryProps {
  churchAdmins: ChurchAdminAccount[];
  onNavigate: (view: ViewType) => void;
  onUpdateChurchAdmin?: (admin: ChurchAdminAccount) => void;
  onDeleteChurchAdmin?: (adminId: string) => void;
  onStartPageTour?: () => void;
}

export const ChurchAdminsDirectory: React.FC<ChurchAdminsDirectoryProps> = ({
  churchAdmins,
  onNavigate,
  onUpdateChurchAdmin,
  onDeleteChurchAdmin,
  onStartPageTour
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'All' | 'Active' | 'Pending Verification'>('All');
  const [editingAdmin, setEditingAdmin] = useState<ChurchAdminAccount | null>(null);
  const [deletingAdmin, setDeletingAdmin] = useState<ChurchAdminAccount | null>(null);

  const cleanQuery = (searchQuery || '').trim().toLowerCase();
  const filteredAdmins = churchAdmins.filter(admin => {
    if (!admin) return false;
    const nameStr = (admin.adminName || '').toLowerCase();
    const emailStr = (admin.adminEmail || '').toLowerCase();
    const churchStr = (admin.churchName || '').toLowerCase();
    const phoneStr = admin.adminPhone || '';

    const matchesSearch =
      !cleanQuery ||
      nameStr.includes(cleanQuery) ||
      emailStr.includes(cleanQuery) ||
      churchStr.includes(cleanQuery) ||
      phoneStr.includes((searchQuery || '').trim());
    
    const matchesStatus = filterStatus === 'All' || admin.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-4 md:p-8 w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full mb-2 border border-blue-200">
            <span className="material-symbols-outlined text-[14px]">badge</span>
            Registered Church Admins
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">
            Church Admins Directory
          </h1>
          <p className="text-sm text-slate-500 mt-2">
            Manage and monitor all registered church branch administrators across the group
          </p>
        </div>

        {onStartPageTour && (
          <button
            onClick={onStartPageTour}
            className="border border-blue-200 bg-blue-50/70 hover:bg-blue-100 text-blue-700 font-bold text-xs py-2.5 px-3.5 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
            title="Tour this page step-by-step"
          >
            <span className="material-symbols-outlined text-[17px]">tour</span>
            <span>Tour Page</span>
          </button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-bold text-slate-500 ">Total Admins</p>
          <p className="font-display text-2xl font-extrabold text-slate-900 mt-2">{churchAdmins.length}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-bold text-slate-500 ">Active</p>
          <p className="font-display text-2xl font-extrabold text-emerald-600 mt-2">
            {churchAdmins.filter(a => a.status === 'Active').length}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-bold text-slate-500 ">Pending Verification</p>
          <p className="font-display text-2xl font-extrabold text-blue-700 mt-2">
            {churchAdmins.filter(a => a.status === 'Pending Verification').length}
          </p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-4 shadow-sm">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label className="text-xs font-bold text-slate-500 mb-1 block">
              Search
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
              <input
                type="text"
                placeholder="Search by name, email, church, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none transition-all placeholder:text-slate-400"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 mb-1 block">
              Filter Status
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none cursor-pointer"
            >
              <option>All</option>
              <option>Active</option>
              <option>Pending Verification</option>
            </select>
          </div>
        </div>
      </div>

      {/* Admins List */}
      {filteredAdmins.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAdmins.map((admin, index) => (
            <motion.div
              key={admin.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-sm hover:border-blue-300/50 transition-all"
            >
              {/* Header with Status Badge */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-bold text-sm text-slate-900">{admin.adminName}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{admin.churchName}</p>
                </div>
                <span
                  className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                    admin.status === 'Active'
                      ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                      : 'bg-blue-100 text-blue-700 border border-blue-100'
                  }`}
                >
                  {admin.status}
                </span>
              </div>

              {/* Contact Info */}
              <div className="space-y-2 mb-4 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2 text-xs">
                  <span className="material-symbols-outlined text-slate-400 text-[16px]">mail</span>
                  <a href={`mailto:${admin.adminEmail}`} className="text-blue-600 hover:underline truncate">
                    {admin.adminEmail}
                  </a>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="material-symbols-outlined text-slate-400 text-[16px]">phone</span>
                  <a href={`tel:${admin.adminPhone}`} className="text-blue-600 hover:underline">
                    {admin.adminPhone}
                  </a>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="material-symbols-outlined text-slate-400 text-[16px]">location_on</span>
                  <span className="text-slate-600">{admin.zone}</span>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-2 text-xs mb-4">
                <div>
                  <span className="text-slate-400 uppercase block mb-0.5">Joined Date</span>
                  <span className="text-slate-700 font-semibold">{admin.joinedDate}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditingAdmin(admin)}
                  className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs py-2 rounded-lg transition-colors cursor-pointer inline-flex items-center justify-center gap-1"
                >
                  <span className="material-symbols-outlined text-[16px]">edit</span>
                  Edit
                </button>
                <button
                  onClick={() => setDeletingAdmin(admin)}
                  className="flex-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs py-2 rounded-lg transition-colors cursor-pointer inline-flex items-center justify-center gap-1"
                >
                  <span className="material-symbols-outlined text-[16px]">delete</span>
                  Delete
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
          <span className="material-symbols-outlined text-slate-300 text-[48px] block mb-2 mx-auto">person_search</span>
          <p className="text-sm text-slate-500">No church admins found matching your criteria</p>
        </div>
      )}

      {/* Footer Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-center">
        <p className="text-xs text-slate-600">
          <strong>{filteredAdmins.length}</strong> of <strong>{churchAdmins.length}</strong> admins shown
        </p>
      </div>

      {editingAdmin && (
        <EditRecordModal
          title="Edit Church Admin"
          subtitle={`${editingAdmin.adminName} • ${editingAdmin.churchName}`}
          icon="manage_accounts"
          values={editingAdmin as any}
          fields={[
            { key: 'adminName', label: 'Admin Name', required: true },
            { key: 'adminEmail', label: 'Email', type: 'email' },
            { key: 'adminPhone', label: 'Phone', type: 'tel' },
            { key: 'churchName', label: 'Church Branch' },
            { key: 'zone', label: 'Zone' },
            { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Pending Verification'] }
          ]}
          onCancel={() => setEditingAdmin(null)}
          onSave={(vals) => {
            onUpdateChurchAdmin?.({ ...editingAdmin, ...vals } as ChurchAdminAccount);
            setEditingAdmin(null);
          }}
        />
      )}

      {deletingAdmin && (
        <ConfirmDeleteDialog
          title="Delete Church Admin"
          message={`This removes the admin account for ${deletingAdmin.adminName}.`}
          onCancel={() => setDeletingAdmin(null)}
          onConfirm={() => {
            onDeleteChurchAdmin?.(deletingAdmin.id);
            setDeletingAdmin(null);
          }}
        />
      )}
    </div>
  );
};
