import { useEffect, useState } from "react";

/**
 * Text-to-speech support check.
 *
 * Browsers ship very few Pashto or Dari voices. Speaking Pashto text with an
 * English voice produces unintelligible audio, so the Listen button is only
 * offered when the device exposes a voice that really matches the page
 * language. `getVoices()` is empty until the browser has loaded its voice list
 * (Chrome fills it asynchronously and signals `voiceschanged`), so the list is
 * re-read on that event.
 */
export type SpeechLocale = "en" | "ps" | "fa";

/** Language tags to accept, best match first. Trailing "*" means any subtag. */
const VOICE_PREFERENCES: Record<SpeechLocale, string[]> = {
  en: ["en-us", "en-gb", "en*"],
  // Pashto: ps, ps-AF, ps-PK, and the ISO 639-3 code pus.
  ps: ["ps-af", "ps*", "pus*"],
  // Dari: fa-AF, prs (ISO 639-3), then generic Persian as the closest fallback.
  fa: ["fa-af", "prs*", "fa*"],
};

/** BCP-47 tag used for the utterance language when a voice is chosen. */
export const SPEECH_LANG: Record<SpeechLocale, string> = {
  en: "en-US",
  ps: "ps-AF",
  fa: "fa-AF",
};

type VoiceLike = Pick<SpeechSynthesisVoice, "lang" | "name"> & Partial<SpeechSynthesisVoice>;

function normalise(lang: string): string {
  return lang.trim().toLowerCase().replace(/_/g, "-");
}

function matches(lang: string, pattern: string): boolean {
  const tag = normalise(lang);
  if (pattern.endsWith("*")) {
    const base = pattern.slice(0, -1);
    return tag === base || tag.startsWith(`${base}-`);
  }
  return tag === pattern;
}

/** Pure matcher so it can be unit tested without a browser. */
export function pickVoice<T extends VoiceLike>(voices: readonly T[], locale: SpeechLocale): T | null {
  for (const pattern of VOICE_PREFERENCES[locale]) {
    const found = voices.find(voice => matches(voice.lang ?? "", pattern));
    if (found) return found;
  }
  return null;
}

export type SpeechSupport = {
  /** True once the browser has told us what voices exist. */
  ready: boolean;
  /** Voice to use, or null when the device has none for this language. */
  voice: SpeechSynthesisVoice | null;
  /** The Listen button should be rendered only when this is true. */
  available: boolean;
};

const SETTLE_MS = 1500;

export function useSpeechSupport(locale: SpeechLocale): SpeechSupport {
  const [state, setState] = useState<SpeechSupport>({ ready: false, voice: null, available: false });

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
      setState({ ready: true, voice: null, available: false });
      return;
    }
    const synth = window.speechSynthesis;
    let settled = false;

    const evaluate = (final: boolean) => {
      const voices = synth.getVoices();
      const voice = pickVoice(voices, locale);
      // Some browsers expose a working default English voice but an empty list.
      const englishDefault = locale === "en" && voices.length === 0 && final;
      if (voice || englishDefault || final) settled = true;
      setState({ ready: settled, voice, available: Boolean(voice) || englishDefault });
    };

    evaluate(false);
    const onChange = () => evaluate(false);
    synth.addEventListener?.("voiceschanged", onChange);
    // Browsers that never fire voiceschanged (or have no voices at all) settle here.
    const timer = window.setTimeout(() => evaluate(true), SETTLE_MS);
    return () => {
      window.clearTimeout(timer);
      synth.removeEventListener?.("voiceschanged", onChange);
    };
  }, [locale]);

  return state;
}
