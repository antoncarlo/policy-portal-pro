import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Practice {
  id: string;
  practice_number: string;
  practice_type: string;
  client_name: string;
  premium_amount: number | null;
  commission_percentage: number | null;
  commission_amount: number | null;
  financial_status: string;
  payment_date: string | null;
  commission_received_date: string | null;
  created_at: string;
  user_id?: string;
  user_full_name?: string;
  user_role?: string;
}

interface FinancialPracticesTableProps {
  practices: Practice[];
  onEditFinancial: (practice: Practice) => void;
  showUserColumn?: boolean;
}

export const FinancialPracticesTable = ({
  practices,
  onEditFinancial,
  showUserColumn = false,
}: FinancialPracticesTableProps) => {
  const navigate = useNavigate();

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return "-";
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  const formatDate = (date: string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("it-IT");
  };

  const getFinancialStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      non_incassata: "bg-gray-100 text-gray-800 border-gray-300",
      incassata: "bg-orange-100 text-orange-800 border-orange-300",
      provvigioni_ricevute: "bg-green-100 text-green-800 border-green-300",
    };
    return colors[status] || colors.non_incassata;
  };

  const getFinancialStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      non_incassata: "Non Incassata",
      incassata: "Incassata",
      provvigioni_ricevute: "Provvigioni Ricevute",
    };
    return labels[status] || status;
  };

  const getPracticeTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      fidejussioni: "Fidejussioni",
      car: "Car",
      postuma_decennale: "Postuma Decennale",
      all_risk: "All Risk",
      responsabilita_civile: "Responsabilità Civile",
      pet: "Pet",
      fotovoltaico: "Fotovoltaico",
      catastrofali: "Catastrofali",
      azienda: "Azienda",
      casa: "Casa",
      risparmio: "Risparmio",
      salute: "Salute",
      auto: "Auto",
      vita: "Vita",
      responsabilita: "Responsabilità",
      altro: "Altro",
    };
    return labels[type] || type;
  };

  if (practices.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Nessuna pratica trovata</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Numero Pratica</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Cliente</TableHead>
            {showUserColumn && <TableHead>Utente</TableHead>}
            <TableHead className="text-right">Premio</TableHead>
            <TableHead className="text-right">Provv. %</TableHead>
            <TableHead className="text-right">Provvigione</TableHead>
            <TableHead>Stato Finanziario</TableHead>
            <TableHead>Data Incasso</TableHead>
            <TableHead>Data Provv.</TableHead>
            <TableHead className="text-right">Azioni</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {practices.map((practice) => (
            <TableRow key={practice.id}>
              <TableCell className="font-medium">
                {practice.practice_number}
              </TableCell>
              <TableCell>{getPracticeTypeLabel(practice.practice_type)}</TableCell>
              <TableCell>{practice.client_name}</TableCell>
              {showUserColumn && (
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{practice.user_full_name}</span>
                    {practice.user_role && (
                      <span className="text-xs text-muted-foreground capitalize">
                        {practice.user_role}
                      </span>
                    )}
                  </div>
                </TableCell>
              )}
              <TableCell className="text-right">
                {formatCurrency(practice.premium_amount)}
              </TableCell>
              <TableCell className="text-right">
                {practice.commission_percentage ? `${practice.commission_percentage}%` : "-"}
              </TableCell>
              <TableCell className="text-right font-medium">
                {formatCurrency(practice.commission_amount)}
              </TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className={getFinancialStatusColor(practice.financial_status)}
                >
                  {getFinancialStatusLabel(practice.financial_status)}
                </Badge>
              </TableCell>
              <TableCell>{formatDate(practice.payment_date)}</TableCell>
              <TableCell>{formatDate(practice.commission_received_date)}</TableCell>
              <TableCell className="text-right">
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/practices/${practice.id}`)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEditFinancial(practice)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
