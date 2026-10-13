import * as XLSX from 'xlsx';
import type { EvangelismRecord, Member } from '../types';
import { getSupabase } from './supabase';
import { loadLocalStore, saveLocalStore } from './portalDb';
import { normalizeGhanaPhone } from './cellReports';
import { csvQ, neutralizeCell } from '../utils/csvSafe';

const EVANGELISM_STORAGE_KEY = 'cekb_evangelism_records_v1';

export function getLocalEvangelismRecords(): EvangelismRecord[] {
  try {
    const store = loadLocalStore();
    if (Array.isArray(store.tables.evangelism_records) && store.tables.evangelism_records.length > 0) {
      return store.tables.evangelism_records as EvangelismRecord[];
    }
    const raw = localStorage.getItem(EVANGELISM_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn('Could not read local evangelism records:', err);
  }
  return [];
}

export function saveLocalEvangelismRecords(records: EvangelismRecord[]): void {
  try {
    const store = loadLocalStore();
    store.tables.evangelism_records = records;
    saveLocalStore(store);
    localStorage.setItem(EVANGELISM_STORAGE_KEY, JSON.stringify(records));
  } catch (err) {
    console.warn('Could not save local evangelism records:', err);
  }
}

export async function fetchEvangelismRecords(church?: string, leaderId?: string): Promise<EvangelismRecord[]> {
  const local = getLocalEvangelismRecords();
  const client = getSupabase();
  if (client) {
    try {
      let query = client.from('evangelism_records').select('*').order('date_won', { ascending: false });
      if (church && church.toLowerCase() !== 'all') {
        query = query.ilike('church', church);
      }
      if (leaderId) {
        query = query.eq('leader_id', leaderId);
      }
      const { data, error } = await query;
      if (!error && data) {
        const mapped: EvangelismRecord[] = data.map((r: any) => ({
          id: r.id,
          fullName: r.full_name,
          phone: r.phone,
          gender: r.gender,
          location: r.location,
          dateWon: r.date_won,
          leaderId: r.leader_id,
          leaderName: r.leader_name,
          cellOrPcfName: r.cell_or_pcf_name,
          church: r.church,
          notes: r.notes,
          status: (r.status as any) || 'Soul Won',
          memberId: r.member_id,
          createdAt: r.created_at || new Date().toISOString(),
        }));
        // Merge with any unsynced local records
        const map = new Map<string, EvangelismRecord>();
        mapped.forEach(m => map.set(m.id, m));
        local.forEach(l => { if (!map.has(l.id)) map.set(l.id, l); });
        const merged = Array.from(map.values());
        saveLocalEvangelismRecords(merged);
        return filterRecords(merged, church, leaderId);
      }
    } catch (err) {
      console.warn('Supabase fetchEvangelismRecords error, falling back to local:', err);
    }
  }

  return filterRecords(local, church, leaderId);
}

function filterRecords(records: EvangelismRecord[], church?: string, leaderId?: string): EvangelismRecord[] {
  return records.filter(r => {
    if (church && church.toLowerCase() !== 'all' && (r.church || '').toLowerCase() !== church.toLowerCase()) {
      return false;
    }
    if (leaderId && r.leaderId !== leaderId) {
      return false;
    }
    return true;
  });
}

export async function saveEvangelismRecord(record: EvangelismRecord): Promise<boolean> {
  const current = getLocalEvangelismRecords();
  const existingIdx = current.findIndex(r => r.id === record.id);
  let updated: EvangelismRecord[];
  if (existingIdx >= 0) {
    updated = [...current];
    updated[existingIdx] = record;
  } else {
    updated = [record, ...current];
  }
  saveLocalEvangelismRecords(updated);

  const client = getSupabase();
  if (client) {
    try {
      await client.from('evangelism_records').upsert({
        id: record.id,
        full_name: record.fullName,
        phone: record.phone,
        gender: record.gender || null,
        location: record.location || null,
        date_won: record.dateWon,
        leader_id: record.leaderId,
        leader_name: record.leaderName,
        cell_or_pcf_name: record.cellOrPcfName || null,
        church: record.church,
        notes: record.notes || null,
        status: record.status,
        member_id: record.memberId || null,
        updated_at: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('Supabase saveEvangelismRecord error:', err);
    }
  }

  return true;
}

export async function saveEvangelismRecords(records: EvangelismRecord[]): Promise<boolean> {
  const current = getLocalEvangelismRecords();
  const map = new Map<string, EvangelismRecord>();
  current.forEach(r => map.set(r.id, r));
  records.forEach(r => map.set(r.id, r));
  const merged = Array.from(map.values());
  saveLocalEvangelismRecords(merged);

  const client = getSupabase();
  if (client) {
    try {
      const rows = records.map(record => ({
        id: record.id,
        full_name: record.fullName,
        phone: record.phone,
        gender: record.gender || null,
        location: record.location || null,
        date_won: record.dateWon,
        leader_id: record.leaderId,
        leader_name: record.leaderName,
        cell_or_pcf_name: record.cellOrPcfName || null,
        church: record.church,
        notes: record.notes || null,
        status: record.status,
        member_id: record.memberId || null,
        updated_at: new Date().toISOString(),
      }));
      await client.from('evangelism_records').upsert(rows);
    } catch (err) {
      console.warn('Supabase saveEvangelismRecords error:', err);
    }
  }

  return true;
}

export async function updateEvangelismRecord(id: string, updates: Partial<EvangelismRecord>): Promise<boolean> {
  const current = getLocalEvangelismRecords();
  const idx = current.findIndex(r => r.id === id);
  if (idx < 0) return false;
  current[idx] = { ...current[idx], ...updates };
  saveLocalEvangelismRecords(current);

  const client = getSupabase();
  if (client) {
    try {
      const dbUpdates: any = { updated_at: new Date().toISOString() };
      if (updates.status !== undefined) dbUpdates.status = updates.status;
      if (updates.memberId !== undefined) dbUpdates.member_id = updates.memberId;
      if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
      if (updates.fullName !== undefined) dbUpdates.full_name = updates.fullName;
      if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
      await client.from('evangelism_records').update(dbUpdates).eq('id', id);
    } catch (err) {
      console.warn('Supabase updateEvangelismRecord error:', err);
    }
  }

  return true;
}

/**
 * Moves a soul won through evangelism into the church's Member database as a First Timer.
 */
export async function convertEvangelismToMember(
  record: EvangelismRecord,
  onAddMember: (member: Member) => void
): Promise<Member> {
  const nameParts = record.fullName.trim().split(/\s+/).filter(Boolean);
  const initials = nameParts.map(p => p[0]).join('').slice(0, 2).toUpperCase() || 'MB';
  const memberId = `CE-${Date.now().toString().slice(-4)}${Math.floor(10 + Math.random() * 90)}`;

  const newMember: Member = {
    id: memberId,
    fullName: record.fullName.trim(),
    phone: record.phone.trim(),
    gender: record.gender === 'Female' ? 'Female' : 'Male',
    location: record.location?.trim() || 'Korle Bu, Accra',
    church: record.church,
    invitedBy: record.leaderName,
    invitedByLeaderId: record.leaderId,
    role: 'First Timer',
    status: 'First Timer',
    serviceCount: 1,
    foundationClass: 0,
    joinDate: new Date().toISOString().slice(0, 10),
    occupation: 'General',
    education: 'Tertiary',
    initials,
  };

  onAddMember(newMember);

  await updateEvangelismRecord(record.id, {
    status: 'Attended Church',
    memberId: newMember.id,
  });

  return newMember;
}

/**
 * Downloads a standardized Excel or CSV template for leaders to fill their evangelism data.
 */
export function downloadEvangelismTemplate(format: 'csv' | 'xlsx' = 'xlsx'): void {
  const headers = ['Full Name', 'Phone Number', 'Gender', 'Location', 'Date Won (YYYY-MM-DD)', 'Notes / Prayer Request'];
  const sampleRows = [
    ['Kofi Mensah', '+233 24 123 4567', 'Male', 'Korle Bu Campus', new Date().toISOString().slice(0, 10), 'Met during Friday afternoon hostel outreach'],
    ['Ama Boateng', '+233 20 987 6543', 'Female', 'Central Market', new Date().toISOString().slice(0, 10), 'Accepted Christ eagerly, invited to Sunday Service'],
  ];

  if (format === 'csv') {
    const csvContent = [
      headers.join(','),
      ...sampleRows.map(r => r.map(c => csvQ(c)).join(',')),
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CEKB_Evangelism_Upload_Template_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  } else {
    const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
    ws['!cols'] = [
      { wch: 24 },
      { wch: 20 },
      { wch: 12 },
      { wch: 22 },
      { wch: 24 },
      { wch: 36 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Evangelism Template');
    XLSX.writeFile(wb, `CEKB_Evangelism_Upload_Template_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }
}

/**
 * Parses an uploaded CSV or Excel file filled with evangelism contacts.
 */
export async function parseEvangelismFile(
  file: File,
  leader: { id: string; fullName: string; cellOrPcfName?: string; church: string }
): Promise<{ success: boolean; records: EvangelismRecord[]; error?: string }> {
  try {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return { success: false, records: [], error: 'The uploaded spreadsheet has no sheets.' };

    const worksheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });

    if (!rawRows || rawRows.length === 0) {
      return { success: false, records: [], error: 'The file contains no data rows.' };
    }

    const records: EvangelismRecord[] = [];
    const today = new Date().toISOString().slice(0, 10);

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      // Normalize column names
      const findVal = (keys: string[]) => {
        for (const k of Object.keys(row)) {
          const lower = k.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (keys.some(expected => lower.includes(expected))) {
            const v = String(row[k] ?? '').trim();
            if (v) return v;
          }
        }
        return '';
      };

      const fullName = findVal(['fullname', 'name', 'person', 'contactname']);
      const rawPhone = findVal(['phone', 'phonenumber', 'contact', 'telephone', 'mobile']);
      const genderRaw = findVal(['gender', 'sex']).toLowerCase();
      const location = findVal(['location', 'address', 'area', 'venue']) || 'Korle Bu, Accra';
      let dateWon = findVal(['datewon', 'date', 'dated']);
      const notes = findVal(['notes', 'prayer', 'remark', 'comment', 'description']);

      // Skip sample rows if unchanged
      if (fullName.toLowerCase() === 'kofi mensah' || fullName.toLowerCase() === 'ama boateng') {
        continue;
      }

      if (!fullName) continue; // Skip empty rows

      const phone = normalizeGhanaPhone(rawPhone) || rawPhone || '+233 24 000 0000';
      const gender: 'Male' | 'Female' = genderRaw.startsWith('f') ? 'Female' : 'Male';

      // Parse date if Excel serial number
      if (typeof dateWon === 'number' || (!isNaN(Number(dateWon)) && Number(dateWon) > 40000)) {
        try {
          const parsed = XLSX.SSF.parse_date_code(Number(dateWon));
          if (parsed) {
            dateWon = `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
          }
        } catch {}
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateWon)) {
        dateWon = today;
      }

      const record: EvangelismRecord = {
        id: `ev-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
        fullName,
        phone,
        gender,
        location,
        dateWon,
        leaderId: leader.id,
        leaderName: leader.fullName,
        cellOrPcfName: leader.cellOrPcfName || '',
        church: leader.church,
        notes,
        status: 'Soul Won',
        createdAt: new Date().toISOString(),
      };
      records.push(record);
    }

    if (records.length === 0) {
      return {
        success: false,
        records: [],
        error: 'No valid records found. Please ensure the columns include "Full Name" and "Phone Number".',
      };
    }

    return { success: true, records };
  } catch (err: any) {
    return { success: false, records: [], error: err.message || 'Failed to read file.' };
  }
}

/**
 * Exports evangelism records to CSV or Excel.
 */
export function exportEvangelismRecords(records: EvangelismRecord[], filename = 'Evangelism_Records'): void {
  const rows = records.map(r => ({
    'ID': r.id,
    'Full Name': r.fullName,
    'Phone': r.phone,
    'Gender': r.gender || '',
    'Location': r.location || '',
    'Date Won': r.dateWon,
    'Leader Name': r.leaderName,
    'Cell / PCF': r.cellOrPcfName || '',
    'Church': r.church,
    'Status': r.status,
    'Member ID': r.memberId || '',
    'Notes': r.notes || '',
  }));

  const ws = XLSX.utils.json_to_sheet(rows.map(r => {
    const safe: any = {};
    for (const [k, v] of Object.entries(r)) safe[k] = neutralizeCell(v);
    return safe;
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Evangelism Records');
  XLSX.writeFile(wb, `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
