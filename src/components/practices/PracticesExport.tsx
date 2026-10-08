import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import { formatDate, getLanguage, getLocale, useMessages, type Language } from "@/i18n";
import { practicesMessages } from "@/i18n/messages/practices";
import { practiceStatusLabel, practiceTypeLabel } from "@/i18n/messages/domain";
import autoTable from "jspdf-autotable";

type PracticeStatus = "in_lavorazione" | "in_attesa" | "approvata" | "rifiutata" | "completata";
type PracticeType = string;

interface Practice {
  practice_number: string;
  practice_type: PracticeType;
  client_name: string;
  beneficiary: string | null;
  policy_number: string | null;
  status: PracticeStatus;
  created_at: string;
}

interface PracticesExportProps {
  practices: Practice[];
}

// jsPDF's standard fonts have no Chinese glyphs: in Chinese the PDF is written in English.
const pdfLanguage = (): Language => (getLanguage() === "zh" ? "en" : getLanguage());

export const PracticesExport = ({ practices }: PracticesExportProps) => {
  const m = useMessages(practicesMessages).export;

  const exportToExcel = () => {
    const language = getLanguage();
    const labels = practicesMessages[language].export;
    const data = practices.map((practice) => {
      const values = [
        practice.practice_number,
        practice.client_name,
        practice.beneficiary || "-",
        practiceTypeLabel(practice.practice_type, language),
        practice.policy_number || "-",
        practiceStatusLabel(practice.status, language),
        formatDate(practice.created_at),
      ];
      return Object.fromEntries(labels.columns.map((column, index) => [column, values[index]]));
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, labels.sheet);

    // Set column widths
    const colWidths = [
      { wch: 15 }, // Numero Pratica
      { wch: 25 }, // Contraente
      { wch: 25 }, // Beneficiario
      { wch: 20 }, // Tipo
      { wch: 15 }, // Polizza
      { wch: 15 }, // Stato
      { wch: 12 }, // Data
    ];
    ws["!cols"] = colWidths;

    XLSX.writeFile(wb, `${labels.fileName}_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const exportToPDF = () => {
    const language = pdfLanguage();
    const labels = practicesMessages[language].export;
    const date = (value: string | Date) => new Date(value).toLocaleDateString(getLocale(language));
    const doc = new jsPDF();

    // Add title
    doc.setFontSize(18);
    doc.text(labels.pdfTitle, 14, 20);

    // Add date
    doc.setFontSize(10);
    doc.text(labels.generatedOn(date(new Date())), 14, 28);

    // Prepare table data
    const tableData = practices.map((practice) => [
      practice.practice_number,
      practice.client_name,
      practice.beneficiary || "-",
      practiceTypeLabel(practice.practice_type, language),
      practice.policy_number || "-",
      practiceStatusLabel(practice.status, language),
      date(practice.created_at),
    ]);

    // Add table
    autoTable(doc, {
      head: [labels.pdfColumns],
      body: tableData,
      startY: 35,
      styles: {
        fontSize: 8,
        cellPadding: 2,
      },
      headStyles: {
        fillColor: [59, 130, 246], // blue-500
        textColor: 255,
        fontStyle: "bold",
      },
      alternateRowStyles: {
        fillColor: [249, 250, 251], // gray-50
      },
    });

    doc.save(`${labels.fileName}_${new Date().toISOString().split("T")[0]}.pdf`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          {m.button}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={exportToExcel}>
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          {m.excel}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportToPDF}>
          <FileText className="mr-2 h-4 w-4" />
          {m.pdf}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

// supported practice type: vies
