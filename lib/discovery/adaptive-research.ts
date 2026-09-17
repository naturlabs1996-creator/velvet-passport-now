import type { ResearchPacket } from "./research-verification";
import { collectResearchPacket } from "./research-collectors";
import type { AdaptiveTargetBudget } from "./adaptive-budget";

export async function collectAdaptiveResearchQueue(
  packets: ResearchPacket[],
  budgets: AdaptiveTargetBudget[],
  maxPackets = 5,
) {
  const ranked = [...packets]
    .map((packet) => ({
      packet,
      budget: budgets.find((item) => item.theme === packet.theme),
    }))
    .sort((a, b) => (b.budget?.priorityScore ?? 0) - (a.budget?.priorityScore ?? 0))
    .slice(0, Math.max(1, Math.min(maxPackets, 5)));

  const collections: Awaited<ReturnType<typeof collectResearchPacket>>[] = [];
  let cursor = 0;

  while (cursor < ranked.length) {
    const current = ranked[cursor];
    const tierConcurrency = current.budget?.research.concurrency ?? 1;
    const batchSize = Math.max(1, Math.min(tierConcurrency ?? 1, 4));
    const batch = ranked.slice(cursor, cursor + batchSize);

    const results = await Promise.all(batch.map(({ packet, budget }) =>
      collectResearchPacket(packet, budget?.research ?? { maxCollectorsPerPacket: 2, maxLeadsPerCollector: 4, concurrency: 1 })
    ));
    collections.push(...results);
    cursor += batch.length;
  }

  return collections;
}
