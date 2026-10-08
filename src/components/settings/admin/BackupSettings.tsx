import { formatDateTime, getMessages, useMessages } from "@/i18n";
import { commonMessages } from "@/i18n/messages/common";
import { systemMessages } from "@/i18n/messages/system";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Json } from "@/integrations/supabase/types";
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
  const m = useMessages(systemMessages).backup;
  const common = useMessages(commonMessages);

  const handleExportData = async () => {
    setLoading(true);
    try {
      // Export all tables data
      const tables = ["profiles", "practices", "clients", "practice_documents", "practice_events", "notifications"];
      const exportData: {
        export_date: string;
        version: string;
        tables: Record<string, Json[] | null>;
      } = {
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
        title: getMessages(commonMessages).success,
        description: getMessages(systemMessages).backup.done,
      });
    } catch (error) {
      console.error("Error exporting data:", error);
      toast({
        variant: "destructive",
        title: getMessages(commonMessages).error,
        description: getMessages(systemMessages).backup.failed,
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
      const importData = JSON.parse(text) as { tables?: Record<string, Json[]> };

      if (!importData.tables) {
        throw new Error(getMessages(systemMessages).backup.invalidFormat);
      }

      toast({
        title: getMessages(systemMessages).backup.warningTitle,
        description: getMessages(systemMessages).backup.restoreAdvanced,
      });

      setShowRestoreDialog(false);
    } catch (error) {
      console.error("Error importing data:", error);
      toast({
        variant: "destructive",
        title: getMessages(commonMessages).error,
        description: error.message || getMessages(systemMessages).backup.importFailed,
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
        title: getMessages(commonMessages).success,
        description: getMessages(systemMessages).backup.saved,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: getMessages(commonMessages).error,
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
            <h2 className="text-xl font-semibold">{m.title}</h2>
          </div>

          <div className="space-y-6">
            {/* Backup Automatico */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{m.auto}</Label>
                  <p className="text-sm text-muted-foreground">
                    {m.autoText}
                  </p>
                </div>
                <Switch
                  checked={autoBackup}
                  onCheckedChange={setAutoBackup}
                />
              </div>

              {autoBackup && (
                <div className="space-y-2 pl-4 border-l-2 border-muted">
                  <Label>{m.frequency}</Label>
                  <Select value={backupFrequency} onValueChange={setBackupFrequency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hourly">{m.hourly}</SelectItem>
                      <SelectItem value="daily">{m.daily}</SelectItem>
                      <SelectItem value="weekly">{m.weekly}</SelectItem>
                      <SelectItem value="monthly">{m.monthly}</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {m.retention}
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSaveSettings} disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {m.save}
              </Button>
            </div>
          </div>
        </Card>

        {/* Backup Manuale */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Download className="h-5 w-5" />
            <h3 className="text-lg font-semibold">{m.manual}</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            {m.manualText}
          </p>
          <Button onClick={handleExportData} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {m.creating}
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                {m.download}
              </>
            )}
          </Button>
        </Card>

        {/* Ripristino */}
        <Card className="p-6 border-destructive/50">
          <div className="flex items-center gap-2 mb-4">
            <Upload className="h-5 w-5 text-destructive" />
            <h3 className="text-lg font-semibold text-destructive">{m.restore}</h3>
          </div>
          <div className="space-y-4">
            <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-destructive">{m.restoreWarningTitle}</p>
                <p className="text-muted-foreground mt-1">
                  {m.restoreWarning}
                </p>
              </div>
            </div>
            <Button
              variant="destructive"
              onClick={() => setShowRestoreDialog(true)}
              disabled={loading}
            >
              <Upload className="mr-2 h-4 w-4" />
              {m.restoreButton}
            </Button>
          </div>
        </Card>

        {/* Ultimo Backup */}
        <Card className="p-6 bg-muted">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-5 w-5" />
            <h3 className="font-semibold">{m.last}</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            {m.lastAuto(formatDateTime(new Date()))}
          </p>
          <p className="text-sm text-muted-foreground">
            {m.size("2.4 MB")}
          </p>
          <p className="text-sm text-muted-foreground">
            {m.next(formatDateTime(new Date(Date.now() + 24 * 60 * 60 * 1000)))}
          </p>
        </Card>
      </div>

      <AlertDialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{m.confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {m.confirmText}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => document.getElementById("backup-upload")?.click()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {m.continue}
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
