import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { Permissions } from '../../modules/permissions/src';
import { areCorePermissionsReady } from '../domain';

export type PermissionKey = 'accessibility' | 'overlay' | 'batteryOptimization';
export type PermissionStatuses = Record<PermissionKey, boolean>;

const initialStatuses: PermissionStatuses = {
  accessibility: false,
  overlay: false,
  batteryOptimization: false,
};

export const usePermissions = () => {
  const [statuses, setStatuses] = useState(initialStatuses);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [accessibility, overlay, batteryOptimization] = await Promise.all([
        Permissions.checkAccessibility(),
        Permissions.checkOverlay(),
        Permissions.checkBatteryOptimization(),
      ]);
      setStatuses({ accessibility, overlay, batteryOptimization });
    } catch (error) {
      console.error('Permission status check failed:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  const request = useCallback(
    async (key: PermissionKey) => {
      try {
        if (key === 'accessibility') await Permissions.requestAccessibility();
        if (key === 'overlay') await Permissions.requestOverlay();
        if (key === 'batteryOptimization') await Permissions.requestBatteryOptimization();
        await refresh();
      } catch (error) {
        console.error('Permission request failed:', error);
      }
    },
    [refresh]
  );

  return useMemo(
    () => ({
      statuses,
      loading,
      coreReady: areCorePermissionsReady(statuses),
      refresh,
      request,
    }),
    [statuses, loading, refresh, request]
  );
};
