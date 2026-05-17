import { jsPDF } from "jspdf";
import { businessDetails } from "../config/business";

const MARGIN = 14;
const LINE = 5;
const PAGE_BOTTOM = 280;

export class PdfBuilder {
  private doc: jsPDF;
  private y = MARGIN;
  private readonly contentWidth: number;

  constructor() {
    this.doc = new jsPDF({ unit: "mm", format: "letter" });
    this.contentWidth = this.doc.internal.pageSize.getWidth() - MARGIN * 2;
  }

  addReportHeader(title: string, subtitle?: string) {
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(14);
    this.doc.text(businessDetails.name, MARGIN, this.y);
    this.y += LINE + 1;

    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(9);
    this.doc.text(businessDetails.address, MARGIN, this.y);
    this.y += LINE;
    this.doc.text(`Tel: ${businessDetails.phone}`, MARGIN, this.y);
    this.y += LINE + 2;

    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(13);
    this.doc.text(title, MARGIN, this.y);
    this.y += LINE + 1;

    if (subtitle) {
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(10);
      this.doc.text(subtitle, MARGIN, this.y);
      this.y += LINE;
    }

    const generated = new Intl.DateTimeFormat("es-DO", {
      dateStyle: "full",
      timeStyle: "short",
    }).format(new Date());
    this.doc.setFontSize(8);
    this.doc.setTextColor(90, 90, 90);
    this.doc.text(`Generado: ${generated}`, MARGIN, this.y);
    this.doc.setTextColor(0, 0, 0);
    this.y += LINE + 3;
  }

  addSection(title: string) {
    this.ensureSpace(LINE * 2);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(11);
    this.doc.text(title, MARGIN, this.y);
    this.y += LINE + 1;
    this.doc.setDrawColor(180, 140, 165);
    this.doc.line(MARGIN, this.y, MARGIN + this.contentWidth, this.y);
    this.y += LINE;
  }

  addParagraph(text: string) {
    this.ensureSpace(LINE * 2);
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(9);
    const lines = this.doc.splitTextToSize(text, this.contentWidth);
    lines.forEach((line: string) => {
      this.ensureSpace(LINE);
      this.doc.text(line, MARGIN, this.y);
      this.y += LINE;
    });
    this.y += 1;
  }

  addKeyValues(rows: { label: string; value: string }[]) {
    this.doc.setFontSize(9);
    rows.forEach(({ label, value }) => {
      this.ensureSpace(LINE);
      this.doc.setFont("helvetica", "bold");
      this.doc.text(`${label}:`, MARGIN, this.y);
      this.doc.setFont("helvetica", "normal");
      this.doc.text(value, MARGIN + 42, this.y);
      this.y += LINE;
    });
    this.y += 2;
  }

  addTable(headers: string[], rows: string[][], columnWidths?: number[]) {
    if (rows.length === 0) {
      this.addParagraph("Sin registros.");
      return;
    }

    const widths = columnWidths ?? headers.map(() => this.contentWidth / headers.length);
    const rowHeight = LINE + 1;
    const headerHeight = rowHeight + 2;

    const drawHeader = () => {
      this.ensureSpace(headerHeight + 2);
      let x = MARGIN;
      this.doc.setFillColor(245, 235, 242);
      this.doc.rect(MARGIN, this.y - 4, this.contentWidth, headerHeight, "F");
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(8);
      headers.forEach((header, index) => {
        this.doc.text(header, x + 1, this.y);
        x += widths[index];
      });
      this.y += headerHeight;
    };

    drawHeader();

    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(8);

    rows.forEach((row, rowIndex) => {
      const cellLines = row.map((cell, index) => (
        this.doc.splitTextToSize(cell, Math.max(8, widths[index] - 2))
      ));
      const maxLines = Math.max(...cellLines.map((lines) => lines.length));
      const blockHeight = maxLines * LINE + 2;

      if (this.y + blockHeight > PAGE_BOTTOM) {
        this.doc.addPage();
        this.y = MARGIN;
        drawHeader();
        this.doc.setFont("helvetica", "normal");
        this.doc.setFontSize(8);
      }

      if (rowIndex % 2 === 1) {
        this.doc.setFillColor(252, 248, 251);
        this.doc.rect(MARGIN, this.y - 3.5, this.contentWidth, blockHeight, "F");
      }

      let x = MARGIN;
      cellLines.forEach((lines, index) => {
        lines.forEach((line: string, lineIndex: number) => {
          this.doc.text(line, x + 1, this.y + lineIndex * LINE);
        });
        x += widths[index];
      });
      this.y += blockHeight;
    });

    this.y += 3;
  }

  save(filename: string) {
    this.doc.save(filename);
  }

  private ensureSpace(height: number) {
    if (this.y + height > PAGE_BOTTOM) {
      this.doc.addPage();
      this.y = MARGIN;
    }
  }
}
