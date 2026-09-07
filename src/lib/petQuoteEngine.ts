// Motore del preventivatore Pet, condiviso tra portale (configuratore) e API
// partner (/api/pet-quote-catalog, /api/pet-quote, webhook). Niente React,
// niente alias "@/" (viene bundlato anche dalle Vercel Functions).

import {
  getCoverageById,
  petCoverages,
  petOptions,
  type PetCoverage,
  type PetOption,
} from "../data/petInsuranceData.js";
import { PET_ANIMAL_TYPE_LABELS, PET_COVERAGE_CATEGORY_LABELS, PET_COVERAGE_TYPE_LABELS } from "./practiceSummary.js";

export type PetAnimalType = PetOption["animalType"];
export type PetCoverageCategory = PetCoverage["category"];

export const PET_ANIMAL_TYPES: PetAnimalType[] = ["gatti", "cani_0_20kg", "cani_oltre_20kg"];
export const ASSISTENZA_COVERAGE_ID = "ass_standard";
export const TUTELA_LEGALE_COVERAGE_ID = "tl_standard";
export const DOG_WEIGHT_THRESHOLD_KG = 20;

/** Regole di composizione del preventivo (identiche al configuratore del portale). */
export const PET_QUOTE_RULES = {
  assistenza: "sempre inclusa (ass_standard)",
  rsv: "facoltativa, al massimo una copertura della categoria rsv",
  rct: "facoltativa, al massimo una copertura della categoria rct",
  tl: "facoltativa (tl_standard)",
  minimum: "obbligatoria almeno una copertura tra rsv e rct",
  premium: "premio annuale = somma dei premi delle coperture selezionate; rata mensile = premio annuale / 12",
} as const;

export interface PetQuoteLine {
  id: string;
  name: string;
  category: PetCoverageCategory;
  category_label: string;
  description: string;
  max_coverage: string | null;
  price_annual: number;
}

export interface PetGuaranteeRow {
  position: number;
  name: string;
  description: string;
  included: boolean;
}

export interface PetQuoteResult {
  animal_type: PetAnimalType;
  animal_type_label: string;
  coverage_type: string;
  coverage_type_label: string;
  plan_id: string | null;
  plan_name: string | null;
  coverages: PetQuoteLine[];
  selected_coverages: string[];
  total_annual: number;
  total_monthly: number;
  guarantees: PetGuaranteeRow[];
  /** Oggetto pronto da inviare in `specific_fields` del webhook di creazione pratica. */
  specific_fields: Record<string, unknown>;
}

export interface PetQuoteRequest {
  animal_type?: unknown;
  pet_species?: unknown;
  pet_weight?: unknown;
  selected_coverages?: unknown;
  plan_id?: unknown;
  rsv?: unknown;
  rct?: unknown;
  tutela_legale?: unknown;
}

export type PetQuoteOutcome =
  | { ok: true; quote: PetQuoteResult }
  | { ok: false; error: string; details?: Record<string, unknown> };

const round2 = (n: number) => Math.round(n * 100) / 100;

const toStr = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s : null;
};

const toNum = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

const toBool = (v: unknown): boolean => {
  if (typeof v === "boolean") return v;
  const s = String(v ?? "").toLowerCase();
  return ["true", "1", "si", "sì", "yes"].includes(s);
};

export function toQuoteLine(c: PetCoverage): PetQuoteLine {
  return {
    id: c.id,
    name: c.name,
    category: c.category,
    category_label: PET_COVERAGE_CATEGORY_LABELS[c.category],
    description: c.description,
    max_coverage: c.maxCoverage ?? null,
    price_annual: c.price,
  };
}

/** Deduce la categoria tariffaria da animal_type esplicito oppure da specie + peso. */
export function resolveAnimalType(input: { animal_type?: unknown; pet_species?: unknown; pet_weight?: unknown }): PetAnimalType | null {
  const explicit = toStr(input.animal_type)?.toLowerCase();
  if (explicit && (PET_ANIMAL_TYPES as string[]).includes(explicit)) return explicit as PetAnimalType;
  if (explicit === "gatto") return "gatti";

  const species = toStr(input.pet_species)?.toLowerCase();
  if (species === "gatto" || species === "gatti") return "gatti";
  if (species === "cane" || species === "cani") {
    const weight = toNum(input.pet_weight);
    if (weight === null) return null;
    return weight > DOG_WEIGHT_THRESHOLD_KG ? "cani_oltre_20kg" : "cani_0_20kg";
  }
  return null;
}

/** coverage_type (rct | rsv | rct_rsv | completa) derivato dalle coperture scelte. */
export function deriveCoverageType(coverages: PetCoverage[]): string {
  const hasRsv = coverages.some((c) => c.category === "rsv");
  const hasRct = coverages.some((c) => c.category === "rct");
  const hasTl = coverages.some((c) => c.category === "tl");
  if (hasRsv && hasRct && hasTl) return "completa";
  if (hasRsv && hasRct) return "rct_rsv";
  if (hasRsv) return "rsv";
  if (hasRct) return "rct";
  return "";
}

/** Le sei garanzie della mail di preventivo, con SI/NO in base alle coperture scelte. */
export function buildGuaranteeTable(coverages: Array<{ id: string; category: PetCoverageCategory }>): PetGuaranteeRow[] {
  const has = (pred: (c: { id: string; category: PetCoverageCategory }) => boolean) => coverages.some(pred);
  const rows: Array<Omit<PetGuaranteeRow, "position">> = [
    {
      name: "Assistenza PET",
      description:
        "Fornisce assistenza telefonica specializzata per esigenze urgenti legate al PET. Ovunque ti trovi, potrai sempre contare sull'assistenza offerta da un call center specializzato (800.06.63.20 - numero gratuito dall'Italia).",
      included: has((c) => c.category === "assistenza") || coverages.length > 0,
    },
    {
      name: "Rimborso Spese Veterinarie (Silver)",
      description:
        "Copre le spese veterinarie legate a interventi chirurgici che comportino il ricovero / day hospital del tuo PET e gli esami collegati all'intervento se effettuati nei 30 giorni precedenti o successivi all'intervento.",
      included: has((c) => c.id.startsWith("rsv_silver")),
    },
    {
      name: "Rimborso Spese Veterinarie (Gold)",
      description:
        "Copre le spese veterinarie per ricovero / day hospital anche non vincolati a interventi chirurgici, incluse visite, analisi, esami e accertamenti collegati al ricovero se effettuati nei 30 giorni precedenti o successivi.",
      included: has((c) => c.id.startsWith("rsv_gold")),
    },
    {
      name: "Rimborso Spese Veterinarie (Platinum)",
      description:
        "Copre le spese veterinarie in caso di ricoveri / day hospital, incluse visite, analisi, esami e accertamenti collegati. Inoltre, riconosce i costi sostenuti per accertamenti da infortuni, nonche' le spese successive a ritrovamento dopo lo smarrimento.",
      included: has((c) => c.id.startsWith("rsv_platinum")),
    },
    {
      name: "Responsabilita' Civile Terzi",
      description:
        "Copre i danni o le lesioni causati dal tuo PET a persone, beni o altri animali; anche quando e' temporaneamente affidato a terzi non professionisti.",
      included: has((c) => c.category === "rct"),
    },
    {
      name: "Tutela Legale",
      description:
        "Copre le spese legali, peritali e di consulenza in caso di liti civili relative a danni o lesioni subiti dal tuo PET. Include assistenza telefonica per informazioni e consigli legali.",
      included: has((c) => c.category === "tl"),
    },
  ];
  return rows.map((r, i) => ({ position: i + 1, ...r }));
}

/**
 * Espande la selezione del partner in una lista di id copertura:
 * - `selected_coverages` (array o stringa separata da virgole) ha la precedenza;
 * - altrimenti `plan_id` (piani predefiniti del catalogo);
 * - altrimenti la scelta strutturata `rsv`, `rct`, `tutela_legale`.
 * L'assistenza standard viene sempre aggiunta.
 */
export function expandCoverageSelection(input: PetQuoteRequest): { ids: string[]; plan: PetOption | null; unknownIds: string[] } {
  const raw = input.selected_coverages;
  const explicit = Array.isArray(raw)
    ? raw.map((x) => String(x).trim()).filter(Boolean)
    : typeof raw === "string"
      ? raw.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

  let plan: PetOption | null = null;
  let ids: string[] = explicit;

  if (ids.length === 0) {
    const planId = toStr(input.plan_id);
    if (planId) {
      plan = petOptions.find((o) => o.id === planId) ?? null;
      if (plan) ids = Object.values(plan.coverages).filter((x): x is string => Boolean(x));
    }
  }

  if (ids.length === 0 && plan === null) {
    const structured: string[] = [];
    const rsv = toStr(input.rsv);
    const rct = toStr(input.rct);
    if (rsv) structured.push(rsv);
    if (rct) structured.push(rct);
    if (toBool(input.tutela_legale)) structured.push(TUTELA_LEGALE_COVERAGE_ID);
    ids = structured;
  }

  const unknownIds = ids.filter((id) => !getCoverageById(id));
  const known = ids.filter((id) => getCoverageById(id));
  if (!known.includes(ASSISTENZA_COVERAGE_ID)) known.unshift(ASSISTENZA_COVERAGE_ID);
  return { ids: [...new Set(known)], plan, unknownIds };
}

/** Calcola il preventivo applicando le regole del configuratore. */
export function computePetQuote(input: PetQuoteRequest): PetQuoteOutcome {
  const animalType = resolveAnimalType(input);
  if (!animalType) {
    return {
      ok: false,
      error: "animal_type mancante o non valido: indicare gatti | cani_0_20kg | cani_oltre_20kg, oppure pet_species (cane|gatto) e pet_weight.",
      details: { valid_animal_types: PET_ANIMAL_TYPES },
    };
  }

  const { ids, plan, unknownIds } = expandCoverageSelection(input);
  if (unknownIds.length > 0) {
    return {
      ok: false,
      error: "Coperture non presenti nel catalogo.",
      details: { unknown_coverages: unknownIds, valid_coverages: petCoverages.map((c) => c.id) },
    };
  }
  if (plan && plan.animalType !== animalType) {
    return {
      ok: false,
      error: `Il piano ${plan.id} non e' disponibile per la categoria ${animalType}.`,
      details: { plan_animal_type: plan.animalType, valid_plans: petOptions.filter((o) => o.animalType === animalType).map((o) => o.id) },
    };
  }
  if (toStr(input.plan_id) && !plan && ids.length <= 1) {
    return {
      ok: false,
      error: "plan_id non presente nel catalogo.",
      details: { valid_plans: petOptions.map((o) => o.id) },
    };
  }

  const coverages = ids.map((id) => getCoverageById(id)).filter((c): c is PetCoverage => Boolean(c));
  const byCategory = (cat: PetCoverageCategory) => coverages.filter((c) => c.category === cat);
  if (byCategory("rsv").length > 1 || byCategory("rct").length > 1 || byCategory("tl").length > 1 || byCategory("assistenza").length > 1) {
    return {
      ok: false,
      error: "Selezionare al massimo una copertura per categoria (assistenza, rsv, rct, tl).",
      details: { selected_coverages: ids },
    };
  }
  if (byCategory("rsv").length === 0 && byCategory("rct").length === 0) {
    return {
      ok: false,
      error: "Selezionare almeno una copertura tra Rimborso Spese Veterinarie (rsv) e Responsabilita' Civile Terzi (rct).",
      details: { selected_coverages: ids },
    };
  }

  // Ordine stabile: assistenza, rsv, rct, tl
  const order: PetCoverageCategory[] = ["assistenza", "rsv", "rct", "tl"];
  coverages.sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category));

  const totalAnnual = round2(coverages.reduce((sum, c) => sum + c.price, 0));
  const totalMonthly = round2(totalAnnual / 12);
  const coverageType = deriveCoverageType(coverages);
  const selectedIds = coverages.map((c) => c.id);
  const matchedPlan = plan ?? petOptions.find((o) => o.animalType === animalType && Object.values(o.coverages).filter(Boolean).sort().join(",") === [...selectedIds].sort().join(",")) ?? null;

  return {
    ok: true,
    quote: {
      animal_type: animalType,
      animal_type_label: PET_ANIMAL_TYPE_LABELS[animalType] ?? animalType,
      coverage_type: coverageType,
      coverage_type_label: PET_COVERAGE_TYPE_LABELS[coverageType] ?? coverageType,
      plan_id: matchedPlan?.id ?? null,
      plan_name: matchedPlan?.name ?? null,
      coverages: coverages.map(toQuoteLine),
      selected_coverages: selectedIds,
      total_annual: totalAnnual,
      total_monthly: totalMonthly,
      guarantees: buildGuaranteeTable(coverages),
      specific_fields: {
        animal_type: animalType,
        coverage_type: coverageType,
        selected_coverages: selectedIds,
        total_annual: totalAnnual,
        total_monthly: totalMonthly,
        ...(matchedPlan ? { plan_id: matchedPlan.id, plan_name: matchedPlan.name } : {}),
      },
    },
  };
}

/** Catalogo completo per il preventivatore del partner. */
export function buildPetQuoteCatalog() {
  const categories = (["assistenza", "rsv", "rct", "tl"] as PetCoverageCategory[]).map((category) => ({
    category,
    label: PET_COVERAGE_CATEGORY_LABELS[category],
    required: category === "assistenza",
    max_selectable: 1,
    coverages: petCoverages.filter((c) => c.category === category).map(toQuoteLine),
  }));

  const plans = petOptions.map((o) => {
    const ids = Object.values(o.coverages).filter((x): x is string => Boolean(x));
    return {
      id: o.id,
      name: o.name,
      animal_type: o.animalType,
      animal_type_label: PET_ANIMAL_TYPE_LABELS[o.animalType] ?? o.animalType,
      coverages: ids,
      coverage_type: deriveCoverageType(ids.map((id) => getCoverageById(id)).filter((c): c is PetCoverage => Boolean(c))),
      total_annual: o.totalAnnual,
      total_monthly: o.totalMonthly,
    };
  });

  return {
    currency: "EUR",
    animal_types: PET_ANIMAL_TYPES.map((t) => ({
      id: t,
      label: PET_ANIMAL_TYPE_LABELS[t] ?? t,
      species: t === "gatti" ? "gatto" : "cane",
      max_weight_kg: t === "cani_0_20kg" ? DOG_WEIGHT_THRESHOLD_KG : null,
      min_weight_kg: t === "cani_oltre_20kg" ? DOG_WEIGHT_THRESHOLD_KG : null,
    })),
    coverage_types: Object.entries(PET_COVERAGE_TYPE_LABELS).map(([id, label]) => ({ id, label })),
    categories,
    coverages: petCoverages.map(toQuoteLine),
    plans,
    rules: PET_QUOTE_RULES,
    guarantees: buildGuaranteeTable([]).map(({ position, name, description }) => ({ position, name, description })),
  };
}
