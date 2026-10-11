// Reads members / leaders out of an uploaded .xlsx or .csv file, maps the
// column headings onto the app's own fields (tolerating common wording
// variations), and validates each row in plain English before anything is saved.

import * as XLSX from 'xlsx';
import { LeaderType, Member, Leader } from '../types';

export type ImportKind = 'members' | 'leaders';

export interface RawRow {
  [key: string]: string;
}

export interface PreparedRow {
  index: number; // 1-based row number as it appears in the file
  raw: RawRow;
  valid: boolean;
  problems: string[];
  duplicate: boolean;
  member?: Omit<Member, 'id' | 'initials'> & { id?: string };
  leader?: Omit<Leader, 'id' | 'initials' | 'downstreamCount' | 'isAppointed' | 'promotionStatus' | 'joinedDate'>;
}

const LEADER_TYPES: LeaderType[] = ['BSCT', 'Cell Leader', 'PCF Leader', 'Church Coordinator'];

/** Column heading variations we accept for each field. */
const HEADER_ALIASES: Record<string, string[]> = {
  fullName: ['full name', 'name', 'fullname', 'member name', 'leader name', 'names', 'surname and other names', 'member', 'first name and surname'],
  email: ['email', 'e-mail', 'email address', 'mail', 'email addr', 'e mail'],
  phone: ['phone', 'contact', 'phone number', 'contact number', 'contact no', 'mobile', 'mobile number', 'telephone', 'tel', 'whatsapp', 'whatsapp number', 'number'],
  dob: ['dob', 'date of birth', 'birthday', 'birth date', 'birthdate', 'd o b'],
  gender: ['gender', 'sex'],
  maritalStatus: ['marital status', 'marital', 'status (marital)'],
  occupation: ['occupation', 'job', 'work', 'profession', 'career', 'occupation category'],
  education: ['education', 'education level', 'educational level', 'school level', 'qualification'],
  location: ['location', 'address', 'residence', 'area', 'town', 'city', 'residential address', 'where do you stay'],
  church: ['church', 'church branch', 'branch', 'church name', 'assembly'],
  foundationClass: ['foundation class', 'foundation school', 'foundation school class', 'class'],
  invitedBy: [
    'invited by',
    'who invited you',
    'leader',
    'inviter',
    'referred by',
    'cell leader',
    'pcf leader',
    'bible study class teacher',
    'bsct',
    'leaders name',
    'name of leader',
    'invited by leader',
  ],
  leaderType: ['leader type', 'role', 'leadership role', 'position', 'leader role', 'type of leader'],
  cellOrPcfName: ['cell', 'pcf', 'cell name', 'pcf name', 'cell or pcf', 'cell/pcf name', 'cell or pcf name', 'group name', 'pcf/cell'],
};

function normalizeHeader(h: string): string {
  return (h || '').toString().trim().toLowerCase().replace(/[_.*]+/g, ' ').replace(/\s+/g, ' ');
}

/** Field-to-heading matching, plus any heading we could not place. */
export interface HeaderMapResult {
  map: Record<number, string>;
  matched: { header: string; field: string }[];
  unmatched: string[];
}

const FIELD_LABELS: Record<string, string> = {
  fullName: 'Full name',
  email: 'Email',
  phone: 'Phone',
  dob: 'Date of birth',
  gender: 'Gender',
  maritalStatus: 'Marital status',
  occupation: 'Occupation',
  education: 'Education',
  location: 'Location',
  church: 'Church',
  foundationClass: 'Foundation class',
  invitedBy: 'Leader / invited by',
  leaderType: 'Leader type',
  cellOrPcfName: 'Cell or PCF name',
};

export function fieldLabel(field: string): string {
  return FIELD_LABELS[field] || field;
}

/** Headings that mean "the leader who invited this person", never the member's own name. */
const LEADER_NAME_ALIASES = ['leader name', 'leaders name', 'name of leader', 'leader s name'];

/** Maps the file's headings to our field names, whatever wording was used. */
export function mapHeadersDetailed(headers: string[], kind: ImportKind = 'members'): HeaderMapResult {
  const map: Record<number, string> = {};
  const matched: { header: string; field: string }[] = [];
  const unmatched: string[] = [];

  const aliasesFor = (field: string): string[] => {
    const list = HEADER_ALIASES[field] || [];
    // In a members file "Leader Name" means who invited them, not their own name.
    if (field === 'fullName' && kind === 'members') {
      return list.filter((a) => !LEADER_NAME_ALIASES.includes(a));
    }
    return list;
  };

  headers.forEach((header, i) => {
    const norm = normalizeHeader(header);
    if (!norm) return;
    const squashed = norm.replace(/[^a-z]/g, '');

    // Collect every field this heading could mean, exact matches first.
    const candidates: string[] = [];
    for (const field of Object.keys(HEADER_ALIASES)) {
      if (aliasesFor(field).some((a) => norm === a || squashed === a.replace(/[^a-z]/g, ''))) {
        candidates.push(field);
      }
    }
    for (const field of Object.keys(HEADER_ALIASES)) {
      if (candidates.includes(field)) continue;
      if (aliasesFor(field).some((a) => a.length > 3 && norm.includes(a))) {
        candidates.push(field);
      }
    }

    // Use the first candidate that isn't already taken by an earlier column.
    const used = Object.values(map);
    const hit = candidates.find((f) => !used.includes(f));
    if (hit) {
      map[i] = hit;
      matched.push({ header: String(header), field: hit });
    } else {
      unmatched.push(String(header));
    }
  });

  return { map, matched, unmatched };
}

export function mapHeaders(headers: string[], kind: ImportKind = 'members'): Record<number, string> {
  return mapHeadersDetailed(headers, kind).map;
}



/** Very small CSV reader that copes with quoted values and commas inside them. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else inQuotes = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (ch !== '\r') {
      cell += ch;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => (c || '').trim() !== ''));
}

/** Reads any supported file into a grid of raw text cells. */
export async function readSpreadsheet(file: File): Promise<string[][]> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.csv') || file.type === 'text/csv') {
    return parseCsv(await file.text());
  }
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const grid = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, raw: false, defval: '' });
  return (grid || [])
    .map((r) => (r || []).map((c) => (c === null || c === undefined ? '' : String(c))))
    .filter((r) => r.some((c) => (c || '').trim() !== ''));
}

/** Turns a written date into YYYY-MM-DD, or returns null when unreadable. */
export function parseDate(value: string): string | null {
  const v = (value || '').trim();
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;

  const slash = v.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (slash) {
    let [, a, b, c] = slash;
    let day = parseInt(a, 10);
    let month = parseInt(b, 10);
    if (day > 12 && month <= 12) {
      // already day/month
    } else if (month > 12 && day <= 12) {
      const t = day;
      day = month;
      month = t;
    }
    let year = parseInt(c, 10);
    if (year < 100) year += year > 30 ? 1900 : 2000;
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const parsed = new Date(v);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return null;
}

function parseFoundation(value: string): number {
  const digits = (value || '').match(/\d+/);
  if (!digits) {
    if (/complete|done|graduat/i.test(value || '')) return 7;
    return 0;
  }
  const n = parseInt(digits[0], 10);
  return Math.max(0, Math.min(7, isNaN(n) ? 0 : n));
}

function initialsOf(name: string): string {
  return (
    (name || 'Member')
      .split(' ')
      .filter(Boolean)
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'MB'
  );
}

function normalizeLeaderType(value: string): LeaderType {
  const v = (value || '').trim().toLowerCase();
  if (v.includes('pcf')) return 'PCF Leader';
  if (v.includes('coordinat')) return 'Church Coordinator';
  if (v.includes('cell')) return 'Cell Leader';
  if (v.includes('bible') || v === 'bsct' || v.includes('teacher') || v.includes('study')) return 'BSCT';
  const exact = LEADER_TYPES.find((t) => t.toLowerCase() === v);
  return exact || 'BSCT';
}

export interface ExistingIndex {
  emails: Set<string>;
  phones: Set<string>;
}

export function buildExistingIndex(members: Member[], leaders: Leader[]): ExistingIndex {
  const emails = new Set<string>();
  const phones = new Set<string>();
  (members || []).forEach((m) => {
    if (m?.email) emails.add(m.email.trim().toLowerCase());
    if (m?.phone) phones.add(m.phone.replace(/\D/g, ''));
  });
  (leaders || []).forEach((l) => {
    if (l?.email) emails.add(l.email.trim().toLowerCase());
    if (l?.contact) phones.add(l.contact.replace(/\D/g, ''));
  });
  return { emails, phones };
}

export interface PrepareOptions {
  kind: ImportKind;
  church: string;
  existing: ExistingIndex;
}

export interface PrepareResult {
  headerMap: Record<number, string>;
  matchedHeaders: { header: string; field: string }[];
  unmatchedHeaders: string[];
  rows: PreparedRow[];
}

/** Validates and shapes every row of the file, ready for the preview table. */
export function prepareRows(grid: string[][], options: PrepareOptions): PrepareResult {
  if (!grid.length) return { headerMap: {}, matchedHeaders: [], unmatchedHeaders: [], rows: [] };

  const headers = grid[0].map((h) => String(h || ''));
  const { map: headerMap, matched: matchedHeaders, unmatched: unmatchedHeaders } = mapHeadersDetailed(headers, options.kind);

  const seenEmails = new Set<string>();
  const seenPhones = new Set<string>();

  const rows: PreparedRow[] = grid.slice(1).map((cells, i) => {
    const raw: RawRow = {};
    Object.entries(headerMap).forEach(([colIdx, field]) => {
      raw[field] = String(cells[Number(colIdx)] ?? '').trim();
    });

    const problems: string[] = [];
    const fullName = (raw.fullName || '').trim();
    const email = (raw.email || '').trim();
    const phone = (raw.phone || '').trim();
    const dobRaw = (raw.dob || '').trim();
    const dob = dobRaw ? parseDate(dobRaw) : null;

    if (!fullName) problems.push('Missing name');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) problems.push('Email address looks wrong');
    if (dobRaw && !dob) problems.push('Date of birth could not be read');
    if (options.kind === 'leaders' && !(raw.cellOrPcfName || '').trim()) {
      problems.push('Note: no cell / PCF name — you can add it after importing');
    }


    let duplicate = false;
    const emailKey = email.toLowerCase();
    const phoneKey = phone.replace(/\D/g, '');
    if (emailKey && (options.existing.emails.has(emailKey) || seenEmails.has(emailKey))) duplicate = true;
    if (!duplicate && phoneKey && (options.existing.phones.has(phoneKey) || seenPhones.has(phoneKey))) duplicate = true;
    if (duplicate) problems.push('Already in the system — will be skipped');
    if (emailKey) seenEmails.add(emailKey);
    if (phoneKey) seenPhones.add(phoneKey);

    const hardProblems = problems.filter((p) => !p.startsWith('Already in the system') && !p.startsWith('Note:'));
    const valid = hardProblems.length === 0 && !duplicate;

    const prepared: PreparedRow = {
      index: i + 2,
      raw,
      valid,
      duplicate,
      problems,
    };

    const church = (raw.church || '').trim() || options.church;

    if (options.kind === 'members') {
      prepared.member = {
        fullName,
        phone,
        email: email || undefined,
        dob: dob || undefined,
        role: 'Member',
        occupation: raw.occupation || 'Not Specified',
        education: raw.education || 'Not Specified',
        location: raw.location || 'Not Specified',
        church,
        invitedBy: raw.invitedBy || 'Spreadsheet Import',
        joinDate: new Date().toISOString().slice(0, 10),
        serviceCount: 1,
        foundationClass: parseFoundation(raw.foundationClass || ''),
        status: 'General Member',
        gender: /^f/i.test(raw.gender || '') ? 'Female' : /^m/i.test(raw.gender || '') ? 'Male' : undefined,
        maritalStatus: raw.maritalStatus || undefined,
      } as PreparedRow['member'];
    } else {
      prepared.leader = {
        fullName,
        email,
        contact: phone,
        dob: dob || '',
        location: raw.location || 'Not Specified',
        leaderType: normalizeLeaderType(raw.leaderType || ''),
        cellOrPcfName: (raw.cellOrPcfName || '').trim(),
        church,
      } as PreparedRow['leader'];
    }

    return prepared;
  });

  return { headerMap, matchedHeaders, unmatchedHeaders, rows };
}

export { initialsOf };

// ---------------------------------------------------------------------------
// Leaders picked out of a members file
// ---------------------------------------------------------------------------

/** A leader name found in the Leader / Invited By column of a members file. */
export interface DerivedLeader {
  name: string;
  key: string;
  memberCount: number;
  existingLeaderId?: string;
  phone: string;
  email: string;
  dob: string;
  location: string;
  church: string;
}

/** Values people type when nobody invited them — never treated as a leader. */
const NON_LEADER_VALUES = new Set([
  'self',
  'selfwalkin',
  'selfwalkin',
  'walkin',
  'none',
  'na',
  'nil',
  'nobody',
  'myself',
  'noone',
  'notapplicable',
  'spreadsheetimport',
  'direct',
  'directself',
  'firsttimer',
  'unknown',
]);

export function toTitleCase(name: string): string {
  if (!name) return '';
  const trimmed = name.trim().replace(/\s+/g, ' ');
  const isAllCaps = trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed);
  const isAllLower = trimmed === trimmed.toLowerCase();
  if (!isAllCaps && !isAllLower) return trimmed;
  return trimmed
    .toLowerCase()
    .split(' ')
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : ''))
    .join(' ');
}

export function nameKey(name: string): string {
  return (name || '')
    .toLowerCase()
    .replace(/\b(pastor|pst|bro|bro\.|sis|sis\.|dcn|deacon|mr|mrs|ms|dr)\b/g, ' ')
    .replace(/[^a-z]/g, '');
}

/** A leader is incomplete while we only know their name. */
export function isIncompleteLeader(leader: { contact?: string; email?: string; cellOrPcfName?: string }): boolean {
  const noContact = !(leader.contact || '').trim() && !(leader.email || '').trim();
  const noGroup = !(leader.cellOrPcfName || '').trim();
  return noContact || noGroup;
}

/**
 * Collects every name in the Leader / Invited By column, counts how many members
 * named them, reuses an existing leader in the branch when the name matches, and
 * fills in details from that person's own member row when the file has one.
 */
export function collectLeadersFromRows(
  rows: PreparedRow[],
  options: { church: string; existingLeaders: Leader[] }
): DerivedLeader[] {
  const existingByName = new Map<string, Leader>();
  (options.existingLeaders || []).forEach((l) => {
    if (!l || !l.fullName) return;
    const k1 = nameKey(l.fullName);
    if (k1) existingByName.set(k1, l);
    const k2 = l.fullName.trim().toLowerCase().replace(/\s+/g, ' ');
    if (k2) existingByName.set(k2, l);
  });

  // Every person in the file, so a leader who also appears as a member row
  // inherits their own contact details.
  const rowByName = new Map<string, PreparedRow>();
  rows.forEach((r) => {
    const key = nameKey(r.raw.fullName || '');
    if (key && !rowByName.has(key)) rowByName.set(key, r);
  });

  const found = new Map<string, DerivedLeader>();

  rows.forEach((r) => {
    const rawName = (r.raw.invitedBy || '').trim();
    if (!rawName) return;
    const key = nameKey(rawName);
    if (!key || key.length < 3 || NON_LEADER_VALUES.has(key)) return;

    const current = found.get(key);
    if (current) {
      current.memberCount += 1;
      return;
    }

    const cleanRaw = rawName.toLowerCase().replace(/\s+/g, ' ');
    const existing = existingByName.get(key) || existingByName.get(cleanRaw);
    const ownRow = rowByName.get(key);

    const leaderDisplayName = existing?.fullName || toTitleCase(rawName);

    found.set(key, {
      name: leaderDisplayName,
      key,
      memberCount: 1,
      existingLeaderId: existing?.id,
      phone: existing?.contact || (ownRow?.raw.phone || '').trim(),
      email: existing?.email || (ownRow?.raw.email || '').trim(),
      dob: existing?.dob || (ownRow?.raw.dob ? parseDate(ownRow.raw.dob) || '' : ''),
      location: existing?.location || (ownRow?.raw.location || '').trim(),
      church: existing?.church || (ownRow?.raw.church || '').trim() || options.church,
    });
  });

  return Array.from(found.values()).sort((a, b) => b.memberCount - a.memberCount);
}


/** The exact column headings the system reads, in order, per import type. */
export const TEMPLATE_COLUMNS: Record<ImportKind, { header: string; note: string; required?: boolean }[]> = {
  members: [
    { header: 'Full Name', note: 'First and last name', required: true },
    { header: 'Phone', note: 'e.g. 0244000000' },
    { header: 'Email', note: 'Needed to email their attendance code' },
    { header: 'Date of Birth', note: 'DD/MM/YYYY' },
    { header: 'Gender', note: 'Male or Female' },
    { header: 'Marital Status', note: 'Single, Married…' },
    { header: 'Occupation', note: 'Student, Trader…' },
    { header: 'Education', note: 'SHS, Tertiary…' },
    { header: 'Location', note: 'Where they live' },
    { header: 'Church', note: 'Leave blank to use the branch chosen above' },
    { header: 'Foundation Class', note: '0 to 7' },
    { header: 'Invited By', note: 'Name of the leader who invited them' },
  ],
  leaders: [
    { header: 'Full Name', note: 'First and last name', required: true },
    { header: 'Phone', note: 'e.g. 0244000000' },
    { header: 'Email', note: 'Needed to email their attendance code' },
    { header: 'Date of Birth', note: 'DD/MM/YYYY' },
    { header: 'Leader Type', note: 'BSCT, Cell Leader, PCF Leader or Church Coordinator', required: true },
    { header: 'Cell or PCF Name', note: 'The group they lead', required: true },
    { header: 'Location', note: 'Where they live' },
    { header: 'Church', note: 'Leave blank to use the branch chosen above' },
  ],
};

/** Two example rows so the format is obvious at a glance. */
const TEMPLATE_EXAMPLES: Record<ImportKind, string[][]> = {
  members: [
    ['Ama Mensah', '0244000001', 'ama@example.com', '14/03/1998', 'Female', 'Single', 'Student', 'Tertiary', 'Achimota', '', '3', 'Kofi Boateng'],
    ['Kwame Owusu', '0244000002', 'kwame@example.com', '02/11/1990', 'Male', 'Married', 'Trader', 'SHS', 'Dansoman', '', '7', 'Self'],
  ],
  leaders: [
    ['Kofi Boateng', '0244000003', 'kofi@example.com', '21/06/1988', 'Cell Leader', 'Grace Cell', 'Achimota', ''],
    ['Adjoa Sarpong', '0244000004', 'adjoa@example.com', '09/09/1992', 'BSCT', 'Faith Class', 'Dansoman', ''],
  ],
};

/** Builds and downloads a ready-to-fill .xlsx template for the chosen import type. */
export function downloadImportTemplate(kind: ImportKind): void {
  const cols = TEMPLATE_COLUMNS[kind];
  const headers = cols.map((c) => c.header);
  const guide = cols.map((c) => (c.required ? `REQUIRED — ${c.note}` : c.note));

  const wb = XLSX.utils.book_new();
  // Data sheet: headings + example rows only, so the file can be filled in and sent back as-is.
  const ws = XLSX.utils.aoa_to_sheet([headers, ...TEMPLATE_EXAMPLES[kind]]);
  ws['!cols'] = headers.map(() => ({ wch: 22 }));
  XLSX.utils.book_append_sheet(wb, ws, kind === 'members' ? 'Members' : 'Leaders');

  // Separate guide sheet so notes never get imported as people.
  const help = XLSX.utils.aoa_to_sheet([['Column', 'What to put'], ...headers.map((h, i) => [h, guide[i]])]);
  help['!cols'] = [{ wch: 24 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, help, 'How to fill');
  XLSX.writeFile(wb, `CEKB_${kind}_import_template.xlsx`);
}
