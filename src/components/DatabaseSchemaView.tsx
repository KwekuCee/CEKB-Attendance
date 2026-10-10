import React, { useState } from 'react';
import { motion } from 'motion/react';
import { SUPABASE_SQL_SCHEMA } from '../data/supabase_schema';

export const DatabaseSchemaView: React.FC = () => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
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
    { name: 'announcements', desc: 'Group-wide, developer, and branch-targeted announcements', cols: 10 },
    { name: 'audit_logs', desc: 'Immutable accountability trail for System, Security, Settings, Church & Member actions', cols: 12 },
    { name: 'admin_settings', desc: 'Global JSON configuration (platform_config, feature_matrix, report codes)', cols: 8 },
    { name: 'qr_tokens', desc: 'Cryptographic member QR pass tokens and scan counters', cols: 7 },
    { name: 'portal_sessions', desc: 'Server-verified session tokens with configurable expiration', cols: 8 },
    { name: 'login_otps', desc: 'Hashed 6-digit email verification codes for two-step Group Pastor sign-in', cols: 7 },
    { name: 'rate_limit_hits', desc: 'Sliding-window rate limiter buckets + check_rate_limit() atomic RPC', cols: 4 },
    { name: 'email_send_log', desc: 'Outbound email delivery telemetry, template names, and failure diagnostics', cols: 8 },
    { name: 'suppressed_emails', desc: 'Bounce and complaint suppression list for email hygiene', cols: 5 },
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
      <div className="bg-blue-700 p-6 md:p-8 rounded-2xl text-white shadow-sm border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-300 text-xs font-extrabold px-3 py-1 rounded-full border border-emerald-500/30">
            <span className="material-symbols-outlined text-[15px]">database</span>
            <span>POSTGRESQL / SUPABASE PRODUCTION SCHEMA</span>
          </div>
          <h1 className="font-display text-2xl md:text-3xl font-extrabold tracking-tight">
            Complete Database Schema (SQL)
          </h1>
          <p className="text-slate-300 text-xs md:text-sm max-w-2xl">
            Ready-to-run idempotent SQL DDL script for your Supabase SQL Editor. Includes all 18 tables, member count triggers, rate-limiting RPCs, RLS policies, and default platform settings.
          </p>
        </div>

        <button
          onClick={handleCopy}
          className={`px-5 py-3 rounded-xl font-black text-xs flex items-center gap-2 transition-all cursor-pointer shrink-0 shadow-lg ${
            copied
              ? 'bg-emerald-500 text-slate-950'
              : 'bg-blue-700 hover:bg-blue-800 text-white'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">
            {copied ? 'check_circle' : 'content_copy'}
          </span>
          <span>{copied ? 'SQL Schema Copied!' : 'Copy Full SQL Schema'}</span>
        </button>
      </div>

      {/* Table Architecture Overview Grid */}
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

      {/* SQL Code Block */}
      <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-sm">
        <div className="bg-slate-900 px-5 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-rose-500/80"></span>
            <span className="w-3 h-3 rounded-full bg-blue-500/80"></span>
            <span className="w-3 h-3 rounded-full bg-emerald-500/80"></span>
            <span className="ml-2 font-mono text-xs text-slate-400">supabase/migrations/cekb_complete_schema.sql</span>
          </div>
          <button
            onClick={handleCopy}
            className="text-xs font-bold text-blue-300 hover:text-blue-300 flex items-center gap-1 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[15px]">content_copy</span>
            <span>{copied ? 'Copied' : 'Copy SQL'}</span>
          </button>
        </div>
        <pre className="p-5 text-xs font-mono text-emerald-300/90 overflow-x-auto max-h-[620px] leading-relaxed select-all">
          {SUPABASE_SQL_SCHEMA}
        </pre>
      </div>
    </motion.div>
  );
};
