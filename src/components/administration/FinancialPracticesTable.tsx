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
import { formatCurrency as formatLocaleCurrency, formatDate as formatLocaleDate, useMessages } from "@/i18n";
import { administrationMessages } from "@/i18n/messages/administration";
import { financialStatusLabel, practiceTypeLabel, roleLabel } from "@/i18n/messages/domain";

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
  const m = useMessages(administrationMessages).table;

  const formatCurrency = (amount: number | null) => (amount === null ? "-" : formatLocaleCurrency(amount));

  const formatDate = (date: string | null) => (date ? formatLocaleDate(date) : "-");

  const getFinancialStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      non_incassata: "bg-gray-100 text-gray-800 border-gray-300",
      incassata: "bg-orange-100 text-orange-800 border-orange-300",
      provvigioni_ricevute: "bg-green-100 text-green-800 border-green-300",
    };
    return colors[status] || colors.non_incassata;
  };

  const getFinancialStatusLabel = (status: string) => financialStatusLabel(status);

  const getPracticeTypeLabel = (type: string) => practiceTypeLabel(type);

  if (practices.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>{m.empty}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border">
      <div className="w-full overflow-x-auto">
      <Table className="min-w-[1180px]">
        <TableHeader>
          <TableRow>
            <TableHead>{m.number}</TableHead>
            <TableHead>{m.type}</TableHead>
            <TableHead>{m.client}</TableHead>
            {showUserColumn && <TableHead>{m.user}</TableHead>}
            <TableHead className="text-right">{m.premium}</TableHead>
            <TableHead className="text-right">{m.commissionPercentage}</TableHead>
            <TableHead className="text-right">{m.commission}</TableHead>
            <TableHead>{m.status}</TableHead>
            <TableHead>{m.paymentDate}</TableHead>
            <TableHead>{m.commissionDate}</TableHead>
            <TableHead className="text-right">{m.actions}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {practices.map((practice) => (
            <TableRow key={practice.id}>
              <TableCell className="font-medium whitespace-nowrap">
                {practice.practice_number}
              </TableCell>
              <TableCell className="whitespace-nowrap">{getPracticeTypeLabel(practice.practice_type)}</TableCell>
              <TableCell className="max-w-[220px] break-words">{practice.client_name}</TableCell>
              {showUserColumn && (
                <TableCell>
                  <div className="flex min-w-0 flex-col">
                    <span className="max-w-[180px] break-words font-medium">{practice.user_full_name}</span>
                    {practice.user_role && (
                      <span className="text-xs text-muted-foreground">
                        {roleLabel(practice.user_role)}
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
    </div>
  );
};
