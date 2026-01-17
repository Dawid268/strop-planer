import { Injectable, inject } from "@angular/core";

@Injectable({ providedIn: "root" })
export class ExportService {
  /**
   * Export SVG element as PNG image
   */
  public async exportAsPng(
    svgElement: SVGElement,
    filename: string
  ): Promise<void> {
    const svgData = new XMLSerializer().serializeToString(svgElement);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    const svgBlob = new Blob([svgData], {
      type: "image/svg+xml;charset=utf-8",
    });
    const url = URL.createObjectURL(svgBlob);

    return new Promise((resolve) => {
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);

        canvas.toBlob((blob) => {
          if (blob) {
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = `${filename}.png`;
            link.click();
          }
          resolve();
        }, "image/png");
      };
      img.src = url;
    });
  }

  /**
   * Export as SVG file
   */
  public exportAsSvg(svgElement: SVGElement, filename: string): void {
    const svgData = new XMLSerializer().serializeToString(svgElement);
    const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.svg`;
    link.click();
  }

  /**
   * Print current view
   */
  public print(): void {
    window.print();
  }

  /**
   * Generate simple PDF report (uses browser print)
   */
  public generatePdfReport(title: string, content: string): void {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 2rem; }
          h1 { color: #333; border-bottom: 2px solid #3f51b5; padding-bottom: 0.5rem; }
          table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
          th, td { border: 1px solid #ddd; padding: 0.5rem; text-align: left; }
          th { background: #f5f5f5; }
          .header { display: flex; justify-content: space-between; }
          .date { color: #666; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${title}</h1>
          <span class="date">${new Date().toLocaleDateString("pl-PL")}</span>
        </div>
        ${content}
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  }

  /**
   * Generate Bill of Materials table
   */
  public generateBomHtml(
    items: Array<{ name: string; quantity: number; unit: string }>
  ): string {
    const rows = items
      .map(
        (item, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${item.name}</td>
        <td>${item.quantity}</td>
        <td>${item.unit}</td>
      </tr>
    `
      )
      .join("");

    return `
      <h2>Zestawienie materiałów (BoM)</h2>
      <table>
        <thead>
          <tr>
            <th>Lp.</th>
            <th>Nazwa elementu</th>
            <th>Ilość</th>
            <th>Jednostka</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;
  }
}
