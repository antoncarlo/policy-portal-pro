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
import autoTable from "jspdf-autotable";

type PracticeStatus = "in_lavorazione" | "in_attesa" | "approvata" | "rifiutata" | "completata";
type PracticeType = "auto" | "casa" | "vita" | "salute" | "responsabilita" | "altro";

interface Practice {
  practice_number: string;
  practice_type: PracticeType;
  client_name: string;
  policy_number: string | null;
  status: PracticeStatus;
  created_at: string;
}

interface PracticesExportProps {
  practices: Practice[];
}

export const PracticesExport = ({ practices }: PracticesExportProps) => {
  const getStatusLabel = (status: PracticeStatus) => {
    const labels = {
      in_lavorazione: "In Lavorazione",
      completata: "Completata",
      rifiutata: "Rifiutata",
      in_attesa: "In Attesa",
      approvata: "Approvata",
    };
    return labels[status];
  };

  const getPracticeTypeLabel = (type: PracticeType) => {
    const labels = {
      auto: "Auto",
      casa: "Casa",
      vita: "Vita",
      salute: "Salute",
      responsabilita: "Responsabilità Civile",
      altro: "Altro",
    };
    return labels[type];
  };

  const exportToExcel = () => {
    const data = practices.map((practice) => ({
      "Numero Pratica": practice.practice_number,
      Cliente: practice.client_name,
      Tipo: getPracticeTypeLabel(practice.practice_type),
      Polizza: practice.policy_number || "-",
      Stato: getStatusLabel(practice.status),
      Data: new Date(practice.created_at).toLocaleDateString("it-IT"),
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pratiche");

    // Set column widths
    const colWidths = [
      { wch: 15 }, // Numero Pratica
      { wch: 25 }, // Cliente
      { wch: 20 }, // Tipo
      { wch: 15 }, // Polizza
      { wch: 15 }, // Stato
      { wch: 12 }, // Data
    ];
    ws["!cols"] = colWidths;

    XLSX.writeFile(wb, `pratiche_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();

    // Add title
    doc.setFontSize(18);
    doc.text("Elenco Pratiche", 14, 20);

    // Add date
    doc.setFontSize(10);
    doc.text(
      `Generato il: ${new Date().toLocaleDateString("it-IT")}`,
      14,
      28
    );

    // Prepare table data
    const tableData = practices.map((practice) => [
      practice.practice_number,
      practice.client_name,
      getPracticeTypeLabel(practice.practice_type),
      practice.policy_number || "-",
      getStatusLabel(practice.status),
      new Date(practice.created_at).toLocaleDateString("it-IT"),
    ]);

    // Add table
    autoTable(doc, {
      head: [["N. Pratica", "Cliente", "Tipo", "Polizza", "Stato", "Data"]],
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

    doc.save(`pratiche_${new Date().toISOString().split("T")[0]}.pdf`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Esporta
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={exportToExcel}>
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Esporta in Excel
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportToPDF}>
          <FileText className="mr-2 h-4 w-4" />
          Esporta in PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
