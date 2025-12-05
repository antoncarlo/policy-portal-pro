import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

interface ExpiryPractice {
  practice_id: string;
  practice_number: string;
  practice_type: string;
  client_name: string;
  policy_end_date: string;
  days_until_expiry: number;
}

export const ExpiryCalendar = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [expiries, setExpiries] = useState<ExpiryPractice[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedPracticeType, setSelectedPracticeType] = useState<string>("all");

  useEffect(() => {
    loadExpiries();
  }, [selectedPracticeType]);

  const loadExpiries = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase.rpc("get_upcoming_expiries", {
        p_user_id: user.id,
        p_days_ahead: 365, // Load full year for calendar
        p_practice_type: selectedPracticeType === "all" ? null : selectedPracticeType,
      });

      if (error) throw error;
      setExpiries(data || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Errore caricamento",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    return firstDay === 0 ? 6 : firstDay - 1; // Convert Sunday=0 to Monday=0
  };

  const getExpiriesForDate = (date: Date) => {
    const dateStr = date.toISOString().split("T")[0];
    return expiries.filter((e) => e.policy_end_date === dateStr);
  };

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const today = () => {
    setCurrentDate(new Date());
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const days = [];

    // Empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-24 bg-gray-50 dark:bg-gray-900"></div>);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      const dayExpiries = getExpiriesForDate(date);
      const isToday =
        date.toDateString() === new Date().toDateString();

      days.push(
        <Card
          key={day}
          className={`h-24 p-2 hover:shadow-md transition-shadow ${
            isToday ? "border-primary border-2" : ""
          } ${dayExpiries.length > 0 ? "cursor-pointer" : ""}`}
        >
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between mb-1">
              <span className={`text-sm font-semibold ${isToday ? "text-primary" : ""}`}>
                {day}
              </span>
              {dayExpiries.length > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {dayExpiries.length}
                </Badge>
              )}
            </div>
            <div className="flex-1 overflow-y-auto space-y-1">
              {dayExpiries.slice(0, 2).map((expiry) => (
                <div
                  key={expiry.practice_id}
                  className="text-xs p-1 bg-red-100 dark:bg-red-900 rounded cursor-pointer hover:bg-red-200 dark:hover:bg-red-800"
                  onClick={() => navigate(`/practices/${expiry.practice_id}`)}
                >
                  <p className="font-medium truncate">{expiry.client_name}</p>
                  <p className="text-muted-foreground truncate">{expiry.practice_type}</p>
                </div>
              ))}
              {dayExpiries.length > 2 && (
                <p className="text-xs text-muted-foreground">+{dayExpiries.length - 2} altre</p>
              )}
            </div>
          </div>
        </Card>
      );
    }

    return days;
  };

  const monthNames = [
    "Gennaio",
    "Febbraio",
    "Marzo",
    "Aprile",
    "Maggio",
    "Giugno",
    "Luglio",
    "Agosto",
    "Settembre",
    "Ottobre",
    "Novembre",
    "Dicembre",
  ];

  const dayNames = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Calendar Controls */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={previousMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-xl font-semibold min-w-[200px] text-center">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h2>
            <Button variant="outline" size="sm" onClick={nextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={today}>
              <CalendarIcon className="h-4 w-4 mr-2" />
              Oggi
            </Button>
          </div>

          <div className="w-64">
            <Select value={selectedPracticeType} onValueChange={setSelectedPracticeType}>
              <SelectTrigger>
                <SelectValue placeholder="Filtra per tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutte le polizze</SelectItem>
                <SelectItem value="Fidejussioni">Fidejussioni</SelectItem>
                <SelectItem value="Car">Car</SelectItem>
                <SelectItem value="Postuma Decennale">Postuma Decennale</SelectItem>
                <SelectItem value="All Risk">All Risk</SelectItem>
                <SelectItem value="RC">RC Professionale</SelectItem>
                <SelectItem value="Pet">Pet</SelectItem>
                <SelectItem value="Fotovoltaico">Fotovoltaico</SelectItem>
                <SelectItem value="Catastrofali">Catastrofali</SelectItem>
                <SelectItem value="Azienda">Azienda</SelectItem>
                <SelectItem value="Casa">Casa</SelectItem>
                <SelectItem value="Risparmio">Risparmio</SelectItem>
                <SelectItem value="Salute">Salute</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Calendar Grid */}
      <Card className="p-4">
        <div className="grid grid-cols-7 gap-2">
          {/* Day headers */}
          {dayNames.map((day) => (
            <div key={day} className="text-center font-semibold text-sm py-2">
              {day}
            </div>
          ))}
          {/* Calendar days */}
          {renderCalendar()}
        </div>
      </Card>

      {/* Legend */}
      <Card className="p-4">
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-primary rounded"></div>
            <span>Oggi</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="destructive" className="text-xs">1</Badge>
            <span>Numero scadenze</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-100 dark:bg-red-900 rounded"></div>
            <span>Polizza in scadenza</span>
          </div>
        </div>
      </Card>
    </div>
  );
};
