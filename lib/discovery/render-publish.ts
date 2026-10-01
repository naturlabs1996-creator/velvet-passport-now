import type { AssembledAnswerPage } from "./page-assembly";

export type RenderMode = "PREVIEW" | "PUBLIC" | "BLOCKED";
export type PublishDecision = "PUBLISH_ALLOWED" | "PREVIEW_ONLY" | "BLOCKED";

export type RenderSection = {
  id: string;
  label: string;
  heading: string;
  body: string[];
};

export type RenderManifest = {
  pageId: string;
  route: string;
  canonicalPath: string;
  mode: RenderMode;
  publishDecision: PublishDecision;
  seo: {
    title: string;
    description: string;
    canonicalPath: string;
    robots: "index,follow" | "noindex,nofollow";
  };
  hero: AssembledAnswerPage["hero"];
  sections: RenderSection[];
  discoveries: AssembledAnswerPage["discoveries"];
  conversion: AssembledAnswerPage["conversion"];
  tracking: AssembledAnswerPage["tracking"];
  sourceAudit: AssembledAnswerPage["sourceAudit"];
  blockers: string[];
  publicationChecks: {
    assemblyReady: boolean;
    fiveReadyDiscoveries: boolean;
    sourceAuditPresent: boolean;
    indexAllowed: boolean;
  };
};

function readyDiscoveryCount(page: AssembledAnswerPage) {
  return page.discoveries.filter((item) => item.copyStatus === "READY").length;
}

export function buildRenderManifest(page: AssembledAnswerPage): RenderManifest {
  const assemblyReady = page.status === "READY_TO_RENDER";
  const fiveReadyDiscoveries = readyDiscoveryCount(page) >= 5;
  const sourceAuditPresent = page.sourceAudit.length > 0;
  const indexAllowed = assemblyReady && fiveReadyDiscoveries && sourceAuditPresent && page.robots === "index,follow";

  let mode: RenderMode = "PREVIEW";
  let publishDecision: PublishDecision = "PREVIEW_ONLY";
  const blockers = [...page.blockers];

  if (page.status === "HOLD") {
    mode = "BLOCKED";
    publishDecision = "BLOCKED";
    blockers.push("ASSEMBLY_HOLD");
  } else if (indexAllowed) {
    mode = "PUBLIC";
    publishDecision = "PUBLISH_ALLOWED";
  } else {
    if (!assemblyReady) blockers.push("ASSEMBLY_NOT_READY_TO_RENDER");
    if (!fiveReadyDiscoveries) blockers.push("FEWER_THAN_5_READY_DISCOVERIES");
    if (!sourceAuditPresent) blockers.push("SOURCE_AUDIT_MISSING");
    if (page.robots !== "index,follow") blockers.push("INDEX_GATE_CLOSED");
  }

  const robots: "index,follow" | "noindex,nofollow" = publishDecision === "PUBLISH_ALLOWED"
    ? "index,follow"
    : "noindex,nofollow";

  return {
    pageId: page.pageId,
    route: page.route,
    canonicalPath: page.canonicalPath,
    mode,
    publishDecision,
    seo: {
      title: page.seo.title,
      description: page.seo.description,
      canonicalPath: page.canonicalPath,
      robots,
    },
    hero: page.hero,
    sections: page.sections.map((section) => ({
      id: section.id,
      label: section.label,
      heading: section.heading,
      body: section.body ?? [],
    })),
    discoveries: page.discoveries,
    conversion: page.conversion,
    tracking: page.tracking,
    sourceAudit: page.sourceAudit,
    blockers: [...new Set(blockers)],
    publicationChecks: {
      assemblyReady,
      fiveReadyDiscoveries,
      sourceAuditPresent,
      indexAllowed,
    },
  };
}

export function buildRenderPublishPortfolio(pages: AssembledAnswerPage[]) {
  return pages.map(buildRenderManifest);
}

export function canPublishManifest(manifest: RenderManifest) {
  return manifest.publishDecision === "PUBLISH_ALLOWED"
    && manifest.mode === "PUBLIC"
    && manifest.seo.robots === "index,follow"
    && manifest.publicationChecks.indexAllowed;
}
