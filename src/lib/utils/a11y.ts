import type React from "react";

/**
 * A helper to handle keyboard activation (Enter or Space) for non-interactive elements
 * made interactive via ARIA roles.
 */
export function handleKeyActivate(handler: () => void) {
  return (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handler();
    }
  };
}
