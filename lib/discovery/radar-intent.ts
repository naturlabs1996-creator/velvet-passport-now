export type IntentStrength = "NONE" | "WEAK" | "MEDIUM" | "STRONG";
export type PurchaseCategory = "NONE" | "GUIDE" | "PASS" | "ACTIVITY_TICKET" | "LODGING" | "TRANSPORT" | "FOOD" | "GENERAL_TRIP";

export type RadarIntentProfile = {
  travelerIntent: IntentStrength;
  travelerIntentScore: number;
  buyIntent: IntentStrength;
  buyIntentScore: number;
  purchaseCategory: PurchaseCategory;
  travelerCues: string[];
  buyCues: string[];
};

const normalize = (value: string) => value
  .toLowerCase()
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9€$£\s]/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const findCues = (text: string, cues: string[]) => cues.filter((cue) => text.includes(cue));

const travelerStrong = [
  "planning a trip", "planning my trip", "visiting paris", "going to paris", "trip to paris",
  "staying in paris", "first time in paris", "second time in paris", "third time in paris",
  "returning to paris", "been to paris before", "been in paris before", "back to paris",
  "already been to paris", "already visited paris", "few days in paris", "couple days in paris",
  "itinerary", "where should i stay", "where to stay", "what should i do", "things to do",
  "what to see", "where should i go", "recommendations for paris", "recommendation for paris",
  "looking for recommendations", "looking for advice", "looking for hidden gems", "looking for places",
  "already done the touristy", "done the touristy", "avoid the touristy", "avoid tourist crowds",
  "how many days", "day trip", "weekend in paris", "days in paris", "nights in paris",
  "voyage a paris", "visiter paris", "sejour a paris", "itineraire paris", "que faire a paris",
  "retour a paris", "deja visite paris", "recommandations paris", "cherche des endroits",
];

const travelerMedium = [
  "travel", "travelling", "traveling", "visit", "visited", "visitor", "tourist", "touristy", "vacation", "holiday",
  "recommend", "recommendation", "recommendations", "advice", "suggestions", "looking for",
  "hidden gems", "local spots", "lowkey", "less crowded", "quiet place", "quiet places", "calm place", "calm places",
  "hotel", "hostel", "airbnb", "flight", "train", "metro", "museum", "restaurant", "cafe",
  "neighborhood", "neighbourhood", "attraction", "reservation", "booking", "ticket", "pass",
  "guidebook", "travel guide", "city guide", "tour", "walk", "excursion",
];

const buyStrong = [
  "buy", "buying", "purchase", "purchasing", "book now", "booking now", "reserve now", "pay for",
  "worth buying", "worth purchasing", "where can i buy", "where to buy", "price", "cost", "how much",
  "cheapest", "discount", "promo code", "sold out", "availability", "available tickets",
  "acheter", "achat", "prix", "combien coute", "reserver", "reservation",
];

const buyMedium = [
  "book", "booking", "reserve", "reservation", "ticket", "tickets", "pass", "admission",
  "entry", "entrance", "hotel", "hostel", "airbnb", "flight", "flights", "train tickets",
  "tour", "guided tour", "download", "ebook", "pdf", "guidebook", "travel guide", "city guide",
];

const categoryCues: Array<{ category: PurchaseCategory; cues: string[] }> = [
  { category: "GUIDE", cues: ["travel guide", "city guide", "guidebook", "ebook", "pdf guide", "download guide", "paris guide", "digital guide"] },
  { category: "PASS", cues: ["city pass", "paris pass", "museum pass", "travel pass", "metro pass", "pass"] },
  { category: "ACTIVITY_TICKET", cues: ["ticket", "tickets", "admission", "entrance", "museum ticket", "tour", "guided tour", "excursion", "activity"] },
  { category: "LODGING", cues: ["hotel", "hostel", "airbnb", "apartment", "accommodation", "where to stay", "room"] },
  { category: "TRANSPORT", cues: ["flight", "flights", "airfare", "train", "eurostar", "metro ticket", "transport pass", "car rental"] },
  { category: "FOOD", cues: ["restaurant reservation", "book a restaurant", "reserve a table", "prix fixe", "tasting menu"] },
];

function strength(score: number): IntentStrength {
  if (score >= 75) return "STRONG";
  if (score >= 45) return "MEDIUM";
  if (score >= 20) return "WEAK";
  return "NONE";
}

export function classifyRadarIntent(value: string): RadarIntentProfile {
  const text = normalize(value);
  const travelerStrongHits = findCues(text, travelerStrong);
  const travelerMediumHits = findCues(text, travelerMedium);
  const buyStrongHits = findCues(text, buyStrong);
  const buyMediumHits = findCues(text, buyMedium);

  let travelerIntentScore = Math.min(100, travelerStrongHits.length * 42 + travelerMediumHits.length * 14);
  if (/\bparis\b/.test(text) && travelerMediumHits.length > 0) travelerIntentScore = Math.min(100, travelerIntentScore + 12);

  let buyIntentScore = Math.min(100, buyStrongHits.length * 38 + buyMediumHits.length * 15);
  if (/\b(€|\$|£)\s?\d|\b\d+\s?(euros?|eur|usd|gbp|dollars?|pounds?)\b/.test(text)) buyIntentScore = Math.min(100, buyIntentScore + 28);

  let purchaseCategory: PurchaseCategory = "NONE";
  let bestHits = 0;
  for (const entry of categoryCues) {
    const hits = findCues(text, entry.cues).length;
    if (hits > bestHits) {
      bestHits = hits;
      purchaseCategory = entry.category;
    }
  }
  if (buyIntentScore >= 20 && purchaseCategory === "NONE") purchaseCategory = "GENERAL_TRIP";

  return {
    travelerIntent: strength(travelerIntentScore),
    travelerIntentScore,
    buyIntent: strength(buyIntentScore),
    buyIntentScore,
    purchaseCategory,
    travelerCues: [...new Set([...travelerStrongHits, ...travelerMediumHits])].slice(0, 10),
    buyCues: [...new Set([...buyStrongHits, ...buyMediumHits])].slice(0, 10),
  };
}
