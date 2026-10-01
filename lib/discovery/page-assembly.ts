import type { AnswerPageSpec } from "./page-factory";
import type { SafeDiscoveryCopy } from "./safe-copy-composer";
import type { PageVerificationResult } from "./research-verification";

export type AssemblyStatus = "READY_TO_RENDER" | "DRAFT_NO_INDEX" | "HOLD";

export type AssemblySourceRef = {
  id: string;
  url: string;
};

export type AssemblyDiscovery = {
  candidateId: string;
  name: string;
  summary: string[];
  facts: string[];
  sources: AssemblySourceRef[];
  copyStatus: SafeDiscoveryCopy["status"];
};

export type AssembledAnswerPage = {
  pageId: string;
  theme: string;
  route: string;
  canonicalPath: string;
  status: AssemblyStatus;
  robots: "index,follow" | "noindex,nofollow";
  seo: AnswerPageSpec["seo"];
  hero: AnswerPageSpec["hero"];
  discoveries: AssemblyDiscovery[];
  sections: Array<{
    id: string;
    label: string;
    heading: string;
    purpose: string;
    contentStatus: "FILLED_VERIFIED" | "GENERATED_SAFE" | "RESEARCH_REQUIRED";
    body?: string[];
  }>;
  conversion: AnswerPageSpec["conversion"];
  tracking: AnswerPageSpec["tracking"];
  sourceAudit: AssemblySourceRef[];
  blockers: string[];
  qualityNotes: string[];
};

function uniqueSources(copy: SafeDiscoveryCopy): AssemblySourceRef[] {
  const byUrl = new Map<string, AssemblySourceRef>();
  for (const sentence of [...copy.summary, ...copy.facts]) {
    sentence.sourceUrls.forEach((url, index) => {
      const id = sentence.sourceIds[index] ?? sentence.sourceIds[0] ?? url;
      if (!byUrl.has(url)) byUrl.set(url, { id, url });
    });
  }
  return [...byUrl.values()];
}

function safeDiscovery(copy: SafeDiscoveryCopy): AssemblyDiscovery {
  return {
    candidateId: copy.candidateId,
    name: copy.name,
    summary: copy.summary.map((item) => item.text),
    facts: copy.facts.map((item) => item.text),
    sources: uniqueSources(copy),
    copyStatus: copy.status,
  };
}

function generatedBody(sectionId: string, page: AnswerPageSpec) {
  if (sectionId === "how-to-use") {
    return [
      "Choose the discovery that best fits your available time, location and preferred atmosphere.",
      "Re-check time-sensitive access details before setting out.",
    ];
  }
  if (sectionId === "velvet-difference") {
    return [
      "Velvet Passport prioritizes specific, useful discoveries over generic lists and keeps unsupported claims out of the published answer.",
    ];
  }
  if (sectionId === "conversion") {
    return [
      page.conversion.productTarget === "PARIS_NOW"
        ? "If you want the next step adapted to the moment, continue with Paris NOW."
        : "If you want to continue beyond this answer, explore Paris Uncovered.",
    ];
  }
  return [];
}

export function assembleAnswerPage(
  page: AnswerPageSpec,
  safeCopies: SafeDiscoveryCopy[],
  verification?: PageVerificationResult,
): AssembledAnswerPage {
  if (page.status === "HOLD") {
    return {
      pageId: page.id,
      theme: page.theme,
      route: page.route,
      canonicalPath: page.canonicalPath,
      status: "HOLD",
      robots: "noindex,nofollow",
      seo: { ...page.seo, robots: "noindex,nofollow" },
      hero: page.hero,
      discoveries: [],
      sections: [],
      conversion: page.conversion,
      tracking: page.tracking,
      sourceAudit: [],
      blockers: ["PAGE_FACTORY_HOLD"],
      qualityNotes: ["Assembly halted because the Page Factory placed this asset on HOLD."],
    };
  }

  const usableCopies = safeCopies.filter((copy) => copy.status === "READY" || copy.status === "PARTIAL");
  const readyCopies = usableCopies.filter((copy) => copy.status === "READY");
  const discoveries = usableCopies.map(safeDiscovery);
  const sourceAudit = [...new Map(discoveries.flatMap((item) => item.sources).map((source) => [source.url, source])).values()];
  const blockers: string[] = [];

  const verificationPublishable = verification?.status === "PUBLISHABLE";
  if (!verificationPublishable) blockers.push(...(verification?.unresolvedRequirements ?? ["PAGE_VERIFICATION_NOT_PUBLISHABLE"]));
  if (readyCopies.length < 5) blockers.push("MINIMUM_5_READY_SAFE_COPY_DISCOVERIES");
  if (!sourceAudit.length) blockers.push("NO_SOURCE_AUDIT_TRAIL");

  const status: AssemblyStatus = verificationPublishable && readyCopies.length >= 5 && sourceAudit.length
    ? "READY_TO_RENDER"
    : "DRAFT_NO_INDEX";
  const robots = status === "READY_TO_RENDER" ? "index,follow" : "noindex,nofollow";

  const directAnswerBody = readyCopies.slice(0, 3).flatMap((copy) => copy.summary.map((item) => item.text));
  const discoveryBody = discoveries.flatMap((item) => [item.name, ...item.summary, ...item.facts]);

  const sections = page.sections.map((section) => {
    if (section.id === "direct-answer") {
      return {
        ...section,
        contentStatus: directAnswerBody.length ? "FILLED_VERIFIED" as const : "RESEARCH_REQUIRED" as const,
        body: directAnswerBody,
      };
    }
    if (section.id === "discoveries") {
      return {
        ...section,
        contentStatus: discoveryBody.length ? "FILLED_VERIFIED" as const : "RESEARCH_REQUIRED" as const,
        body: discoveryBody,
      };
    }
    return {
      ...section,
      contentStatus: "GENERATED_SAFE" as const,
      body: generatedBody(section.id, page),
    };
  });

  return {
    pageId: page.id,
    theme: page.theme,
    route: page.route,
    canonicalPath: page.canonicalPath,
    status,
    robots,
    seo: { ...page.seo, robots },
    hero: page.hero,
    discoveries,
    sections,
    conversion: page.conversion,
    tracking: page.tracking,
    sourceAudit,
    blockers: [...new Set(blockers)],
    qualityNotes: [
      "Only Safe Copy Composer output is allowed into factual discovery sections.",
      "Every assembled factual sentence remains traceable to source IDs and URLs.",
      "Indexing opens only when the Research Verification gate is PUBLISHABLE and at least five READY safe-copy discoveries exist.",
      "CTA and tracking configuration are inherited from the Page Factory spec without modification.",
    ],
  };
}

export function buildPageAssemblyPortfolio(
  pages: AnswerPageSpec[],
  inputs: Array<{
    pageId: string;
    safeCopies: SafeDiscoveryCopy[];
    verification?: PageVerificationResult;
  }>,
) {
  return pages.map((page) => {
    const input = inputs.find((item) => item.pageId === page.id);
    return assembleAnswerPage(page, input?.safeCopies ?? [], input?.verification);
  });
}
