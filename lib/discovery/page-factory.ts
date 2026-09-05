import type { ProductionBrief } from "./production-queue";

export type PageFactoryStatus = "PUBLISHABLE_STRUCTURE" | "RESEARCH_REQUIRED" | "HOLD";

export type AnswerPageSection = {
  id: string;
  label: string;
  heading: string;
  purpose: string;
  contentStatus: "GENERATED_SAFE" | "RESEARCH_REQUIRED";
};

export type AnswerPageSpec = {
  id: string;
  city: string;
  theme: string;
  status: PageFactoryStatus;
  route: string;
  canonicalPath: string;
  seo: {
    title: string;
    description: string;
    primaryKeyword: string;
    supportingKeywords: string[];
    robots: "index,follow" | "noindex,nofollow";
  };
  hero: {
    eyebrow: string;
    title: string;
    lede: string;
  };
  sections: AnswerPageSection[];
  conversion: {
    productTarget: ProductionBrief["productTarget"];
    primaryCta: string;
    secondaryCta: string;
  };
  tracking: {
    pageView: "page_view";
    engagement: "answer_engaged";
    primaryCtaEvent: "guide_cta_click" | "now_interest";
    secondaryCtaEvent: "mini_guide_click";
  };
  qualityGates: string[];
  researchTasks: string[];
};

function humanize(value: string) {
  return value
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function ledeFor(brief: ProductionBrief) {
  if (brief.productTarget === "PARIS_NOW") {
    return `A precise way to answer “${brief.primaryKeyword}” with useful live-context guidance before introducing Paris NOW.`;
  }
  return `A precise, useful answer to “${brief.primaryKeyword}” for travelers who want a more discreet side of Paris.`;
}

function descriptionFor(brief: ProductionBrief) {
  return `Discover ${brief.primaryKeyword} with a focused Velvet Passport answer built for travelers looking beyond generic Paris recommendations.`;
}

export function buildAnswerPageSpec(brief: ProductionBrief): AnswerPageSpec {
  if (brief.status === "HOLD") {
    return {
      id: `page:${brief.id}`,
      city: brief.city,
      theme: brief.theme,
      status: "HOLD",
      route: brief.proposedSlug,
      canonicalPath: brief.proposedSlug,
      seo: {
        title: `${brief.proposedTitle} | Velvet Passport`,
        description: descriptionFor(brief),
        primaryKeyword: brief.primaryKeyword,
        supportingKeywords: brief.supportingKeywords,
        robots: "noindex,nofollow",
      },
      hero: {
        eyebrow: "VELVET PASSPORT · PARIS",
        title: brief.proposedTitle,
        lede: ledeFor(brief),
      },
      sections: [],
      conversion: {
        productTarget: brief.productTarget,
        primaryCta: brief.primaryCta,
        secondaryCta: brief.secondaryCta,
      },
      tracking: {
        pageView: "page_view",
        engagement: "answer_engaged",
        primaryCtaEvent: brief.productTarget === "PARIS_NOW" ? "now_interest" : "guide_cta_click",
        secondaryCtaEvent: "mini_guide_click",
      },
      qualityGates: ["Production brief is HOLD; do not publish."],
      researchTasks: [],
    };
  }

  const researchTasks = [
    `Verify 5–7 real Paris discoveries that directly satisfy “${brief.primaryKeyword}”.`,
    "Verify names, addresses/locations, current access conditions and any time-sensitive details before publication.",
    "Confirm every factual claim from reliable current sources; do not fabricate hidden/secret status.",
    "Remove any location that is generic, overly touristy or does not fit the Velvet promise.",
  ];

  return {
    id: `page:${brief.id}`,
    city: brief.city,
    theme: brief.theme,
    status: "RESEARCH_REQUIRED",
    route: brief.proposedSlug,
    canonicalPath: brief.proposedSlug,
    seo: {
      title: `${brief.proposedTitle} | Velvet Passport`,
      description: descriptionFor(brief),
      primaryKeyword: brief.primaryKeyword,
      supportingKeywords: brief.supportingKeywords,
      robots: "noindex,nofollow",
    },
    hero: {
      eyebrow: "VELVET PASSPORT · PARIS",
      title: brief.proposedTitle,
      lede: ledeFor(brief),
    },
    sections: [
      {
        id: "direct-answer",
        label: "THE ANSWER",
        heading: `Where to find ${humanize(brief.theme)} in Paris`,
        purpose: "Answer the traveler intent immediately, before any product mention.",
        contentStatus: "RESEARCH_REQUIRED",
      },
      {
        id: "discoveries",
        label: "THE DISCOVERIES",
        heading: "Places worth knowing",
        purpose: "Present 5–7 specific verified discoveries with concise reasons each one fits the query.",
        contentStatus: "RESEARCH_REQUIRED",
      },
      {
        id: "how-to-use",
        label: "HOW TO USE THIS",
        heading: "Choose by atmosphere, time and location",
        purpose: "Help the traveler make a decision instead of delivering a generic listicle.",
        contentStatus: "GENERATED_SAFE",
      },
      {
        id: "velvet-difference",
        label: "THE VELVET DIFFERENCE",
        heading: "Go beyond the places everyone already knows",
        purpose: "Explain the Velvet selection logic without making unsupported claims.",
        contentStatus: "GENERATED_SAFE",
      },
      {
        id: "conversion",
        label: "CONTINUE THE DISCOVERY",
        heading: brief.productTarget === "PARIS_NOW" ? "Use Paris NOW" : "Continue with Paris Uncovered",
        purpose: "Provide the natural paid continuation only after the useful answer is complete.",
        contentStatus: "GENERATED_SAFE",
      },
    ],
    conversion: {
      productTarget: brief.productTarget,
      primaryCta: brief.primaryCta,
      secondaryCta: brief.secondaryCta,
    },
    tracking: {
      pageView: "page_view",
      engagement: "answer_engaged",
      primaryCtaEvent: brief.productTarget === "PARIS_NOW" ? "now_interest" : "guide_cta_click",
      secondaryCtaEvent: "mini_guide_click",
    },
    qualityGates: [
      "Do not publish until all RESEARCH_REQUIRED sections are sourced and reviewed.",
      "One canonical page per distinct search intent; merge near-duplicate keywords into supporting keywords.",
      "The first useful answer must appear before the first product CTA.",
      "No invented popularity, secrecy, local endorsement, opening hours, prices or access conditions.",
      "Keep exactly two conversion exits for Paris Uncovered Answer Pages unless product routing explicitly requires NOW.",
      "Track page_view, answer_engaged and CTA events.",
    ],
    researchTasks,
  };
}

export function buildPageFactoryQueue(briefs: ProductionBrief[]) {
  return briefs
    .filter((brief) => brief.assetType === "ANSWER_PAGE" || brief.assetType === "NOW_LANDING")
    .map(buildAnswerPageSpec)
    .sort((a, b) => {
      const order: Record<PageFactoryStatus, number> = {
        RESEARCH_REQUIRED: 0,
        PUBLISHABLE_STRUCTURE: 1,
        HOLD: 2,
      };
      return order[a.status] - order[b.status];
    });
}
