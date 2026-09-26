import { BadRequestException, Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { parseDay } from '../common/dates';
import type { Lang } from '../common/lang';
import { normalize } from '../common/text';
import { UnitsService } from '../units/units.service';
import { NewRequest } from './requests.service';

type Field = keyof NewRequest;

// Headers are matched loosely (case, accents and punctuation ignored), so a register kept
// by hand with slightly different titles still imports.
// Albanian and English titles are both accepted.
const HEADERS: Record<Field, string[]> = {
  protocolNo: ['nr protokolli', 'nr i protokollit', 'numri i protokollit', 'protokolli', 'nr prot', 'nr', 'numri', 'nr kerkeses', 'numri i kerkeses', 'id', 'protocol no', 'protocol number', 'protocol', 'no', 'number', 'request number'],
  date: ['data', 'data e regjistrimit', 'data e kerkeses', 'data e leshimit', 'date', 'registration date'],
  subject: ['lenda', 'subjekti', 'objekti', 'tema', 'pershkrimi', 'subject', 'topic', 'description'],
  unitId: ['drejtoria agjencia', 'drejtoria', 'agjencia', 'dergohet te', 'dergohet', 'marresi', 'institucioni', 'per', 'department agency', 'department', 'agency', 'sent to', 'recipient', 'unit'],
};

const TEMPLATE = {
  sq: { headers: ['Nr. protokolli', 'Data', 'Lënda', 'Drejtoria / Agjencia'], sheet: 'Kërkesat', list: 'Drejtoritë', error: ['Drejtori e panjohur', 'Zgjidhni një drejtori ose agjenci nga lista.'] },
  en: { headers: ['Protocol no.', 'Date', 'Subject', 'Department / Agency'], sheet: 'Requests', list: 'Departments', error: ['Unknown department', 'Pick a department or agency from the list.'] },
};

export interface ParsedRow {
  row: number;
  values: NewRequest;
  unitText: string;
}

@Injectable()
export class ExcelService {
  constructor(private readonly units: UnitsService) {}

  /** Reads the first sheet whose header row has the four columns; one ParsedRow per filled line. */
  async parse(buffer: Buffer): Promise<ParsedRow[]> {
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    } catch {
      throw new BadRequestException('Skedari nuk lexohet. Ruajeni si Excel .xlsx dhe provoni sërish.');
    }

    for (const sheet of workbook.worksheets) {
      for (let headerRow = 1; headerRow <= Math.min(10, sheet.rowCount); headerRow++) {
        const columns = this.findColumns(sheet.getRow(headerRow));
        if (!columns) continue;

        const rows: ParsedRow[] = [];
        for (let r = headerRow + 1; r <= sheet.rowCount; r++) {
          const row = sheet.getRow(r);
          const raw = (field: Field) => row.getCell(columns[field]).value;
          const unitText = cellText(raw('unitId'));
          const values: NewRequest = {
            protocolNo: cellText(raw('protocolNo')),
            date: parseDay(dateValue(raw('date'))) ?? '',
            subject: cellText(raw('subject')),
            unitId: this.units.match(unitText)?.id ?? '',
          };
          const empty = !values.protocolNo && !values.subject && !unitText && !cellText(raw('date'));
          if (!empty) rows.push({ row: r, values, unitText });
        }
        return rows;
      }
    }
    throw new BadRequestException(
      `Nuk u gjet një fletë me kolonat: ${TEMPLATE.sq.headers.join(', ')}. Shkarkoni shabllonin dhe plotësojeni atë.`,
    );
  }

  /** An empty register with the right columns and a drop-down of units, in Albanian or English. */
  async template(lang: Lang = 'sq'): Promise<Buffer> {
    const tpl = TEMPLATE[lang];
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(tpl.sheet);
    const list = workbook.addWorksheet(tpl.list);

    sheet.columns = [
      { header: tpl.headers[0], key: 'protocolNo', width: 18 },
      { header: tpl.headers[1], key: 'date', width: 14, style: { numFmt: 'dd.mm.yyyy' } },
      { header: tpl.headers[2], key: 'subject', width: 48 },
      { header: tpl.headers[3], key: 'unit', width: 40 },
    ];
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];

    const units = this.units.findAll();
    list.columns = [{ header: tpl.headers[3], key: 'name', width: 42 }];
    units.forEach((u) => list.addRow({ name: lang === 'en' ? u.nameEn : u.name }));
    list.getRow(1).font = { bold: true };

    const example = new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()));
    sheet.addRow({ protocolNo: 'K-2026-0001', date: example, subject: 'Kërkesë për ndihmë ekonomike', unit: lang === 'en' ? units[0]?.nameEn : units[0]?.name });

    for (let r = 2; r <= 500; r++) {
      sheet.getCell(`D${r}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`'${tpl.list}'!$A$2:$A$${units.length + 1}`],
        showErrorMessage: true,
        errorTitle: tpl.error[0],
        error: tpl.error[1],
      };
    }

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  private findColumns(row: ExcelJS.Row): Record<Field, number> | null {
    const found: Partial<Record<Field, number>> = {};
    row.eachCell((cell, col) => {
      const header = normalize(cellText(cell.value));
      for (const field of Object.keys(HEADERS) as Field[]) {
        if (found[field] === undefined && HEADERS[field].includes(header)) found[field] = col;
      }
    });
    const complete = (Object.keys(HEADERS) as Field[]).every((f) => found[f] !== undefined);
    return complete ? (found as Record<Field, number>) : null;
  }
}

/** Plain text of a cell, whatever Excel stored in it (rich text, formula, hyperlink...). */
function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    if ('richText' in value) return value.richText.map((t) => t.text).join('').trim();
    if ('text' in value) return String(value.text).trim();
    if ('result' in value) return cellText(value.result as ExcelJS.CellValue);
    return '';
  }
  return String(value).trim();
}

function dateValue(value: ExcelJS.CellValue): unknown {
  if (value && typeof value === 'object' && !(value instanceof Date) && 'result' in value) return value.result;
  return value instanceof Date || typeof value === 'number' ? value : cellText(value);
}
