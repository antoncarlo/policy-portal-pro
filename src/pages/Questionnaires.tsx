import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requiredDocumentsConfig } from "@/config/requiredDocuments";
import { Download, FileText } from "lucide-react";

const practiceTypeLabels: Record<string, string> = {
  car: "CAR",
  casa: "Casa / Condomini",
  fidejussioni: "Fidejussioni",
  responsabilita_civile: "Responsabilità Civile",
  pet: "Pet",
  fotovoltaico: "Fotovoltaico",
  catastrofali: "Rischi Catastrofali",
  azienda: "Azienda",
  postuma_decennale: "Postuma Decennale",
  all_risk: "All Risk",
  risparmio: "Risparmio",
  salute: "Salute",
};

const questionnaireGroups = requiredDocumentsConfig
  .map((config) => ({
    practiceType: config.practiceType,
    practiceTypeLabel: practiceTypeLabels[config.practiceType] ?? config.practiceType,
    questionnaires: config.requiredDocuments.filter((doc) => doc.isQuestionnaire && doc.questionnaireFile),
  }))
  .filter((group) => group.questionnaires.length > 0);

const uniqueQuestionnaires = Array.from(
  new Map(
    questionnaireGroups
      .flatMap((group) =>
        group.questionnaires.map((doc) => [
          doc.questionnaireFile,
          {
            ...doc,
            practiceTypes: questionnaireGroups
              .filter((candidate) => candidate.questionnaires.some((q) => q.questionnaireFile === doc.questionnaireFile))
              .map((candidate) => candidate.practiceTypeLabel),
          },
        ])
      )
  ).values()
);

const Questionnaires = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Questionari</h1>
          <p className="text-muted-foreground mt-2">
            Libreria dei questionari da scaricare, far compilare e firmare al cliente, quindi ricaricare nella pratica tra i documenti obbligatori.
          </p>
        </div>

        <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-900 dark:text-blue-100">
              <FileText className="h-5 w-5" />
              Procedura corretta
            </CardTitle>
            <CardDescription className="text-blue-800 dark:text-blue-200">
              Per le pratiche che prevedono questionari, il portale mostra il download direttamente nel form di caricamento e blocca il salvataggio finché il questionario compilato e firmato non viene allegato.
            </CardDescription>
          </CardHeader>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {uniqueQuestionnaires.map((questionnaire) => (
            <Card key={questionnaire.questionnaireFile} className="flex flex-col">
              <CardHeader className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-primary/10 p-2 text-primary">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <CardTitle className="text-base leading-tight">{questionnaire.label}</CardTitle>
                    <CardDescription>{questionnaire.description}</CardDescription>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {questionnaire.practiceTypes.map((practiceType) => (
                    <Badge key={practiceType} variant="secondary">
                      {practiceType}
                    </Badge>
                  ))}
                </div>
              </CardHeader>
              <CardContent className="mt-auto">
                <Button asChild className="w-full">
                  <a href={questionnaire.questionnaireFile} target="_blank" rel="noreferrer">
                    <Download className="mr-2 h-4 w-4" />
                    Scarica PDF
                  </a>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Questionnaires;
