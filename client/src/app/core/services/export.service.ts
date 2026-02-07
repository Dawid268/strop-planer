import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/** Column definition for export */
export interface ExportColumn {
  key: string;
  label: string;
}

/** Generic record type for exportable data */
export type ExportableRecord = Record<string, unknown>;

@Injectable({
  providedIn: 'root',
})
export class ExportService {
  /**
   * Eksportuje dane do pliku CSV
   */
  public exportToCsv(
    data: ExportableRecord[],
    filename: string,
    columns: ExportColumn[],
  ): void {
    if (!data || !data.length) {
      return;
    }

    const header = columns.map((col) => `"${col.label}"`).join(',');
    const rows = data.map((item) => {
      return columns
        .map((col) => {
          const val = this.resolveValue(item, col.key);
          return `"${val !== undefined ? String(val) : ''}"`;
        })
        .join(',');
    });

    const csvContent = [header, ...rows].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], {
      type: 'text/csv;charset=utf-8;',
    });
    const link = document.createElement('a');

    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `${filename}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  /**
   * Eksportuje dane do pliku PDF
   */
  public exportToPdf(
    data: ExportableRecord[],
    filename: string,
    columns: ExportColumn[],
    title: string,
  ): void {
    const doc = new jsPDF();

    // Dodaj tytuł
    doc.setFontSize(18);
    doc.text(title, 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);

    // Dodaj datę wygenerowania
    const dateStr = new Date().toLocaleString();
    doc.text(`Wygenerowano: ${dateStr}`, 14, 30);

    const tableData = data.map((item) =>
      columns.map((col) => {
        const val = this.resolveValue(item, col.key);
        return val !== undefined && val !== null ? String(val) : '';
      }),
    );
    const tableHeader = [columns.map((col) => col.label)];

    autoTable(doc, {
      head: tableHeader,
      body: tableData as string[][],
      startY: 40,
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [63, 81, 181], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    });

    doc.save(`${filename}.pdf`);
  }

  private resolveValue(obj: ExportableRecord, path: string): unknown {
    if (path.includes('.')) {
      return path.split('.').reduce<unknown>((prev, curr) => {
        if (prev && typeof prev === 'object' && curr in prev) {
          return (prev as ExportableRecord)[curr];
        }
        return undefined;
      }, obj);
    }
    return obj[path];
  }
}
