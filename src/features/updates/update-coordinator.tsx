import * as Updates from 'expo-updates';
import { useCallback, useEffect, useRef } from 'react';
import { Alert, AppState, type AppStateStatus } from 'react-native';

import { track } from '@/lib/posthog';

import {
  LAUNCH_CHECK_DELAY_MS,
  shouldCheckForUpdate,
  updateFailureReason,
  type UpdateFailureStage,
  type UpdateTrigger,
} from './policy';

/**
 * Finds compatible EAS updates without interrupting somebody mid-task.
 * The native ON_LOAD check remains the fast path; this supplies foreground
 * checks and the missing prompt that lets a downloaded bundle run immediately.
 */
export function UpdateCoordinator() {
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const checking = useRef(false);
  const lastCheckedAt = useRef<number | null>(null);
  const promptVisible = useRef(false);

  const recordFailure = useCallback((stage: UpdateFailureStage, error: unknown) => {
    track('update_failed', { stage, reason: updateFailureReason(error) });
  }, []);

  const reload = useCallback(async () => {
    track('update_reload_requested');
    try {
      await Updates.reloadAsync();
    } catch (error) {
      recordFailure('reload', error);
    }
  }, [recordFailure]);

  const offerRestart = useCallback(() => {
    if (promptVisible.current) return;
    promptVisible.current = true;
    Alert.alert(
      'Update ready',
      'Restart Cinch now to use the latest version.',
      [
        {
          text: 'Later',
          style: 'cancel',
          onPress: () => {
            promptVisible.current = false;
          },
        },
        {
          text: 'Restart now',
          onPress: () => {
            promptVisible.current = false;
            void reload();
          },
        },
      ],
      {
        cancelable: true,
        onDismiss: () => {
          promptVisible.current = false;
        },
      },
    );
  }, [reload]);

  const check = useCallback(
    async (trigger: UpdateTrigger) => {
      if (__DEV__ || !Updates.isEnabled) return;
      const now = Date.now();
      if (
        !shouldCheckForUpdate({
          now,
          lastCheckedAt: lastCheckedAt.current,
          inFlight: checking.current,
        })
      ) {
        return;
      }

      checking.current = true;
      lastCheckedAt.current = now;
      track('update_check_started', { trigger });

      try {
        const result = await Updates.checkForUpdateAsync();
        track('update_check_finished', {
          trigger,
          result: result.isAvailable ? 'available' : 'current',
        });
        if (!result.isAvailable) return;

        try {
          await Updates.fetchUpdateAsync();
          track('update_downloaded', { trigger });
          offerRestart();
        } catch (error) {
          recordFailure('download', error);
        }
      } catch (error) {
        recordFailure('check', error);
      } finally {
        checking.current = false;
      }
    },
    [offerRestart, recordFailure],
  );

  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled) return;

    const launchTimer = setTimeout(() => {
      void check('launch');
    }, LAUNCH_CHECK_DELAY_MS);
    const subscription = AppState.addEventListener('change', (next) => {
      const wasBackgrounded = appState.current === 'background' || appState.current === 'inactive';
      appState.current = next;
      if (next === 'active' && wasBackgrounded) void check('foreground');
    });

    return () => {
      clearTimeout(launchTimer);
      subscription.remove();
    };
  }, [check]);

  return null;
}
