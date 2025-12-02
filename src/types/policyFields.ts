// Tipi per i campi dinamici delle polizze

export type FieldType = 
  | 'text' 
  | 'number' 
  | 'date' 
  | 'select' 
  | 'textarea' 
  | 'checkbox'
  | 'email'
  | 'tel';

export interface FieldOption {
  value: string;
  label: string;
}

export interface PolicyField {
  name: string;
  label: string;
  type: FieldType;
  required: boolean;
  placeholder?: string;
  options?: FieldOption[];
  description?: string;
  defaultValue?: string | number | boolean;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    minLength?: number;
    maxLength?: number;
  };
}

export interface PolicyFieldsConfig {
  [policyType: string]: PolicyField[];
}

// Configurazione campi per ogni tipologia di polizza
export const policyFieldsConfig: PolicyFieldsConfig = {
  // POLIZZA CAR (Contractors All Risk - Cantieri)
  "Car": [
    {
      name: "company_name",
      label: "Ragione Sociale",
      type: "text",
      required: true
    },
    {
      name: "vat_number",
      label: "Partita IVA",
      type: "text",
      required: true,
      validation: { pattern: "^[0-9]{11}$" }
    },
    {
      name: "construction_site_address",
      label: "Indirizzo Cantiere",
      type: "text",
      required: true
    },
    {
      name: "client_name",
      label: "Committente",
      type: "text",
      required: true
    },
    {
      name: "works_amount",
      label: "Importo Lavori (€)",
      type: "number",
      required: true,
      validation: { min: 10000, max: 1000000000 }
    },
    {
      name: "work_type",
      label: "Tipo Opera",
      type: "select",
      required: true,
      options: [
        { value: "nuova_costruzione", label: "Nuova Costruzione" },
        { value: "ristrutturazione", label: "Ristrutturazione" },
        { value: "ampliamento", label: "Ampliamento" },
        { value: "infrastruttura", label: "Infrastruttura" },
        { value: "impianti", label: "Impianti" }
      ]
    },
    {
      name: "works_start_date",
      label: "Data Inizio Lavori",
      type: "date",
      required: true
    },
    {
      name: "works_end_date",
      label: "Data Fine Lavori Prevista",
      type: "date",
      required: true
    },
    {
      name: "maintenance_period_months",
      label: "Periodo Manutenzione (mesi)",
      type: "number",
      required: true,
      validation: { min: 0, max: 24 },
      defaultValue: 12,
      description: "Periodo di manutenzione dopo il completamento"
    },
    {
      name: "insured_value",
      label: "Valore Assicurato (€)",
      type: "number",
      required: true,
      validation: { min: 10000, max: 1000000000 },
      description: "Valore totale dell'opera da assicurare"
    },
    {
      name: "project_manager",
      label: "Direttore Lavori",
      type: "text",
      required: true
    },
    {
      name: "designer",
      label: "Progettista",
      type: "text",
      required: false
    },
    {
      name: "subcontractors",
      label: "Subappaltatori Principali",
      type: "textarea",
      required: false,
      placeholder: "Elenco dei principali subappaltatori coinvolti"
    }
  ],

  // POLIZZA CASA
  "Casa": [
    {
      name: "property_type",
      label: "Tipologia Immobile",
      type: "select",
      required: true,
      options: [
        { value: "appartamento", label: "Appartamento" },
        { value: "villa", label: "Villa" },
        { value: "bifamiliare", label: "Bifamiliare" },
        { value: "terratetto", label: "Terratetto" }
      ]
    },
    {
      name: "property_ownership",
      label: "Proprietà/Affitto",
      type: "select",
      required: true,
      options: [
        { value: "proprieta", label: "Proprietà" },
        { value: "affitto", label: "Affitto" }
      ]
    },
    {
      name: "property_sqm",
      label: "Superficie (mq)",
      type: "number",
      required: true,
      validation: { min: 10, max: 10000 }
    },
    {
      name: "property_floor",
      label: "Piano",
      type: "select",
      required: true,
      options: [
        { value: "terra", label: "Piano Terra" },
        { value: "rialzato", label: "Piano Rialzato" },
        { value: "1", label: "1° Piano" },
        { value: "2", label: "2° Piano" },
        { value: "3", label: "3° Piano" },
        { value: "4", label: "4° Piano" },
        { value: "5+", label: "5° Piano o superiore" },
        { value: "attico", label: "Attico" }
      ]
    },
    {
      name: "property_rooms",
      label: "Numero Vani",
      type: "number",
      required: true,
      validation: { min: 1, max: 50 }
    },
    {
      name: "construction_year",
      label: "Anno di Costruzione",
      type: "number",
      required: true,
      validation: { min: 1800, max: new Date().getFullYear() }
    },
    {
      name: "property_alarm",
      label: "Presenza Allarme",
      type: "checkbox",
      required: false,
      defaultValue: false
    },
    {
      name: "property_bars",
      label: "Presenza Inferriate",
      type: "checkbox",
      required: false,
      defaultValue: false
    },
    {
      name: "property_armored_door",
      label: "Presenza Porta Blindata",
      type: "checkbox",
      required: false,
      defaultValue: false
    },
    {
      name: "building_value",
      label: "Valore Immobile (€)",
      type: "number",
      required: true,
      validation: { min: 10000, max: 10000000 }
    },
    {
      name: "contents_value",
      label: "Valore Contenuto (€)",
      type: "number",
      required: true,
      validation: { min: 5000, max: 5000000 }
    },
    {
      name: "adults_count",
      label: "Numero Maggiorenni Conviventi",
      type: "number",
      required: true,
      validation: { min: 1, max: 20 }
    },
    {
      name: "minors_count",
      label: "Numero Minorenni Conviventi",
      type: "number",
      required: false,
      validation: { min: 0, max: 20 },
      defaultValue: 0
    },
    {
      name: "claims_last_3_years",
      label: "Sinistri Domestici Ultimi 3 Anni",
      type: "number",
      required: true,
      validation: { min: 0, max: 50 },
      defaultValue: 0
    }
  ],

  // FIDEJUSSIONI
  "Fidejussioni": [
    {
      name: "company_name",
      label: "Ragione Sociale / Nome Cognome",
      type: "text",
      required: true
    },
    {
      name: "vat_number",
      label: "Partita IVA",
      type: "text",
      required: true,
      placeholder: "11 cifre",
      validation: { pattern: "^[0-9]{11}$" }
    },
    {
      name: "pec_email",
      label: "PEC",
      type: "email",
      required: true,
      placeholder: "esempio@pec.it"
    },
    {
      name: "legal_representative",
      label: "Rappresentante Legale",
      type: "text",
      required: true
    },
    {
      name: "guarantee_amount",
      label: "Importo Garantito (€)",
      type: "number",
      required: true,
      validation: { min: 1000, max: 100000000 }
    },
    {
      name: "guarantee_type",
      label: "Tipo Fidejussione",
      type: "select",
      required: true,
      options: [
        { value: "definitiva", label: "Definitiva" },
        { value: "provvisoria", label: "Provvisoria" },
        { value: "anticipazione", label: "Anticipazione" },
        { value: "buona_esecuzione", label: "Buona Esecuzione" }
      ]
    },
    {
      name: "sector",
      label: "Settore",
      type: "select",
      required: true,
      options: [
        { value: "appalti_pubblici", label: "Appalti Pubblici" },
        { value: "appalti_privati", label: "Appalti Privati" },
        { value: "forniture", label: "Forniture" },
        { value: "servizi", label: "Servizi" },
        { value: "altro", label: "Altro" }
      ]
    },
    {
      name: "contracting_authority",
      label: "Ente Appaltante",
      type: "text",
      required: true
    },
    {
      name: "cig_code",
      label: "CIG (Codice Identificativo Gara)",
      type: "text",
      required: false,
      placeholder: "10 caratteri alfanumerici"
    },
    {
      name: "guarantee_object",
      label: "Oggetto della Garanzia",
      type: "textarea",
      required: true,
      placeholder: "Descrivi l'oggetto della fidejussione"
    }
  ],

  // RC PROFESSIONALE
  "RC": [
    {
      name: "professional_type",
      label: "Professione",
      type: "select",
      required: true,
      options: [
        { value: "medico", label: "Medico" },
        { value: "ingegnere", label: "Ingegnere" },
        { value: "architetto", label: "Architetto" },
        { value: "avvocato", label: "Avvocato" },
        { value: "commercialista", label: "Commercialista" },
        { value: "geometra", label: "Geometra" },
        { value: "notaio", label: "Notaio" },
        { value: "consulente", label: "Consulente" },
        { value: "altro", label: "Altro" }
      ]
    },
    {
      name: "professional_order",
      label: "Ordine Professionale",
      type: "text",
      required: true,
      placeholder: "Es: Ordine degli Ingegneri di Roma"
    },
    {
      name: "registration_number",
      label: "Numero Iscrizione Albo",
      type: "text",
      required: true
    },
    {
      name: "registration_date",
      label: "Data Iscrizione Albo",
      type: "date",
      required: true
    },
    {
      name: "annual_turnover",
      label: "Fatturato Annuo (€)",
      type: "number",
      required: true,
      validation: { min: 0, max: 100000000 }
    },
    {
      name: "coverage_limit_per_claim",
      label: "Massimale per Sinistro (€)",
      type: "select",
      required: true,
      options: [
        { value: "500000", label: "€ 500.000" },
        { value: "1000000", label: "€ 1.000.000" },
        { value: "2000000", label: "€ 2.000.000" },
        { value: "3000000", label: "€ 3.000.000" },
        { value: "5000000", label: "€ 5.000.000" }
      ]
    },
    {
      name: "retroactivity",
      label: "Retroattività",
      type: "select",
      required: true,
      options: [
        { value: "illimitata", label: "Illimitata" },
        { value: "10_anni", label: "10 anni" },
        { value: "5_anni", label: "5 anni" },
        { value: "3_anni", label: "3 anni" },
        { value: "1_anno", label: "1 anno" }
      ]
    },
    {
      name: "postuma",
      label: "Postuma",
      type: "select",
      required: true,
      options: [
        { value: "illimitata", label: "Illimitata" },
        { value: "10_anni", label: "10 anni" },
        { value: "5_anni", label: "5 anni" },
        { value: "3_anni", label: "3 anni" }
      ]
    },
    {
      name: "claims_history",
      label: "Sinistri Ultimi 5 Anni",
      type: "number",
      required: true,
      validation: { min: 0, max: 50 },
      defaultValue: 0
    }
  ],

  // PET
  "Pet": [
    {
      name: "pet_name",
      label: "Nome Animale",
      type: "text",
      required: true
    },
    {
      name: "pet_species",
      label: "Specie",
      type: "select",
      required: true,
      options: [
        { value: "cane", label: "Cane" },
        { value: "gatto", label: "Gatto" }
      ]
    },
    {
      name: "pet_breed",
      label: "Razza",
      type: "text",
      required: true,
      placeholder: "Es: Labrador, Pastore Tedesco"
    },
    {
      name: "pet_birth_date",
      label: "Data di Nascita",
      type: "date",
      required: true
    },
    {
      name: "pet_gender",
      label: "Sesso",
      type: "select",
      required: true,
      options: [
        { value: "maschio", label: "Maschio" },
        { value: "femmina", label: "Femmina" }
      ]
    },
    {
      name: "pet_microchip",
      label: "Numero Microchip",
      type: "text",
      required: true,
      placeholder: "15 cifre"
    },
    {
      name: "pet_sterilized",
      label: "Sterilizzato",
      type: "checkbox",
      required: false,
      defaultValue: false
    },
    {
      name: "pet_weight",
      label: "Peso (kg)",
      type: "number",
      required: true,
      validation: { min: 0.5, max: 150 }
    },
    {
      name: "pet_previous_diseases",
      label: "Malattie Pregresse",
      type: "textarea",
      required: false,
      placeholder: "Descrivi eventuali malattie o condizioni mediche pregresse"
    },
    {
      name: "coverage_type",
      label: "Coperture Richieste",
      type: "select",
      required: true,
      options: [
        { value: "rct", label: "Solo RC Terzi (RCT)" },
        { value: "rsv", label: "Solo Spese Veterinarie (RSV)" },
        { value: "rct_rsv", label: "RC Terzi + Spese Veterinarie" },
        { value: "completa", label: "Copertura Completa (RCT + RSV + TL)" }
      ]
    }
  ],

  // FOTOVOLTAICO
  "Fotovoltaico": [
    {
      name: "owner_type",
      label: "Tipo Soggetto",
      type: "select",
      required: true,
      options: [
        { value: "privato", label: "Privato" },
        { value: "azienda", label: "Azienda" }
      ]
    },
    {
      name: "installation_address",
      label: "Indirizzo Installazione",
      type: "text",
      required: true,
      placeholder: "Via, Città, CAP"
    },
    {
      name: "nominal_power",
      label: "Potenza Nominale (kWp)",
      type: "number",
      required: true,
      validation: { min: 1, max: 10000 }
    },
    {
      name: "installation_date",
      label: "Data Installazione",
      type: "date",
      required: true
    },
    {
      name: "panel_brand",
      label: "Marca Pannelli",
      type: "text",
      required: true,
      placeholder: "Es: SunPower, LG, Canadian Solar"
    },
    {
      name: "inverter_brand",
      label: "Marca Inverter",
      type: "text",
      required: true,
      placeholder: "Es: SMA, Fronius, Huawei"
    },
    {
      name: "panel_count",
      label: "Numero Pannelli",
      type: "number",
      required: true,
      validation: { min: 1, max: 10000 }
    },
    {
      name: "installation_type",
      label: "Tipo Installazione",
      type: "select",
      required: true,
      options: [
        { value: "tetto", label: "Tetto" },
        { value: "terra", label: "A Terra" },
        { value: "pensilina", label: "Pensilina" }
      ]
    },
    {
      name: "system_value",
      label: "Valore Impianto (€)",
      type: "number",
      required: true,
      validation: { min: 1000, max: 10000000 }
    },
    {
      name: "has_storage",
      label: "Presenza Sistema di Accumulo",
      type: "checkbox",
      required: false,
      defaultValue: false
    },
    {
      name: "storage_capacity",
      label: "Capacità Accumulo (kWh)",
      type: "number",
      required: false,
      validation: { min: 1, max: 1000 }
    }
  ],

  // CATASTROFALI
  "Catastrofali": [
    {
      name: "company_name",
      label: "Ragione Sociale",
      type: "text",
      required: true
    },
    {
      name: "vat_number",
      label: "Partita IVA",
      type: "text",
      required: true,
      validation: { pattern: "^[0-9]{11}$" }
    },
    {
      name: "business_sector",
      label: "Settore Attività",
      type: "select",
      required: true,
      options: [
        { value: "industria", label: "Industria" },
        { value: "commercio", label: "Commercio" },
        { value: "servizi", label: "Servizi" },
        { value: "artigianato", label: "Artigianato" },
        { value: "altro", label: "Altro" }
      ]
    },
    {
      name: "building_type",
      label: "Tipologia Immobile",
      type: "select",
      required: true,
      options: [
        { value: "capannone", label: "Capannone" },
        { value: "ufficio", label: "Ufficio" },
        { value: "negozio", label: "Negozio" },
        { value: "magazzino", label: "Magazzino" },
        { value: "altro", label: "Altro" }
      ]
    },
    {
      name: "building_sqm",
      label: "Superficie (mq)",
      type: "number",
      required: true,
      validation: { min: 10, max: 100000 }
    },
    {
      name: "building_value",
      label: "Valore Fabbricato (€)",
      type: "number",
      required: true,
      validation: { min: 10000, max: 100000000 }
    },
    {
      name: "contents_value",
      label: "Valore Contenuto (€)",
      type: "number",
      required: true,
      validation: { min: 0, max: 100000000 }
    },
    {
      name: "machinery_value",
      label: "Valore Macchinari (€)",
      type: "number",
      required: false,
      validation: { min: 0, max: 100000000 }
    },
    {
      name: "seismic_zone",
      label: "Zona Sismica",
      type: "select",
      required: true,
      options: [
        { value: "zona1", label: "Zona 1 (Alta pericolosità)" },
        { value: "zona2", label: "Zona 2 (Media pericolosità)" },
        { value: "zona3", label: "Zona 3 (Bassa pericolosità)" },
        { value: "zona4", label: "Zona 4 (Molto bassa pericolosità)" }
      ]
    },
    {
      name: "flood_risk",
      label: "Rischio Alluvionale",
      type: "select",
      required: true,
      options: [
        { value: "alto", label: "Alto" },
        { value: "medio", label: "Medio" },
        { value: "basso", label: "Basso" }
      ]
    }
  ],

  // AZIENDA (Multirischio)
  "Azienda": [
    {
      name: "company_name",
      label: "Ragione Sociale",
      type: "text",
      required: true
    },
    {
      name: "vat_number",
      label: "Partita IVA",
      type: "text",
      required: true,
      validation: { pattern: "^[0-9]{11}$" }
    },
    {
      name: "ateco_code",
      label: "Codice ATECO",
      type: "text",
      required: true,
      placeholder: "Es: 47.19.10"
    },
    {
      name: "business_sector",
      label: "Settore Attività",
      type: "text",
      required: true,
      placeholder: "Descrivi l'attività principale"
    },
    {
      name: "employees_count",
      label: "Numero Dipendenti",
      type: "number",
      required: true,
      validation: { min: 0, max: 10000 }
    },
    {
      name: "annual_turnover",
      label: "Fatturato Annuo (€)",
      type: "number",
      required: true,
      validation: { min: 0, max: 1000000000 }
    },
    {
      name: "property_ownership",
      label: "Immobile",
      type: "select",
      required: true,
      options: [
        { value: "proprieta", label: "Proprietà" },
        { value: "affitto", label: "Affitto" }
      ]
    },
    {
      name: "building_sqm",
      label: "Superficie (mq)",
      type: "number",
      required: true,
      validation: { min: 10, max: 100000 }
    },
    {
      name: "building_value",
      label: "Valore Fabbricato (€)",
      type: "number",
      required: true,
      validation: { min: 10000, max: 100000000 }
    },
    {
      name: "contents_value",
      label: "Valore Contenuto (€)",
      type: "number",
      required: true,
      validation: { min: 0, max: 100000000 }
    },
    {
      name: "machinery_value",
      label: "Valore Macchinari (€)",
      type: "number",
      required: false,
      validation: { min: 0, max: 100000000 }
    },
    {
      name: "goods_value",
      label: "Valore Merci (€)",
      type: "number",
      required: false,
      validation: { min: 0, max: 100000000 }
    }
  ],

  // POLIZZA POSTUMA DECENNALE (Responsabilità Civile Decennale)
  "Postuma Decennale": [ {
      name: "company_name",
      label: "Ragione Sociale",
      type: "text",
      required: true
    },
    {
      name: "vat_number",
      label: "Partita IVA",
      type: "text",
      required: true,
      validation: { pattern: "^[0-9]{11}$" }
    },
    {
      name: "cciaa_registration",
      label: "Iscrizione CCIAA",
      type: "text",
      required: true
    },
    {
      name: "soa_certification",
      label: "Certificazione SOA",
      type: "text",
      required: false,
      placeholder: "Se applicabile"
    },
    {
      name: "construction_site_address",
      label: "Indirizzo Cantiere",
      type: "text",
      required: true
    },
    {
      name: "client_name",
      label: "Committente",
      type: "text",
      required: true
    },
    {
      name: "works_amount",
      label: "Importo Lavori (€)",
      type: "number",
      required: true,
      validation: { min: 10000, max: 1000000000 }
    },
    {
      name: "work_type",
      label: "Tipo Opera",
      type: "select",
      required: true,
      options: [
        { value: "nuova_costruzione", label: "Nuova Costruzione" },
        { value: "ristrutturazione", label: "Ristrutturazione" },
        { value: "ampliamento", label: "Ampliamento" },
        { value: "manutenzione_straordinaria", label: "Manutenzione Straordinaria" }
      ]
    },
    {
      name: "building_use",
      label: "Destinazione d'Uso",
      type: "select",
      required: true,
      options: [
        { value: "residenziale", label: "Residenziale" },
        { value: "commerciale", label: "Commerciale" },
        { value: "industriale", label: "Industriale" },
        { value: "pubblico", label: "Pubblico" }
      ]
    },
    {
      name: "works_start_date",
      label: "Data Inizio Lavori",
      type: "date",
      required: true
    },
    {
      name: "works_end_date",
      label: "Data Fine Lavori Prevista",
      type: "date",
      required: true
    },
    {
      name: "project_manager",
      label: "Direttore Lavori",
      type: "text",
      required: true
    },
    {
      name: "designer",
      label: "Progettista",
      type: "text",
      required: true
    }
  ],

  // ALL RISK
  "All Risk": [
    {
      name: "risk_type",
      label: "Tipo All Risk",
      type: "select",
      required: true,
      options: [
        { value: "cantiere", label: "Cantiere (CAR)" },
        { value: "elettronica", label: "Elettronica" },
        { value: "gioielli", label: "Gioielli/Opere d'Arte" },
        { value: "macchinari", label: "Macchinari" }
      ]
    },
    {
      name: "insured_value",
      label: "Valore Assicurato (€)",
      type: "number",
      required: true,
      validation: { min: 1000, max: 100000000 }
    },
    {
      name: "item_description",
      label: "Descrizione Bene/Attività",
      type: "textarea",
      required: true,
      placeholder: "Descrivi dettagliatamente il bene o l'attività da assicurare"
    },
    {
      name: "location",
      label: "Luogo di Custodia/Ubicazione",
      type: "text",
      required: true
    },
    {
      name: "purchase_year",
      label: "Anno di Acquisto/Costruzione",
      type: "number",
      required: false,
      validation: { min: 1900, max: new Date().getFullYear() }
    }
  ],

  // RISPARMIO / VITA
  "Risparmio": [
    {
      name: "policy_type",
      label: "Tipo Polizza",
      type: "select",
      required: true,
      options: [
        { value: "caso_morte", label: "Caso Morte" },
        { value: "caso_vita", label: "Caso Vita" },
        { value: "mista", label: "Mista" },
        { value: "unit_linked", label: "Unit Linked" }
      ]
    },
    {
      name: "insured_capital",
      label: "Capitale Assicurato (€)",
      type: "number",
      required: true,
      validation: { min: 10000, max: 10000000 }
    },
    {
      name: "policy_duration",
      label: "Durata Polizza (anni)",
      type: "number",
      required: true,
      validation: { min: 5, max: 40 }
    },
    {
      name: "premium_type",
      label: "Tipo Premio",
      type: "select",
      required: true,
      options: [
        { value: "unico", label: "Premio Unico" },
        { value: "ricorrente_annuale", label: "Ricorrente Annuale" },
        { value: "ricorrente_semestrale", label: "Ricorrente Semestrale" },
        { value: "ricorrente_mensile", label: "Ricorrente Mensile" }
      ]
    },
    {
      name: "smoker",
      label: "Fumatore",
      type: "checkbox",
      required: false,
      defaultValue: false
    },
    {
      name: "health_status",
      label: "Stato di Salute",
      type: "textarea",
      required: true,
      placeholder: "Descrivi il tuo stato di salute generale e eventuali patologie"
    },
    {
      name: "beneficiaries",
      label: "Beneficiari",
      type: "textarea",
      required: true,
      placeholder: "Indica i beneficiari della polizza"
    }
  ],

  // SALUTE
  "Salute": [
    {
      name: "coverage_type",
      label: "Tipo Copertura",
      type: "select",
      required: true,
      options: [
        { value: "rimborso", label: "Rimborso Spese" },
        { value: "convenzione", label: "Convenzione Diretta" },
        { value: "mista", label: "Mista" }
      ]
    },
    {
      name: "annual_limit",
      label: "Massimale Annuo (€)",
      type: "select",
      required: true,
      options: [
        { value: "50000", label: "€ 50.000" },
        { value: "100000", label: "€ 100.000" },
        { value: "250000", label: "€ 250.000" },
        { value: "500000", label: "€ 500.000" },
        { value: "illimitato", label: "Illimitato" }
      ]
    },
    {
      name: "height",
      label: "Altezza (cm)",
      type: "number",
      required: true,
      validation: { min: 50, max: 250 }
    },
    {
      name: "weight",
      label: "Peso (kg)",
      type: "number",
      required: true,
      validation: { min: 20, max: 300 }
    },
    {
      name: "smoker",
      label: "Fumatore",
      type: "checkbox",
      required: false,
      defaultValue: false
    },
    {
      name: "previous_conditions",
      label: "Patologie Pregresse",
      type: "textarea",
      required: false,
      placeholder: "Indica eventuali patologie o condizioni mediche pregresse"
    },
    {
      name: "hospitalizations_last_5_years",
      label: "Ricoveri Ultimi 5 Anni",
      type: "number",
      required: true,
      validation: { min: 0, max: 50 },
      defaultValue: 0
    },
    {
      name: "current_therapies",
      label: "Terapie in Corso",
      type: "textarea",
      required: false,
      placeholder: "Indica eventuali terapie farmacologiche in corso"
    }
  ]
};
