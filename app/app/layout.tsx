import type { ReactNode } from "react";
import GuardianOfflineFallback from "./GuardianOfflineFallback";
import RainAheadPrompt from "./RainAheadPrompt";
import RouteReliabilityGuard from "./RouteReliabilityGuard";

export default function ParisNowLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <GuardianOfflineFallback />
      <RouteReliabilityGuard />
      <RainAheadPrompt />
      {children}
    </>
  );
}
