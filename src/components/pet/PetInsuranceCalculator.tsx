import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { 
  Shield, 
  Heart, 
  Users, 
  Scale, 
  Check,
  Info
} from "lucide-react";
import {
  petCoverages,
  getCoverageById,
  getCoveragesByCategory,
  calculateTotalPrice,
  type PetCoverage,
} from "@/data/petInsuranceData";
import { formatCurrency, useLanguage, useMessages } from "@/i18n";
import { petMessages } from "@/i18n/messages/pet";
import { petCoverageDescription, petCoverageName, translatePetText } from "@/i18n/petText";

interface PetInsuranceCalculatorProps {
  onQuoteGenerated?: (quote: {
    animalType: string;
    selectedCoverages: string[];
    totalAnnual: number;
    totalMonthly: number;
    coverageDetails: PetCoverage[];
  }) => void;
}

export const PetInsuranceCalculator = ({ onQuoteGenerated }: PetInsuranceCalculatorProps) => {
  const m = useMessages(petMessages);
  const language = useLanguage();
  const assistenza = getCoverageById("ass_standard");
  const tutelaLegale = getCoverageById("tl_standard");

  // Step 1: Animal Type
  const [animalType, setAnimalType] = useState<string>("");
  
  // Step 2: Coverage Selection
  const [selectedAssistenza, setSelectedAssistenza] = useState<string>("ass_standard");
  const [selectedRSV, setSelectedRSV] = useState<string>("");
  const [selectedRCT, setSelectedRCT] = useState<string>("");
  const [includeTL, setIncludeTL] = useState<boolean>(false);
  
  // Calculated values
  const [totalAnnual, setTotalAnnual] = useState<number>(0);
  const [totalMonthly, setTotalMonthly] = useState<number>(0);

  // Get coverages by category
  const rsvCoverages = getCoveragesByCategory('rsv');
  const rctCoverages = getCoveragesByCategory('rct');

  // Check if at least one coverage is selected (RSV or RCT)
  const hasAnyCoverage = selectedRSV || selectedRCT;

  // Calculate total when selections change
  useEffect(() => {
    const selectedIds = [
      selectedAssistenza,
      selectedRSV,
      selectedRCT,
      ...(includeTL ? ['tl_standard'] : []),
    ].filter(Boolean);

    const annual = calculateTotalPrice(selectedIds);
    const monthly = annual / 12;

    setTotalAnnual(annual);
    setTotalMonthly(monthly);

    // Notify parent component - ora basta che ci sia almeno RSV OPPURE RCT
    if (onQuoteGenerated && animalType && hasAnyCoverage) {
      const coverageDetails = selectedIds
        .map(id => getCoverageById(id))
        .filter(Boolean) as PetCoverage[];

      onQuoteGenerated({
        animalType,
        selectedCoverages: selectedIds,
        totalAnnual: annual,
        totalMonthly: monthly,
        coverageDetails,
      });
    }
  }, [selectedAssistenza, selectedRSV, selectedRCT, includeTL, animalType, onQuoteGenerated, hasAnyCoverage]);

  return (
    <Card className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-6 w-6" />
        <div>
          <h3 className="text-xl font-bold">{m.title}</h3>
          <p className="text-sm text-muted-foreground">
            {m.subtitle}
          </p>
        </div>
      </div>

      <Separator />

      {/* Step 1: Animal Type */}
      <div className="space-y-4">
        <Label className="text-base font-semibold">{m.animalStep}</Label>
        
        <RadioGroup value={animalType} onValueChange={setAnimalType}>
          <div className="grid md:grid-cols-3 gap-3">
            <label className={`flex items-center space-x-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
              animalType === 'gatti' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
            }`}>
              <RadioGroupItem value="gatti" id="gatti" />
              <div className="font-medium">🐱 {m.cats}</div>
            </label>

            <label className={`flex items-center space-x-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
              animalType === 'cani_0_20kg' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
            }`}>
              <RadioGroupItem value="cani_0_20kg" id="cani_0_20kg" />
              <div className="font-medium">🐕 {m.smallDogs}</div>
            </label>

            <label className={`flex items-center space-x-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
              animalType === 'cani_oltre_20kg' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
            }`}>
              <RadioGroupItem value="cani_oltre_20kg" id="cani_oltre_20kg" />
              <div className="font-medium">🐕 {m.largeDogs}</div>
            </label>
          </div>
        </RadioGroup>
      </div>

      {animalType && (
        <>
          <Separator />

          {/* Step 2: Coverage Selection */}
          <div className="space-y-6">
            <Label className="text-base font-semibold">{m.coverageStep}</Label>

            {/* Assistenza (Always included) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-green-600" />
                  <Label className="font-medium">{petCoverageName(assistenza, language)}</Label>
                </div>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">{m.alwaysIncluded}</span>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-800">
                  {petCoverageDescription(assistenza, language)}
                </p>
              </div>
            </div>

            {/* RSV - Rimborso Spese Veterinarie (Opzionale) */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Heart className="h-4 w-4 text-red-500" />
                <Label className="font-medium">{translatePetText("Rimborso Spese Veterinarie", language)}</Label>
                <span className="text-xs text-muted-foreground">{m.optional}</span>
              </div>
              <RadioGroup value={selectedRSV} onValueChange={setSelectedRSV}>
                <div className="space-y-2">
                  {/* Opzione per non selezionare RSV */}
                  <label
                    className={`flex items-start justify-between p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      selectedRSV === ''
                        ? 'border-muted bg-muted/20'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-start space-x-3 flex-1">
                      <RadioGroupItem value="" id="rsv_none" className="mt-1" />
                      <div className="flex-1">
                        <div className="font-medium text-muted-foreground">{m.noRsv}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {m.noRsvText}
                        </div>
                      </div>
                    </div>
                  </label>
                  {rsvCoverages.map((coverage) => (
                    <label
                      key={coverage.id}
                      className={`flex items-start justify-between p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        selectedRSV === coverage.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="flex items-start space-x-3 flex-1">
                        <RadioGroupItem value={coverage.id} id={coverage.id} className="mt-1" />
                        <div className="flex-1">
                          <div className="font-medium">{petCoverageName(coverage, language)}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {petCoverageDescription(coverage, language)}
                          </div>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </RadioGroup>
            </div>

            {/* RCT - Responsabilità Civile (Opzionale) */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-500" />
                <Label className="font-medium">{translatePetText("Responsabilità Civile verso Terzi", language)}</Label>
                <span className="text-xs text-muted-foreground">{m.optional}</span>
              </div>
              <RadioGroup value={selectedRCT} onValueChange={setSelectedRCT}>
                <div className="space-y-2">
                  {/* Opzione per non selezionare RCT */}
                  <label
                    className={`flex items-start justify-between p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      selectedRCT === ''
                        ? 'border-muted bg-muted/20'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-start space-x-3 flex-1">
                      <RadioGroupItem value="" id="rct_none" className="mt-1" />
                      <div className="flex-1">
                        <div className="font-medium text-muted-foreground">{m.noRct}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {m.noRctText}
                        </div>
                      </div>
                    </div>
                  </label>
                  {rctCoverages.map((coverage) => (
                    <label
                      key={coverage.id}
                      className={`flex items-start justify-between p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        selectedRCT === coverage.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="flex items-start space-x-3 flex-1">
                        <RadioGroupItem value={coverage.id} id={coverage.id} className="mt-1" />
                        <div className="flex-1">
                          <div className="font-medium">{petCoverageName(coverage, language)}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {petCoverageDescription(coverage, language)}
                          </div>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </RadioGroup>
            </div>

            {/* TL - Tutela Legale (Optional) */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Scale className="h-4 w-4 text-purple-500" />
                <Label className="font-medium">{translatePetText("Tutela Legale", language)}</Label>
                <span className="text-xs text-muted-foreground">{m.optional}</span>
              </div>
              <label
                className={`flex items-start justify-between p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  includeTL
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="flex items-start space-x-3 flex-1">
                  <Checkbox
                    id="tl_standard"
                    checked={includeTL}
                    onCheckedChange={(checked) => setIncludeTL(checked as boolean)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="font-medium">{petCoverageName(tutelaLegale, language)}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {petCoverageDescription(tutelaLegale, language)}
                    </div>
                  </div>
                </div>
              </label>
            </div>
          </div>

          <Separator />

          {/* Summary - Mostra sempre, anche con solo Assistenza */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">{m.summaryStep}</Label>

            <div className={`border-2 rounded-lg p-6 space-y-4 ${
              hasAnyCoverage 
                ? 'bg-primary/5 border-primary' 
                : 'bg-amber-50 border-amber-300'
            }`}>
              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground">{m.selected}</div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-600" />
                    <span>{m.included(petCoverageName(assistenza, language))}</span>
                  </div>
                  
                  {selectedRSV && (
                    <div className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary" />
                      <span>{petCoverageName(getCoverageById(selectedRSV), language)}</span>
                    </div>
                  )}
                  
                  {selectedRCT && (
                    <div className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary" />
                      <span>{petCoverageName(getCoverageById(selectedRCT), language)}</span>
                    </div>
                  )}
                  
                  {includeTL && (
                    <div className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary" />
                      <span>{petCoverageName(tutelaLegale, language)}</span>
                    </div>
                  )}

                  {!hasAnyCoverage && !includeTL && (
                    <div className="flex items-center gap-2 text-sm text-amber-700">
                      <Info className="h-4 w-4" />
                      <span>{m.selectOne}</span>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold">{m.annual}</span>
                  <span className="text-3xl font-bold">
                    {formatCurrency(totalAnnual)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>{m.monthly}</span>
                  <span className="text-lg font-semibold">
                    {formatCurrency(totalMonthly)}{m.perMonth}
                  </span>
                </div>
              </div>

              {hasAnyCoverage && (
                <div className="bg-background border rounded-lg p-3">
                  <div className="flex items-start gap-2 text-sm">
                    <Info className="h-4 w-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                    <div className="text-muted-foreground">
                      <strong>{m.multiPetTitle}</strong> {m.multiPetText}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </Card>
  );
};
// Deploy trigger Sun Jan 25 10:12:05 EST 2026
