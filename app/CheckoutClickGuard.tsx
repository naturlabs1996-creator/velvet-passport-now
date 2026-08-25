"use client";

import { useEffect } from "react";

const BUY_BUTTON = /^BUY (72-HOUR|7-DAY) PASS/i;
const RESET_AFTER_MS = 12000;

export default function CheckoutClickGuard() {
  useEffect(() => {
    let locked = false;
    let resetTimer: number | null = null;

    const unlock = () => {
      locked = false;
      if (resetTimer !== null) {
        window.clearTimeout(resetTimer);
        resetTimer = null;
      }
    };

    const onClickCapture = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest("button");
      if (!button || !BUY_BUTTON.test(button.textContent?.trim() ?? "")) return;

      if (locked) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        return;
      }

      locked = true;
      resetTimer = window.setTimeout(unlock, RESET_AFTER_MS);
    };

    document.addEventListener("click", onClickCapture, true);
    window.addEventListener("pageshow", unlock);

    return () => {
      document.removeEventListener("click", onClickCapture, true);
      window.removeEventListener("pageshow", unlock);
      if (resetTimer !== null) window.clearTimeout(resetTimer);
    };
  }, []);

  return null;
}
