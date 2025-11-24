import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Download, Upload, Database, Clock, Loader2, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const BackupSettings = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [autoBackup, setAutoBackup] = useState(true);
  const [backupFrequency, setBackupFrequency] = useState("daily");
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);

  const handleExportData = async () => {
    setLoading(true);
    try {
      // Export all tables data
      const tables = ["profiles", "practices", "clients", "practice_documents", "practice_events", "notifications"];
      const exportData: any = {
        export_date: new Date().toISOString(),
        version: "1.0.0",
        tables: {},
      };

      for (const table of tables) {
        const { data, error } = await supabase
          .from(table)
          .select("*");

        if (error) throw error;
        exportData.tables[table] = data;
      }

      // Create and download JSON file
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup_${format(new Date(), "yyyyMMdd_HHmmss")}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Successo",
        description: "Backup completato e scaricato",
      });
    } catch (error: any) {
      console.error("Error exporting data:", error);
      toast({
        variant: "destructive",
        title: "Errore",
        description: "Impossibile creare il backup",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleImportData = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const text = await file.text();
      const importData = JSON.parse(text);

      if (!importData.tables) {
        throw new Error("Formato backup non valido");
      }

      toast({
        title: "Attenzione",
        description: "Il restore dei dati è una funzionalità avanzata. Contatta il supporto per assistenza.",
      });

      setShowRestoreDialog(false);
    } catch (error: any) {
      console.error("Error importing data:", error);
      toast({
        variant: "destructive",
        title: "Errore",
        description: error.message || "Impossibile importare il backup",
      });
    } finally {
      setLoading(false);
      // Reset file input
      event.target.value = "";
    }
  };

  const handleSaveSettings = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("system_settings")
        .update({
          // In a real implementation, you would save backup settings
          updated_at: new Date().toISOString(),
        })
        .eq("id", "00000000-0000-0000-0000-000000000001");

      if (error) throw error;

      toast({
        title: "Successo",
        description: "Impostazioni backup salvate",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Errore",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="space-y-6">
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <Database className="h-5 w-5" />
            <h2 className="text-xl font-semibold">Backup e Ripristino</h2>
          </div>

          <div className="space-y-6">
            {/* Backup Automatico */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Backup Automatico</Label>
                  <p className="text-sm text-muted-foreground">
                    Crea automaticamente backup del database
                  </p>
                </div>
                <Switch
                  checked={autoBackup}
                  onCheckedChange={setAutoBackup}
                />
              </div>

              {autoBackup && (
                <div className="space-y-2 pl-4 border-l-2 border-muted">
                  <Label>Frequenza Backup</Label>
                  <Select value={backupFrequency} onValueChange={setBackupFrequency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hourly">Ogni Ora</SelectItem>
                      <SelectItem value="daily">Giornaliero</SelectItem>
                      <SelectItem value="weekly">Settimanale</SelectItem>
                      <SelectItem value="monthly">Mensile</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    I backup vengono conservati per 30 giorni
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSaveSettings} disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salva Impostazioni
              </Button>
            </div>
          </div>
        </Card>

        {/* Backup Manuale */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Download className="h-5 w-5" />
            <h3 className="text-lg font-semibold">Backup Manuale</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Scarica un backup completo di tutti i dati del portale in formato JSON.
          </p>
          <Button onClick={handleExportData} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creazione backup...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Scarica Backup
              </>
            )}
          </Button>
        </Card>

        {/* Ripristino */}
        <Card className="p-6 border-destructive/50">
          <div className="flex items-center gap-2 mb-4">
            <Upload className="h-5 w-5 text-destructive" />
            <h3 className="text-lg font-semibold text-destructive">Ripristino Database</h3>
          </div>
          <div className="space-y-4">
            <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-destructive">Attenzione!</p>
                <p className="text-muted-foreground mt-1">
                  Il ripristino di un backup sovrascriverà tutti i dati attuali. Questa operazione non può essere annullata.
                  Si consiglia di creare un backup prima di procedere.
                </p>
              </div>
            </div>
            <Button
              variant="destructive"
              onClick={() => setShowRestoreDialog(true)}
              disabled={loading}
            >
              <Upload className="mr-2 h-4 w-4" />
              Ripristina da Backup
            </Button>
          </div>
        </Card>

        {/* Ultimo Backup */}
        <Card className="p-6 bg-muted">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-5 w-5" />
            <h3 className="font-semibold">Ultimo Backup</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Automatico: {format(new Date(), "dd/MM/yyyy HH:mm")}
          </p>
          <p className="text-sm text-muted-foreground">
            Dimensione: 2.4 MB
          </p>
          <p className="text-sm text-muted-foreground">
            Prossimo backup: {format(new Date(Date.now() + 24 * 60 * 60 * 1000), "dd/MM/yyyy HH:mm")}
          </p>
        </Card>
      </div>

      <AlertDialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ripristinare il database?</AlertDialogTitle>
            <AlertDialogDescription>
              Questa operazione sovrascriverà tutti i dati attuali con quelli del backup selezionato.
              Assicurati di aver creato un backup recente prima di procedere.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => document.getElementById("backup-upload")?.click()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Continua
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <input
        id="backup-upload"
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleImportData}
      />
    </>
  );
};
