export type HotelOutreachStatus =
  | "research"
  | "ready_to_contact"
  | "contacted"
  | "follow_up_due"
  | "replied"
  | "meeting_requested"
  | "meeting_scheduled"
  | "pilot_proposed"
  | "pilot_active"
  | "partner"
  | "declined"
  | "paused";

export type HotelDecisionMaker = {
  name?: string;
  role: string;
  email?: string;
  phone?: string;
  source?: string;
  verifiedAt?: string;
};

export type HotelOutreachTouch = {
  date: string;
  channel: "email" | "phone" | "linkedin" | "website-form" | "in-person" | "other";
  contactName?: string;
  contactRole?: string;
  subject?: string;
  summary: string;
  result?: string;
  nextAction?: string;
  nextActionDate?: string;
};

export type HotelPilotTracking = {
  proposed: boolean;
  startDate?: string;
  endDate?: string;
  qrLocations?: string[];
  qrCodeId?: string;
  scans?: number;
  activations?: number;
  notes?: string;
};

export type HotelOutreachRecord = {
  id: string;
  hotelName: string;
  city: string;
  country: string;
  group?: string;
  address?: string;
  website?: string;
  trustGateStatus: "approved" | "review_required" | "rejected" | "not_assessed";
  trustScore?: number;
  partnerPriorityScore?: number;
  commercialWave?: 1 | 2 | 3;
  whySelected?: string[];
  decisionMakers: HotelDecisionMaker[];
  primaryContact?: HotelDecisionMaker;
  outreachStatus: HotelOutreachStatus;
  firstContactDate?: string;
  lastContactDate?: string;
  nextActionDate?: string;
  nextAction?: string;
  touches: HotelOutreachTouch[];
  pilot: HotelPilotTracking;
  notes?: string[];
  createdAt: string;
  updatedAt: string;
};

const today = "2026-08-30";
const slh = "Small Luxury Hotels of the World";
const pilot = { proposed: false, qrLocations: ["reception", "concierge desk", "guest-room collateral"] };
const commonNotes = [
  "Commercial partnership never changes the NOW Lodging Trust Gate status.",
  "Initial pilot concept: 30 days; NOW supplies digital collateral and the hotel prints locally if desired.",
  "Use the official first-contact hotel outreach template; personalize only verified hotel-specific facts.",
];

export const HOTEL_OUTREACH_REGISTRY: HotelOutreachRecord[] = [
  {
    id: "paris-grand-hotel-palais-royal",
    hotelName: "Grand Hôtel du Palais Royal",
    city: "Paris", country: "France", group: slh,
    address: "4 Rue de Valois, 75001 Paris, France",
    website: "https://www.grandhoteldupalaisroyal.com/",
    trustGateStatus: "approved", partnerPriorityScore: 97, commercialWave: 1,
    whySelected: ["Louvre/Palais Royal location.", "Clefs d'Or concierge.", "Strong international luxury guest fit.", "High QR distribution potential."],
    decisionMakers: [
      { name: "Séverine Gréault", role: "Sales & Marketing / Paristory commercial leadership", email: "s.greault@paristoryhotels.com", source: "Public 2026 Paristory commercial contact", verifiedAt: today },
      { name: "Christopher El Ouadakri", role: "Head Concierge / Clefs d'Or", source: "Hotel official website", verifiedAt: today },
      { role: "Hotel general contact", email: "contact@ghprparis.com", phone: "+33 1 42 96 15 35", source: "Hotel official website", verifiedAt: today },
    ],
    primaryContact: { name: "Séverine Gréault", role: "Sales & Marketing / Paristory commercial leadership", email: "s.greault@paristoryhotels.com", source: "Public 2026 Paristory commercial contact", verifiedAt: today },
    outreachStatus: "ready_to_contact",
    nextAction: "Send personalized Paris NOW introduction to Séverine Gréault; keep Christopher El Ouadakri as the operational concierge stakeholder.",
    touches: [], pilot: { ...pilot }, notes: [...commonNotes], createdAt: today, updatedAt: today,
  },
  {
    id: "paris-grand-powers",
    hotelName: "Grand Powers", city: "Paris", country: "France", group: slh,
    address: "52 Rue François 1er, 75008 Paris, France", website: "https://www.hotelgrandpowersparis.com/",
    trustGateStatus: "approved", partnerPriorityScore: 96, commercialWave: 1,
    whySelected: ["50-room luxury boutique property.", "Golden Triangle location.", "Dedicated concierge and international clientele.", "Very high QR exposure potential."],
    decisionMakers: [
      { name: "Séverine Gréault", role: "Paristory commercial leadership / established Grand Powers sales contact", email: "s.greault@paristoryhotels.com", source: "Paristory public commercial contact and historical Grand Powers sales role", verifiedAt: today },
      { role: "Hotel reservations/general routing", email: "book@gphotel.com", phone: "+33 1 47 23 91 05", source: "Grand Powers official website", verifiedAt: today },
    ],
    primaryContact: { name: "Séverine Gréault", role: "Paristory commercial leadership / established Grand Powers sales contact", email: "s.greault@paristoryhotels.com", source: "Paristory public commercial contact and historical Grand Powers sales role", verifiedAt: today },
    outreachStatus: "ready_to_contact",
    nextAction: "Approach Séverine Gréault as a second Paristory property opportunity, with a Grand Powers-specific version of the approved template.",
    touches: [], pilot: { ...pilot }, notes: [...commonNotes, "Do not merge this record with Grand Hôtel du Palais Royal even if the same group contact handles both."], createdAt: today, updatedAt: today,
  },
  {
    id: "paris-hotel-san-regis",
    hotelName: "Hôtel San Régis", city: "Paris", country: "France", group: slh,
    address: "12 Rue Jean Goujon, 75008 Paris, France", website: "https://www.hotel-sanregis.fr/",
    trustGateStatus: "approved", partnerPriorityScore: 95, commercialWave: 1,
    whySelected: ["Intimate family-run luxury house.", "Clefs d'Or concierge team.", "Discreet high-end clientele.", "Strong fit with Velvet Passport positioning."],
    decisionMakers: [
      { name: "Sarah Georges", role: "General Manager", email: "s.georges@hotel-sanregis.fr", phone: "+33 1 44 95 16 16", source: "San Régis official legal/contact pages", verifiedAt: today },
      { name: "Zeina Georges", role: "Deputy Managing Director", source: "San Régis official contact page", verifiedAt: today },
      { name: "Philique Roest", role: "Sales Manager", source: "San Régis official contact page", verifiedAt: today },
      { name: "Jérôme Joubert", role: "Chef Concierge", source: "San Régis official contact page", verifiedAt: today },
    ],
    primaryContact: { name: "Sarah Georges", role: "General Manager", email: "s.georges@hotel-sanregis.fr", phone: "+33 1 44 95 16 16", source: "San Régis official website", verifiedAt: today },
    outreachStatus: "ready_to_contact",
    nextAction: "Send the personalized Paris NOW introduction to Sarah Georges; copy or involve Sales/Concierge only after interest is established.",
    touches: [], pilot: { ...pilot }, notes: [...commonNotes], createdAt: today, updatedAt: today,
  },
  {
    id: "paris-hotel-norman",
    hotelName: "Hotel Norman Paris", city: "Paris", country: "France", group: slh,
    address: "9 Rue Balzac, 75008 Paris, France", website: "https://www.hotelnorman.com/",
    trustGateStatus: "approved", partnerPriorityScore: 93, commercialWave: 2,
    whySelected: ["37-room boutique format.", "Steps from Arc de Triomphe and Champs-Élysées.", "Concierge-led discovery philosophy closely aligned with NOW.", "Strong international guest fit."],
    decisionMakers: [
      { name: "Grégoire Lachampt", role: "Maître de Maison / management representative", source: "Recent 2025-2026 management responses", verifiedAt: today },
      { role: "Hotel official contact", email: "contact@hotelnorman.com", phone: "+33 1 42 99 80 80", source: "Hotel Norman official website", verifiedAt: today },
    ],
    primaryContact: { name: "Grégoire Lachampt", role: "Maître de Maison / management representative", email: "contact@hotelnorman.com", phone: "+33 1 42 99 80 80", source: "Named management representative + official hotel routing address", verifiedAt: today },
    outreachStatus: "ready_to_contact",
    nextAction: "Send to the official hotel address addressed to Grégoire Lachampt; do not infer a private email pattern.",
    touches: [], pilot: { ...pilot }, notes: [...commonNotes], createdAt: today, updatedAt: today,
  },
  {
    id: "paris-chateau-des-fleurs",
    hotelName: "Chateau des Fleurs", city: "Paris", country: "France", group: slh,
    address: "19 Rue Vernet, 75008 Paris, France", website: "https://www.chateaudesfleurs.paris/",
    trustGateStatus: "approved", partnerPriorityScore: 91, commercialWave: 2,
    whySelected: ["37-room intimate design-led property.", "Arc de Triomphe / Golden Triangle location.", "High-end boutique guest profile.", "Strong discreet QR deployment fit."],
    decisionMakers: [
      { name: "Margaux Séhébiade", role: "Directrice Adjointe", source: "2025 hospitality profile; role requires revalidation at send time", verifiedAt: today },
      { role: "Hotel official contact", email: "contact@chateaudf.com", phone: "+33 1 47 20 41 73", source: "Chateau des Fleurs official website", verifiedAt: today },
    ],
    primaryContact: { name: "Margaux Séhébiade", role: "Directrice Adjointe", email: "contact@chateaudf.com", phone: "+33 1 47 20 41 73", source: "Named management contact routed through official hotel address", verifiedAt: today },
    outreachStatus: "ready_to_contact",
    nextAction: "Address the first email to Margaux Séhébiade via the official hotel contact; revalidate her current role immediately before sending.",
    touches: [], pilot: { ...pilot }, notes: [...commonNotes, "Named role comes from a 2025 profile; do not claim it as current without a final recheck at send time."], createdAt: today, updatedAt: today,
  },
  {
    id: "paris-le-narcisse-blanc",
    hotelName: "Le Narcisse Blanc Hôtel & Spa", city: "Paris", country: "France", group: slh,
    address: "19 Boulevard de la Tour-Maubourg, 75007 Paris, France", website: "https://www.lenarcisseblanc.com/",
    trustGateStatus: "approved", partnerPriorityScore: 89, commercialWave: 2,
    whySelected: ["Exceptionally strong lodging trust profile.", "Boutique luxury identity.", "Left Bank location near major cultural sites.", "Concierge and guest-service fit despite smaller room count."],
    decisionMakers: [
      { name: "Fanny Royol", role: "Director of Operations for Le Narcisse Blanc and Yndo", source: "August 2026 hospitality appointment announcement", verifiedAt: today },
      { role: "Hotel official contact", email: "contact@lenarcisseblanc.com", phone: "+33 1 40 60 44 32", source: "Le Narcisse Blanc official website/legal notice", verifiedAt: today },
    ],
    primaryContact: { name: "Fanny Royol", role: "Director of Operations", email: "contact@lenarcisseblanc.com", phone: "+33 1 40 60 44 32", source: "Current named operations director routed through official hotel address", verifiedAt: today },
    outreachStatus: "ready_to_contact",
    nextAction: "Send the personalized Paris NOW introduction addressed to Fanny Royol via the official hotel contact address.",
    touches: [], pilot: { ...pilot }, notes: [...commonNotes], createdAt: today, updatedAt: today,
  },
  {
    id: "paris-lhotel",
    hotelName: "L’Hotel", city: "Paris", country: "France", group: slh,
    address: "13 Rue des Beaux-Arts, 75006 Paris, France", website: "https://www.l-hotel.com/",
    trustGateStatus: "approved", partnerPriorityScore: 86, commercialWave: 3,
    whySelected: ["Exceptional Velvet identity fit in Saint-Germain-des-Prés.", "Direct published management and sales contacts.", "Small 20-room size makes it suitable for a controlled boutique pilot."],
    decisionMakers: [
      { role: "General Manager", email: "stephane@l-hotel.com", source: "L’Hotel official contact page", verifiedAt: today },
      { role: "Group Marketing Director", email: "joe@curioushotels.com", source: "L’Hotel official contact page", verifiedAt: today },
      { role: "Sales enquiries", email: "sales@curioushotels.com", source: "L’Hotel official contact page", verifiedAt: today },
      { role: "Hotel general contact", email: "stay@l-hotel.com", phone: "+33 1 44 41 99 00", source: "L’Hotel official contact page", verifiedAt: today },
    ],
    primaryContact: { role: "Group Marketing Director", email: "joe@curioushotels.com", source: "L’Hotel official contact page", verifiedAt: today },
    outreachStatus: "ready_to_contact",
    nextAction: "Send first outreach to the published Group Marketing Director; use Sales as fallback and General Manager if strategic approval is needed.",
    touches: [], pilot: { ...pilot }, notes: [...commonNotes], createdAt: today, updatedAt: today,
  },
];

export function getHotelOutreachRecord(id: string) {
  return HOTEL_OUTREACH_REGISTRY.find((record) => record.id === id) ?? null;
}

export function getHotelsByOutreachStatus(status: HotelOutreachStatus) {
  return HOTEL_OUTREACH_REGISTRY.filter((record) => record.outreachStatus === status);
}

export function getFollowUpsDue(onOrBefore: string) {
  const cutoff = Date.parse(onOrBefore);
  if (!Number.isFinite(cutoff)) return [];
  return HOTEL_OUTREACH_REGISTRY.filter((record) => {
    if (!record.nextActionDate) return false;
    const due = Date.parse(record.nextActionDate);
    return Number.isFinite(due) && due <= cutoff;
  });
}
