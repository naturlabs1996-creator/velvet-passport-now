import type { Metadata } from "next";
import LegalPage from "../legal-shell";

export const metadata: Metadata = { title: "Contact | Paris NOW" };

export default function Contact() {
  return <LegalPage eyebrow="VELVET PASSPORT SUPPORT" title="Contact us" intro="Tell us what happened and include the information that lets us help without sending you through unnecessary steps.">
    <section className="contactCards">
      <article><small>PARIS NOW</small><h2>Pass and technical support</h2><p>For activation, access, billing or route issues, include your order reference, the email used at checkout, your device and a short description of the problem.</p><p className="supportNotice">The dedicated Paris NOW support address will be displayed here before paid checkout is activated.</p></article>
      <article><small>PARIS UNCOVERED</small><h2>Etsy order support</h2><p>For download, order or payment questions concerning Paris Uncovered, contact Velvet Passport directly through Etsy so the purchase record is attached to your message.</p><a className="legalButton" href="https://www.etsy.com/shop/VelvetPassportParis" target="_blank" rel="noreferrer">CONTACT ON ETSY →</a></article>
    </section>
    <section><h2>Privacy requests</h2><p>For access, correction or deletion requests, identify the email connected to the service and state the privacy right you wish to exercise. We may need to verify your identity before acting.</p></section>
    <section><h2>Safety and emergencies</h2><p>Paris NOW is not an emergency service. For urgent medical, police or safety assistance, contact the appropriate local emergency service.</p></section>
  </LegalPage>;
}
