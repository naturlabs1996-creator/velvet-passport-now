import type { ReactNode } from "react";
import Link from "next/link";

export default function LegalPage({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro: string; children: ReactNode }) {
  return (
    <main className="legalPage">
      <header className="legalNav">
        <Link className="legalBrand" href="/">
          <span className="legalRings"><i/><i/></span>
          <b><span>Paris</span><em>NOW</em></b>
        </Link>
        <Link className="legalBack" href="/">BACK TO PARIS NOW</Link>
      </header>
      <article className="legalArticle">
        <p className="legalEyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="legalIntro">{intro}</p>
        <p className="legalUpdated">Effective August 13, 2026 · Last updated August 13, 2026</p>
        <div className="legalContent">{children}</div>
      </article>
      <footer className="legalFooter">
        <nav><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link><Link href="/refund-policy">Refund policy</Link><Link href="/contact">Contact</Link></nav>
        <small>© 2026 Velvet Passport. Paris NOW is a digital product by Velvet Passport.</small>
      </footer>
    </main>
  );
}
