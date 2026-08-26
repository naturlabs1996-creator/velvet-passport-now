import { beforeEach, describe, expect, it, vi } from 'vitest';

const getLiveNeedChoices = vi.fn();

vi.mock('../lib/live-needs', () => ({
  getLiveNeedChoices,
}));

vi.mock('../lib/confidential-routes', () => ({
  getConfidentialRoutes: () => [{ id: 'route-a', zone: 'Louvre & Opéra' }],
}));

vi.mock('../lib/now-health-adapters', () => ({
  liveNeedsHealthSignal: () => ({ component: 'live_needs', status: 'green', reason: 'mock', fallbackAvailable: true }),
  walkingHealthSignal: () => ({ component: 'walking', status: 'green', reason: 'mock', fallbackAvailable: true }),
}));

vi.mock('../lib/now-health', () => ({
  summarizeNowHealth: () => ({ status: 'green', travelerSafe: true, signals: [] }),
}));

import { planComposableRequest } from '../lib/now-planner';

const base = {
  routeId: 'route-a',
  availableMinutes: 140,
  location: { lat: 48.86, lon: 2.34 },
  transport: { minutes: 10 },
  ticket: { protectedMarginMinutes: 15 },
};

function venue(overrides: Record<string, unknown> = {}) {
  return {
    id: 'v',
    name: 'Venue',
    detail: 'general',
    lat: 48.861,
    lon: 2.341,
    distanceMeters: 500,
    travelMinutes: 7,
    openStatus: 'open',
    ...overrides,
  };
}

describe('NOW Day 1 crash tests', () => {
  beforeEach(() => getLiveNeedChoices.mockReset());

  it('rejects a curated-first pharmacy that misses the hard deadline and selects the feasible one', async () => {
    getLiveNeedChoices.mockResolvedValueOnce([
      venue({ id: 'far', name: 'Curated Far Pharmacy', travelMinutes: 18 }),
      venue({ id: 'near', name: 'Near Pharmacy', travelMinutes: 5 }),
    ]);
    const result = await planComposableRequest({
      ...base,
      needs: [{ type: 'pharmacy', withinMinutes: 30 }],
    } as any);
    expect(result.needs[0].selected?.id).toBe('near');
    expect(result.needs[0].deadlineProtected).toBe(true);
    expect(result.ticketProtected).toBe(true);
  });

  it('fails closed when no pharmacy can meet the deadline', async () => {
    getLiveNeedChoices.mockResolvedValueOnce([
      venue({ id: 'too-far', travelMinutes: 25 }),
    ]);
    const result = await planComposableRequest({
      ...base,
      needs: [{ type: 'pharmacy', withinMinutes: 30 }],
    } as any);
    expect(result.needs[0].selected).toBeNull();
    expect(result.needs[0].timeFeasible).toBe(false);
    expect(result.ticketProtected).toBe(false);
  });

  it('does not substitute another cuisine when Chinese is unavailable', async () => {
    getLiveNeedChoices.mockResolvedValueOnce([
      venue({ id: 'italian', name: 'Trattoria Roma', detail: 'Italian pasta' }),
    ]);
    const result = await planComposableRequest({
      ...base,
      needs: [{ type: 'food', cuisine: 'chinese' }],
    } as any);
    expect(result.needs[0].selected).toBeNull();
    expect(result.needs[0].preferenceMatched).toBe(false);
    expect(result.factors.some((f: string) => f.includes('no substitute presented'))).toBe(true);
  });

  it('drops unsafe food when the protected time budget is too tight', async () => {
    getLiveNeedChoices.mockResolvedValueOnce([
      venue({ id: 'food', name: 'Sichuan House', detail: 'Chinese Sichuan', travelMinutes: 12 }),
    ]);
    const result = await planComposableRequest({
      ...base,
      availableMinutes: 65,
      needs: [{ type: 'food', cuisine: 'chinese' }],
    } as any);
    expect(result.needs[0].selected).toBeNull();
    expect(result.needs[0].timeFeasible).toBe(false);
    expect(result.ticketProtected).toBe(false);
  });

  it('keeps a feasible pharmacy + Chinese meal while preserving the ticket margin', async () => {
    getLiveNeedChoices
      .mockResolvedValueOnce([
        venue({ id: 'pharmacy', name: 'Pharmacy', travelMinutes: 4 }),
      ])
      .mockResolvedValueOnce([
        venue({ id: 'chinese', name: 'Sichuan House', detail: 'Chinese Sichuan', travelMinutes: 6 }),
      ]);
    const result = await planComposableRequest({
      ...base,
      needs: [
        { type: 'pharmacy', withinMinutes: 30 },
        { type: 'food', cuisine: 'chinese' },
      ],
    } as any);
    expect(result.needs[0].selected?.id).toBe('pharmacy');
    expect(result.needs[1].selected?.id).toBe('chinese');
    expect(result.ticketProtected).toBe(true);
    expect(result.remainingMinutes).toBeGreaterThanOrEqual(15);
  });
});
