import type { Metadata } from "next";
import LegalPage from "../legal-shell";

export const metadata: Metadata = { title: "Refund Policy | Paris NOW" };

export default function RefundPolicy() {
  return <LegalPage eyebrow="PURCHASE PROTECTION" title="Refund Policy" intro="The policy is designed around one simple distinction: an unused Paris NOW Pass is different from an activated digital service.">
    <section className="legalHighlight"><h2>Paris NOW Passes</h2><p><b>Before activation:</b> You may request a full refund within 14 days of purchase if the Pass has not been activated.</p><p><b>After activation:</b> A Pass is generally non-refundable because the timed digital service has begun. If a verified technical failure prevents meaningful use, contact us promptly. We may restore access, extend the Pass or issue an appropriate refund.</p></section>
    <section><h2>Duplicate or incorrect purchase</h2><p>If you were charged twice or purchased the wrong Pass, contact us as soon as possible with the order reference. We will review the transaction and correct an eligible error.</p></section>
    <section><h2>What is not covered</h2><p>Refunds are not normally issued because of weather, a personal change of plans, an attraction closure, sold-out tickets, transport disruption or dissatisfaction with a third-party service. Paris NOW does not sell or include attraction tickets unless expressly stated.</p></section>
    <section><h2>Paris Uncovered and Etsy purchases</h2><p>Paris Uncovered is a separate downloadable PDF sold through Etsy. Its purchase, delivery and refund conditions are shown on the Etsy listing and governed by Etsy’s checkout terms and applicable law. This Paris NOW refund policy does not replace those conditions.</p></section>
    <section><h2>How to request a refund</h2><p>Use our <a href="/contact">Contact page</a>. Include the purchaser’s name, email, order reference, purchase date and a short explanation. Approved refunds are returned to the original payment method; bank processing times may vary.</p></section>
    <section><h2>Mandatory rights</h2><p>This policy does not limit any non-waivable consumer right available under the law that applies to your purchase.</p></section>
  </LegalPage>;
}
