export type CacheDomain = "DEMAND" | "DESTINATION" | "RESEARCH" | "SOURCE_REPUTATION" | "FIRST_PARTY" | "COMMERCE";

export type CachePolicy = {
  domain: CacheDomain;
  ttlSeconds: number;
  staleWhileRevalidateSeconds: number;
  keyParts: string[];
  allowStaleForDecision: boolean;
  reason: string;
};

const POLICIES: Record<CacheDomain, Omit<CachePolicy, "keyParts">> = {
  DEMAND: {
    domain: "DEMAND",
    ttlSeconds: 21_600,
    staleWhileRevalidateSeconds: 43_200,
    allowStaleForDecision: true,
    reason: "Demand discovery changes slower than operational facts, so short-term reuse reduces duplicate scans.",
  },
  DESTINATION: {
    domain: "DESTINATION",
    ttlSeconds: 21_600,
    staleWhileRevalidateSeconds: 43_200,
    allowStaleForDecision: true,
    reason: "SERP destination capture can be reused briefly while a refresh runs.",
  },
  RESEARCH: {
    domain: "RESEARCH",
    ttlSeconds: 21_600,
    staleWhileRevalidateSeconds: 21_600,
    allowStaleForDecision: false,
    reason: "Research leads may be cached, but stale evidence cannot support publication-sensitive claims.",
  },
  SOURCE_REPUTATION: {
    domain: "SOURCE_REPUTATION",
    ttlSeconds: 604_800,
    staleWhileRevalidateSeconds: 604_800,
    allowStaleForDecision: true,
    reason: "Fact-domain source suitability changes rarely and can be reused aggressively.",
  },
  FIRST_PARTY: {
    domain: "FIRST_PARTY",
    ttlSeconds: 900,
    staleWhileRevalidateSeconds: 900,
    allowStaleForDecision: false,
    reason: "Behavior and performance data should refresh frequently before targeting decisions.",
  },
  COMMERCE: {
    domain: "COMMERCE",
    ttlSeconds: 300,
    staleWhileRevalidateSeconds: 300,
    allowStaleForDecision: false,
    reason: "Commerce outcomes are decision-critical and receive the shortest cache window.",
  },
};

export function getCachePolicy(domain: CacheDomain, keyParts: string[]): CachePolicy {
  return { ...POLICIES[domain], keyParts: keyParts.map((part) => part.trim().toLowerCase()).filter(Boolean) };
}

export function buildCacheKey(policy: CachePolicy) {
  return ["predator", policy.domain.toLowerCase(), ...policy.keyParts].join(":");
}

export function canReuseCache(input: {
  policy: CachePolicy;
  ageSeconds: number;
  requiresFreshEvidence?: boolean;
}) {
  if (input.ageSeconds <= input.policy.ttlSeconds) return { reusable: true, mode: "FRESH" as const };
  if (
    !input.requiresFreshEvidence &&
    input.policy.allowStaleForDecision &&
    input.ageSeconds <= input.policy.ttlSeconds + input.policy.staleWhileRevalidateSeconds
  ) {
    return { reusable: true, mode: "STALE_WHILE_REVALIDATE" as const };
  }
  return { reusable: false, mode: "MISS" as const };
}
