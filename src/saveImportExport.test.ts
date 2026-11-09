import { beforeEach, describe, expect, it } from 'vitest';
import { createInitialCampaign, readCampaignFromStorage } from './saveState';
import { importGameSave } from './saveImportExport';

const mockStorage: Record<string, string> = {};
beforeEach(() => {
  Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
  (globalThis as any).localStorage = {
    getItem: (k: string) => mockStorage[k] ?? null,
    setItem: (k: string, v: string) => { mockStorage[k] = v; },
    removeItem: (k: string) => { delete mockStorage[k]; },
    clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }
  } as Storage;
});

describe('saveImportExport round-trip', () => {
  it('exports and re-imports the same campaign state', () => {
    const campaign = createInitialCampaign({ fresh: true, week: 20, funds: 500000 });
    const json = JSON.stringify(campaign, null, 2);
    const imported = importGameSave(json);
    expect(imported).not.toBeNull();
    expect(imported!.campaignName).toBe(campaign.campaignName);
    expect(imported!.week).toBe(campaign.week);
    expect(imported!.funds).toBe(campaign.funds);
    expect(imported!.version).toBe(5);
  });

  it('migrates an old-schema import missing 0.6.8 event fields', () => {
    const oldSave = {
      ...createInitialCampaign({ fresh: true, week: 5 }),
      version: 4,
      eventHistory: undefined,
      eventCooldowns: undefined,
      deferredEventEffects: undefined,
      seenExpansionEventIds: undefined
    };
    const json = JSON.stringify(oldSave);
    const imported = importGameSave(json);
    expect(imported).not.toBeNull();
    expect(imported!.version).toBe(5);
    expect(imported!.eventHistory).toEqual([]);
    expect(imported!.eventCooldowns).toEqual({});
    expect(imported!.deferredEventEffects).toEqual([]);
    expect(imported!.seenExpansionEventIds).toEqual([]);
  });

  it('rejects a non-object payload', () => {
    expect(importGameSave('not json at all')).toBeNull();
    expect(importGameSave('42')).toBeNull();
    expect(importGameSave('null')).toBeNull();
    expect(importGameSave('[]')).toBeNull();
  });

  it('rejects a payload without campaignName', () => {
    expect(importGameSave(JSON.stringify({ version: 5, week: 1 }))).toBeNull();
  });
});

describe('readCampaignFromStorage guards', () => {
  it('returns null for corrupt JSON instead of throwing', () => {
    const key = 'emporium_save_slot_1';
    localStorage.setItem(key, '{ not valid json ');
    expect(readCampaignFromStorage(1)).toBeNull();
    localStorage.removeItem(key);
  });

  it('returns null for missing slot', () => {
    expect(readCampaignFromStorage(99)).toBeNull();
  });
});
