import type { Metadata } from "next";
import LegalPage from "../legal-shell";

export const metadata: Metadata = { title: "Contact | Paris NOW" };

export default function Contact() {
  return <LegalPage eyebrow="VELVET PASSPORT SUPPORT" title="Contact us" intro="Send your request directly to the Velvet Passport team. We will reply to the email address entered below.">
    <section className="contactFormSection">
      <div className="contactFormIntro"><small>PARIS NOW SUPPORT</small><h2>How can we help?</h2><p>For activation, access, payment, refund or technical issues, include your order number when available.</p></div>
      <form className="contactForm" action="https://formsubmit.co/velvetpassport26@gmail.com" method="POST">
        <input type="hidden" name="_subject" value="New Paris NOW support request"/>
        <input type="hidden" name="_next" value="https://velvet-passport-now.vercel.app/contact/thanks"/>
        <input type="hidden" name="_template" value="table"/>
        <input type="hidden" name="_captcha" value="false"/>
        <input className="contactHoney" type="text" name="_honey" tabIndex={-1} autoComplete="off"/>
        <label><span>Name *</span><input type="text" name="Name" autoComplete="name" required/></label>
        <label><span>Email *</span><input type="email" name="Email" autoComplete="email" required/></label>
        <label><span>Order number <em>optional</em></span><input type="text" name="Order number" autoComplete="off"/></label>
        <label><span>Subject *</span><select name="Topic" required defaultValue=""><option value="" disabled>Select a subject</option><option>Pass access or activation</option><option>Payment or billing</option><option>Refund request</option><option>Technical problem</option><option>Paris Uncovered</option><option>Privacy request</option><option>Other</option></select></label>
        <label className="contactMessage"><span>Message *</span><textarea name="Message" rows={7} required/></label>
        <button type="submit">SEND MESSAGE →</button>
      </form>
    </section>
    <section className="contactSecondary"><div><h2>Paris Uncovered on Etsy</h2><p>For an Etsy order, you may also contact Velvet Passport through Etsy so the purchase record is attached automatically.</p><a href="https://www.etsy.com/shop/VelvetPassportParis" target="_blank" rel="noreferrer">CONTACT ON ETSY →</a></div><div><h2>Safety and emergencies</h2><p>Paris NOW is not an emergency service. For urgent medical, police or safety assistance, contact the appropriate local emergency service.</p></div></section>
  </LegalPage>;
}
