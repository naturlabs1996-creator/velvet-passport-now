import type { Metadata } from "next";
import LegalPage from "../legal-shell";

export const metadata: Metadata = { title: "Privacy Policy | Paris NOW" };

export default function Privacy() {
  return <LegalPage eyebrow="YOUR DATA" title="Privacy Policy" intro="This policy explains what Velvet Passport may collect through Paris NOW, why it is used and the choices available to you.">
    <section><h2>1. Information we collect</h2><p>We may collect information you provide at checkout or when contacting support, such as your name, email address, order reference and message. The service may also process route inputs such as approximate location, available time, weather preference, mobility preference and selected interests.</p></section>
    <section><h2>2. Payment information</h2><p>Payments for Paris NOW are intended to be processed by Stripe. Velvet Passport does not receive or store your complete card number. Stripe processes payment information under its own privacy policy. Paris Uncovered purchases made on Etsy are processed by Etsy under Etsy’s policies.</p></section>
    <section><h2>3. Technical and usage data</h2><p>When you use the site, hosting and security providers may receive standard technical data such as IP address, browser type, device information, timestamps, pages viewed and error logs. If analytics are enabled, we use them to understand performance and improve the service.</p></section>
    <section><h2>4. How we use information</h2><p>We use information to deliver and activate your Pass, generate relevant recommendations, provide support, secure the service, prevent fraud, maintain records, improve Paris NOW and comply with legal obligations. We do not sell your personal information.</p></section>
    <section><h2>5. Service providers</h2><p>Information may be processed by providers that help us host, secure, sell and support the service, including Vercel, Stripe and Etsy where applicable. They receive only the information reasonably necessary for their role and process it under their own contractual and legal obligations.</p></section>
    <section><h2>6. Location</h2><p>If you choose to share device location, it is used to improve route relevance. You can deny or withdraw browser location permission at any time. Paris NOW can also work from a location you enter manually.</p></section>
    <section><h2>7. Retention and security</h2><p>We retain information only as long as reasonably needed for the purposes described, including support, accounting, security and legal requirements. We use reasonable safeguards, but no online system can guarantee absolute security.</p></section>
    <section><h2>8. Your choices and rights</h2><p>Depending on where you live, you may request access, correction, deletion, restriction or portability of personal information, or object to certain processing. You may also withdraw consent where consent is the legal basis. Use the <a href="/contact">Contact page</a> and describe your request.</p></section>
    <section><h2>9. Children</h2><p>Paris NOW is not directed to children under 16, and we do not knowingly collect their personal information.</p></section>
    <section><h2>10. International processing and updates</h2><p>Providers may process information in countries other than yours. Where required, appropriate protections are used. We may update this policy as the product changes; the date above identifies the current version.</p></section>
  </LegalPage>;
}
