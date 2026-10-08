import { getMessages, useMessages } from "@/i18n";
import { commonMessages } from "@/i18n/messages/common";
import { usersMessages } from "@/i18n/messages/users";
import { useCallback, useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Search, Users, Briefcase } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

interface AssignAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    id: string;
    full_name: string;
    email: string;
    agent_name: string | null;
  } | null;
  onSuccess: () => void;
}

interface Agent {
  user_id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  collaborator_count: number;
}

export const AssignAgentDialog = ({
  open,
  onOpenChange,
  user,
  onSuccess,
}: AssignAgentDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const m = useMessages(usersMessages).assignAgent;
  const common = useMessages(commonMessages);

  const loadAgents = useCallback(async () => {
    try {
      const { data, error } = await supabase.from("user_roles").select("user_id").eq("role", "agente");
      if (error) throw error;

      // user_roles points at auth.users, not at profiles: the names are read separately.
      const agentIds = (data || []).map((agent) => agent.user_id);
      const { data: profilesData, error: profilesError } = agentIds.length
        ? await supabase.from("profiles").select("id, full_name, email, avatar_url").in("id", agentIds)
        : { data: [], error: null };
      if (profilesError) throw profilesError;
      const profileById = new Map((profilesData || []).map((profile) => [profile.id, profile]));

      // Count collaborators for each agent
      const agentsWithCounts = await Promise.all(
        (data || []).map(async (agent) => {
          const profile = profileById.get(agent.user_id);
          const { count } = await supabase
            .from("user_roles")
            .select("*", { count: "exact", head: true })
            .eq("parent_agent_id", agent.user_id);

          return {
            user_id: agent.user_id,
            full_name: profile?.full_name || "N/A",
            email: profile?.email || "N/A",
            avatar_url: profile?.avatar_url || null,
            collaborator_count: count || 0,
          };
        })
      );

      setAgents(agentsWithCounts);
    } catch (error) {
      toast({
        variant: "destructive",
        title: getMessages(commonMessages).error,
        description: getMessages(usersMessages).assignAgent.loadError,
      });
    }
  }, [toast]);

  useEffect(() => {
    if (open) {
      loadAgents();
    }
  }, [loadAgents, open]);

  const handleSave = async () => {
    if (!user || !selectedAgentId) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("user_roles")
        .update({ parent_agent_id: selectedAgentId })
        .eq("user_id", user.id);

      if (error) throw error;

      toast({
        title: getMessages(commonMessages).success,
        description: getMessages(usersMessages).assignAgent.assigned,
      });

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast({
        variant: "destructive",
        title: getMessages(commonMessages).error,
        description: error instanceof Error ? error.message : getMessages(usersMessages).assignAgent.assignError,
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredAgents = agents.filter(
    (agent) =>
      agent.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{m.title}</DialogTitle>
          <DialogDescription>
            {m.collaborator(user.full_name, user.email)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {user.agent_name && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-800">
                <strong>{m.current}</strong> {user.agent_name}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>{m.search}</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder={m.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{m.select}</Label>
            <div className="border rounded-lg max-h-[300px] overflow-y-auto">
              {filteredAgents.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Briefcase className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                  <p>{m.empty}</p>
                </div>
              ) : (
                <RadioGroup value={selectedAgentId || ""} onValueChange={setSelectedAgentId}>
                  {filteredAgents.map((agent) => (
                    <div
                      key={agent.user_id}
                      className={`flex items-center space-x-3 p-4 border-b last:border-b-0 cursor-pointer hover:bg-gray-50 ${
                        selectedAgentId === agent.user_id ? "bg-primary/5" : ""
                      }`}
                      onClick={() => setSelectedAgentId(agent.user_id)}
                    >
                      <RadioGroupItem value={agent.user_id} id={agent.user_id} />
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={agent.avatar_url || undefined} />
                        <AvatarFallback>{getInitials(agent.full_name)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="font-medium">{agent.full_name}</div>
                        <div className="text-sm text-gray-500">{agent.email}</div>
                      </div>
                      <Badge variant="outline" className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {agent.collaborator_count}
                      </Badge>
                    </div>
                  ))}
                </RadioGroup>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {common.cancel}
          </Button>
          <Button onClick={handleSave} disabled={loading || !selectedAgentId}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {m.submit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
