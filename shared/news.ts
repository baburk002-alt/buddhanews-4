/**
 * Code-owned news taxonomy.
 *
 * The original preview used one flat dictionary where "economy" appeared under
 * both Business and Opinions and "society" was attached to Art & Culture. That
 * made filters ambiguous. Here every subcategory key is scoped to exactly one
 * parent category, and labels carry all three newsroom languages.
 */

export type Locale = "en" | "ps" | "fa";

export type LocalizedText = Record<Locale, string>;

export const LOCALES: Array<{
  code: Locale;
  label: string;
  english: string;
  dir: "ltr" | "rtl";
  htmlLang: string;
}> = [
  { code: "en", label: "English", english: "English", dir: "ltr", htmlLang: "en" },
  { code: "ps", label: "پښتو", english: "Pashto", dir: "rtl", htmlLang: "ps" },
  { code: "fa", label: "دری", english: "Dari", dir: "rtl", htmlLang: "fa-AF" },
];

export const DEFAULT_LOCALE: Locale = "en";

export function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "ps" || value === "fa";
}

export function localeDir(locale: Locale): "ltr" | "rtl" {
  return locale === "en" ? "ltr" : "rtl";
}

export function localeHtmlLang(locale: Locale): string {
  return locale === "en" ? "en" : locale === "ps" ? "ps" : "fa-AF";
}

export type Subcategory = {
  key: string;
  label: LocalizedText;
};

export type Category = {
  key: string;
  label: LocalizedText;
  description: LocalizedText;
  accent: string;
  subcategories: Subcategory[];
};

export const CATEGORIES: Category[] = [
  {
    key: "afghanistan",
    label: { en: "Afghanistan", ps: "افغانستان", fa: "افغانستان" },
    description: {
      en: "Reporting from inside the country and the diaspora, with human rights at the centre.",
      ps: "له هېواده او بهر مېشتو افغانانو راپورونه، چې بشري حقوق په مرکز کې دي.",
      fa: "گزارش از داخل کشور و دیاسپورا، با محوریت حقوق بشر.",
    },
    accent: "#E9A23B",
    subcategories: [
      { key: "human-rights", label: { en: "Human Rights", ps: "بشري حقوق", fa: "حقوق بشر" } },
      { key: "security", label: { en: "Security", ps: "امنیت", fa: "امنیت" } },
      { key: "immigration", label: { en: "Immigration", ps: "مهاجرت", fa: "مهاجرت" } },
      { key: "media", label: { en: "Media", ps: "رسنۍ", fa: "رسانه‌ها" } },
      { key: "politics", label: { en: "Politics", ps: "سیاست", fa: "سیاست" } },
      {
        key: "violations",
        label: {
          en: "Human Rights Violations",
          ps: "د بشري حقوقو نقض",
          fa: "نقض حقوق بشر",
        },
      },
    ],
  },
  {
    key: "world",
    label: { en: "World", ps: "نړۍ", fa: "جهان" },
    description: {
      en: "The wider region and the powers that shape it, explained without noise.",
      ps: "پراخه سیمه او هغه ځواکونه چې هغه جوړوي، له اضافي شور پرته.",
      fa: "منطقه گسترده و قدرت‌هایی که آن را شکل می‌دهند، بدون هیاهو.",
    },
    accent: "#3C8D8A",
    subcategories: [
      { key: "us", label: { en: "United States", ps: "امریکا", fa: "ایالات متحده" } },
      { key: "africa", label: { en: "Africa", ps: "افریقا", fa: "افریقا" } },
      { key: "asia", label: { en: "Asia", ps: "آسیا", fa: "آسیا" } },
      { key: "europe", label: { en: "Europe", ps: "اروپا", fa: "اروپا" } },
      { key: "middle-east", label: { en: "Middle East", ps: "منځنی ختیځ", fa: "خاورمیانه" } },
      { key: "central-asia", label: { en: "Central Asia", ps: "مرکزي آسیا", fa: "آسیای میانه" } },
      { key: "south-asia", label: { en: "South Asia", ps: "جنوبي آسیا", fa: "جنوب آسیا" } },
      { key: "west-asia", label: { en: "West Asia", ps: "لویدیځه آسیا", fa: "غرب آسیا" } },
    ],
  },
  {
    key: "business",
    label: { en: "Business", ps: "سوداګري", fa: "اقتصاد" },
    description: {
      en: "Trade, energy and the money moving through the region.",
      ps: "سوداګري، انرژي او هغه پیسې چې په سیمه کې ګرځي.",
      fa: "تجارت، انرژی و پولی که در منطقه در جریان است.",
    },
    accent: "#C77D2E",
    subcategories: [
      { key: "economy", label: { en: "Economy", ps: "اقتصاد", fa: "اقتصاد" } },
      { key: "trade", label: { en: "Trade", ps: "تجارت", fa: "تجارت" } },
      {
        key: "mining-energy",
        label: { en: "Mining & Energy", ps: "کانونه او انرژي", fa: "معادن و انرژی" },
      },
      { key: "agriculture", label: { en: "Agriculture", ps: "کرنه", fa: "زراعت" } },
    ],
  },
  {
    key: "sports",
    label: { en: "Sports", ps: "سپورټ", fa: "ورزش" },
    description: {
      en: "The games that bring the region together, on and off the field.",
      ps: "هغه لوبې چې سیمه یوځای کوي، په میدان او له میدان بهر.",
      fa: "بازی‌هایی که منطقه را کنار هم می‌آورد، در میدان و بیرون آن.",
    },
    accent: "#B34A3C",
    subcategories: [
      { key: "football", label: { en: "Football", ps: "فوټبال", fa: "فوتبال" } },
      { key: "volleyball", label: { en: "Volleyball", ps: "والیبال", fa: "والیبال" } },
      { key: "cricket", label: { en: "Cricket", ps: "کرکټ", fa: "کریکت" } },
      { key: "hockey", label: { en: "Hockey", ps: "هاکي", fa: "هاکی" } },
      { key: "taekwondo", label: { en: "Taekwondo", ps: "تکواندو", fa: "تکواندو" } },
      { key: "karate", label: { en: "Karate", ps: "کراته", fa: "کاراته" } },
    ],
  },
  {
    key: "culture",
    label: { en: "Art & Culture", ps: "هنر او کلتور", fa: "هنر و فرهنگ" },
    description: {
      en: "Heritage, craft and the people keeping memory alive.",
      ps: "میراث، هنر او هغه خلک چې یادونه ژوندې ساتي.",
      fa: "میراث، هنر و مردمی که حافظه را زنده نگه می‌دارند.",
    },
    accent: "#7A5AA6",
    subcategories: [
      { key: "heritage", label: { en: "Heritage", ps: "کلتوري میراث", fa: "میراث فرهنگی" } },
      { key: "arts", label: { en: "Arts", ps: "هنرونه", fa: "هنرها" } },
      { key: "society", label: { en: "Society", ps: "ټولنه", fa: "جامعه" } },
    ],
  },
  {
    key: "opinion",
    label: { en: "Opinions", ps: "نظرونه", fa: "دیدگاه‌ها" },
    description: {
      en: "Argument, analysis and dissenting voices, clearly labelled.",
      ps: "استدلال، تحلیل او مخالف غږونه، په روښانه ډول.",
      fa: "استدلال، تحلیل و صداهای مخالف، به‌روشنی.",
    },
    accent: "#5B6B7A",
    subcategories: [
      { key: "analysis", label: { en: "Analysis", ps: "تحلیل", fa: "تحلیل" } },
      { key: "global", label: { en: "Global", ps: "نړیوال", fa: "جهانی" } },
      { key: "society-op", label: { en: "Society", ps: "ټولنیز نظر", fa: "دیدگاه اجتماعی" } },
      },
    ],
  },
  {
    key: "specials",
    label: { en: "Special Events", ps: "ځانګړې پېښې", fa: "رویدادهای ویژه" },
    description: {
      en: "Anniversaries and investigations that deserve more than a headline.",
      ps: "کالیزې او څیړنې چې له یوې سرلیکې زیاتې دي.",
      fa: "سالگردها و پژوهش‌هایی که بیش از یک تیتر می‌خواهند.",
    },
    accent: "#A65E4E",
    subcategories: [
      },
      },
      {
        key: "womens-day",
        label: { en: "International Women's Day", ps: "د ښځو نړیواله ورځ", fa: "روز جهانی زن" },
      },
      },
    ],
  },
  {
    key: "women",
    label: { en: "Women", ps: "ښځې", fa: "زنان" },
    description: {
      en: "Stories, leadership and daily realities of women across the region.",
      ps: "په ټوله سیمه کې د ښځو کیسې، مشرتابه او ورځنی ژوند.",
      fa: "گزارش‌ها، نقش‌آفرینی و زندگی روزمره زنان در سراسر منطقه.",
    },
    accent: "#C25975",
    subcategories: [],
  },

  {
    key: "videos",
    label: { en: "Videos", ps: "ویډیوګانې", fa: "ویدیوها" },
    description: {
      en: "Short documentaries, explainers and live broadcasts.",
      ps: "لنډ مستندونه، تشریحات او ژوندۍ خپرونې.",
      fa: "مستندهای کوتاه، توضیح‌ها و پخش زنده.",
    },
    accent: "#2F6F8F",
    subcategories: [],
  },
];

export function getCategory(key: string | null | undefined): Category | undefined {
  if (!key) return undefined;
  return CATEGORIES.find(category => category.key === key);
}

export function getSubcategory(
  categoryKey: string | null | undefined,
  subKey: string | null | undefined
): Subcategory | undefined {
  if (!categoryKey || !subKey) return undefined;
  return getCategory(categoryKey)?.subcategories.find(sub => sub.key === subKey);
}

export function categoryLabel(key: string, locale: Locale): string {
  return getCategory(key)?.label[locale] ?? key;
}

export function subcategoryLabel(
  categoryKey: string,
  subKey: string | null | undefined,
  locale: Locale
): string {
  return getSubcategory(categoryKey, subKey)?.label[locale] ?? "";
}

/** Public shapes shared by server responses and the React app. */
export type ArticleTranslationDTO = {
  locale: Locale;
  /** Localized, search-engine-friendly slug. Null means "use the article slug". */
  slug: string | null;
  title: string;
  summary: string | null;
  content: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  aiSummary: string | null;
  aiSummaryAt: string | null;
};

export type ArticleDTO = {
  id: number;
  slug: string;
  status: "draft" | "published" | "archived";
  category: string;
  subcategory: string | null;
  coverImage: string | null;
  coverAlt: string | null;
  authorName: string;
  featured: boolean;
  breaking: boolean;
  readMinutes: number;
  tags: string[];
  publishedAt: string | null;
  updatedAt: string | null;
  views: number;
  /** True when the story is clearly-labelled demonstration content. */
  isDemo: boolean;
  translations: ArticleTranslationDTO[];
};

export type AdminArticleDTO = ArticleDTO & {
  createdAt: string | null;
  deletedAt?: string | null;
};

export const SITE = {
  name: "Buddha News",
  legalName: "Buddha Media Group",
  abbreviation: "BMG",
  tagline: {
    en: "One region. Three languages. No noise.",
    ps: "یوه سیمه. درې ژبې. بې شوره.",
    fa: "یک منطقه. سه زبان. بدون هیاهو.",
  } as LocalizedText,
  /** Intentionally empty: the public address comes from Admin → Settings → Newsroom email. */
  email: "",
  tipSignal: "",
  founded: 2021,
};

/* ------------------------------------------------------------------ */
/* Locale-aware URLs                                                   */
/* ------------------------------------------------------------------ */

/**
 * Public pages that exist in all three languages. Admin and API routes are
 * intentionally absent: they are English-only and marked noindex.
 */
export const PUBLIC_PAGES = [
  "about",
  "contact",
  "tip-line",
  "privacy",
  "terms",
  "editorial-policy",
] as const;

export type PublicPage = (typeof PUBLIC_PAGES)[number];

/** Prefix an application path with its language segment: `/ps/category/world`. */
export function localePath(locale: Locale, path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  if (clean === "/") return `/${locale}/`;
  return `/${locale}${clean}`;
}

export function articleUrl(locale: Locale, slug: string): string {
  return localePath(locale, `/article/${encodeURIComponent(slug)}`);
}

export function categoryUrl(locale: Locale, key: string, sub?: string | null): string {
  const base = localePath(locale, `/category/${encodeURIComponent(key)}`);
  return sub ? `${base}?sub=${encodeURIComponent(sub)}` : base;
}

/**
 * Split a request path into its language and the language-neutral remainder.
 * `/ps/article/x` -> { locale: "ps", path: "/article/x", hadLocale: true }
 * `/article/x`    -> { locale: "en", path: "/article/x", hadLocale: false }
 */
export function splitLocalePath(pathname: string): {
  locale: Locale;
  path: string;
  hadLocale: boolean;
} {
  const match = /^\/(en|ps|fa)(?=\/|$)/.exec(pathname);
  if (!match) return { locale: DEFAULT_LOCALE, path: pathname || "/", hadLocale: false };
  const rest = pathname.slice(match[0].length);
  return {
    locale: match[1] as Locale,
    path: rest.startsWith("/") ? rest : `/${rest}`,
    hadLocale: true,
  };
}

/** Language preference for a first-time visitor, from the Accept-Language header. */
export function localeFromAcceptLanguage(header: string | undefined): Locale {
  if (!header) return DEFAULT_LOCALE;
  const entries = header
    .split(",")
    .map(part => {
      const [tag, q] = part.trim().split(";q=");
      return { tag: (tag ?? "").toLowerCase(), q: q ? Number(q) : 1 };
    })
    .filter(entry => entry.tag)
    .sort((a, b) => b.q - a.q);
  for (const entry of entries) {
    if (entry.tag === "ps" || entry.tag.startsWith("ps-")) return "ps";
    if (entry.tag === "fa" || entry.tag.startsWith("fa-") || entry.tag.startsWith("prs")) {
      return "fa";
    }
    if (entry.tag === "en" || entry.tag.startsWith("en-")) return "en";
  }
  return DEFAULT_LOCALE;
}

/* ------------------------------------------------------------------ */
/* Slugs                                                               */
/* ------------------------------------------------------------------ */

/**
 * Arabic-script to Latin transliteration used to build readable, unique
 * localized slugs from Pashto and Dari headlines. It is intentionally
 * lossy — the result only has to be stable, ASCII and recognisable.
 */
const ARABIC_TO_LATIN: Record<string, string> = {
  ا: "a", آ: "aa", أ: "a", إ: "e", ب: "b", پ: "p", ت: "t", ټ: "tt", ث: "s",
  ج: "j", چ: "ch", ځ: "dz", ح: "h", خ: "kh", د: "d", ډ: "dd", ذ: "z", ر: "r",
  ړ: "rr", ز: "z", ژ: "zh", س: "s", ش: "sh", ښ: "shh", ص: "s", ض: "z",
  ط: "t", ظ: "z", ع: "a", غ: "gh", ف: "f", ق: "q", ک: "k", ګ: "g", ك: "k",
  گ: "g", ل: "l", م: "m", ن: "n", ڼ: "nn", و: "w", ه: "h", هـ: "h", ي: "y",
  ی: "y", ې: "e", ۍ: "ay", ئ: "y", ء: "", ة: "a", ى: "a",
  "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4", "۵": "5", "۶": "6",
  "۷": "7", "۸": "8", "۹": "9", "٠": "0", "١": "1", "٢": "2", "٣": "3",
  "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
  "‌": "-", " ": "-", "،": "-", "؛": "-", "؟": "-", "«": "", "»": "",
};

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 170);
}

/** Build an ASCII slug from a Pashto/Dari headline (or any Latin text). */
export function localizedSlug(title: string, maxLength = 120): string {
  let out = "";
  for (const char of title.normalize("NFC")) {
    out += ARABIC_TO_LATIN[char] ?? char;
  }
  const slug = out
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return slug.slice(0, maxLength).replace(/-$/, "") || "story";
}
