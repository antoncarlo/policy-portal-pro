import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Users, FileText, HardDrive, TrendingUp, Activity } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Stats {
  totalUsers: number;
  totalPractices: number;
  totalDocuments: number;
  storageUsed: number;
  usersByRole: { name: string; value: number }[];
  practicesByStatus: { name: string; value: number }[];
  practicesByType: { name: string; value: number }[];
  practicesTrend: { month: string; count: number }[];
}

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"];

export const PortalStatistics = () => {
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalPractices: 0,
    totalDocuments: 0,
    storageUsed: 0,
    usersByRole: [],
    practicesByStatus: [],
    practicesByType: [],
    practicesTrend: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStatistics();
  }, []);

  const loadStatistics = async () => {
    setLoading(true);
    try {
      // Total users
      const { count: usersCount } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

      // Total practices
      const { count: practicesCount } = await supabase
        .from("practices")
        .select("*", { count: "exact", head: true });

      // Total documents
      const { count: documentsCount } = await supabase
        .from("practice_documents")
        .select("*", { count: "exact", head: true });

      // Users by role
      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("role");

      const rolesCounts = rolesData?.reduce((acc: any, curr) => {
        const roleName = curr.role === "admin" ? "Admin" : curr.role === "agente" ? "Agenti" : "Collaboratori";
        acc[roleName] = (acc[roleName] || 0) + 1;
        return acc;
      }, {});

      const usersByRole = Object.entries(rolesCounts || {}).map(([name, value]) => ({
        name,
        value: value as number,
      }));

      // Practices by status
      const { data: practicesData } = await supabase
        .from("practices")
        .select("status");

      const statusCounts = practicesData?.reduce((acc: any, curr) => {
        const statusName =
          curr.status === "in_lavorazione"
            ? "In Lavorazione"
            : curr.status === "in_attesa"
            ? "In Attesa"
            : curr.status === "approvata"
            ? "Approvate"
            : curr.status === "respinta"
            ? "Respinte"
            : "Completate";
        acc[statusName] = (acc[statusName] || 0) + 1;
        return acc;
      }, {});

      const practicesByStatus = Object.entries(statusCounts || {}).map(([name, value]) => ({
        name,
        value: value as number,
      }));

      // Practices by type
      const typeCounts = practicesData?.reduce((acc: any, curr) => {
        const typeName =
          curr.practice_type === "auto"
            ? "Auto"
            : curr.practice_type === "casa"
            ? "Casa"
            : curr.practice_type === "vita"
            ? "Vita"
            : "Salute";
        acc[typeName] = (acc[typeName] || 0) + 1;
        return acc;
      }, {});

      const practicesByType = Object.entries(typeCounts || {}).map(([name, value]) => ({
        name,
        value: value as number,
      }));

      // Practices trend (last 6 months)
      const { data: trendData } = await supabase
        .from("practices")
        .select("created_at")
        .gte("created_at", new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString());

      const monthCounts = trendData?.reduce((acc: any, curr) => {
        const month = new Date(curr.created_at).toLocaleDateString("it-IT", {
          month: "short",
          year: "2-digit",
        });
        acc[month] = (acc[month] || 0) + 1;
        return acc;
      }, {});

      const practicesTrend = Object.entries(monthCounts || {}).map(([month, count]) => ({
        month,
        count: count as number,
      }));

      // Storage (mock for now - would need actual file sizes)
      const storageUsed = (documentsCount || 0) * 0.5; // Assume 0.5 MB per document

      setStats({
        totalUsers: usersCount || 0,
        totalPractices: practicesCount || 0,
        totalDocuments: documentsCount || 0,
        storageUsed,
        usersByRole,
        practicesByStatus,
        practicesByType,
        practicesTrend,
      });
    } catch (error) {
      console.error("Error loading statistics:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Caricamento statistiche...</div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <Activity className="h-5 w-5" />
        <h2 className="text-xl font-semibold">Statistiche Portale</h2>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Panoramica</TabsTrigger>
          <TabsTrigger value="charts">Grafici</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Utenti Totali</p>
                  <p className="text-2xl font-bold">{stats.totalUsers}</p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <FileText className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pratiche Totali</p>
                  <p className="text-2xl font-bold">{stats.totalPractices}</p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <FileText className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Documenti</p>
                  <p className="text-2xl font-bold">{stats.totalDocuments}</p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <HardDrive className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Storage</p>
                  <p className="text-2xl font-bold">{stats.storageUsed.toFixed(1)} MB</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Quick Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-4">Utenti per Ruolo</h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={stats.usersByRole}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {stats.usersByRole.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-4">Pratiche per Stato</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={stats.practicesByStatus}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#0088FE" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="charts" className="space-y-6">
          {/* Practices Trend */}
          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Andamento Pratiche (Ultimi 6 Mesi)
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={stats.practicesTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="count" stroke="#8884d8" name="Pratiche" />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          {/* Practices by Type */}
          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-4">Pratiche per Tipo</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.practicesByType} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" />
                <Tooltip />
                <Bar dataKey="value" fill="#00C49F" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </TabsContent>
      </Tabs>
    </Card>
  );
};
