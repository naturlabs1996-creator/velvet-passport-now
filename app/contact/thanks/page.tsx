import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "../../legal-shell";

export const metadata: Metadata = { title: "Message sent | Paris NOW" };

export default function ContactThanks() {
  return <LegalPage eyebrow="MESSAGE SENT" title="Thank you." intro="Your message has been sent to Velvet Passport support. A reply will be sent to the email address you provided.">
    <section className="contactThanks"><h2>What happens next?</h2><p>We will review your request and use the order details you provided to investigate it. Please avoid sending the same request repeatedly.</p><Link className="legalButton" href="/">RETURN TO PARIS NOW →</Link></section>
  </LegalPage>;
}
