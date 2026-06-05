export interface RequiredDocument {
  id: string;
  label: string;
  description: string;
  isQuestionnaire: boolean;
  questionnaireFile?: string;
}

export interface PracticeTypeDocConfig {
  practiceType: string;
  requiredDocuments: RequiredDocument[];
}

export const requiredDocumentsConfig: PracticeTypeDocConfig[] = [
  {
    practiceType: "car",
    requiredDocuments: [
      {
        id: "visura_camerale",
        label: "Visura Camerale",
        description: "Documento ufficiale camerale dell'impresa",
        isQuestionnaire: false,
      },
      {
        id: "documento_identita",
        label: "Documento d'Identità Legale Rappresentante",
        description: "Carta d'identità o passaporto in corso di validità",
        isQuestionnaire: false,
      },
      {
        id: "preventivo_o_contratto",
        label: "Preventivo o Contratto Lavori",
        description: "Documento che attesta l'importo e la natura dei lavori",
        isQuestionnaire: false,
      },
      {
        id: "questionario_car",
        label: "Questionario CAR Compilato e Firmato",
        description: "Questionario per l'assicurazione tutti i rischi della costruzione di opere civili",
        isQuestionnaire: true,
        questionnaireFile: "/questionari/questionario_car_bc2.pdf",
      },
    ],
  },
  {
    practiceType: "casa",
    requiredDocuments: [
      {
        id: "documento_identita",
        label: "Documento d'Identità",
        description: "Carta d'identità o passaporto",
        isQuestionnaire: false,
      },
      {
        id: "visura_catastale",
        label: "Visura Catastale",
        description: "Visura dell'immobile da assicurare",
        isQuestionnaire: false,
      },
      {
        id: "questionario_globale_fabbricati",
        label: "Questionario Globale Fabbricati/Condomini Compilato e Firmato",
        description: "Questionario per fabbricati e condomini da compilare, firmare e ricaricare",
        isQuestionnaire: true,
        questionnaireFile: "/questionari/questionario_globale_fabbricati_condomini.pdf",
      },
    ],
  },
  {
    practiceType: "fidejussioni",
    requiredDocuments: [
      {
        id: "visura_camerale",
        label: "Visura Camerale",
        description: "Documento ufficiale camerale dell'impresa",
        isQuestionnaire: false,
      },
      {
        id: "documento_identita",
        label: "Documento d'Identità Legale Rappresentante",
        description: "Carta d'identità o passaporto in corso di validità",
        isQuestionnaire: false,
      },
      {
        id: "bilancio_ultimo_anno",
        label: "Bilancio Ultimo Anno",
        description: "Ultimo bilancio approvato dell'azienda",
        isQuestionnaire: false,
      },
      {
        id: "atto_gara",
        label: "Atto di Gara / Bando",
        description: "Documentazione della gara o del contratto da garantire",
        isQuestionnaire: false,
      },
    ],
  },
  {
    practiceType: "responsabilita_civile",
    requiredDocuments: [
      {
        id: "visura_camerale",
        label: "Visura Camerale",
        description: "Documento ufficiale camerale del professionista o impresa",
        isQuestionnaire: false,
      },
      {
        id: "documento_identita",
        label: "Documento d'Identità",
        description: "Carta d'identità o passaporto",
        isQuestionnaire: false,
      },
      {
        id: "questionario_rc",
        label: "Questionario RC Compilato e Firmato",
        description: "Questionario di valutazione rischio RC, incluso il modello RC vettoriale/fatturato noli fornito",
        isQuestionnaire: true,
        questionnaireFile: "/questionari/questionario_rc_vettoriale.pdf",
      },
    ],
  },
  {
    practiceType: "pet",
    requiredDocuments: [
      {
        id: "documento_identita",
        label: "Documento d'Identità Proprietario",
        description: "Carta d'identità o passaporto",
        isQuestionnaire: false,
      },
      {
        id: "libretto_sanitario",
        label: "Libretto Sanitario o Certificato Microchip",
        description: "Documento veterinario attestante l'identità dell'animale",
        isQuestionnaire: false,
      },
      {
        id: "questionario_pet",
        label: "Questionario Pet Compilato e Firmato",
        description: "Questionario sullo stato di salute dell'animale",
        isQuestionnaire: true,
        questionnaireFile: "/questionari/questionario_pet_cocco.pdf",
      },
    ],
  },
  {
    practiceType: "fotovoltaico",
    requiredDocuments: [
      {
        id: "visura_camerale",
        label: "Visura Camerale o Documento d'Identità",
        description: "Documento identificativo del richiedente",
        isQuestionnaire: false,
      },
      {
        id: "progetto_impianto",
        label: "Progetto dell'Impianto",
        description: "Documentazione tecnica del progetto fotovoltaico",
        isQuestionnaire: false,
      },
      {
        id: "autorizzazione",
        label: "Autorizzazione/Permesso",
        description: "Autorizzazione all'installazione rilasciata dal Comune",
        isQuestionnaire: false,
      },
    ],
  },
  {
    practiceType: "catastrofali",
    requiredDocuments: [
      {
        id: "documento_identita",
        label: "Documento d'Identità",
        description: "Carta d'identità o passaporto",
        isQuestionnaire: false,
      },
      {
        id: "visura_catastale",
        label: "Visura Catastale",
        description: "Visura dell'immobile da assicurare",
        isQuestionnaire: false,
      },
      {
        id: "perizia_immobile",
        label: "Perizia o Planimetria Immobile",
        description: "Documento attestante caratteristiche e valore dell'immobile",
        isQuestionnaire: false,
      },
      {
        id: "questionario_rischi_catastrofali",
        label: "Questionario Rischi Catastrofali Compilato e Firmato",
        description: "Questionario per terremoto, alluvione/esondazione e frana",
        isQuestionnaire: true,
        questionnaireFile: "/questionari/questionario_rischi_catastrofali.pdf",
      },
    ],
  },
  {
    practiceType: "azienda",
    requiredDocuments: [
      {
        id: "visura_camerale",
        label: "Visura Camerale",
        description: "Documento ufficiale camerale dell'impresa",
        isQuestionnaire: false,
      },
      {
        id: "documento_identita",
        label: "Documento d'Identità Legale Rappresentante",
        description: "Carta d'identità o passaporto",
        isQuestionnaire: false,
      },
      {
        id: "bilancio",
        label: "Bilancio o Dichiarazione dei Redditi",
        description: "Ultimo bilancio approvato o dichiarazione fiscale",
        isQuestionnaire: false,
      },
      {
        id: "questionario_rischi_catastrofali_azienda",
        label: "Questionario Rischi Catastrofali Azienda Compilato e Firmato",
        description: "Questionario rischi catastrofali per prodotti linea aziende, se richiesto dalla copertura",
        isQuestionnaire: true,
        questionnaireFile: "/questionari/questionario_rischi_catastrofali.pdf",
      },
    ],
  },
  {
    practiceType: "postuma_decennale",
    requiredDocuments: [
      {
        id: "visura_camerale",
        label: "Visura Camerale",
        description: "Documento ufficiale camerale dell'impresa",
        isQuestionnaire: false,
      },
      {
        id: "documento_identita",
        label: "Documento d'Identità Legale Rappresentante",
        description: "Carta d'identità o passaporto",
        isQuestionnaire: false,
      },
      {
        id: "collaudo_statico",
        label: "Collaudo Statico",
        description: "Certificato di collaudo statico dell'opera",
        isQuestionnaire: false,
      },
      {
        id: "progetto_esecutivo",
        label: "Progetto Esecutivo",
        description: "Progetto esecutivo dell'opera firmato dal progettista",
        isQuestionnaire: false,
      },
      {
        id: "questionario_decennale_postuma",
        label: "Questionario Decennale Postuma Compilato e Firmato",
        description: "Questionario per l'assicurazione dell'immobile CAR e postuma decennale edilizia",
        isQuestionnaire: true,
        questionnaireFile: "/questionari/questionario_decennale_postuma.pdf",
      },
    ],
  },
  {
    practiceType: "all_risk",
    requiredDocuments: [
      {
        id: "visura_camerale",
        label: "Visura Camerale o Documento d'Identità",
        description: "Documento identificativo del richiedente",
        isQuestionnaire: false,
      },
      {
        id: "documento_identita",
        label: "Documento d'Identità",
        description: "Carta d'identità o passaporto",
        isQuestionnaire: false,
      },
      {
        id: "lista_beni",
        label: "Lista Beni/Macchinari",
        description: "Elenco dettagliato dei beni da assicurare con valori",
        isQuestionnaire: false,
      },
      {
        id: "questionario_car_postuma_l210",
        label: "Questionario Tutti i Rischi / CAR L210 Compilato e Firmato",
        description: "Questionario tutti i rischi della costruzione di opere civili e postuma decennale L210",
        isQuestionnaire: true,
        questionnaireFile: "/questionari/questionario_car_postuma_decennale_l210.pdf",
      },
    ],
  },
  {
    practiceType: "risparmio",
    requiredDocuments: [
      {
        id: "documento_identita",
        label: "Documento d'Identità",
        description: "Carta d'identità o passaporto",
        isQuestionnaire: false,
      },
      {
        id: "codice_fiscale",
        label: "Tessera Sanitaria / Codice Fiscale",
        description: "Documento con codice fiscale del contraente",
        isQuestionnaire: false,
      },
      {
        id: "questionario_salute_risparmio",
        label: "Questionario Sanitario Compilato e Firmato",
        description: "Questionario sullo stato di salute del contraente",
        isQuestionnaire: true,
        questionnaireFile: "/questionari/questionario_sanitario.pdf",
      },
    ],
  },
  {
    practiceType: "salute",
    requiredDocuments: [
      {
        id: "documento_identita",
        label: "Documento d'Identità",
        description: "Carta d'identità o passaporto",
        isQuestionnaire: false,
      },
      {
        id: "codice_fiscale",
        label: "Tessera Sanitaria / Codice Fiscale",
        description: "Documento con codice fiscale del contraente",
        isQuestionnaire: false,
      },
      {
        id: "questionario_sanitario",
        label: "Questionario Sanitario Compilato e Firmato",
        description: "Questionario sullo stato di salute obbligatorio per underwriting",
        isQuestionnaire: true,
        questionnaireFile: "/questionari/questionario_sanitario.pdf",
      },
    ],
  },
];
