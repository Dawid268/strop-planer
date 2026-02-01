import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Injectable({
  providedIn: 'root',
})
export class ExportService {
  /**
   * Eksportuje dane do pliku CSV
   */
  public exportToCsv(
    data: any[],
    filename: string,
    columns: { key: string; label: string }[],
  ): void {
    if (!data || !data.length) {
      return;
    }

    const header = columns.map((col) => `"${col.label}"`).join(',');
    const rows = data.map((item) => {
      return columns
        .map((col) => {
          const val = this.resolveValue(item, col.key);
          return `"${val !== undefined ? val : ''}"`;
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
    data: any[],
    filename: string,
    columns: { key: string; label: string }[],
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
      columns.map((col) => this.resolveValue(item, col.key)),
    );
    const tableHeader = [columns.map((col) => col.label)];

    autoTable(doc, {
      head: tableHeader,
      body: tableData,
      startY: 40,
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [63, 81, 181], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    });

    doc.save(`${filename}.pdf`);
  }

  private resolveValue(obj: any, path: string): any {
    if (path.includes('.')) {
      return path.split('.').reduce((prev, curr) => {
        return prev ? prev[curr] : undefined;
      }, obj);
    }
    return obj[path];
  }
}
