import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Eye, Download, MoreVertical } from "lucide-react";

interface PracticesTableProps {
  searchQuery: string;
}

export const PracticesTable = ({ searchQuery }: PracticesTableProps) => {
  const practices = [
    {
      id: "PR-2024-001",
      client: "Mario Rossi",
      type: "Auto",
      status: "in-elaborazione",
      date: "15/01/2024",
      amount: "€ 1,200",
      policy: "POL-2024-001",
    },
    {
      id: "PR-2024-002",
      client: "Laura Bianchi",
      type: "Casa",
      status: "completata",
      date: "14/01/2024",
      amount: "€ 2,500",
      policy: "POL-2024-002",
    },
    {
      id: "PR-2024-003",
      client: "Giuseppe Verdi",
      type: "Vita",
      status: "da-approvare",
      date: "13/01/2024",
      amount: "€ 5,000",
      policy: "POL-2024-003",
    },
    {
      id: "PR-2024-004",
      client: "Anna Ferrari",
      type: "Auto",
      status: "in-elaborazione",
      date: "12/01/2024",
      amount: "€ 800",
      policy: "POL-2024-004",
    },
    {
      id: "PR-2024-005",
      client: "Marco Colombo",
      type: "Salute",
      status: "completata",
      date: "11/01/2024",
      amount: "€ 3,200",
      policy: "POL-2024-005",
    },
    {
      id: "PR-2024-006",
      client: "Sofia Romano",
      type: "Casa",
      status: "in-elaborazione",
      date: "10/01/2024",
      amount: "€ 2,800",
      policy: "POL-2024-006",
    },
    {
      id: "PR-2024-007",
      client: "Luca Galli",
      type: "Responsabilità Civile",
      status: "da-approvare",
      date: "09/01/2024",
      amount: "€ 1,500",
      policy: "POL-2024-007",
    },
    {
      id: "PR-2024-008",
      client: "Elena Ricci",
      type: "Auto",
      status: "completata",
      date: "08/01/2024",
      amount: "€ 950",
      policy: "POL-2024-008",
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completata":
        return "bg-green-600/10 text-green-600 border-green-600/20";
      case "in-elaborazione":
        return "bg-chart-2/10 text-chart-2 border-chart-2/20";
      case "da-approvare":
        return "bg-destructive/10 text-destructive border-destructive/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "completata":
        return "Completata";
      case "in-elaborazione":
        return "In Elaborazione";
      case "da-approvare":
        return "Da Approvare";
      default:
        return status;
    }
  };

  const filteredPractices = practices.filter((practice) => {
    const query = searchQuery.toLowerCase();
    return (
      practice.id.toLowerCase().includes(query) ||
      practice.client.toLowerCase().includes(query) ||
      practice.type.toLowerCase().includes(query) ||
      practice.policy.toLowerCase().includes(query)
    );
  });

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Numero Pratica</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Polizza</TableHead>
            <TableHead>Data</TableHead>
            <TableHead>Importo</TableHead>
            <TableHead>Stato</TableHead>
            <TableHead className="text-right">Azioni</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredPractices.map((practice) => (
            <TableRow key={practice.id}>
              <TableCell className="font-medium">{practice.id}</TableCell>
              <TableCell>{practice.client}</TableCell>
              <TableCell>{practice.type}</TableCell>
              <TableCell className="text-muted-foreground">
                {practice.policy}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {practice.date}
              </TableCell>
              <TableCell className="font-medium">{practice.amount}</TableCell>
              <TableCell>
                <Badge variant="outline" className={getStatusColor(practice.status)}>
                  {getStatusLabel(practice.status)}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm">
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm">
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
};
