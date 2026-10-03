import writeXlsxFile, { type SheetData } from 'write-excel-file/browser';
import { sheetNames, type RunsheetRow, type TeamRunsheet } from '@/lib/schedule/runsheet';

export const canExportRunsheets = true;

const ALL_SHEET = 'Alle';
const bold = (value: string) => ({ value, fontWeight: 'bold' as const });

function rowCells(r: RunsheetRow) {
  return [r.block, r.round, r.start, r.end, r.station, r.location, r.game, r.opponents];
}

const rowHeader = ['Block', 'Runde', 'Start', 'Ende', 'Station', 'Ort', 'Spiel', 'Gegner'];
const rowWidths = [{ width: 7 }, { width: 8 }, { width: 8 }, { width: 8 }, { width: 24 }, { width: 28 }, { width: 28 }, { width: 36 }];

export async function exportRunsheets(runsheets: TeamRunsheet[], fileBase: string): Promise<void> {
  const names = sheetNames(
    runsheets.map((r) => r.team.name),
    [ALL_SHEET],
  );

  const all: SheetData = [
    ['Team-Nr.', 'Team', 'Teamfarbe', ...rowHeader].map(bold),
    ...runsheets.flatMap(({ team, rows }) =>
      rows.map((r) => [team.number, team.name, team.color ?? '', ...rowCells(r)]),
    ),
  ];

  const sheets = [
    {
      sheet: ALL_SHEET,
      data: all,
      columns: [{ width: 10 }, { width: 24 }, { width: 12 }, ...rowWidths],
      stickyRowsCount: 1,
    },
    ...runsheets.map(({ rows }, i) => ({
      sheet: names[i],
      data: [rowHeader.map(bold), ...rows.map(rowCells)] as SheetData,
      columns: rowWidths,
      stickyRowsCount: 1,
    })),
  ];

  await writeXlsxFile(sheets as never).toFile(`${fileBase}.xlsx`);
}
