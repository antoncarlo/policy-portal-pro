import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Filter, CalendarIcon, X } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

export interface PracticeFilters {
  practiceType: string;
  status: string;
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  userId: string;
}

interface PracticesFiltersProps {
  filters: PracticeFilters;
  onFiltersChange: (filters: PracticeFilters) => void;
  onClearFilters: () => void;
}

interface User {
  id: string;
  full_name: string;
  email: string;
}

export const PracticesFilters = ({
  filters,
  onFiltersChange,
  onClearFilters,
}: PracticesFiltersProps) => {
  const [users, setUsers] = useState<User[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    checkUserRole();
  }, []);

  const checkUserRole = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id);

    const userIsAdmin = roles?.some((r) => r.role === "admin");
    setIsAdmin(userIsAdmin || false);

    if (userIsAdmin) {
      loadAllUsers();
    } else {
      loadCollaborators(session.user.id);
    }
  };

  const loadAllUsers = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .order("full_name");

    if (!error && data) {
      setUsers(data);
    }
  };

  const loadCollaborators = async (agentId: string) => {
    const { data, error } = await supabase
      .from("user_roles")
      .select("user_id, profiles(id, full_name, email)")
      .eq("parent_agent_id", agentId);

    if (!error && data) {
      const collaborators = data
        .filter((r) => r.profiles)
        .map((r) => r.profiles as unknown as User);
      setUsers(collaborators);
    }
  };

  const updateFilter = (key: keyof PracticeFilters, value: any) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const hasActiveFilters = () => {
    return (
      filters.practiceType !== "all" ||
      filters.status !== "all" ||
      filters.dateFrom !== undefined ||
      filters.dateTo !== undefined ||
      filters.userId !== "all"
    );
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className="relative">
          <Filter className="mr-2 h-4 w-4" />
          Filtri Avanzati
          {hasActiveFilters() && (
            <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-primary" />
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Filtri Avanzati</SheetTitle>
          <SheetDescription>
            Filtra le pratiche per tipo, stato, date e utente
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          <div className="space-y-2">
            <Label htmlFor="practiceType">Tipo Pratica</Label>
            <Select
              value={filters.practiceType}
              onValueChange={(value) => updateFilter("practiceType", value)}
            >
              <SelectTrigger id="practiceType">
                <SelectValue placeholder="Tutti i tipi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti i tipi</SelectItem>
                <SelectItem value="auto">Auto</SelectItem>
                <SelectItem value="casa">Casa</SelectItem>
                <SelectItem value="vita">Vita</SelectItem>
                <SelectItem value="salute">Salute</SelectItem>
                <SelectItem value="responsabilita">Responsabilità Civile</SelectItem>
                <SelectItem value="altro">Altro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Stato</Label>
            <Select
              value={filters.status}
              onValueChange={(value) => updateFilter("status", value)}
            >
              <SelectTrigger id="status">
                <SelectValue placeholder="Tutti gli stati" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti gli stati</SelectItem>
                <SelectItem value="in_lavorazione">In Lavorazione</SelectItem>
                <SelectItem value="in_attesa">In Attesa</SelectItem>
                <SelectItem value="approvata">Approvata</SelectItem>
                <SelectItem value="completata">Completata</SelectItem>
                <SelectItem value="rifiutata">Rifiutata</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Data Da</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !filters.dateFrom && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filters.dateFrom ? (
                    format(filters.dateFrom, "PPP")
                  ) : (
                    <span>Seleziona data</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filters.dateFrom}
                  onSelect={(date) => updateFilter("dateFrom", date)}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Data A</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !filters.dateTo && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filters.dateTo ? (
                    format(filters.dateTo, "PPP")
                  ) : (
                    <span>Seleziona data</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filters.dateTo}
                  onSelect={(date) => updateFilter("dateTo", date)}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {(isAdmin || users.length > 0) && (
            <div className="space-y-2">
              <Label htmlFor="userId">
                {isAdmin ? "Utente" : "Collaboratore"}
              </Label>
              <Select
                value={filters.userId}
                onValueChange={(value) => updateFilter("userId", value)}
              >
                <SelectTrigger id="userId">
                  <SelectValue placeholder="Tutti gli utenti" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {isAdmin ? "Tutti gli utenti" : "Tutti i collaboratori"}
                  </SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.full_name || user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                onClearFilters();
                setOpen(false);
              }}
            >
              <X className="mr-2 h-4 w-4" />
              Cancella Filtri
            </Button>
            <Button className="flex-1" onClick={() => setOpen(false)}>
              Applica Filtri
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
