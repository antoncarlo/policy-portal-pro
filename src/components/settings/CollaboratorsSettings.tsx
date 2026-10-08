import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { formatDate, getMessages, useMessages } from "@/i18n";
import { commonMessages } from "@/i18n/messages/common";
import { settingsMessages } from "@/i18n/messages/settings";
import { supabase } from "@/integrations/supabase/client";
import { Users, UserPlus, Trash2, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Badge } from "@/components/ui/badge";

interface CollaboratorProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
}

interface Collaborator {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  created_at: string;
  practices_count: number;
}

interface CollaboratorsSettingsProps {
  /** Only administrators create users (Gestione Utenti). */
  canAddCollaborators?: boolean;
}

export const CollaboratorsSettings = ({ canAddCollaborators = false }: CollaboratorsSettingsProps) => {
  const { toast } = useToast();
  const m = useMessages(settingsMessages).collaborators;
  const common = useMessages(commonMessages);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedCollaborator, setSelectedCollaborator] = useState<Collaborator | null>(null);

  useEffect(() => {
    loadCollaborators();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- legacy loader intentionally runs only for the dependency list below
  }, []);

  const loadCollaborators = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get collaborators assigned to this agent
      const { data: collaboratorsData, error } = await supabase
        .from("user_roles")
        .select("id, user_id, created_at")
        .eq("parent_agent_id", user.id)
        .eq("role", "collaboratore");

      if (error) throw error;

      // user_roles points at auth.users, not at profiles: the names are read separately.
      const collaboratorIds = (collaboratorsData || []).map((collab) => collab.user_id);
      const { data: profilesData, error: profilesError } = collaboratorIds.length
        ? await supabase.from("profiles").select("id, full_name, email, phone").in("id", collaboratorIds)
        : { data: [] as CollaboratorProfile[], error: null };
      if (profilesError) throw profilesError;
      const profileById = new Map((profilesData || []).map((profile) => [profile.id, profile as CollaboratorProfile]));

      // Get practice counts for each collaborator
      const collaboratorsWithCounts = await Promise.all(
        (collaboratorsData || []).map(async (collab) => {
          const profile = profileById.get(collab.user_id);
          const { count } = await supabase
            .from("practices")
            .select("*", { count: "exact", head: true })
            .eq("user_id", collab.user_id);

          return {
            id: collab.id,
            user_id: collab.user_id,
            full_name: profile?.full_name || "N/A",
            email: profile?.email || "N/A",
            phone: profile?.phone ?? null,
            created_at: collab.created_at,
            practices_count: count || 0,
          };
        })
      );

      setCollaborators(collaboratorsWithCounts);
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

  const handleRemoveCollaborator = async () => {
    if (!selectedCollaborator) return;

    try {
      // Remove the parent_agent_id relationship
      const { error } = await supabase
        .from("user_roles")
        .update({ parent_agent_id: null })
        .eq("user_id", selectedCollaborator.user_id);

      if (error) throw error;

      toast({
        title: getMessages(commonMessages).success,
        description: getMessages(settingsMessages).collaborators.removed,
      });

      setDeleteDialogOpen(false);
      setSelectedCollaborator(null);
      loadCollaborators();
    } catch (error) {
      toast({
        variant: "destructive",
        title: getMessages(commonMessages).error,
        description: error.message,
      });
    }
  };

  const handleViewPractices = (collaborator: Collaborator) => {
    // Navigate to practices page with filter for this collaborator
    navigate(`/practices?user=${collaborator.user_id}`);
  };

  return (
    <Card className="p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <Users className="h-5 w-5" />
          <h2 className="min-w-0 break-words text-xl font-semibold">{m.title}</h2>
        </div>
        {canAddCollaborators && (
          <Button onClick={() => navigate("/user-management")} size="sm" className="h-auto min-h-9 w-full whitespace-normal sm:w-auto">
            <UserPlus className="mr-2 h-4 w-4 shrink-0" />
            <span>{m.add}</span>
          </Button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">
          {common.loading}
        </div>
      ) : collaborators.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">{m.emptyTitle}</p>
          <p className="text-sm mt-2">
            {m.emptyText}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border">
          <div className="w-full overflow-x-auto">
          <Table className="min-w-[820px]">
            <TableHeader>
              <TableRow>
                <TableHead>{m.name}</TableHead>
                <TableHead>{m.email}</TableHead>
                <TableHead>{m.phone}</TableHead>
                <TableHead className="text-center">{m.practices}</TableHead>
                <TableHead>{m.assignedOn}</TableHead>
                <TableHead className="text-right">{m.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {collaborators.map((collaborator) => (
                <TableRow key={collaborator.id}>
                  <TableCell className="max-w-[220px] break-words font-medium">
                    {collaborator.full_name}
                  </TableCell>
                  <TableCell className="max-w-[260px] break-all">{collaborator.email}</TableCell>
                  <TableCell className="break-words">{collaborator.phone || "-"}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary">
                      {collaborator.practices_count}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {formatDate(collaborator.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewPractices(collaborator)}
                        title={m.viewPractices}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedCollaborator(collaborator);
                          setDeleteDialogOpen(true);
                        }}
                        title={m.remove}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </div>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{m.confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {m.confirmText(selectedCollaborator?.full_name ?? "")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{m.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveCollaborator}>
              {m.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
