import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";
import { useMessages } from "@/i18n";
import { usersMessages } from "@/i18n/messages/users";

interface UserFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  roleFilter: string;
  onRoleFilterChange: (value: string) => void;
  viewMode: "table" | "org";
  onViewModeChange: (value: "table" | "org") => void;
}

export const UserFilters = ({
  searchQuery,
  onSearchChange,
  roleFilter,
  onRoleFilterChange,
  viewMode,
  onViewModeChange,
}: UserFiltersProps) => {
  const m = useMessages(usersMessages).filters;
  return (
    <div className="flex flex-col md:flex-row gap-4 mb-6">
      <div className="flex-1 relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder={m.search}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>
      
      <Select value={roleFilter} onValueChange={onRoleFilterChange}>
        <SelectTrigger className="w-full md:w-[180px]">
          <SelectValue placeholder={m.allRoles} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{m.allRoles}</SelectItem>
          <SelectItem value="admin">{m.admins}</SelectItem>
          <SelectItem value="agente">{m.agents}</SelectItem>
          <SelectItem value="collaboratore">{m.collaborators}</SelectItem>
        </SelectContent>
      </Select>

      <Select value={viewMode} onValueChange={(value) => onViewModeChange(value as "table" | "org")}>
        <SelectTrigger className="w-full md:w-[180px]">
          <SelectValue placeholder={m.view} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="table">{m.table}</SelectItem>
          <SelectItem value="org">{m.org}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};
