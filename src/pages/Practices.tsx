import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { PracticesTable } from "@/components/practices/PracticesTable";
import { PracticesFilters, PracticeFilters } from "@/components/practices/PracticesFilters";
import { PracticeStageTabs } from "@/components/practices/PracticeStageTabs";
import { isPracticeStage, type PracticeStage } from "@/lib/practiceStages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { useMessages } from "@/i18n";
import { practicesMessages } from "@/i18n/messages/practices";

const Practices = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const m = useMessages(practicesMessages);
  const [filters, setFilters] = useState<PracticeFilters>({
    practiceType: searchParams.get("type") || "all",
    status: "all",
    dateFrom: undefined,
    dateTo: undefined,
    userId: "all",
  });

  // The section lives in the address (?stage=…) so the menu, links and back button agree with the page.
  const stageParam = searchParams.get("stage");
  const stage: PracticeStage | "all" = isPracticeStage(stageParam) ? stageParam : "all";
  const handleStageChange = (next: PracticeStage | "all") => {
    const params = new URLSearchParams(searchParams);
    if (next === "all") params.delete("stage");
    else params.set("stage", next);
    setSearchParams(params);
  };

  const handleClearFilters = () => {
    setFilters({
      practiceType: "all",
      status: "all",
      dateFrom: undefined,
      dateTo: undefined,
      userId: "all",
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold text-foreground">{m.title}</h1>
            <p className="text-muted-foreground mt-1">
              {m.subtitle}
            </p>
          </div>
          <Link to="/upload" className="w-full md:w-auto">
            <Button className="h-auto min-h-10 w-full whitespace-normal text-center md:w-auto">{m.newPractice}</Button>
          </Link>
        </div>

        <PracticeStageTabs value={stage} onChange={handleStageChange} />

        <div className="flex flex-col gap-4 md:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={m.search}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <PracticesFilters
            filters={filters}
            onFiltersChange={setFilters}
            onClearFilters={handleClearFilters}
          />
        </div>

        <PracticesTable searchQuery={searchQuery} filters={filters} stage={stage} />
      </div>
    </DashboardLayout>
  );
};

export default Practices;
