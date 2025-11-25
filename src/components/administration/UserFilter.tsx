import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface User {
  user_id: string;
  full_name: string;
  role: string;
}

interface UserFilterProps {
  users: User[];
  selectedUserId: string;
  onUserChange: (userId: string) => void;
  currentUserRole: string;
}

export const UserFilter = ({
  users,
  selectedUserId,
  onUserChange,
  currentUserRole,
}: UserFilterProps) => {
  const getRoleBadge = (role: string) => {
    const roleConfig: Record<string, { label: string; className: string }> = {
      admin: { label: "Admin", className: "bg-red-100 text-red-800 border-red-300" },
      agente: { label: "Agente", className: "bg-blue-100 text-blue-800 border-blue-300" },
      collaboratore: { label: "Collab.", className: "bg-green-100 text-green-800 border-green-300" },
    };
    
    const config = roleConfig[role] || { label: role, className: "" };
    return (
      <Badge variant="outline" className={`ml-2 ${config.className}`}>
        {config.label}
      </Badge>
    );
  };

  const getFilterLabel = () => {
    if (currentUserRole === "admin") {
      return "Visualizza Provvigioni Di";
    } else if (currentUserRole === "agente") {
      return "Visualizza Provvigioni Di (Team)";
    }
    return "Utente";
  };

  // Don't show filter if user is collaboratore (can only see own data)
  if (currentUserRole === "collaboratore") {
    return null;
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="userFilter">{getFilterLabel()}</Label>
      <Select value={selectedUserId} onValueChange={onUserChange}>
        <SelectTrigger id="userFilter">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">
            <span className="font-medium">
              {currentUserRole === "admin" ? "Tutti gli Utenti" : "Tutto il Team"}
            </span>
          </SelectItem>
          {users.map((user) => (
            <SelectItem key={user.user_id} value={user.user_id}>
              <div className="flex items-center">
                {user.full_name}
                {getRoleBadge(user.role)}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
