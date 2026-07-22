import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "@/types/settings";

describe("Lightbox Settings Defaults", () => {
  it("defines default values for all lightbox fields in DEFAULT_SETTINGS", () => {
    expect(DEFAULT_SETTINGS.app.lightboxFitMode).toBe("fitBoth");
    expect(DEFAULT_SETTINGS.app.lightboxZoomMin).toBe(25);
    expect(DEFAULT_SETTINGS.app.lightboxZoomMax).toBe(500);
    expect(DEFAULT_SETTINGS.app.lightboxZoomStep).toBe(25);
    expect(DEFAULT_SETTINGS.app.lightboxAutoHideControls).toBe(false);
    expect(DEFAULT_SETTINGS.app.lightboxAutoHideDelay).toBe(3);
  });
});
