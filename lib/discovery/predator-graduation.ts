export type PredatorGraduationStatus = "TRAINING" | "SHADOW_READY" | "BOUNDED_AUTONOMY";

export const PREDATOR_GRADUATION = {
  agentId: "predator-2",
  status: "SHADOW_READY" as PredatorGraduationStatus,
  completedCapabilities: [
    "historical witness spatial clue extraction",
    "historical micro-location hypothesis ranking",
    "official street-name lineage reconstruction",
    "current address and parcel candidate resolution",
    "current entrance candidate resolution",
    "historical parcel alignment with fail-closed exact-match gate",
    "multi-city historical geo adapter architecture",
    "permanent historical regression benchmark",
    "autonomous improvement proposal evaluation",
    "independent integrity verification",
    "governance GPS and heartbeat watchdog",
    "NORMAL/HOLD/MUZZLED/KILL_SWITCH containment",
  ],
  shadowModePermissions: [
    "Run historical research missions independently inside the declared mandate.",
    "Generate and rank hypotheses.",
    "Use approved public and archival sources.",
    "Add benchmark candidates and improvement proposals.",
    "Return CONFIRMED/PROBABLE/POSSIBLE/UNRESOLVED/CONTRADICTED results with traceable evidence.",
  ],
  permanentRestrictions: [
    "No direct publication, merge or production deployment.",
    "No weakening of protected gates, thresholds or evidence standards.",
    "No exact historical parcel or entrance claim without required independent continuity evidence.",
    "No self-certification of factual status; independent verification remains mandatory.",
    "No autonomous expansion of mission outside historical research, archival analysis, micro-location and city-source adapters.",
    "No continuation under MUZZLED or KILL_SWITCH beyond allowed diagnostic/rollback actions.",
  ],
  promotionGateToBoundedAutonomy: [
    "Complete a supervised shadow corpus of real missions.",
    "Maintain zero critical integrity violations.",
    "Maintain zero protected-gate regressions.",
    "Demonstrate calibrated confidence on real-world historical parcel and entrance cases.",
    "Pass independent verification consistently across multiple city adapters.",
  ],
  rule:
    "Predator 2.0 is SHADOW_READY: capable of independent historical research inside a bounded mandate, but conclusions remain independently verified and no autonomous behavioral change, publication or deployment is permitted.",
} as const;
