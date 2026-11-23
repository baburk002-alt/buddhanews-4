import { describe, expect, it } from "vitest";
import { pickVoice } from "../client/src/lib/speechVoices";

const v = (lang: string, name = lang) => ({ lang, name });

describe("TTS voice selection (item 12)", () => {
  it("finds no Pashto or Dari voice among English-only voices", () => {
    const voices = [v("en-US"), v("en-GB"), v("fr-FR")];
    expect(pickVoice(voices, "ps")).toBeNull();
    expect(pickVoice(voices, "fa")).toBeNull();
    expect(pickVoice(voices, "en")?.lang).toBe("en-US");
  });

  it("matches Pashto voices", () => {
    expect(pickVoice([v("en-US"), v("ps-AF")], "ps")?.lang).toBe("ps-AF");
    expect(pickVoice([v("ps_PK")], "ps")?.lang).toBe("ps_PK");
    expect(pickVoice([v("ps")], "ps")?.lang).toBe("ps");
  });

  it("prefers Dari voices, then falls back to generic Persian", () => {
    expect(pickVoice([v("fa-IR"), v("fa-AF")], "fa")?.lang).toBe("fa-AF");
    expect(pickVoice([v("fa-IR"), v("prs-AF")], "fa")?.lang).toBe("prs-AF");
    expect(pickVoice([v("fa-IR")], "fa")?.lang).toBe("fa-IR");
  });

  it("does not confuse similar prefixes", () => {
    // "pl", "pt", "fi" and "fr" must not satisfy "ps" or "fa".
    expect(pickVoice([v("pl-PL"), v("pt-BR"), v("fi-FI"), v("fr-FR"), v("fil-PH")], "ps")).toBeNull();
    expect(pickVoice([v("pl-PL"), v("pt-BR"), v("fi-FI"), v("fr-FR"), v("fil-PH")], "fa")).toBeNull();
  });
});
