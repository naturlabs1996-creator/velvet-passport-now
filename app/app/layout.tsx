import type { ReactNode } from "react";
import RainAheadPrompt from "./RainAheadPrompt";

export default function ParisNowLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <RainAheadPrompt />
      {children}
    </>
  );
}
