import type { Gender } from './balance';

/**
 * CSV-Import für Spieler (Planungsschritt „Teams“). Rein und plattformneutral.
 * Erkennt Trennzeichen (; , Tab), Anführungszeichen und eine optionale
 * Kopfzeile mit deutschen oder englischen Spaltennamen.
 */

export type ImportTeamRef = { id: string; name: string; number: number | null };

export type ParsedPlayer = {
  line: number;
  name: string;
  gender: Gender | null;
  skill: number | null;
  age: number | null;
  teamId: string | null;
};

export type ParseIssue = { line: number; message: string; blocking: boolean };

export type ParseResult = {
  rows: ParsedPlayer[];
  issues: ParseIssue[];
  columns: string[];
};

type Column = 'name' | 'first' | 'last' | 'gender' | 'skill' | 'age' | 'team';

const columnAliases: Record<Column, string[]> = {
  name: ['name', 'spieler', 'spielername', 'teilnehmer', 'teilnehmerin', 'person', 'kind'],
  first: ['vorname', 'firstname', 'first name', 'first_name', 'rufname'],
  last: ['nachname', 'lastname', 'last name', 'last_name', 'familienname'],
  gender: ['geschlecht', 'gender', 'sex', 'g'],
  skill: ['stärke', 'staerke', 'starke', 'bewertung', 'skill', 'level', 'niveau', 'wertung', 'rating'],
  age: ['alter', 'age', 'jahre'],
  team: ['team', 'gruppe', 'mannschaft'],
};

const columnLabels: Record<Column, string> = {
  name: 'Name',
  first: 'Vorname',
  last: 'Nachname',
  gender: 'Geschlecht',
  skill: 'Stärke',
  age: 'Alter',
  team: 'Team',
};

function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/[.:]/g, '');
}

function detectDelimiter(firstLine: string) {
  const candidates = [';', '\t', ','];
  let best = ';';
  let bestCount = -1;
  for (const candidate of candidates) {
    const count = splitLine(firstLine, candidate).length;
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
}

function splitLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quoted) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

export function parseGender(raw: string): Gender | null | 'invalid' {
  const value = raw.trim().toLowerCase();
  if (!value) return null;
  if (['m', 'männlich', 'maennlich', 'mannlich', 'male', 'junge', 'j', 'boy'].includes(value)) return 'm';
  if (['w', 'f', 'weiblich', 'female', 'mädchen', 'maedchen', 'madchen', 'girl'].includes(value)) return 'f';
  if (['d', 'divers', 'diverse', 'x'].includes(value)) return 'd';
  return 'invalid';
}

/** Stärke 1 (schwach) bis 6 (sehr stark). */
export function parseSkill(raw: string): number | null | 'invalid' {
  const value = raw.trim().replace(',', '.');
  if (!value) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return 'invalid';
  const rounded = Math.round(n);
  if (rounded < 1 || rounded > 6) return 'invalid';
  return rounded;
}

export function parseAge(raw: string): number | null | 'invalid' {
  const value = raw.trim();
  if (!value) return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 120) return 'invalid';
  return n;
}

function matchTeam(raw: string, teams: ImportTeamRef[]): string | null | 'invalid' {
  const value = raw.trim();
  if (!value) return null;
  const lower = value.toLowerCase();
  const byName = teams.find((t) => t.name.trim().toLowerCase() === lower);
  if (byName) return byName.id;
  const numeric = Number(value.replace(/^team\s*/i, ''));
  if (Number.isInteger(numeric)) {
    const byNumber = teams.find((t) => t.number === numeric);
    if (byNumber) return byNumber.id;
  }
  return 'invalid';
}

export function parsePlayersCsv(text: string, teams: ImportTeamRef[], existingNames: string[] = []): ParseResult {
  const lines = text
    .replace(/^﻿/, '')
    .split(/\r\n|\n|\r/)
    .map((line, index) => ({ line: index + 1, text: line }))
    .filter((l) => l.text.trim().length > 0);

  const issues: ParseIssue[] = [];
  if (lines.length === 0) return { rows: [], issues, columns: [] };

  const delimiter = detectDelimiter(lines[0].text);
  const headerCells = splitLine(lines[0].text, delimiter).map(normalizeKey);

  const mapping = new Map<Column, number>();
  headerCells.forEach((cell, index) => {
    for (const [column, aliases] of Object.entries(columnAliases) as [Column, string[]][]) {
      if (!mapping.has(column) && aliases.includes(cell)) mapping.set(column, index);
    }
  });

  const hasHeader = mapping.has('name') || mapping.has('first') || mapping.has('last');
  if (!hasHeader) {
    // Ohne erkannte Kopfzeile: Spalten in der Reihenfolge Name, Geschlecht, Stärke, Alter, Team.
    mapping.clear();
    (['name', 'gender', 'skill', 'age', 'team'] as Column[]).forEach((column, index) => mapping.set(column, index));
  }
  const dataLines = hasHeader ? lines.slice(1) : lines;

  const seen = new Set(existingNames.map((n) => n.trim().toLowerCase()));
  const rows: ParsedPlayer[] = [];

  for (const { line, text: lineText } of dataLines) {
    const cells = splitLine(lineText, delimiter);
    const cell = (column: Column) => {
      const index = mapping.get(column);
      return index === undefined ? '' : (cells[index] ?? '');
    };

    const name = (
      cell('name') || [cell('first'), cell('last')].filter(Boolean).join(' ')
    ).replace(/\s+/g, ' ').trim();
    if (!name) {
      issues.push({ line, message: 'Kein Name – Zeile wird übersprungen.', blocking: true });
      continue;
    }

    const gender = parseGender(cell('gender'));
    const skill = parseSkill(cell('skill'));
    const age = parseAge(cell('age'));
    const team = matchTeam(cell('team'), teams);

    if (gender === 'invalid') issues.push({ line, message: `„${cell('gender')}“ ist kein bekanntes Geschlecht (m/w/d).`, blocking: false });
    if (skill === 'invalid') issues.push({ line, message: `Stärke „${cell('skill')}“ muss zwischen 1 und 6 liegen.`, blocking: false });
    if (age === 'invalid') issues.push({ line, message: `Alter „${cell('age')}“ ist ungültig.`, blocking: false });
    if (team === 'invalid') issues.push({ line, message: `Team „${cell('team')}“ gibt es nicht – Spieler bleibt ohne Team.`, blocking: false });

    const key = name.toLowerCase();
    if (seen.has(key)) issues.push({ line, message: `„${name}“ ist bereits vorhanden.`, blocking: false });
    seen.add(key);

    rows.push({
      line,
      name,
      gender: gender === 'invalid' ? null : gender,
      skill: skill === 'invalid' ? null : skill,
      age: age === 'invalid' ? null : age,
      teamId: team === 'invalid' ? null : team,
    });
  }

  const columns = [...mapping.entries()]
    .filter(([, index]) => index < headerCells.length || !hasHeader)
    .sort((a, b) => a[1] - b[1])
    .map(([column]) => columnLabels[column]);

  return { rows, issues, columns: hasHeader ? columns : [] };
}
