import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
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

interface Collaborator {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  created_at: string;
  practices_count: number;
}

export const CollaboratorsSettings = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedCollaborator, setSelectedCollaborator] = useState<Collaborator | null>(null);

  useEffect(() => {
    loadCollaborators();
  }, []);

  const loadCollaborators = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get collaborators assigned to this agent
      const { data: collaboratorsData, error } = await supabase
        .from("user_roles")
        .select(`
          id,
          user_id,
          created_at,
          profiles:user_id (
            full_name,
            email,
            phone
          )
        `)
        .eq("parent_agent_id", user.id)
        .eq("role", "collaboratore");

      if (error) throw error;

      // Get practice counts for each collaborator
      const collaboratorsWithCounts = await Promise.all(
        (collaboratorsData || []).map(async (collab: any) => {
          const { count } = await supabase
            .from("practices")
            .select("*", { count: "exact", head: true })
            .eq("user_id", collab.user_id);

          return {
            id: collab.id,
            user_id: collab.user_id,
            full_name: collab.profiles?.full_name || "N/A",
            email: collab.profiles?.email || "N/A",
            phone: collab.profiles?.phone,
            created_at: collab.created_at,
            practices_count: count || 0,
          };
        })
      );

      setCollaborators(collaboratorsWithCounts);
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
        title: "Successo",
        description: "Collaboratore rimosso dalla tua gestione",
      });

      setDeleteDialogOpen(false);
      setSelectedCollaborator(null);
      loadCollaborators();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Errore",
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
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          <h2 className="text-xl font-semibold">Gestione Collaboratori</h2>
        </div>
        <Button onClick={() => navigate("/admin/users")} size="sm">
          <UserPlus className="mr-2 h-4 w-4" />
          Aggiungi Collaboratore
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">
          Caricamento...
        </div>
      ) : collaborators.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">Nessun collaboratore assegnato</p>
          <p className="text-sm mt-2">
            I collaboratori assegnati a te appariranno qui
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Telefono</TableHead>
                <TableHead className="text-center">Pratiche</TableHead>
                <TableHead>Assegnato il</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {collaborators.map((collaborator) => (
                <TableRow key={collaborator.id}>
                  <TableCell className="font-medium">
                    {collaborator.full_name}
                  </TableCell>
                  <TableCell>{collaborator.email}</TableCell>
                  <TableCell>{collaborator.phone || "-"}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary">
                      {collaborator.practices_count}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(collaborator.created_at).toLocaleDateString("it-IT")}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewPractices(collaborator)}
                        title="Visualizza pratiche"
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
                        title="Rimuovi collaboratore"
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
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rimuovi Collaboratore</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler rimuovere <strong>{selectedCollaborator?.full_name}</strong> dalla
              tua gestione? Il collaboratore non sarà eliminato, ma non sarà più assegnato a te.
              Le sue pratiche rimarranno accessibili.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveCollaborator}>
              Rimuovi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
