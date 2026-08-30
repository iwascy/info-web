"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { SWRConfig, useSWRConfig } from "swr";

const ENABLED_KEY = "opspilot_auto_refresh";
const INTERVAL_KEY = "opspilot_refresh_seconds";
const DEFAULT_INTERVAL_SECONDS = 30;

type RefreshContextValue = {
  enabled: boolean;
  intervalSeconds: number;
  setEnabled: (enabled: boolean) => void;
  setIntervalSeconds: (seconds: number) => void;
};

const RefreshContext = createContext<RefreshContextValue | null>(null);

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabledState] = useState(true);
  const [intervalSeconds, setIntervalSecondsState] = useState(DEFAULT_INTERVAL_SECONDS);

  useEffect(() => {
    const storedEnabled = window.localStorage.getItem(ENABLED_KEY);
    const storedInterval = Number(window.localStorage.getItem(INTERVAL_KEY));
    if (storedEnabled != null) setEnabledState(storedEnabled !== "false");
    if ([10, 30, 60, 300].includes(storedInterval)) setIntervalSecondsState(storedInterval);
  }, []);

  const value = useMemo<RefreshContextValue>(
    () => ({
      enabled,
      intervalSeconds,
      setEnabled(next) {
        setEnabledState(next);
        window.localStorage.setItem(ENABLED_KEY, String(next));
      },
      setIntervalSeconds(next) {
        setIntervalSecondsState(next);
        window.localStorage.setItem(INTERVAL_KEY, String(next));
      }
    }),
    [enabled, intervalSeconds]
  );

  return (
    <RefreshContext.Provider value={value}>
      <SWRConfig
        value={{
          refreshInterval: enabled ? intervalSeconds * 1000 : 0,
          revalidateOnFocus: enabled,
          keepPreviousData: true
        }}
      >
        {children}
      </SWRConfig>
    </RefreshContext.Provider>
  );
}

export function useRefreshSettings() {
  const value = useContext(RefreshContext);
  if (!value) throw new Error("useRefreshSettings must be used inside AppProviders");
  return value;
}

export function useRefreshNow() {
  const { mutate } = useSWRConfig();
  return () => mutate(() => true, undefined, { revalidate: true });
}
