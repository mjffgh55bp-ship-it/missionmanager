import * as XLSX from 'xlsx';
import { format, addDays, startOfWeek } from 'date-fns';
import { getOperationalMinutes, getOperationalEndMinutes } from '@/lib/operationalDate';

// Operational hour order: 06, 07, ..., 23, 00, 01, ..., 05
const OPERATIONAL_HOURS_ORDER = Array.from({ length: 24 }, (_, i) => (i + 6) % 24);

/**
 * Export the matrix as a visual Excel file.
 * Each row = one worker. Each column = one hour slot.
 * Cell values: X (assigned shift), W (wanted), A (available), ! (constraint/unavail)
 */
export function exportMatrixToExcel({
  filteredWorkers,
  viewMode,
  currentDate,
  dateString,
  getWorkerAvailabilityForDate,
  getWorkerTemplateShifts,
  getWorkerUnavailabilityForDate,
}) {
  const HOURS = OPERATIONAL_HOURS_ORDER;
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });

  const dateCols = viewMode === 'daily'
    ? [{ date: dateString, label: format(currentDate, 'd.M') }]
    : Array.from({ length: 7 }, (_, i) => {
        const d = addDays(weekStart, i);
        return { date: format(d, 'yyyy-MM-dd'), label: format(d, 'd.M') };
      });

  // ── Build header rows ──────────────────────────────────────────────────────
  const headerRow1 = ['שם עובד'];
  const headerRow2 = [''];
  dateCols.forEach((dc, di) => {
    HOURS.forEach((h, idx) => {
      headerRow1.push(idx === 0 ? dc.label : '');
      headerRow2.push(`${String(h).padStart(2, '0')}:00`);
    });
  });

  // ── Build data rows ────────────────────────────────────────────────────────
  const dataRows = filteredWorkers.map(worker => {
    const row = [worker.nickname];
    dateCols.forEach(dc => {
      const avail = getWorkerAvailabilityForDate(worker.id, dc.date);
      const tShifts = getWorkerTemplateShifts(worker.id, dc.date);
      const unavails = getWorkerUnavailabilityForDate(worker.id, dc.date);

      HOURS.forEach(h => {
        const hS = getOperationalMinutes(`${String(h).padStart(2, '0')}:00`);
        const hE = hS + 60;

        const overlaps = (start, end) => {
          const sS = getOperationalMinutes(start);
          const sE = getOperationalEndMinutes(start, end);
          return sS < hE && sE > hS;
        };

        const assignedHit = tShifts.find(s => overlaps(s.start_time, s.end_time));
        const availHit = !assignedHit && avail.find(s => {
          if (s.type === 'unavailable') return false;
          return overlaps(s.start_time, s.end_time);
        });
        const unavailHit = !assignedHit && !availHit && unavails.find(u => overlaps(u.start_time, u.end_time));

        let cell = '';
        if (assignedHit) cell = 'X';
        else if (availHit?.type === 'wanted') cell = 'W';
        else if (availHit) cell = 'A';
        else if (unavailHit) cell = '!';

        row.push(cell);
      });
    });
    return row;
  });

  const sheetData = [headerRow1, headerRow2, ...dataRows];
  const numCols = 1 + dateCols.length * HOURS.length;

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  // Column widths
  ws['!cols'] = [{ wch: 18 }, ...Array(numCols - 1).fill({ wch: 4 })];

  // Cell styling
  const colorMap = { 'X': 'CC99FF', 'W': '99FF99', 'A': '99CCFF', '!': 'FF9999' };

  // Data rows styling
  for (let r = 2; r < sheetData.length; r++) {
    for (let c = 0; c < numCols; c++) {
      const ref = XLSX.utils.encode_cell({ r, c });
      if (!ws[ref]) ws[ref] = { v: sheetData[r][c] || '', t: 's' };
      const bg = c > 0 ? colorMap[sheetData[r][c]] : null;
      if (bg) {
        ws[ref].s = { fill: { fgColor: { rgb: bg }, patternType: 'solid' }, alignment: { horizontal: 'center' } };
      } else if (c === 0) {
        ws[ref].s = { font: { bold: true }, alignment: { horizontal: 'right' } };
      } else {
        ws[ref].s = { alignment: { horizontal: 'center' } };
      }
    }
  }

  // Header rows styling (dark blue background, white text)
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < numCols; c++) {
      const ref = XLSX.utils.encode_cell({ r, c });
      if (!ws[ref]) ws[ref] = { v: sheetData[r][c] || '', t: 's' };
      ws[ref].s = {
        fill: { fgColor: { rgb: '1F3A5F' }, patternType: 'solid' },
        font: { color: { rgb: 'FFFFFF' }, bold: true, sz: 9 },
        alignment: { horizontal: 'center' },
      };
    }
  }

  // Merge date header cells (row 0)
  ws['!merges'] = dateCols.map((_, di) => {
    const sC = 1 + di * HOURS.length;
    return { s: { r: 0, c: sC }, e: { r: 0, c: sC + HOURS.length - 1 } };
  });

  XLSX.utils.book_append_sheet(wb, ws, 'מטריצה');

  const label = viewMode === 'daily'
    ? dateString
    : `${format(weekStart, 'd.M')}-${format(addDays(weekStart, 6), 'd.M')}`;

  XLSX.writeFile(wb, `מטריצה_${label}.xlsx`);
}