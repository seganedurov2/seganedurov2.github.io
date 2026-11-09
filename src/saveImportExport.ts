import type { ManagedCampaignState } from './saveState';
import { migrateCampaignState } from './saveState';

/**
 * Exports the current game state to a JSON file.
 */
export function exportGameSave(state: ManagedCampaignState, fileName: string = 'emporium_save.json'): void {
  const data = JSON.stringify(state, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Imports a game state from a JSON file.
 * Runs the data through `migrateCampaignState` so old-schema saves are
 * normalized to the current version before being accepted.
 * Returns the migrated state or null if validation fails.
 */
export function importGameSave(fileContent: string): ManagedCampaignState | null {
  try {
    const parsed = JSON.parse(fileContent);
    if (!parsed || typeof parsed !== 'object' || !parsed.campaignName) {
      throw new Error('Invalid save file format.');
    }
    const migrated = migrateCampaignState(parsed);
    return migrated as ManagedCampaignState;
  } catch (e) {
    console.error('Failed to import game save:', e);
    return null;
  }
}
