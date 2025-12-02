import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Shield, 
  Heart, 
  Users, 
  Scale, 
  Euro, 
  Check,
  Info,
  Calculator
} from "lucide-react";
import {
  petCoverages,
  getCoverageById,
  getCoveragesByCategory,
  calculateTotalPrice,
  type PetCoverage,
} from "@/data/petInsuranceData";

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
  const assistenzaCoverages = getCoveragesByCategory('assistenza');
  const rsvCoverages = getCoveragesByCategory('rsv');
  const rctCoverages = getCoveragesByCategory('rct');
  const tlCoverages = getCoveragesByCategory('tl');

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

    // Notify parent component
    if (onQuoteGenerated && animalType && selectedRSV && selectedRCT) {
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
  }, [selectedAssistenza, selectedRSV, selectedRCT, includeTL, animalType, onQuoteGenerated]);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'assistenza':
        return <Shield className="h-5 w-5" />;
      case 'rsv':
        return <Heart className="h-5 w-5" />;
      case 'rct':
        return <Users className="h-5 w-5" />;
      case 'tl':
        return <Scale className="h-5 w-5" />;
      default:
        return null;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'assistenza':
        return 'text-blue-600 dark:text-blue-400';
      case 'rsv':
        return 'text-red-600 dark:text-red-400';
      case 'rct':
        return 'text-green-600 dark:text-green-400';
      case 'tl':
        return 'text-purple-600 dark:text-purple-400';
      default:
        return '';
    }
  };

  return (
    <Card className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Calculator className="h-6 w-6 text-primary" />
        <div>
          <h3 className="text-xl font-bold">Preventivatore Polizza Pet</h3>
          <p className="text-sm text-muted-foreground">
            Seleziona le coperture desiderate per calcolare il premio
          </p>
        </div>
      </div>

      <Separator />

      {/* Step 1: Animal Type */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold">
            1
          </span>
          <Label className="text-base font-semibold">Tipo di Animale</Label>
        </div>
        
        <RadioGroup value={animalType} onValueChange={setAnimalType}>
          <div className="grid md:grid-cols-3 gap-4">
            <label className={`flex items-center space-x-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
              animalType === 'gatti' ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'
            }`}>
              <RadioGroupItem value="gatti" id="gatti" />
              <div>
                <div className="font-medium">🐱 Gatti</div>
                <div className="text-xs text-muted-foreground">€227 - €434/anno</div>
              </div>
            </label>

            <label className={`flex items-center space-x-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
              animalType === 'cani_0_20kg' ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'
            }`}>
              <RadioGroupItem value="cani_0_20kg" id="cani_0_20kg" />
              <div>
                <div className="font-medium">🐕 Cani 0-20 kg</div>
                <div className="text-xs text-muted-foreground">€227 - €440/anno</div>
              </div>
            </label>

            <label className={`flex items-center space-x-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
              animalType === 'cani_oltre_20kg' ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'
            }`}>
              <RadioGroupItem value="cani_oltre_20kg" id="cani_oltre_20kg" />
              <div>
                <div className="font-medium">🐕 Cani oltre 20 kg</div>
                <div className="text-xs text-muted-foreground">€406 - €446/anno</div>
              </div>
            </label>
          </div>
        </RadioGroup>
      </div>

      {animalType && (
        <>
          <Separator />

          {/* Step 2: Coverage Selection */}
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                2
              </span>
              <Label className="text-base font-semibold">Seleziona Coperture</Label>
            </div>

            {/* Assistenza (Always included) */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-600" />
                <Label className="font-semibold">Assistenza Standard</Label>
                <Badge variant="secondary" className="ml-auto">Inclusa</Badge>
              </div>
              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-medium text-blue-900 dark:text-blue-100">
                      Assistenza animali domestici
                    </div>
                    <div className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                      Prestazioni in natura - Carenza 30 giorni
                    </div>
                  </div>
                  <div className="text-lg font-bold text-blue-600 dark:text-blue-400 ml-4">
                    €14
                  </div>
                </div>
              </div>
            </div>

            {/* RSV - Rimborso Spese Veterinarie */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Heart className="h-5 w-5 text-red-600" />
                <Label className="font-semibold">Rimborso Spese Veterinarie *</Label>
              </div>
              <RadioGroup value={selectedRSV} onValueChange={setSelectedRSV}>
                <div className="space-y-2">
                  {rsvCoverages.map((coverage) => (
                    <label
                      key={coverage.id}
                      className={`flex items-center justify-between p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        selectedRSV === coverage.id
                          ? 'border-red-500 bg-red-50 dark:bg-red-950'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center space-x-3 flex-1">
                        <RadioGroupItem value={coverage.id} id={coverage.id} />
                        <div className="flex-1">
                          <div className="font-medium">{coverage.name}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {coverage.description}
                          </div>
                        </div>
                      </div>
                      <div className="text-lg font-bold text-red-600 dark:text-red-400 ml-4">
                        €{coverage.price}
                      </div>
                    </label>
                  ))}
                </div>
              </RadioGroup>
            </div>

            {/* RCT - Responsabilità Civile */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-green-600" />
                <Label className="font-semibold">Responsabilità Civile verso Terzi *</Label>
              </div>
              <RadioGroup value={selectedRCT} onValueChange={setSelectedRCT}>
                <div className="space-y-2">
                  {rctCoverages.map((coverage) => (
                    <label
                      key={coverage.id}
                      className={`flex items-center justify-between p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        selectedRCT === coverage.id
                          ? 'border-green-500 bg-green-50 dark:bg-green-950'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center space-x-3 flex-1">
                        <RadioGroupItem value={coverage.id} id={coverage.id} />
                        <div className="flex-1">
                          <div className="font-medium">{coverage.name}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {coverage.description}
                          </div>
                        </div>
                      </div>
                      <div className="text-lg font-bold text-green-600 dark:text-green-400 ml-4">
                        €{coverage.price}
                      </div>
                    </label>
                  ))}
                </div>
              </RadioGroup>
            </div>

            {/* TL - Tutela Legale (Optional) */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Scale className="h-5 w-5 text-purple-600" />
                <Label className="font-semibold">Tutela Legale (Opzionale)</Label>
              </div>
              <label
                className={`flex items-center justify-between p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  includeTL
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-950'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center space-x-3 flex-1">
                  <Checkbox
                    id="tl_standard"
                    checked={includeTL}
                    onCheckedChange={(checked) => setIncludeTL(checked as boolean)}
                  />
                  <div className="flex-1">
                    <div className="font-medium">Tutela Legale Standard</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Copertura standard - Assistenza legale
                    </div>
                  </div>
                </div>
                <div className="text-lg font-bold text-purple-600 dark:text-purple-400 ml-4">
                  €32
                </div>
              </label>
            </div>
          </div>

          <Separator />

          {/* Summary */}
          {selectedRSV && selectedRCT && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                  3
                </span>
                <Label className="text-base font-semibold">Riepilogo e Premio</Label>
              </div>

              <div className="bg-gradient-to-br from-primary/10 to-primary/5 border-2 border-primary rounded-lg p-6 space-y-4">
                <div className="space-y-2">
                  <div className="text-sm font-medium text-muted-foreground">Coperture Selezionate:</div>
                  <div className="space-y-2">
                    {/* Assistenza */}
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-600" />
                        <span>Assistenza Standard</span>
                      </div>
                      <span className="font-medium">€14</span>
                    </div>
                    
                    {/* RSV */}
                    {selectedRSV && (
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-600" />
                          <span>{getCoverageById(selectedRSV)?.name}</span>
                        </div>
                        <span className="font-medium">€{getCoverageById(selectedRSV)?.price}</span>
                      </div>
                    )}
                    
                    {/* RCT */}
                    {selectedRCT && (
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-600" />
                          <span>{getCoverageById(selectedRCT)?.name}</span>
                        </div>
                        <span className="font-medium">€{getCoverageById(selectedRCT)?.price}</span>
                      </div>
                    )}
                    
                    {/* TL */}
                    {includeTL && (
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-600" />
                          <span>Tutela Legale Standard</span>
                        </div>
                        <span className="font-medium">€32</span>
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-semibold">Premio Annuale:</span>
                    <span className="text-2xl font-bold text-primary">
                      €{totalAnnual.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Premio Mensile:</span>
                    <span className="text-lg font-semibold">
                      €{totalMonthly.toFixed(2)}/mese
                    </span>
                  </div>
                </div>

                <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                  <div className="flex items-start gap-2 text-sm text-blue-800 dark:text-blue-200">
                    <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <div>
                      <strong>Sconto Multi-Animale:</strong> Se assicuri 2 o 3 animali, riceverai uno sconto del 10% sul 2° e 3° animale!
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
};
