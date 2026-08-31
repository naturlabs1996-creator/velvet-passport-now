export type HotelPartnerPriority = {
  hotel: string;
  city: "paris";
  rooms: number;
  conciergeLevel: "clefs-dor" | "dedicated" | "standard-or-unknown";
  locationStrength: "exceptional" | "strong";
  boutiqueLuxuryFit: "exceptional" | "strong";
  internationalGuestFit: "exceptional" | "strong";
  qrDistributionPotential: "exceptional" | "strong" | "moderate";
  decisionMakerAccess: "direct" | "standard" | "unknown";
  approvedByLodgingTrustGate: true;
  score: number;
  tier: "A1" | "A2" | "B";
  rationale: string;
};

export const SLH_PARIS_PARTNER_PRIORITY: HotelPartnerPriority[] = [
  {
    hotel: "Grand Hôtel du Palais Royal",
    city: "paris",
    rooms: 59,
    conciergeLevel: "clefs-dor",
    locationStrength: "exceptional",
    boutiqueLuxuryFit: "exceptional",
    internationalGuestFit: "exceptional",
    qrDistributionPotential: "exceptional",
    decisionMakerAccess: "standard",
    approvedByLodgingTrustGate: true,
    score: 97,
    tier: "A1",
    rationale: "Largest approved SLH Paris property in the pilot, Clefs d'Or concierge, Louvre/Palais Royal location, strong cultural-traveler fit and high room/reception QR exposure potential.",
  },
  {
    hotel: "Grand Powers",
    city: "paris",
    rooms: 50,
    conciergeLevel: "dedicated",
    locationStrength: "exceptional",
    boutiqueLuxuryFit: "exceptional",
    internationalGuestFit: "exceptional",
    qrDistributionPotential: "exceptional",
    decisionMakerAccess: "standard",
    approvedByLodgingTrustGate: true,
    score: 96,
    tier: "A1",
    rationale: "Fifty rooms, concierge, Golden Triangle location and strong international luxury distribution make it a high-leverage NOW partner candidate.",
  },
  {
    hotel: "Hôtel San Régis",
    city: "paris",
    rooms: 42,
    conciergeLevel: "clefs-dor",
    locationStrength: "exceptional",
    boutiqueLuxuryFit: "exceptional",
    internationalGuestFit: "exceptional",
    qrDistributionPotential: "exceptional",
    decisionMakerAccess: "standard",
    approvedByLodgingTrustGate: true,
    score: 95,
    tier: "A1",
    rationale: "Intimate family-run luxury house with 30 rooms and 12 suites, Clefs d'Or concierge and a discreet high-end clientele highly aligned with Velvet Passport.",
  },
  {
    hotel: "Hotel Norman Paris",
    city: "paris",
    rooms: 37,
    conciergeLevel: "dedicated",
    locationStrength: "exceptional",
    boutiqueLuxuryFit: "exceptional",
    internationalGuestFit: "exceptional",
    qrDistributionPotential: "strong",
    decisionMakerAccess: "standard",
    approvedByLodgingTrustGate: true,
    score: 93,
    tier: "A2",
    rationale: "Small luxury format, global-traveler positioning and a concierge team that explicitly discovers and tests activities and restaurants create an unusually natural fit with NOW.",
  },
  {
    hotel: "Chateau des Fleurs",
    city: "paris",
    rooms: 37,
    conciergeLevel: "dedicated",
    locationStrength: "exceptional",
    boutiqueLuxuryFit: "exceptional",
    internationalGuestFit: "strong",
    qrDistributionPotential: "strong",
    decisionMakerAccess: "standard",
    approvedByLodgingTrustGate: true,
    score: 91,
    tier: "A2",
    rationale: "Thirty-seven-room boutique house near the Arc de Triomphe with dedicated concierge and strong brand fit for a discreet, high-design NOW deployment.",
  },
  {
    hotel: "Le Narcisse Blanc Hôtel & Spa",
    city: "paris",
    rooms: 30,
    conciergeLevel: "dedicated",
    locationStrength: "strong",
    boutiqueLuxuryFit: "exceptional",
    internationalGuestFit: "strong",
    qrDistributionPotential: "strong",
    decisionMakerAccess: "standard",
    approvedByLodgingTrustGate: true,
    score: 89,
    tier: "A2",
    rationale: "Highly trusted boutique hotel with 24-hour concierge and a strong Left Bank position; lower room count reduces raw scan volume but not strategic fit.",
  },
  {
    hotel: "L’Hotel",
    city: "paris",
    rooms: 20,
    conciergeLevel: "standard-or-unknown",
    locationStrength: "strong",
    boutiqueLuxuryFit: "exceptional",
    internationalGuestFit: "strong",
    qrDistributionPotential: "moderate",
    decisionMakerAccess: "direct",
    approvedByLodgingTrustGate: true,
    score: 86,
    tier: "B",
    rationale: "Only 20 rooms, but exceptionally strong Velvet identity fit in Saint-Germain-des-Prés and unusually direct access to general management and sales contacts can make it an efficient boutique pilot.",
  },
];

export function getSlhParisPartnerPriority() {
  return [...SLH_PARIS_PARTNER_PRIORITY].sort((a, b) => b.score - a.score);
}

export function getFirstWaveSlhParisPartners() {
  return getSlhParisPartnerPriority().filter((hotel) => hotel.tier === "A1");
}
