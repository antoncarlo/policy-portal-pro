import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { PracticesTable } from "@/components/practices/PracticesTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Filter } from "lucide-react";
import { Link } from "react-router-dom";

const Practices = () => {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Pratiche</h1>
            <p className="text-muted-foreground mt-1">
              Visualizza e gestisci tutte le pratiche assicurative
            </p>
          </div>
          <Link to="/upload">
            <Button>Carica Nuova Pratica</Button>
          </Link>
        </div>

        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cerca per numero pratica, cliente, tipo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button variant="outline">
            <Filter className="mr-2 h-4 w-4" />
            Filtri
          </Button>
        </div>

        <PracticesTable searchQuery={searchQuery} />
      </div>
    </DashboardLayout>
  );
};

export default Practices;
