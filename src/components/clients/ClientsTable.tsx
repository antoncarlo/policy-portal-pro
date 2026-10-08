import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Eye, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatDate, getMessages, useMessages } from "@/i18n";
import { clientsMessages } from "@/i18n/messages/clients";

interface Client {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  address_city: string | null;
  created_at: string;
}

interface ClientsTableProps {
  clients: Client[];
  loading: boolean;
  onClientUpdated: () => void;
  onClientEdit: (client: Client) => void;
}

export const ClientsTable = ({
  clients,
  loading,
  onClientUpdated,
  onClientEdit,
}: ClientsTableProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const m = useMessages(clientsMessages).table;
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);

  const handleDeleteClient = async () => {
    if (!clientToDelete) return;

    try {
      const { error } = await supabase
        .from("clients")
        .delete()
        .eq("id", clientToDelete.id);

      if (error) throw error;

      toast({
        title: getMessages(clientsMessages).table.deletedTitle,
        description: getMessages(clientsMessages).table.deletedText(clientToDelete.full_name),
      });

      onClientUpdated();
    } catch (error) {
      toast({
        variant: "destructive",
        title: getMessages(clientsMessages).table.deleteErrorTitle,
        description: error.message,
      });
    } finally {
      setDeleteDialogOpen(false);
      setClientToDelete(null);
    }
  };

  return (
    <Card className="overflow-hidden">
      <div className="w-full overflow-x-auto">
      <Table className="min-w-[980px]">
        <TableHeader>
          <TableRow>
            <TableHead>{m.name}</TableHead>
            <TableHead>{m.company}</TableHead>
            <TableHead>{m.email}</TableHead>
            <TableHead>{m.phone}</TableHead>
            <TableHead>{m.city}</TableHead>
            <TableHead>{m.createdAt}</TableHead>
            <TableHead className="text-right">{m.actions}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                {m.loading}
              </TableCell>
            </TableRow>
          ) : clients.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                {m.empty}
              </TableCell>
            </TableRow>
          ) : (
            clients.map((client) => (
              <TableRow key={client.id}>
                <TableCell className="max-w-[220px] break-words font-medium">{client.full_name}</TableCell>
                <TableCell className="max-w-[220px] break-words text-muted-foreground">
                  {client.company_name || "-"}
                </TableCell>
                <TableCell className="max-w-[260px] break-all text-muted-foreground">
                  {client.email || "-"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {client.phone || client.mobile || "-"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {client.address_city || "-"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(client.created_at)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/clients/${client.id}`)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onClientEdit(client)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          {m.edit}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => {
                            setClientToDelete(client);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          {m.delete}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
            </Table>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{m.confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {m.confirmText(clientToDelete?.full_name ?? "")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{m.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteClient}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {m.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
