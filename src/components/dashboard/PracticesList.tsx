import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PracticesListProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export const PracticesList = ({ searchQuery, onSearchChange }: PracticesListProps) => {
  const practices = [
    {
      id: "PR-2024-001",
      client: "Mario Rossi",
      type: "Auto",
      status: "in-elaborazione",
      date: "15/01/2024",
    },
    {
      id: "PR-2024-002",
      client: "Laura Bianchi",
      type: "Casa",
      status: "completata",
      date: "14/01/2024",
    },
    {
      id: "PR-2024-003",
      client: "Giuseppe Verdi",
      type: "Vita",
      status: "da-approvare",
      date: "13/01/2024",
    },
    {
      id: "PR-2024-004",
      client: "Anna Ferrari",
      type: "Auto",
      status: "in-elaborazione",
      date: "12/01/2024",
    },
    {
      id: "PR-2024-005",
      client: "Marco Colombo",
      type: "Salute",
      status: "completata",
      date: "11/01/2024",
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

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-foreground">Pratiche Recenti</h2>
        <Button variant="ghost" size="sm">
          Vedi Tutte
        </Button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cerca pratiche..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="space-y-3">
        {practices.map((practice) => (
          <div
            key={practice.id}
            className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-accent/50 transition-colors"
          >
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <span className="font-semibold text-foreground">{practice.id}</span>
                <Badge variant="outline" className={getStatusColor(practice.status)}>
                  {getStatusLabel(practice.status)}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>{practice.client}</span>
                <span>•</span>
                <span>{practice.type}</span>
                <span>•</span>
                <span>{practice.date}</span>
              </div>
            </div>
            <Button variant="ghost" size="sm">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
};
