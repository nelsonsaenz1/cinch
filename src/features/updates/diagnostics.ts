import Constants from 'expo-constants';
import * as Updates from 'expo-updates';

import { shortUpdateIdentity } from './policy';

export type UpdateDiagnostic = { label: string; value: string };

export function updateDiagnostics(): UpdateDiagnostic[] {
  return [
    { label: 'Build', value: Constants.expoConfig?.ios?.buildNumber ?? 'Development' },
    { label: 'Update channel', value: Updates.channel || 'None' },
    { label: 'Runtime', value: shortUpdateIdentity(Updates.runtimeVersion, 'Unknown') },
    {
      label: 'Running update',
      value: Updates.isEmbeddedLaunch
        ? 'Embedded in build'
        : shortUpdateIdentity(Updates.updateId, 'Unknown'),
    },
    { label: 'Updates', value: Updates.isEnabled ? 'Enabled' : 'Disabled' },
  ];
}
