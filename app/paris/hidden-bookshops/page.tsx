import type { Metadata } from "next";
import Image from "next/image";
import DiscoveryActions from "./DiscoveryActions";
import { parisDiscovery } from "../../../lib/discovery/paris";
import "./page.css";

const page = parisDiscovery.answerPages.hiddenBookshops;
const product = parisDiscovery.product;

export const metadata: Metadata = {
  title: `${page.title} | Velvet Passport`,
  description:
    "A quieter, more atmospheric way to discover literary Paris — with a natural path into Paris Uncovered.",
};

export default function HiddenBookshopsPage() {
  return (
    <main className="answer-page">
      <header className="answer-hero">
        <div className="answer-hero-image">
          <Image src={page.featuredImage} alt="Atmospheric covered passage in Paris" fill priority sizes="100vw" />
          <div className="answer-hero-shade" />
        </div>
        <div className="answer-hero-content">
          <Image
            src="/images/velvet-passport-logo.png"
            alt="Velvet Passport"
            width={150}
            height={150}
            className="answer-logo"
          />
          <p className="answer-eyebrow">{page.eyebrow}</p>
          <h1>{page.title}</h1>
          <p className="answer-lede">{page.answer}</p>
        </div>
      </header>

      <section className="answer-section answer-discovery">
        <p className="section-kicker">THE DISCOVERY</p>
        <h2>{page.discoveryTitle}</h2>
        <p>{page.discoveryBody}</p>
      </section>

      <section className="answer-section answer-notes">
        <p className="section-kicker">WHAT TO LOOK FOR</p>
        <div className="answer-note-grid">
          {page.more.map((item, index) => (
            <article key={item}>
              <span>0{index + 1}</span>
              <p>{item}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="answer-section answer-velvet">
        <p className="section-kicker">THE VELVET DIFFERENCE</p>
        <h2>Paris does not need another list of famous attractions.</h2>
        <p>
          Velvet Passport looks for places with atmosphere, history and a reason to remember them — then turns those discoveries into something you can actually use while travelling.
        </p>
      </section>

      <section className="answer-conversion">
        <p className="section-kicker">CONTINUE THE DISCOVERY</p>
        <h2>{product.name}</h2>
        <p>
          This theme belongs to the same carefully selected Paris that continues inside {product.name}: {product.totalAddresses} addresses chosen to help you move beyond the places everyone already knows.
        </p>
        <DiscoveryActions
          page={page.slug}
          theme={page.theme}
          product={product.id}
          stores={[...product.stores]}
          miniGuideUrl={parisDiscovery.miniGuideUrl}
        />
      </section>

      <footer className="answer-footer">
        <span>VELVET PASSPORT</span>
        <span>Paris · Discovery MVP</span>
      </footer>
    </main>
  );
}
