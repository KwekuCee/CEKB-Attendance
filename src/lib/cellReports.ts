// Weekly cell report submissions and the per-branch access codes that gate them.
//
// Everything here goes through the `cell-report` server function, which holds the
// only copy of the code check and writes reports with elevated rights. Reading
// saved reports for the dashboards goes through the usual portal gateway, so
// branch admins automatically see only their own branch.

import { portalDb, getPortalToken, loadLocalStore, saveLocalStore } from './portalDb';
import type { CellReport } from '../types';

const RAW_SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const FUNCTION_URL = RAW_SUPABASE_URL ? `${RAW_SUPABASE_URL}/functions/v1/cell-report` : '';
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

/** Rows of the printed report sheet — each row has a Cell and an Outreach column. */
export const GRID_ROWS: Array<{ key: string; label: string; type?: 'text' | 'number' | 'datetime' | 'money' | 'heading' }> = [
  { key: 'venue', label: 'Venue', type: 'text' },
  { key: 'meetingDateTime', label: 'Date & time of meeting', type: 'datetime' },
  { key: 'totalAttendance', label: 'Total attendance', type: 'number' },
  { key: 'totalFirstTimers', label: 'Total first timers', type: 'number' },
  { key: 'totalLeaders', label: 'Total leaders', type: 'number' },
  { key: 'gotSaved', label: 'Number got saved', type: 'number' },
  { key: 'filledWithSpirit', label: 'Number filled with the Spirit', type: 'number' },
  { key: 'membersPresent', label: 'Members present', type: 'heading' },
  { key: 'midweek', label: 'Midweek service', type: 'number' },
  { key: 'prayerService', label: 'Prayer service', type: 'number' },
  { key: 'sundayService', label: 'Sunday service', type: 'number' },
  { key: 'totalOffering', label: 'Total offering received (GH₵)', type: 'money' },
];

export const EVANGELISM_FIELDS: Array<{ key: string; label: string; type?: 'text' | 'number' }> = [
  { key: 'outreachesOrganized', label: 'Outreaches organized this week', type: 'number' },
  { key: 'location', label: 'Location', type: 'text' },
  { key: 'type', label: 'Type of outreach', type: 'text' },
  { key: 'peopleReached', label: 'Total people reached', type: 'number' },
  { key: 'ledToChrist', label: 'Number led to Christ', type: 'number' },
  { key: 'filledWithSpirit', label: 'Number filled with the Spirit', type: 'number' },
];

export interface CellReportSubmission {
  leaderName: string;
  cellName: string;
  outreachCentre: string;
  reportDate: string;
  reportGrid: Record<string, { cell: string; outreach: string }>;
  evangelism: Record<string, string>;
  soulsWonList: Array<Record<string, any>>;
  cellAttendance: Array<Record<string, any>>;
  sundayRegister: Array<Record<string, any>>;
}

async function callFunction<T = any>(payload: Record<string, unknown>): Promise<{ data: T | null; error: string | null }> {
  if (!FUNCTION_URL) {
    const store = loadLocalStore();
    const action = String(payload.action || '');
    if (!store.tables.report_codes) store.tables.report_codes = [];
    if (!store.tables.cell_reports) store.tables.cell_reports = [];

    if (action === 'list_codes') {
      return { data: { codes: store.tables.report_codes } as unknown as T, error: null };
    }
    if (action === 'rotate_code') {
      const churchName = String(payload.churchName || 'CE Korle Bu Central');
      const code = `CEKB-${Math.floor(1000 + Math.random() * 9000)}`;
      const existing = store.tables.report_codes.find(
        (r: any) => String(r.church_name || '').toLowerCase() === churchName.toLowerCase(),
      );
      if (existing) {
        existing.code_hint = code;
        existing.updated_at = new Date().toISOString();
      } else {
        store.tables.report_codes.push({
          church_name: churchName,
          code_hint: code,
          updated_at: new Date().toISOString(),
        });
      }
      saveLocalStore(store);
      return { data: { code, churchName } as unknown as T, error: null };
    }
    if (action === 'verify_code') {
      const churchName = String(payload.churchName || '');
      const leaderCode = String(payload.leaderCode || '').trim().toUpperCase();
      const foundLeader = (store.tables.leaders || []).find(
        (l: any) => String(l.leader_code || l.id || '').toUpperCase() === leaderCode,
      );
      return {
        data: {
          ok: true,
          churchName,
          leader: foundLeader
            ? {
                fullName: foundLeader.full_name,
                cellOrPcfName: foundLeader.cell_or_pcf_name,
                leaderType: foundLeader.leader_type,
              }
            : null,
        } as unknown as T,
        error: null,
      };
    }
    if (action === 'submit') {
      const churchName = String(payload.churchName || '');
      const rep = (payload.report || {}) as CellReportSubmission;
      const id = `rep-${Date.now()}`;
      const attCell = Number(rep.reportGrid?.totalAttendance?.cell || 0) + Number(rep.reportGrid?.totalAttendance?.outreach || 0);
      const ftCell = Number(rep.reportGrid?.totalFirstTimers?.cell || 0) + Number(rep.reportGrid?.totalFirstTimers?.outreach || 0);
      const offCell = Number(rep.reportGrid?.totalOffering?.cell || 0) + Number(rep.reportGrid?.totalOffering?.outreach || 0);
      const soulsWon = Array.isArray(rep.soulsWonList)
        ? rep.soulsWonList.filter((s) => s && (s.name || s.contact)).length
        : 0;
      store.tables.cell_reports.unshift({
        id,
        church_name: churchName,
        leader_name: rep.leaderName || '',
        cell_name: rep.cellName || '',
        outreach_centre: rep.outreachCentre || '',
        report_date: rep.reportDate || new Date().toISOString().slice(0, 10),
        report_grid: rep.reportGrid || {},
        evangelism: rep.evangelism || {},
        souls_won_list: rep.soulsWonList || [],
        cell_attendance: rep.cellAttendance || [],
        sunday_register: rep.sundayRegister || [],
        total_attendance: attCell,
        total_first_timers: ftCell,
        total_souls_won: soulsWon,
        total_offering: offCell,
        submitted_by: rep.leaderName || 'Leader',
        created_at: new Date().toISOString(),
      });
      saveLocalStore(store);
      return { data: { ok: true, id } as unknown as T, error: null };
    }
    return { data: null, error: null };
  }
  try {
    const token = getPortalToken();
    const res = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
        ...(token ? { 'x-portal-session': token } : {}),
      },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => null);
    if (!body) return { data: null, error: 'No response from the server. Please try again.' };
    if (body.error) {
      const message = typeof body.error === 'string' ? body.error : 'Request failed.';
      return { data: null, error: message };
    }
    return { data: body as T, error: null };
  } catch (err: any) {
    return { data: null, error: err?.message || 'Network error. Check your connection and try again.' };
  }
}

export interface LeaderLogin { leaderCode: string; phone: string }
export interface SignedLeader { fullName: string; cellOrPcfName: string; leaderType: string }

/** Public: check a branch access code before revealing the report form. */
export async function verifyReportCode(churchName: string, code: string, login?: LeaderLogin) {
  return callFunction<{ ok: boolean; churchName: string; leader: SignedLeader | null }>({
    action: 'verify_code',
    churchName,
    code,
    ...(login || {}),
  });
}

/** Public: send in a completed weekly report (the code is re-checked server side). */
export async function submitCellReport(churchName: string, code: string, report: CellReportSubmission, login?: LeaderLogin) {
  return callFunction<{ ok: boolean; id: string }>({
    action: 'submit',
    churchName,
    code,
    report,
    ...(login || {}),
  });
}

export interface ReportCodeRow {
  churchName: string;
  code: string;
  updatedAt: string;
}

/** Admin: read the access code(s) this account is allowed to see. */
export async function listReportCodes(): Promise<{ codes: ReportCodeRow[]; error: string | null }> {
  const { data, error } = await callFunction<{ codes: any[] }>({ action: 'list_codes' });
  if (error) return { codes: [], error };
  const codes = (data?.codes || []).map((row) => ({
    churchName: row.church_name || '',
    code: row.code_hint || '',
    updatedAt: row.updated_at || '',
  }));
  return { codes, error: null };
}

/** Admin: create a fresh access code for a branch (the previous one stops working). */
export async function rotateReportCode(churchName?: string) {
  return callFunction<{ code: string; churchName: string }>({
    action: 'rotate_code',
    churchName: churchName || '',
  });
}

function toNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function mapReport(row: any): CellReport {
  return {
    id: row.id,
    church: row.church_name || '',
    leaderName: row.leader_name || '',
    cellName: row.cell_name || '',
    outreachCentre: row.outreach_centre || '',
    reportDate: row.report_date || '',
    reportGrid: (row.report_grid || {}) as Record<string, { cell: string; outreach: string }>,
    evangelism: (row.evangelism || {}) as Record<string, string>,
    soulsWonList: Array.isArray(row.souls_won_list) ? row.souls_won_list : [],
    cellAttendance: Array.isArray(row.cell_attendance) ? row.cell_attendance : [],
    sundayRegister: Array.isArray(row.sunday_register) ? row.sunday_register : [],
    totalAttendance: toNumber(row.total_attendance),
    totalFirstTimers: toNumber(row.total_first_timers),
    totalSoulsWon: toNumber(row.total_souls_won),
    totalOffering: toNumber(row.total_offering),
    submittedBy: row.submitted_by || '',
    createdAt: row.created_at || '',
  };
}

/** Dashboard: load saved reports. Branch admins are scoped server side. */
export async function fetchCellReports(): Promise<CellReport[]> {
  if (!getPortalToken()) return [];
  const { data, error } = await portalDb
    .from('cell_reports')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error || !Array.isArray(data)) return [];
  return data.map(mapReport);
}

/** Normalises Ghana phone numbers to 0XXXXXXXXX. Returns null when invalid. */
export function normalizeGhanaPhone(raw: string): string | null {
  const digits = String(raw || '').replace(/[\s\-().]/g, '');
  let m = digits.match(/^(?:\+?233|00233)(\d{9})$/);
  if (m) return '0' + m[1];
  m = digits.match(/^0(\d{9})$/);
  if (m) return digits;
  return null;
}

/** Keeps only digits (and one decimal point when allowed) so values can never go negative. */
export function sanitizeAmount(value: string, allowDecimal = false): string {
  let v = String(value || '').replace(allowDecimal ? /[^0-9.]/g : /[^0-9]/g, '');
  if (allowDecimal) {
    const [a, ...rest] = v.split('.');
    v = rest.length ? `${a}.${rest.join('').slice(0, 2)}` : a;
  }
  return v;
}
