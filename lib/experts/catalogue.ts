// The fixed vocabularies an expert profile is built from. A closed list keeps
// stage 4's competency tags comparable across experts; labels are the display
// copy, keys are what is stored.

export const COMPETENCIES = {
  management_systems: "OH&S management systems (ISO 45001)",
  risk_assessment: "Hazard identification & risk assessment",
  machine_safety: "Machine & equipment safety",
  chemical_safety: "Chemical & process safety",
  construction_safety: "Construction site safety",
  fire_explosion: "Fire & explosion protection",
  emergency_response: "Emergency preparedness & response",
  incident_investigation: "Incident investigation & root cause",
  safety_culture: "Safety culture & leadership",
  contractor_management: "Contractor management",
  occupational_health: "Occupational health & hygiene",
  ergonomics: "Ergonomics",
  psychosocial_risks: "Psychosocial risks (ISO 45003)",
  environmental: "Environmental management (ISO 14001)",
  training: "Training & competence",
  compliance_audits: "Legal compliance & audits (EKAS, SUVA)",
} as const;

export type CompetencyKey = keyof typeof COMPETENCIES;

// NACE Rev. 2 sections: the level stage 1's sector code is matched at.
export const NACE_SECTIONS = {
  A: "Agriculture, forestry and fishing",
  B: "Mining and quarrying",
  C: "Manufacturing",
  D: "Energy supply",
  E: "Water supply, sewerage, waste",
  F: "Construction",
  G: "Wholesale and retail trade",
  H: "Transportation and storage",
  I: "Accommodation and food service",
  J: "Information and communication",
  K: "Financial and insurance",
  L: "Real estate",
  M: "Professional, scientific and technical",
  N: "Administrative and support services",
  O: "Public administration",
  P: "Education",
  Q: "Human health and social work",
  R: "Arts, entertainment and recreation",
  S: "Other service activities",
} as const;

export type NaceSection = keyof typeof NACE_SECTIONS;

export const LANGUAGES = {
  de: "German",
  fr: "French",
  it: "Italian",
  en: "English",
} as const;

export type LanguageKey = keyof typeof LANGUAGES;

export const REGIONS = {
  "de-ch": "German-speaking Switzerland",
  "fr-ch": "Romandie",
  "it-ch": "Ticino",
  remote: "Remote",
} as const;

export type RegionKey = keyof typeof REGIONS;

export const AVAILABILITY = {
  available: "Available for new engagements",
  limited: "Limited capacity",
  unavailable: "Not available at the moment",
} as const;

export type Availability = keyof typeof AVAILABILITY;

export function keysOf<T extends Record<string, string>>(record: T): [keyof T & string, ...(keyof T & string)[]] {
  // Every catalogue above is a non-empty literal object, so the tuple shape
  // z.enum needs always holds.
  return Object.keys(record) as [keyof T & string, ...(keyof T & string)[]];
}
