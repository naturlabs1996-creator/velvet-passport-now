import type { ResearchLead } from "./research-collectors";

export type HistoricalSpatialRelation =
  | "CORNER_OFFSET"
  | "DOOR_SEQUENCE"
  | "OPPOSITE_LANDMARK"
  | "ADJACENT"
  | "INSIDE_COURTYARD"
  | "FLOOR_LEVEL"
  | "SIDE_OF_STREET"
  | "BEHIND_FRONTAGE"
  | "DISTANCE_RELATIVE"
  | "ENTRANCE_RELATION";

export type HistoricalSpatialClue = {
  relation: HistoricalSpatialRelation;
  sourceText: string;
  normalizedHint: string;
  specificity: "HIGH" | "MEDIUM" | "LOW";
  truthStatus: "WITNESS_HYPOTHESIS_ONLY";
};

export type HistoricalSpatialResult = {
  lead: ResearchLead;
  clues: HistoricalSpatialClue[];
  confidence: "HIGH" | "MEDIUM" | "LOW" | "NONE";
  reconstructable: boolean;
  reasons: string[];
};

const RULES: Array<{
  relation: HistoricalSpatialRelation;
  specificity: HistoricalSpatialClue["specificity"];
  patterns: RegExp[];
}> = [
  {
    relation: "DOOR_SEQUENCE",
    specificity: "HIGH",
    patterns: [
      /(?:premi[eè]re|deuxi[eè]me|troisi[eè]me|1(?:re|er)|2e|3e|first|second|third)\s+(?:porte|door|porte coch[eè]re|gateway)/i,
      /(?:porte|door|porte coch[eè]re|gateway)\s+(?:suivante|next|apr[eè]s|after)/i,
    ],
  },
  {
    relation: "CORNER_OFFSET",
    specificity: "HIGH",
    patterns: [
      /(?:premi[eè]re|deuxi[eè]me|troisi[eè]me|1(?:re|er)|2e|3e)\s+(?:maison|porte|immeuble|b[aâ]timent)\s+(?:apr[eè]s|depuis)\s+(?:l['’])?(?:angle|coin|carrefour)/i,
      /(?:first|second|third)\s+(?:house|door|building)\s+(?:after|from)\s+the\s+(?:corner|intersection)/i,
      /(?:à|a|environ|about)\s*\d{1,3}\s*(?:m|m[eè]tres?|meters?|feet|pieds?)\s+(?:de|du|from)\s+(?:l['’])?(?:angle|coin|carrefour|corner)/i,
    ],
  },
  {
    relation: "OPPOSITE_LANDMARK",
    specificity: "HIGH",
    patterns: [
      /(?:en face de|vis[- ]?[aà][- ]vis de|opposite|across from)\s+[^.;]{3,100}/i,
    ],
  },
  {
    relation: "ADJACENT",
    specificity: "MEDIUM",
    patterns: [
      /(?:à c[oô]t[eé] de|attenant [aà]|voisin de|next to|beside|adjoining)\s+[^.;]{3,100}/i,
    ],
  },
  {
    relation: "INSIDE_COURTYARD",
    specificity: "HIGH",
    patterns: [
      /(?:au fond de|dans|inside|at the back of)\s+(?:la|une|the)?\s*(?:cour|courtyard)/i,
      /(?:seconde?|deuxi[eè]me|second)\s+(?:cour|courtyard)/i,
    ],
  },
  {
    relation: "FLOOR_LEVEL",
    specificity: "MEDIUM",
    patterns: [
      /(?:rez[- ]de[- ]chauss[eé]e|premier|deuxi[eè]me|troisi[eè]me|1er|2e|3e)\s+(?:[eé]tage|floor)?/i,
      /(?:ground|first|second|third)\s+floor/i,
    ],
  },
  {
    relation: "SIDE_OF_STREET",
    specificity: "MEDIUM",
    patterns: [
      /(?:c[oô]t[eé]|side)\s+(?:pair|impair|even|odd)/i,
      /(?:sur la|on the)\s+(?:droite|gauche|right|left)\s+(?:de la rue|side)/i,
    ],
  },
  {
    relation: "BEHIND_FRONTAGE",
    specificity: "MEDIUM",
    patterns: [
      /(?:derri[eè]re|behind)\s+(?:la|the)?\s*(?:fa[cç]ade|frontage|maison|building)/i,
      /(?:arri[eè]re[- ]cour|back courtyard|rear courtyard)/i,
    ],
  },
  {
    relation: "DISTANCE_RELATIVE",
    specificity: "MEDIUM",
    patterns: [
      /\b\d{1,3}\s*(?:m|m[eè]tres?|meters?|feet|pieds?)\s+(?:plus loin|away|from|de)\b/i,
      /(?:quelques|several|few)\s+(?:pas|steps|m[eè]tres?|meters?)\s+(?:de|from)/i,
    ],
  },
  {
    relation: "ENTRANCE_RELATION",
    specificity: "HIGH",
    patterns: [
      /(?:entr[eé]e|porte|door|entrance)\s+(?:dans|sur|on|via|par)\s+[^.;]{3,100}/i,
      /(?:en entrant|upon entering|after entering|apr[eè]s avoir franchi)\s+[^.;]{3,100}/i,
    ],
  },
];

function candidateTexts(lead: ResearchLead) {
  const evidenceClaims = (lead.evidenceTrace ?? []).flatMap((item) => item.claims ?? []);
  const rawClaims = lead.rawClaims.filter((claim) =>
    !/^(?:WIKIDATA_|VENUE_POOL_|PARIS_DATA_|HISTORY_EVIDENCE:|SOURCE_PAGE_HYPOTHESIS|SOURCE_PAGE_LOCAL_HYPOTHESIS)/i.test(claim)
  );
  return [...new Set([lead.snippet ?? "", ...rawClaims, ...evidenceClaims].map((value) => value.trim()).filter((value) => value.length >= 8))];
}

function normalizeHint(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 240);
}

function dedupeClues(clues: HistoricalSpatialClue[]) {
  const seen = new Set<string>();
  return clues.filter((clue) => {
    const key = `${clue.relation}|${clue.normalizedHint.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function extractHistoricalSpatialClues(leads: ResearchLead[]) {
  const results: HistoricalSpatialResult[] = leads.map((lead) => {
    const clues: HistoricalSpatialClue[] = [];
    for (const text of candidateTexts(lead)) {
      for (const rule of RULES) {
        for (const pattern of rule.patterns) {
          const match = text.match(pattern);
          if (!match?.[0]) continue;
          clues.push({
            relation: rule.relation,
            sourceText: normalizeHint(text),
            normalizedHint: normalizeHint(match[0]),
            specificity: rule.specificity,
            truthStatus: "WITNESS_HYPOTHESIS_ONLY",
          });
          break;
        }
      }
    }

    const unique = dedupeClues(clues).slice(0, 12);
    const high = unique.filter((clue) => clue.specificity === "HIGH").length;
    const medium = unique.filter((clue) => clue.specificity === "MEDIUM").length;
    const confidence: HistoricalSpatialResult["confidence"] =
      high >= 2 ? "HIGH" :
      high >= 1 || medium >= 2 ? "MEDIUM" :
      medium >= 1 ? "LOW" : "NONE";
    const reconstructable = high >= 1 || medium >= 2;

    const spatialClaims = unique.map((clue) =>
      `HISTORICAL_SPATIAL_CLUE relation=${clue.relation} specificity=${clue.specificity} truth=WITNESS_HYPOTHESIS_ONLY hint=${JSON.stringify(clue.normalizedHint)}`
    );
    const summaryClaim = unique.length
      ? `HISTORICAL_SPATIAL_RECONSTRUCTION clues=${unique.length} high=${high} medium=${medium} confidence=${confidence} reconstructable=${reconstructable ? "YES" : "NO"} truth=HYPOTHESIS_ONLY`
      : "HISTORICAL_SPATIAL_RECONSTRUCTION clues=0 confidence=NONE reconstructable=NO truth=HYPOTHESIS_ONLY";

    const reasons = unique.length
      ? [
          "Historical testimony contains spatial relations that can constrain a present-day micro-location.",
          "Witness-derived geometry is hypothesis-only until corroborated against plans, cadastral/parcel evidence, address-number evolution or surviving fabric.",
        ]
      : ["No usable witness-style spatial relation was found in the currently attached evidence."];

    return {
      lead: { ...lead, rawClaims: [...lead.rawClaims, ...spatialClaims, summaryClaim] },
      clues: unique,
      confidence,
      reconstructable,
      reasons,
    };
  });

  return {
    results,
    leads: results.map((item) => item.lead),
    reconstructable: results.filter((item) => item.reconstructable),
    rule: "Witness testimony may constrain geometry but never becomes location truth by itself. Door sequence, corner offsets, opposite landmarks, courtyard relations, floor levels and relative distances are preserved as hypothesis-only spatial clues. Exact present-day micro-location requires corroboration against independent cartographic, cadastral, numbering, architectural or surviving-fabric evidence.",
  };
}
