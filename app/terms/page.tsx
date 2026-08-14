import type { Metadata } from "next";
import LegalPage from "../legal-shell";

export const metadata: Metadata = { title: "Terms of Use | Paris NOW" };

export default function Terms() {
  return <LegalPage eyebrow="LEGAL" title="Terms of Use" intro="These terms govern your purchase of and access to Paris NOW, a digital travel-planning product by Velvet Passport.">
    <section><h2>1. What Paris NOW provides</h2><p>Paris NOW provides time-sensitive route suggestions, travel information, weather-aware recommendations and links to selected third-party services. It is a planning tool, not a tour operator, travel agency, ticket seller, emergency service or guarantee of admission.</p></section>
    <section><h2>2. Pass purchase and activation</h2><p>A Pass remains inactive until you expressly activate it. Once activated, access runs continuously for the duration purchased—72 hours or 7 days—and cannot be paused, transferred or restarted. An unused Pass must be activated within 12 months of purchase unless the checkout offer states otherwise.</p></section>
    <section><h2>3. Your responsibilities</h2><p>You are responsible for checking opening hours, entry requirements, accessibility, local conditions and personal safety before acting on a recommendation. You must provide accurate information and use the service lawfully. A Pass is for personal, non-commercial use and may not be shared, resold, copied or used to create a competing product.</p></section>
    <section><h2>4. Tickets, transport and third parties</h2><p>Attraction tickets, transport, meals and other paid services are not included unless expressly stated. Purchases made through Stripe, Etsy, GetYourGuide, Viator or another provider are also subject to that provider’s terms and privacy practices. Velvet Passport is not responsible for a third party’s availability, cancellation, pricing or performance.</p></section>
    <section><h2>5. Changing city conditions</h2><p>Paris changes in real time. Routes, hours, weather, closures and availability may change without notice. We work to keep recommendations useful, but do not promise that every place or route will remain open, safe, available or suitable at the moment you arrive.</p></section>
    <section><h2>6. Intellectual property</h2><p>Paris NOW, its route logic, text, selection, design, product marks and original content belong to Velvet Passport or its licensors. Attraction names and third-party trademarks belong to their respective owners.</p></section>
    <section><h2>7. Availability and changes</h2><p>We may maintain, improve or change the service when reasonably necessary. If a material technical failure prevents you from using a paid Pass, contact us so we can restore access, extend the Pass or provide the remedy required by our Refund Policy and applicable law.</p></section>
    <section><h2>8. Liability</h2><p>To the maximum extent permitted by law, Velvet Passport is not liable for indirect or consequential loss arising from travel disruption, third-party conduct or reliance on changing information. Nothing in these terms excludes liability that cannot legally be excluded or limits mandatory consumer rights.</p></section>
    <section><h2>9. Ending access</h2><p>We may suspend access for fraud, unlawful use, attempted resale, interference with the service or a material breach of these terms. Where appropriate, we will provide notice and a reasonable opportunity to resolve the issue.</p></section>
    <section><h2>10. Questions</h2><p>Questions about these terms may be sent through our <a href="/contact">Contact page</a>. Applicable consumer protections remain available regardless of these terms.</p></section>
  </LegalPage>;
}
