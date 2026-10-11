import React, { useState } from 'react';
import { motion } from 'motion/react';
import { SUPABASE_SQL_SCHEMA, SUPABASE_UPDATE_SQL } from '../data/supabase_schema';

export const DatabaseSchemaView: React.FC = () => {
  const [schemaMode, setSchemaMode] = useState<'update' | 'full'>('update');
  const [copied, setCopied] = useState(false);

  const activeSql = schemaMode === 'update' ? SUPABASE_UPDATE_SQL : SUPABASE_SQL_SCHEMA;

  const handleCopy = () => {
    navigator.clipboard.writeText(activeSql);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleDownload = () => {
    const filename = schemaMode === 'update' ? 'cekb-database-updates.sql' : 'cekb-full-schema.sql';
    const blob = new Blob([activeSql], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const el = document.createElement('a');
    el.href = url;
    el.download = filename;
    el.click();
    URL.revokeObjectURL(url);
  };

  const tables = [
    { name: 'churches', desc: 'Church branches, pastors in charge, member counts, and service start times', cols: 10 },
    { name: 'user_profiles', desc: 'Role-based accounts (Superadmin, Church Pastor, Church Admin, Usher, Leader, Developer)', cols: 18 },
    { name: 'church_admin_accounts', desc: 'Branch administrator directory, contact credentials, and verification status', cols: 16 },
    { name: 'leaders', desc: 'Cell ministry hierarchy (PCF -> Cell -> BSCT) with parent_leader_id rollups', cols: 25 },
    { name: 'members', desc: 'Members, first-timers, new converts, QR pass IDs, and 5-week attendance history', cols: 31 },
    { name: 'attendance_records', desc: 'Timestamped check-ins (Self Check-In, QR Scan, Usher Manual) with late flags', cols: 17 },
    { name: 'absence_records', desc: 'Absentee tracking and pastoral follow-up status per service', cols: 15 },
    { name: 'cell_reports', desc: 'Weekly cell meeting reports, offerings, souls won, and attendee lists', cols: 22 },
    { name: 'service_types', desc: 'Global and branch-level service programs available for check-in', cols: 10 },
    { name: 'sms_templates', desc: 'Automated SMS broadcast templates for onboarding, birthdays, and check-ins', cols: 8 },
    { name: 'announcements', desc: 'Group-wide, developer, and branch-targeted announcements', cols: 10 },
    { name: 'audit_logs', desc: 'Immutable accountability trail for System, Security, Settings, Church & Member actions', cols: 12 },
    { name: 'admin_settings', desc: 'Global JSON configuration (SMS gateway, platform config, report codes)', cols: 8 },
    { name: 'qr_tokens', desc: 'Cryptographic member QR pass tokens and scan counters', cols: 7 },
    { name: 'portal_sessions', desc: 'Server-verified session tokens with configurable expiration', cols: 8 },
    { name: 'login_otps', desc: 'Hashed 6-digit email verification codes for two-step Group Pastor sign-in', cols: 7 },
    { name: 'rate_limit_hits', desc: 'Sliding-window rate limiter buckets + check_rate_limit() atomic RPC', cols: 4 },
    { name: 'email_send_log', desc: 'Outbound email delivery and SMS telemetry with channel tracking', cols: 8 },
    { name: 'suppressed_emails', desc: 'Bounce and complaint suppression list for email hygiene', cols: 5 },
  ];

  const updateHighlights = [
    { title: 'Complete Cascade Deletion Trigger', desc: 'Triggers handle_church_deletion_safety() so removing a church branch safely purges linked records without FK violations' },
    { title: 'SMS Templates Table & Seeds', desc: 'Creates public.sms_templates and seeds the initial message templates' },
    { title: 'Telemetry & SMS Channel Columns', desc: 'Adds channel, recipient_phone, subject, and body_preview to public.email_send_log' },
    { title: 'SMS Gateway Config in admin_settings', desc: 'Seeds sms_config JSON in admin_settings for Hubtel, Twilio, and Arkesel providers' },
    { title: 'Performance Indexes', desc: 'Adds indexes on church_id across attendance, absences, cell reports, members, and user_profiles' },
    { title: 'Server-only database access', desc: 'Revokes anon/authenticated table grants, enables RLS, and grants application-table access to service_role only' }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.25 }}
      className="p-4 md:p-8 max-w-7xl mx-auto space-y-6"
    >
      {/* Top Banner */}
      <div className="bg-slate-900 p-6 md:p-8 rounded-2xl text-white shadow-sm border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-300 text-xs font-extrabold px-3 py-1 rounded-full border border-emerald-500/30">
            <span className="material-symbols-outlined text-[15px]">database</span>
            <span>POSTGRESQL / SUPABASE PRODUCTION SQL</span>
          </div>
          <h1 className="font-display text-2xl md:text-3xl font-extrabold tracking-tight">
            Database Schema & SQL Updates
          </h1>
          <p className="text-slate-300 text-xs md:text-sm max-w-2xl">
            {schemaMode === 'update'
              ? 'Incremental database updates including church-deletion safeguards, SMS configuration, telemetry, performance indexes, and server-role-only table access.'
              : 'Baseline application schema and seed data, followed by service-role-only access hardening for app tables and privileged database functions.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={handleDownload}
            className="px-4 py-2.5 rounded-xl font-bold text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-2 transition-all cursor-pointer shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            <span>Download .sql</span>
          </button>
          <button
            onClick={handleCopy}
            className={`px-5 py-2.5 rounded-xl font-black text-xs flex items-center gap-2 transition-all cursor-pointer shadow-lg ${
              copied
                ? 'bg-emerald-500 text-slate-950'
                : 'bg-blue-600 hover:bg-blue-500 text-white'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">
              {copied ? 'check_circle' : 'content_copy'}
            </span>
            <span>{copied ? 'SQL Script Copied!' : 'Copy SQL Script'}</span>
          </button>
        </div>
      </div>

      {/* Script Mode Selector */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
        <div className="inline-flex p-1 bg-slate-100 rounded-xl">
          <button
            onClick={() => setSchemaMode('update')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              schemaMode === 'update'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">upgrade</span>
            <span>Recent Incremental Updates (Patch SQL)</span>
          </button>
          <button
            onClick={() => setSchemaMode('full')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              schemaMode === 'full'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">schema</span>
            <span>Full Database Schema (Fresh Install)</span>
          </button>
        </div>

        <div className="text-xs text-slate-500 flex items-center gap-2 px-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>Idempotent: Safe to execute repeatedly without duplicating data</span>
        </div>
      </div>

      {/* Update Highlights (Visible when in update mode) */}
      {schemaMode === 'update' && (
        <div className="bg-blue-50/70 border border-blue-200/80 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-blue-950 font-bold text-sm">
            <span className="material-symbols-outlined text-blue-600 text-[20px]">info</span>
            <span>What is included in this SQL Update?</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {updateHighlights.map((u, i) => (
              <div key={i} className="bg-white p-3.5 rounded-xl border border-blue-100 shadow-xs space-y-1">
                <div className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                  <span>{u.title}</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">{u.desc}</p>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-slate-500">
            <strong>How to run:</strong> Open your Supabase Dashboard &rarr; <strong>SQL Editor</strong> &rarr; Click <strong>New query</strong> &rarr; Paste this script &rarr; Click <strong>Run</strong>.
          </p>
        </div>
      )}

      {/* Table Architecture Overview Grid (Visible when in full mode) */}
      {schemaMode === 'full' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tables.map((t) => (
            <div
              key={t.name}
              className="bg-white/90 backdrop-blur-md p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between gap-2"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-xs text-blue-900 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200/60">
                  public.{t.name}
                </span>
                <span className="text-xs font-bold text-slate-400">{t.cols} cols</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">{t.desc}</p>
            </div>
          ))}
        </div>
      )}

      {/* SQL Code Block */}
      <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-sm">
        <div className="bg-slate-900 px-5 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-rose-500/80"></span>
            <span className="w-3 h-3 rounded-full bg-amber-500/80"></span>
            <span className="w-3 h-3 rounded-full bg-emerald-500/80"></span>
            <span className="ml-2 font-mono text-xs text-slate-400">
              {schemaMode === 'update' ? 'supabase/migrations/cekb_database_updates.sql' : 'supabase/migrations/cekb_complete_schema.sql'}
            </span>
          </div>
          <button
            onClick={handleCopy}
            className="text-xs font-bold text-blue-300 hover:text-blue-200 flex items-center gap-1 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[15px]">content_copy</span>
            <span>{copied ? 'Copied' : 'Copy SQL'}</span>
          </button>
        </div>
        <pre className="p-5 text-xs font-mono text-emerald-300/90 overflow-x-auto max-h-[620px] leading-relaxed select-all">
          {activeSql}
        </pre>
      </div>
    </motion.div>
  );
};
