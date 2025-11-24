import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";

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
  return (
    <div className="flex flex-col md:flex-row gap-4 mb-6">
      <div className="flex-1 relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Cerca per nome, email, telefono..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>
      
      <Select value={roleFilter} onValueChange={onRoleFilterChange}>
        <SelectTrigger className="w-full md:w-[180px]">
          <SelectValue placeholder="Tutti i Ruoli" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tutti i Ruoli</SelectItem>
          <SelectItem value="admin">Admin</SelectItem>
          <SelectItem value="agente">Agenti</SelectItem>
          <SelectItem value="collaboratore">Collaboratori</SelectItem>
        </SelectContent>
      </Select>

      <Select value={viewMode} onValueChange={(value: any) => onViewModeChange(value)}>
        <SelectTrigger className="w-full md:w-[180px]">
          <SelectValue placeholder="Vista" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="table">📋 Tabella</SelectItem>
          <SelectItem value="org">🌳 Organigramma</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};
