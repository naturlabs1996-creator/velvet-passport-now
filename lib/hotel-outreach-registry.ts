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

/**
 * Central commercial registry for every hotel NOW approaches.
 * Rule: a commercial relationship never changes Trust Gate status.
 */
export const HOTEL_OUTREACH_REGISTRY: HotelOutreachRecord[] = [
  {
    id: "paris-grand-hotel-palais-royal",
    hotelName: "Grand Hôtel du Palais Royal",
    city: "Paris",
    country: "France",
    group: "Small Luxury Hotels of the World",
    address: "4 Rue de Valois, 75001 Paris, France",
    website: "https://www.grandhoteldupalaisroyal.com/",
    trustGateStatus: "approved",
    partnerPriorityScore: 97,
    commercialWave: 1,
    whySelected: [
      "High-fit luxury independent property near the Louvre and Palais Royal.",
      "Dedicated concierge operation aligns strongly with NOW's in-city decision support.",
      "Strong international-guest and QR distribution potential.",
      "Property already passed the NOW Lodging Trust Gate.",
    ],
    decisionMakers: [
      {
        name: "Séverine Gréault",
        role: "Sales & Marketing / Paristory commercial leadership",
        email: "s.greault@paristoryhotels.com",
        source: "Current Paristory/LinkedIn activity plus publicly listed 2026 commercial contact",
        verifiedAt: today,
      },
      {
        name: "Christopher El Ouadakri",
        role: "Head Concierge / Clefs d'Or",
        source: "Grand Hôtel du Palais Royal official website",
        verifiedAt: today,
      },
      {
        name: "Alexandra Marang",
        role: "Paristory co-director",
        source: "Grand Hôtel du Palais Royal official group page",
        verifiedAt: today,
      },
      {
        name: "Julie Marang",
        role: "Paristory co-director / group image",
        source: "Grand Hôtel du Palais Royal official group page",
        verifiedAt: today,
      },
      {
        role: "Hotel general contact",
        email: "contact@ghprparis.com",
        phone: "+33 1 42 96 15 35",
        source: "Grand Hôtel du Palais Royal official contact page",
        verifiedAt: today,
      },
    ],
    primaryContact: {
      name: "Séverine Gréault",
      role: "Sales & Marketing / Paristory commercial leadership",
      email: "s.greault@paristoryhotels.com",
      source: "Current Paristory/LinkedIn activity plus publicly listed 2026 commercial contact",
      verifiedAt: today,
    },
    outreachStatus: "ready_to_contact",
    nextAction: "Send the personalized NOW hotel-partner introduction to Séverine Gréault. Position Christopher El Ouadakri as the operational concierge stakeholder for a pilot discussion, not as the primary commercial decision-maker.",
    touches: [],
    pilot: {
      proposed: false,
      qrLocations: ["reception", "concierge desk", "guest-room collateral"],
    },
    notes: [
      "Do not imply that hotel partnership affects editorial recommendation status.",
      "Initial pilot concept: 30 days, digital collateral supplied by NOW, hotel prints locally if desired.",
      "Official hotel fallback contact: contact@ghprparis.com / +33 1 42 96 15 35.",
      "Séverine Gréault is the preferred first commercial contact; revalidate direct email before any bulk or automated outreach.",
    ],
    createdAt: today,
    updatedAt: today,
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
