import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MoreVertical, Eye, Edit, Link2, BarChart3, Ban, Trash2 } from "lucide-react";

interface User {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  avatar_url: string | null;
  role: string;
  agent_name: string | null;
  practice_count: number;
}

interface UserTableProps {
  users: User[];
  onEditRole: (user: User) => void;
  onAssignAgent: (user: User) => void;
  onViewPractices: (user: User) => void;
  onDisableUser: (user: User) => void;
  onDeleteUser: (user: User) => void;
}

export const UserTable = ({
  users,
  onEditRole,
  onAssignAgent,
  onViewPractices,
  onDisableUser,
  onDeleteUser,
}: UserTableProps) => {
  const getRoleBadge = (role: string) => {
    const badges = {
      admin: { label: "Admin", className: "bg-red-100 text-red-800 border-red-300" },
      agente: { label: "Agente", className: "bg-blue-100 text-blue-800 border-blue-300" },
      collaboratore: { label: "Collaboratore", className: "bg-green-100 text-green-800 border-green-300" },
    };
    const badge = badges[role as keyof typeof badges] || badges.collaboratore;
    return <Badge className={badge.className}>{badge.label}</Badge>;
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Utente</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Ruolo</TableHead>
            <TableHead>Agente</TableHead>
            <TableHead className="text-right">Pratiche</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                Nessun utente trovato
              </TableCell>
            </TableRow>
          ) : (
            users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={user.avatar_url || undefined} />
                      <AvatarFallback>{getInitials(user.full_name)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{user.full_name}</div>
                      <div className="text-sm text-gray-500">{user.phone}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>{getRoleBadge(user.role)}</TableCell>
                <TableCell>
                  {user.agent_name ? (
                    <span className="text-sm">{user.agent_name}</span>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Badge variant="outline">{user.practice_count}</Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEditRole(user)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Modifica Ruolo
                      </DropdownMenuItem>
                      {user.role === "collaboratore" && (
                        <DropdownMenuItem onClick={() => onAssignAgent(user)}>
                          <Link2 className="h-4 w-4 mr-2" />
                          Assegna Agente
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => onViewPractices(user)}>
                        <BarChart3 className="h-4 w-4 mr-2" />
                        Vedi Pratiche
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => onDisableUser(user)}
                        className="text-orange-600"
                      >
                        <Ban className="h-4 w-4 mr-2" />
                        Disattiva Utente
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onDeleteUser(user)}
                        className="text-red-600"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Elimina Utente
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};
