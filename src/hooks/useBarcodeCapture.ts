import { useCallback, useEffect, useRef } from "react";
import type { KeyboardEvent } from "react";
import { isScanTerminator, normalizeScanCode } from "./useBarcodeScanner";

type UseBarcodeCaptureOptions = {
  onScan: (code: string) => void;
  isPaused?: () => boolean;
};

export function useBarcodeCapture({ onScan, isPaused }: UseBarcodeCaptureOptions) {
  const scanInputRef = useRef<HTMLInputElement>(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const shouldRefocusScanner = useCallback(() => {
    if (isPaused?.()) return false;
    const active = document.activeElement;
    if (!active) return true;
    if (active === scanInputRef.current) return false;
    return !active.closest("[data-manual-input]");
  }, [isPaused]);

  const focusScannerCapture = useCallback(() => {
    scanInputRef.current?.focus();
  }, []);

  const handleCaptureBlur = useCallback(() => {
    window.setTimeout(() => {
      if (shouldRefocusScanner()) scanInputRef.current?.focus();
    }, 80);
  }, [shouldRefocusScanner]);

  const processScanFromInput = useCallback((
    event: KeyboardEvent<HTMLInputElement>,
    onAfterScan?: () => void,
  ) => {
    if (!isScanTerminator(event.key)) return;

    const code = normalizeScanCode(event.currentTarget.value);
    if (!code) return;

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.value = "";
    onAfterScan?.();
    onScanRef.current(code);
  }, []);

  const handleCaptureKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    processScanFromInput(event);
  }, [processScanFromInput]);

  const handleSearchKeyDown = useCallback((
    event: KeyboardEvent<HTMLInputElement>,
    clearSearch: () => void,
  ) => {
    processScanFromInput(event, clearSearch);
  }, [processScanFromInput]);

  useEffect(() => {
    const refocus = () => {
      if (shouldRefocusScanner()) scanInputRef.current?.focus();
    };

    refocus();
    const timer = window.setInterval(refocus, 600);
    const onVisibility = () => {
      if (document.visibilityState === "visible") refocus();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", refocus);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", refocus);
    };
  }, [shouldRefocusScanner]);

  return {
    scanInputRef,
    handleCaptureKeyDown,
    handleCaptureBlur,
    focusScannerCapture,
    handleSearchKeyDown,
  };
}
