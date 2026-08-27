import type { ReactNode } from "react";
import GuardianOfflineFallback from "./GuardianOfflineFallback";
import RainAheadPrompt from "./RainAheadPrompt";

export default function ParisNowLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <GuardianOfflineFallback />
      <RainAheadPrompt />
      {children}
    </>
  );
}
