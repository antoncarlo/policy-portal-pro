import { Tree, TreeNode } from "react-organizational-chart";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Shield, Briefcase, UserCheck, Mail, Phone } from "lucide-react";

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

interface OrganizationalChartProps {
  users: User[];
}

interface UserNodeProps {
  user: User;
}

const UserNode = ({ user }: UserNodeProps) => {
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleConfig = (role: string) => {
    const configs = {
      admin: {
        icon: Shield,
        label: "Admin",
        color: "text-red-600",
        bgColor: "bg-red-100",
        borderColor: "border-red-300",
      },
      agente: {
        icon: Briefcase,
        label: "Agente",
        color: "text-blue-600",
        bgColor: "bg-blue-100",
        borderColor: "border-blue-300",
      },
      collaboratore: {
        icon: UserCheck,
        label: "Collaboratore",
        color: "text-green-600",
        bgColor: "bg-green-100",
        borderColor: "border-green-300",
      },
    };
    return configs[role as keyof typeof configs] || configs.collaboratore;
  };

  const roleConfig = getRoleConfig(user.role);
  const Icon = roleConfig.icon;

  return (
    <Card className={`w-64 border-2 ${roleConfig.borderColor} hover:shadow-lg transition-shadow`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Avatar className="h-12 w-12">
            <AvatarImage src={user.avatar_url || undefined} />
            <AvatarFallback className={roleConfig.bgColor}>
              {getInitials(user.full_name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm truncate">{user.full_name}</div>
            <Badge className={`${roleConfig.bgColor} ${roleConfig.color} border-0 text-xs mt-1`}>
              <Icon className="h-3 w-3 mr-1" />
              {roleConfig.label}
            </Badge>
          </div>
        </div>
        <div className="mt-3 space-y-1">
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <Mail className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{user.email}</span>
          </div>
          {user.phone && (
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <Phone className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{user.phone}</span>
            </div>
          )}
          <div className="flex items-center justify-between pt-2 border-t">
            <span className="text-xs text-gray-500">Pratiche</span>
            <Badge variant="outline" className="text-xs">
              {user.practice_count}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export const OrganizationalChart = ({ users }: OrganizationalChartProps) => {
  // Organize users by hierarchy
  const admins = users.filter((u) => u.role === "admin");
  const agents = users.filter((u) => u.role === "agente");
  const collaborators = users.filter((u) => u.role === "collaboratore");

  // Group collaborators by their agent
  const collaboratorsByAgent = collaborators.reduce((acc, collab) => {
    const agentId = agents.find((a) => a.full_name === collab.agent_name)?.id || "unassigned";
    if (!acc[agentId]) acc[agentId] = [];
    acc[agentId].push(collab);
    return acc;
  }, {} as Record<string, User[]>);

  if (users.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <div className="text-center">
          <Shield className="h-12 w-12 mx-auto mb-2 text-gray-400" />
          <p>Nessun utente da visualizzare</p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto pb-8">
      <div className="inline-block min-w-full">
        <Tree
          lineWidth="2px"
          lineColor="#cbd5e1"
          lineBorderRadius="10px"
          label={
            <div className="mb-8">
              <div className="text-center mb-4">
                <h3 className="text-lg font-semibold text-gray-700">Amministratori</h3>
              </div>
              <div className="flex gap-4 justify-center flex-wrap">
                {admins.map((admin) => (
                  <UserNode key={admin.id} user={admin} />
                ))}
              </div>
            </div>
          }
        >
          {agents.length > 0 && (
            <TreeNode
              label={
                <div className="text-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-700">Agenti</h3>
                </div>
              }
            >
              {agents.map((agent) => (
                <TreeNode key={agent.id} label={<UserNode user={agent} />}>
                  {collaboratorsByAgent[agent.id] && collaboratorsByAgent[agent.id].length > 0 && (
                    <TreeNode
                      label={
                        <div className="text-center mb-2">
                          <h4 className="text-sm font-medium text-gray-600">Collaboratori</h4>
                        </div>
                      }
                    >
                      {collaboratorsByAgent[agent.id].map((collab) => (
                        <TreeNode key={collab.id} label={<UserNode user={collab} />} />
                      ))}
                    </TreeNode>
                  )}
                </TreeNode>
              ))}
            </TreeNode>
          )}

          {collaboratorsByAgent["unassigned"] && collaboratorsByAgent["unassigned"].length > 0 && (
            <TreeNode
              label={
                <div className="text-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-700">
                    Collaboratori Non Assegnati
                  </h3>
                </div>
              }
            >
              {collaboratorsByAgent["unassigned"].map((collab) => (
                <TreeNode key={collab.id} label={<UserNode user={collab} />} />
              ))}
            </TreeNode>
          )}
        </Tree>
      </div>
    </div>
  );
};
