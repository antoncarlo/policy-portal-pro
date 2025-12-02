// Dati per il preventivatore polizza Pet
// Estratti da: 7b-volantinidifront.end(GB-BS-ASdef.04.10.24)(3).xlsx

export interface PetCoverage {
  id: string;
  name: string;
  description: string;
  price: number;
  maxCoverage?: string;
  category: 'assistenza' | 'rsv' | 'rct' | 'tl';
}

export interface PetOption {
  id: string;
  name: string;
  animalType: 'gatti' | 'cani_0_20kg' | 'cani_oltre_20kg';
  coverages: {
    assistenza: string; // ID copertura
    rsv: string; // ID copertura default
    rct: string; // ID copertura default
    tl?: string; // ID copertura (opzionale)
  };
  totalAnnual: number;
  totalMonthly: number;
}

// Coperture disponibili
export const petCoverages: PetCoverage[] = [
  // ASSISTENZA
  {
    id: 'ass_standard',
    name: 'Assistenza Standard',
    description: 'Assistenza animali domestici - Prestazioni in natura - Carenza 30 giorni',
    price: 14,
    category: 'assistenza',
  },
  
  // RSV - RIMBORSO SPESE VETERINARIE
  {
    id: 'rsv_silver_500',
    name: 'RSV Silver 500€',
    description: 'Rimborso spese veterinarie - Massimale 500€ - Scoperto 10% min €100 - Max 2 sinistri/anno',
    price: 141,
    maxCoverage: '500€',
    category: 'rsv',
  },
  {
    id: 'rsv_silver_750',
    name: 'RSV Silver 750€',
    description: 'Rimborso spese veterinarie - Massimale 750€ - Scoperto 10% min €100 - Max 2 sinistri/anno',
    price: 178,
    maxCoverage: '750€',
    category: 'rsv',
  },
  {
    id: 'rsv_gold_1000',
    name: 'RSV Gold 1.000€',
    description: 'Rimborso spese veterinarie - Massimale 1.000€ - Scoperto 10% min €100 - Max 2 sinistri/anno',
    price: 232,
    maxCoverage: '1.000€',
    category: 'rsv',
  },
  {
    id: 'rsv_gold_2000',
    name: 'RSV Gold 2.000€',
    description: 'Rimborso spese veterinarie - Massimale 2.000€ - Scoperto 10% min €100 - Max 2 sinistri/anno',
    price: 308,
    maxCoverage: '2.000€',
    category: 'rsv',
  },
  {
    id: 'rsv_platinum_2500',
    name: 'RSV Platinum 2.000€ + 500€',
    description: 'Rimborso spese veterinarie - Massimale 2.000€ + 500€ extra - Scoperto 10% min €100 - Max 2 sinistri/anno',
    price: 348,
    maxCoverage: '2.500€',
    category: 'rsv',
  },
  {
    id: 'rsv_platinum_3500',
    name: 'RSV Platinum 3.000€ + 500€',
    description: 'Rimborso spese veterinarie - Massimale 3.000€ + 500€ extra - Scoperto 10% min €100 - Max 2 sinistri/anno',
    price: 463,
    maxCoverage: '3.500€',
    category: 'rsv',
  },
  
  // RCT - RESPONSABILITÀ CIVILE
  {
    id: 'rct_100k',
    name: 'RCT 100K€',
    description: 'Responsabilità Civile verso Terzi - Massimale 100.000€ - Carenza 30 giorni',
    price: 40,
    maxCoverage: '100.000€',
    category: 'rct',
  },
  {
    id: 'rct_250k',
    name: 'RCT 250K€',
    description: 'Responsabilità Civile verso Terzi - Massimale 250.000€ - Carenza 30 giorni',
    price: 46,
    maxCoverage: '250.000€',
    category: 'rct',
  },
  {
    id: 'rct_500k',
    name: 'RCT 500K€',
    description: 'Responsabilità Civile verso Terzi - Massimale 500.000€ - Carenza 30 giorni',
    price: 52,
    maxCoverage: '500.000€',
    category: 'rct',
  },
  
  // TL - TUTELA LEGALE
  {
    id: 'tl_standard',
    name: 'Tutela Legale Standard',
    description: 'Copertura standard - Assistenza legale',
    price: 32,
    category: 'tl',
  },
];

// Opzioni predefinite per categoria animale
export const petOptions: PetOption[] = [
  // GATTI
  {
    id: 'gatti_smart',
    name: 'Smart',
    animalType: 'gatti',
    coverages: {
      assistenza: 'ass_standard',
      rsv: 'rsv_silver_500',
      rct: 'rct_100k',
      tl: 'tl_standard',
    },
    totalAnnual: 227,
    totalMonthly: 18.92,
  },
  {
    id: 'gatti_medium',
    name: 'Medium',
    animalType: 'gatti',
    coverages: {
      assistenza: 'ass_standard',
      rsv: 'rsv_gold_1000',
      rct: 'rct_100k',
      tl: 'tl_standard',
    },
    totalAnnual: 318,
    totalMonthly: 26.50,
  },
  {
    id: 'gatti_premium',
    name: 'Premium',
    animalType: 'gatti',
    coverages: {
      assistenza: 'ass_standard',
      rsv: 'rsv_platinum_2500',
      rct: 'rct_100k',
      tl: 'tl_standard',
    },
    totalAnnual: 434,
    totalMonthly: 36.17,
  },
  
  // CANI 0-20 KG
  {
    id: 'cani_0_20_light',
    name: 'Light',
    animalType: 'cani_0_20kg',
    coverages: {
      assistenza: 'ass_standard',
      rsv: 'rsv_silver_500',
      rct: 'rct_100k',
    },
    totalAnnual: 227,
    totalMonthly: 18.92,
  },
  {
    id: 'cani_0_20_smart',
    name: 'Smart',
    animalType: 'cani_0_20kg',
    coverages: {
      assistenza: 'ass_standard',
      rsv: 'rsv_gold_1000',
      rct: 'rct_100k',
      tl: 'tl_standard',
    },
    totalAnnual: 318,
    totalMonthly: 26.50,
  },
  {
    id: 'cani_0_20_medium',
    name: 'Medium',
    animalType: 'cani_0_20kg',
    coverages: {
      assistenza: 'ass_standard',
      rsv: 'rsv_gold_2000',
      rct: 'rct_100k',
      tl: 'tl_standard',
    },
    totalAnnual: 394,
    totalMonthly: 32.83,
  },
  {
    id: 'cani_0_20_premium',
    name: 'Premium',
    animalType: 'cani_0_20kg',
    coverages: {
      assistenza: 'ass_standard',
      rsv: 'rsv_platinum_2500',
      rct: 'rct_250k',
      tl: 'tl_standard',
    },
    totalAnnual: 440,
    totalMonthly: 36.67,
  },
  
  // CANI OLTRE 20 KG
  {
    id: 'cani_oltre_20_medium',
    name: 'Medium',
    animalType: 'cani_oltre_20kg',
    coverages: {
      assistenza: 'ass_standard',
      rsv: 'rsv_gold_2000',
      rct: 'rct_500k',
      tl: 'tl_standard',
    },
    totalAnnual: 406,
    totalMonthly: 33.83,
  },
  {
    id: 'cani_oltre_20_premium',
    name: 'Premium',
    animalType: 'cani_oltre_20kg',
    coverages: {
      assistenza: 'ass_standard',
      rsv: 'rsv_platinum_2500',
      rct: 'rct_500k',
      tl: 'tl_standard',
    },
    totalAnnual: 446,
    totalMonthly: 37.17,
  },
];

// Helper functions
export const getCoverageById = (id: string): PetCoverage | undefined => {
  return petCoverages.find(c => c.id === id);
};

export const getCoveragesByCategory = (category: string): PetCoverage[] => {
  return petCoverages.filter(c => c.category === category);
};

export const getOptionsByAnimalType = (animalType: string): PetOption[] => {
  return petOptions.filter(o => o.animalType === animalType);
};

export const calculateTotalPrice = (selectedCoverages: string[]): number => {
  return selectedCoverages.reduce((total, coverageId) => {
    const coverage = getCoverageById(coverageId);
    return total + (coverage?.price || 0);
  }, 0);
};
