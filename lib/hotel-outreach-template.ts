export type HotelOutreachTemplateInput = {
  hotelName: string;
  contactSalutation: string;
  cityNowName: string;
  selectionReason: string;
  senderName?: string;
};

export function buildHotelFirstOutreach(input: HotelOutreachTemplateInput) {
  const senderName = input.senderName ?? "Alan Lamarre";

  return {
    subject: `${input.hotelName} × ${input.cityNowName}`,
    body: `Bonjour ${input.contactSalutation},\n\nJe me permets de vous contacter car nous avons sélectionné le ${input.hotelName} parmi un nombre très limité d’établissements avec lesquels nous souhaitons présenter ${input.cityNowName}, une nouvelle expérience digitale développée par Velvet Passport pour accompagner les voyageurs une fois qu’ils quittent leur hôtel.\n\n${input.cityNowName} répond à une question très simple que les clients posent constamment :\n\n“What should I do now?”\n\nL’application tient compte du moment de la journée, de la localisation, de la météo, des transports, des réservations et des contraintes réelles du voyageur pour lui proposer quoi faire ensuite — parcours, adresses sélectionnées, pauses, restaurants, billets ou solutions pratiques — sans lui imposer une longue recherche.\n\nNotre objectif n’est surtout pas de remplacer la conciergerie. Au contraire, NOW prolonge le service de l’hôtel lorsque le client est déjà dehors, lorsque le concierge est occupé, ou lorsqu’une décision doit être prise immédiatement.\n\nLe ${input.hotelName} nous paraît particulièrement adapté à ce concept ${input.selectionReason}.\n\nNous souhaiterions vous proposer un pilote très simple, accessible par un QR code discret à la réception ou auprès de la conciergerie. Velvet Passport fournit gratuitement les fichiers numériques nécessaires; l’établissement reste entièrement libre de leur utilisation et aucune intégration technique complexe n’est requise.\n\nSi le concept vous intéresse, je serais heureux de vous présenter ${input.cityNowName} très brièvement et de vous montrer concrètement ce que verrait un client de l’hôtel.\n\nBien cordialement,\n\n${senderName}\nVelvet Passport\n${input.cityNowName}\nYour hotel takes care of the guest while they’re here. NOW helps take care of them when they step outside.`,
  };
}

/**
 * Official first-contact hotel outreach template.
 * Personalize only the hotel, addressee, NOW city and verified reason for selection.
 * Keep the structure, tone and pilot proposition consistent across hotel outreach.
 */
