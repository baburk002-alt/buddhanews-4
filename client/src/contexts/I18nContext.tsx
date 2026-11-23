import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useLocation } from "wouter";
import {
  DEFAULT_LOCALE,
  isLocale,
  localeDir,
  localeHtmlLang,
  splitLocalePath,
  type Locale,
} from "@shared/news";
import { rememberLocale } from "@/const";

const en = {
  brand: "Buddha News",
  tagline: "One region. Three languages. No noise.",
  skip: "Skip to main content",
  home: "Home",
  search: "Search",
  menu: "Menu",
  close: "Close",
  theme: "Theme",
  light: "Light",
  dark: "Dark",
  language: "Language",
  live: "Live",
  breaking: "Breaking",
  latest: "Latest dispatches",
  latestKicker: "The latest",
  recordKicker: "The record",
  briefing: "The briefing",
  opinionKicker: "Opinion & analysis",
  globeText:
    "One region, reported in three languages. The live desk tracks the stories that cross borders.",
  aiSectionTitle: "Ask the newsroom, not the algorithm.",
  aiSectionText:
    "Every answer is grounded in the reporting on this site. If the record is thin, the assistant says so.",
  firstEditionTitle: "The first edition is being prepared.",
  firstEditionText: "Stories will appear here as soon as the newsroom publishes them.",
  openNewsroom: "Open the newsroom",
  mostRead: "Most read",
  featured: "Featured",
  allStories: "All stories",
  readMore: "Read the story",
  minRead: "min read",
  published: "Published",
  updated: "Updated",
  by: "By",
  author: "Author",
  views: "views",
  share: "Share",
  copyLink: "Copy link",
  copied: "Link copied",
  listen: "Listen",
  stop: "Stop",
  audioUnavailable: "Audio playback is not available in this browser.",
  aiBrief: "60-second AI brief",
  aiBriefIntro: "A quick, source-grounded summary of this story.",
  generateBrief: "Generate the brief",
  generating: "Writing the brief…",
  aiDisclaimer:
    "AI can make mistakes. The brief is generated from this article only and is reviewed against the text, not independently reported.",
  askAi: "Ask Buddha AI",
  askTitle: "The AI news desk",
  askIntro:
    "Ask about the stories in our newsroom. Answers use BMG reporting and say so when the record is thin.",
  askPlaceholder: "What should I understand about the region today?",
  send: "Send",
  thinking: "Reading the newsroom…",
  askError: "The AI desk could not answer just now. Please try again.",
  suggestion1: "What are the main stories today?",
  suggestion2: "Explain the border-security agreement.",
  suggestion3: "What changed for women this year?",
  suggestion4: "Which stories are opinion, not reporting?",
  newsletterTitle: "The BMG Brief",
  newsletterText:
    "One calm email each morning: the stories that matter, in the language you read.",
  emailPlaceholder: "Your email address",
  subscribe: "Subscribe",
  subscribing: "Subscribing…",
  subscribed: "You are on the list.",
  newsletterError: "That did not work. Check the address and try again.",
  newsletterPrivacy: "No spam. Unsubscribe at any time.",
  newsletterConsent:
    "I agree to receive the BMG Brief and I have read the privacy policy.",
  newsletterPending:
    "Almost done. Open the confirmation email we just sent and click the link to activate your subscription.",
  newsletterConfirmed: "Your subscription is confirmed. Welcome to the BMG Brief.",
  newsletterInvalid: "That confirmation link is invalid or has expired.",
  unsubscribed: "You have been removed from the BMG Brief.",
  demoBadge: "Demonstration content",
  demoNotice:
    "This story is sample content that ships with the newsroom template. It is not reporting by Buddha News, the byline is a placeholder and the quotes are illustrative. It is excluded from search engines and from the newsletter.",
  demoHomeTitle: "Sample content is labelled",
  demoHomeBody:
    "Some stories on this site are demonstration content used to show the layout. They carry a Demonstration badge, use a placeholder byline and are excluded from search engines, sitemaps and RSS.",
  sections: "Sections",
  company: "Company",
  follow: "Follow",
  rights: "All rights reserved.",
  independence: "Independent · Trilingual · Reader-funded",
  about: "About",
  contact: "Contact",
  tipLine: "Secure tip line",
  privacy: "Privacy",
  terms: "Terms",
  editorial: "Editorial policy",
  searchTitle: "Search the newsroom",
  searchPlaceholder: "Names, places, topics…",
  searchResults: "results",
  noResults: "No stories matched that search.",
  searchHint: "Search by headline, place or topic.",
  searchNoResultsHint: "Try a broader word, or browse a section below.",
  related: "Related reporting",
  tags: "Topics",
  backHome: "Back to the front page",
  notFoundTitle: "This page is not in the edition.",
  notFoundText:
    "The link may be old, or the story may have moved. The front page is a good place to start.",
  loading: "Loading the newsroom…",
  errorTitle: "Something went wrong",
  errorText: "The newsroom could not load this page. Please try again.",
  retry: "Try again",
  translationNotice: "This story is available in English only for now.",
  originalEnglish: "Read in English",
  liveDesk: "The live desk",
  watchLive: "Watch the live broadcast",
  listenArticle: "Listen to this story",
  contents: "In this story",
  askAboutArticle: "Ask AI about this story",
  opinion: "Opinion",
  specialReport: "Special report",
  video: "Video",
  shareOn: "Share on",
  print: "Print",
  contactUs: "Contact the newsroom",
  newsroomLogin: "Newsroom login",
  sendMessage: "Send message",
  messageSent: "Your message reached the newsroom.",
  messageError: "The message could not be sent. Please try again.",
  name: "Name",
  email: "Email",
  subject: "Subject",
  messageLabel: "Message",
  tipIntro:
    "Sensitive information should not travel through ordinary email or social messages. This page explains the channels BMG uses and how to protect yourself.",
  tipWarning:
    "BMG does not publish a PGP key or Signal number until it has been verified by the newsroom. A fake key is worse than no key. Configure the real channel in Settings before launch.",
  tipSignalLabel: "Verified Signal number",
  tipSteps: "How to reach us safely",
  tipNoEmail: "Do not use ordinary email for a sensitive tip.",
  tipSecureChannels: "Use Signal, or the contact form for non-sensitive messages.",
  tipWhatToSend: "Send documents, dates and names — not your own identity unless you choose to.",
  tipProtectYourself: "Use a device that is not shared, and delete local copies when it is safe.",
  privacyIntro:
    "Buddha News is a newsroom, not an advertising network. We collect the minimum needed to publish the site and answer you.",
  privacyData:
    "We store newsletter addresses, contact messages, article view counts and security logs. We do not sell personal data.",
  privacyCookies:
    "The site stores your language and theme in your browser. It does not set advertising cookies.",
  privacyRights:
    "You can ask us to correct or delete your personal data by writing to the newsroom.",
  privacyContact: "contact form",
  termsIntro:
    "By using Buddha News you agree to these terms. They are written to be readable, not to hide anything.",
  termsUse:
    "You may read, link to and quote our journalism with attribution. Do not scrape the site or republish whole articles without permission.",
  termsContent:
    "Reporting is provided as a public service. Opinion pieces are labelled and represent the author's view.",
  termsLiability:
    "We work to be accurate, but the site is provided without a warranty. Always verify information that affects your safety or money.",
  termsChanges: "We will post material changes on this page.",
  editorialIntro:
    "Buddha Media Group is an independent trilingual news organization. These are the standards our journalists work to.",
  editorialSourcing:
    "Every report is checked against at least two independent sources where possible. Documents are reviewed for authenticity. We name sources only when it is safe to do so.",
  editorialCorrections:
    "When we get something wrong, we correct it quickly and say what changed. Corrections are visible on the story.",
  editorialAi:
    "AI helps us draft summaries and translations. A human editor remains responsible for everything we publish. AI is never used to invent quotes or sources.",
  editorialOwnership:
    "BMG is owned by its founding journalists. Funding and partnerships are disclosed when they could affect coverage.",
  editorialComplaints:
    "Complaints go to the newsroom. We aim to respond within five working days.",
  ourMission: "Our mission",
  ourTeam: "The newsroom",
  ownership: "Ownership and funding",
  funding: "Funding",
  correctionsPolicy: "Corrections",
  aiPolicy: "AI policy",
  aboutPageTitle: "About Buddha Media Group — Buddha News",
  aboutPageDescription:
    "Buddha Media Group is an independent trilingual newsroom covering Afghanistan, Central and South Asia in English, Pashto and Dari.",
  aboutPageKicker: "Buddha Media Group",
  aboutHeroTitle: "A newsroom built for a region that refuses to fit in one language.",
  aboutHeroIntro:
    "BMG reports in English, Pashto and Dari, with one editorial standard and one public record. This edition is built to be owned and operated by the newsroom for the long term.",
  aboutMissionFirst:
    "Independent journalism in Afghanistan and the wider region is expensive, dangerous and essential. BMG exists to make it durable: verified reporting, clear sourcing, and a newsroom that can be read in the language people actually use.",
  aboutMissionSecond:
    "We cover politics and security, but also the economy, education, culture, sport and the everyday decisions that shape a household. We publish in three languages because a single-language newsroom leaves most of the region out.",
  aboutNewsroomFirst:
    "The newsroom is organised around a central desk and regional contributors. Editors verify, writers report, and a visual team handles photography, graphics and video. Freelancers are credited and paid; sensitive sources are protected.",
  aboutNewsroomSecond:
    "Every story in this archive can be edited, corrected or retired from the newsroom dashboard. Corrections are recorded in the audit log and dated on the story.",
  aboutOwnershipText:
    "BMG is owned by its founding journalists. The business model is reader support, syndication and clearly disclosed partnerships. Funding that could affect coverage is disclosed on the story and on this page.",
  aboutStudioAlt: "A broadcast studio with a desk, screens and warm lighting.",
  aboutLanguageTitle: "Three languages",
  aboutLanguageText: "English, Pashto and Dari share one editorial standard.",
  aboutSecurityTitle: "Security first",
  aboutSecurityText: "Audit logging, rate limits and a protected newsroom.",
  aboutAiTitle: "AI with a human editor",
  aboutAiText: "Assistance for summaries and translation, never invention.",
  aboutContactText: "Partnerships, corrections and newsroom questions.",
  footerNote:
    "Independent, trilingual reporting from Afghanistan, Central and South Asia. Published by Buddha Media Group.",
  languageEnglish: "English",
  languagePashto: "پښتو",
  languageDari: "دری",
  all: "All",
  filters: "Filter",
  clear: "Clear",
  loadingMore: "Loading more…",
  noMore: "No more stories",
} as const;

export type DictKey = keyof typeof en;

const ps: Record<DictKey, string> = {
  brand: "بودا نیوز",
  tagline: "یوه سیمه. درې ژبې. بې شوره.",
  skip: "اصلي منځپانګې ته لاړ شئ",
  home: "کورپاڼه",
  search: "لټون",
  menu: "مینو",
  close: "بندول",
  theme: "بڼه",
  light: "روښانه",
  dark: "تیاره",
  language: "ژبه",
  live: "ژوندی",
  breaking: "بیړنی",
  latest: "وروستي خبرونه",
  latestKicker: "وروستي",
  recordKicker: "ریکارډ",
  briefing: "لنډیز",
  opinionKicker: "نظر او تحلیل",
  globeText: "یوه سیمه، په درې ژبو راپور شوې. ژوندی میز هغه کیسې تعقیبوي چې پولې تېروي.",
  aiSectionTitle: "له خبري میز وپوښتئ، نه له الګوریتم.",
  aiSectionText: "هر ځواب په همدې سایټ کې پر راپورونو ولاړ دی. که ریکارډ نیمګړی وي، مرستیال یې په ډاګه کوي.",
  firstEditionTitle: "لومړی ګڼه چمتو کېږي.",
  firstEditionText: "کیسې به دلته ښکاره شي کله چې خبري میز خپرې کړي.",
  openNewsroom: "خبري میز پرانیزئ",
  mostRead: "ډیر لوستل شوي",
  featured: "ځانګړي",
  allStories: "ټول خبرونه",
  readMore: "خبر ولولئ",
  minRead: "دقیقې لوستل",
  published: "خپور شو",
  updated: "تازه شو",
  by: "لخوا",
  author: "لیکوال",
  views: "لیدنې",
  share: "شریکول",
  copyLink: "لینک کاپي کړئ",
  copied: "لینک کاپي شو",
  listen: "واورئ",
  stop: "ودروئ",
  audioUnavailable: "په دې براوزر کې غږ نه شي اورېدل کېدای.",
  aiBrief: "د AI ۶۰ ثانیې لنډیز",
  aiBriefIntro: "د دې خبر لنډ او د متن پر بنسټ لنډیز.",
  generateBrief: "لنډیز جوړ کړئ",
  generating: "لنډیز لیکل کیږي…",
  aiDisclaimer:
    "AI تېروتنه کولای شي. لنډیز یوازې له دې خبر څخه جوړ شوی او خپلواک راپور نه دی.",
  askAi: "له بودا AI وپوښتئ",
  askTitle: "د AI خبری میز",
  askIntro: "د زموږ د خبرونو په اړه وپوښتئ. ځوابونه پر BMG راپورونو ولاړ دي.",
  askPlaceholder: "نن د سیمې په اړه څه باید پوه شم؟",
  send: "لیږل",
  thinking: "خبرونه لولل کیږي…",
  askError: "AI میز اوس ځواب نه شو ورکولای. بیا هڅه وکړئ.",
  suggestion1: "د نن ورځې اصلي خبرونه کوم دي؟",
  suggestion2: "د پولې امنیت توافق تشریح کړئ.",
  suggestion3: "سږکال د ښځو لپاره څه بدل شول؟",
  suggestion4: "کوم خبرونه نظر دي، راپور نه؟",
  newsletterTitle: "د BMG لنډیز",
  newsletterText: "هر سهار یو آرام ایمیل: هغه خبرونه چې مهم دي، په خپله ژبه.",
  emailPlaceholder: "ستاسو ایمیل",
  subscribe: "ګډون",
  subscribing: "ګډون کیږي…",
  subscribed: "تاسو په لړلیک کې یاست.",
  newsletterError: "دا ونه شو. پته وګورئ او بیا هڅه وکړئ.",
  newsletterPrivacy: "سپم نشته. هر وخت وتلای شئ.",
  newsletterConsent: "زه غواړم چې د BMG لنډیز ترلاسه کړم او د محرمیت تګلاره مې لوستلې ده.",
  newsletterPending: "نږدې بشپړ شو. هغه تاییدي ایمیل خلاص کړئ چې موږ لیږلی او لینک کلیک کړئ.",
  newsletterConfirmed: "ستاسو ګډون تایید شو. د BMG لنډیز ته ښه راغلاست.",
  newsletterInvalid: "د تایید لینک ناسم یا له منځه تللی دی.",
  unsubscribed: "تاسو د BMG لنډیز له لړلیک څخه ووتلئ.",
  demoBadge: "نمونه منځپانګه",
  demoNotice:
    "دا کیسه د نمونې منځپانګه ده چې د خبرونو د کالب اوډ سره راځي. دا د بودا نیوز راپور نه دی، لیکوالی نوم ځای نیوونکی دی او نقلونه مثال دي. دا د لټون انجنونو او خبرپاڼې څخه ایستل شوې ده.",
  demoHomeTitle: "نمونه منځپانګه نښه شوې ده",
  demoHomeBody:
    "په دې وېبپاڼه کې ځینې کیسې د نمونې منځپانګه ده چې د بڼې ښودلو لپاره کارول کیږي. دوی د نمونې نښه لري، ځای نیوونکی لیکوال نوم او د لټون انجنونو، سایټ مپ او RSS څخه ایستل شوې دي.",
  sections: "برخې",
  company: "شرکت",
  follow: "تعقیب",
  rights: "ټول حقوق محفوظ دي.",
  independence: "خپلواک · درې ژبې · د لوستونکو ملاتړ",
  about: "په اړه",
  contact: "اړیکه",
  tipLine: "د خبر خوندي لار",
  privacy: "خصوصیت",
  terms: "شرایط",
  editorial: "اداری تګلاره",
  searchTitle: "د خبرونو لټون",
  searchPlaceholder: "نومونه، ځایونه، موضوعات…",
  searchResults: "پایلې",
  noResults: "هېڅ خبر ونه موندل شو.",
  searchHint: "د سرلیک، ځای یا موضوع له مخې لټون وکړئ.",
  searchNoResultsHint: "پراخه کلمه هڅه کړئ یا برخه وګورئ.",
  related: "اړوند راپورونه",
  tags: "موضوعات",
  backHome: "کورپاڼې ته",
  notFoundTitle: "دا پاڼه په خپرونه کې نشته.",
  notFoundText: "لینک زوړ وي یا خبر ځای بدل کړی وي. کورپاڼه ښه پیل دی.",
  loading: "خبرونه بار کیږي…",
  errorTitle: "یوه ستونزه رامنځته شوه",
  errorText: "خبرونه دا پاڼه نه شي بارولای. بیا هڅه وکړئ.",
  retry: "بیا هڅه",
  translationNotice: "دا خبر اوس یوازې په انګلیسي کې شته.",
  originalEnglish: "په انګلیسي ولولئ",
  liveDesk: "ژوندی میز",
  watchLive: "ژوندۍ خپرونه وګورئ",
  listenArticle: "دا خبر واورئ",
  contents: "په دې خبر کې",
  askAboutArticle: "د دې خبر په اړه AI وپوښتئ",
  opinion: "نظر",
  specialReport: "ځانګړی راپور",
  video: "ویډیو",
  shareOn: "شریکول په",
  print: "چاپ",
  contactUs: "له خبرونو سره اړیکه",
  newsroomLogin: "خبري دفتر ته ننوتل",
  sendMessage: "پیغام لیږل",
  messageSent: "ستاسو پیغام خبرونو ته ورسید.",
  messageError: "پیغام ونه لیږل شو. بیا هڅه وکړئ.",
  name: "نوم",
  email: "ایمیل",
  subject: "موضوع",
  messageLabel: "پیغام",
  tipIntro: "حساس معلومات باید د عادي ایمیل یا ټولنیزو پیغامونو له لارې ونه لیږل شي.",
  tipWarning: "BMG تر تایید پورې PGP کیلي یا سیګنال شمېره نه خپروي.",
  tipSignalLabel: "تایید شوې سیګنال شمېره",
  tipSteps: "څنګه په خوندي ډول اړیکه ونیسو",
  tipNoEmail: "د حساس خبر لپاره عادي ایمیل مه کاروئ.",
  tipSecureChannels: "سیګنال یا د غیر حساسو پیغامونو لپاره فورم کاروئ.",
  tipWhatToSend: "اسناد، نېټې او نومونه ولیږئ — خپل هویت یوازې که وغواړئ.",
  tipProtectYourself: "هغه وسیله کاروئ چې شریکه نه وي او خوندي کله محلي کاپي ړنګه کړئ.",
  privacyIntro: "بودا نیوز یو خبري دفتر دی، د اعلاناتو شبکه نه. موږ لږ تر لږه معلومات غونډوو.",
  privacyData: "موږ د خبرپاڼې پتې، پیغامونه، د خبر لیدل او امنیتي ثبت ساتو. شخصي معلومات نه پلورو.",
  privacyCookies: "سایټ ستاسو ژبه او بڼه په براوزر کې ساتي. د اعلاناتو کوکیز نه لري.",
  privacyRights: "د خپلو معلوماتو د سمولو یا ړنګولو غوښتنه کولای شئ.",
  privacyContact: "د اړیکې فورمه",
  termsIntro: "د بودا نیوز په کارولو سره تاسو دې شرایطو موافقه کوئ.",
  termsUse: "زموږ خبرونه لوستلای، لینک ورکولای او د سرچینې په ذکر نقلولای شئ.",
  termsContent: "راپورونه عامه خدمت دي. نظریې په نښه شوې دي او د لیکوال نظر ښیي.",
  termsLiability: "موږ دقت کوو، خو سایټ بې تضمین دی. د خوندیتوب یا پیسو اړوند معلومات تایید کړئ.",
  termsChanges: "مهم بدلونونه به په دې پاڼه خپاره شي.",
  editorialIntro: "بودا میډیا ګروپ یوه خپلواکه درې ژبې خبري موسسه ده.",
  editorialSourcing: "هر راپور تر ممکنه حده له دوو خپلواکو سرچینو سره کتل کیږي. اسناد تایید کیږي.",
  editorialCorrections: "کله چې تېروتنه وکړو، ژر یې سمولو او څه بدل شول ښیو.",
  editorialAi: "AI د لنډیز او ژباړې په جوړولو کې مرسته کوي. انساني مدیر مسؤل دی.",
  editorialOwnership: "BMG د بنسټ ایښودونکو خبریالانو ملکیت دی.",
  editorialComplaints: "شکایتونه خبرونو ته ولیږئ. په پنځو کاري ورځو کې ځواب.",
  ourMission: "زموږ ماموریت",
  ourTeam: "خبري دفتر",
  ownership: "ملکیت او تمویل",
  funding: "تمویل",
  correctionsPolicy: "سمونې",
  aiPolicy: "د AI تګلاره",
  aboutPageTitle: "د بودا میډیا ګروپ په اړه — بودا نیوز",
  aboutPageDescription:
    "بودا میډیا ګروپ یوه خپلواکه درې‌ژبې خبري اداره ده چې د افغانستان، مرکزي او جنوبي اسیا په اړه په انګلیسي، پښتو او دري راپورونه خپروي.",
  aboutPageKicker: "بودا میډیا ګروپ",
  aboutHeroTitle: "د هغې سیمې لپاره جوړه شوې خبري اداره چې په یوې ژبې کې نه راټولېږي.",
  aboutHeroIntro:
    "BMG په انګلیسي، پښتو او دري ژبو راپورونه خپروي؛ د ټولو لپاره یو ګډ اداري معیار او عامه ریکارډ ساتي. دا وېبپاڼه داسې جوړه شوې چې خبري اداره یې په اوږد مهال کې په خپل واک کې ولري او وچلوي.",
  aboutMissionFirst:
    "په افغانستان او پراخه سیمه کې خپلواک ژورنالېزم ګران، له خطره ډک او اړین دی. BMG د دې لپاره کار کوي چې دا ژورنالېزم دوام وکړي: کره شوي راپورونه، روښانه سرچینې او داسې خبري اداره چې خلک یې په خپله کارېدونکې ژبه ولولي.",
  aboutMissionSecond:
    "موږ د سیاست او امنیت ترڅنګ اقتصاد، پوهنه، کلتور، ورزش او هغه ورځنۍ پرېکړې هم څارو چې د کورنیو پر ژوند اغېز کوي. په درېیو ژبو خپرونې کوو، ځکه یوازې یوه‌ژبنۍ خبري اداره د سیمې ډېری خلک له پامه غورځوي.",
  aboutNewsroomFirst:
    "خبري اداره د یوه مرکزي میز او سیمه‌ییزو همکارانو پر بنسټ تنظیم شوې ده. اېډېټران معلومات کره کوي، خبریالان راپورونه چمتو کوي او د انځوریزو موادو ډله عکسونه، ګرافیکونه او ویډیوګانې جوړوي. خپلواک خبریالانو ته د کار اعتبار او حق‌الزحمه ورکول کېږي؛ د حساسو سرچینو خوندیتوب ساتل کېږي.",
  aboutNewsroomSecond:
    "په دې زېرمتون کې هر خبر د خبري ادارې له ډشبورډه سمېدای، اصلاح کېدای یا له خپرونه ایستل کېدای شي. سمونې د پلټنې په ثبت کې خوندي کېږي او د خبر نېټه ورسره لیکل کېږي.",
  aboutOwnershipText:
    "BMG د بنسټ‌ايښودونکو خبریالانو ملکیت دی. د عاید سرچینې یې د لوستونکو ملاتړ، د راپورونو بیاخپرونه او په روښانه توګه اعلان شوې ملګرتیاوې دي. هغه تمویل چې پر پوښښ اغېز کولای شي، په خبر او همدې پاڼه کې څرګندېږي.",
  aboutStudioAlt: "د خپرونو سټوډیو، له مېز، پردو او تودې رڼا سره.",
  aboutLanguageTitle: "درې ژبې",
  aboutLanguageText: "انګلیسي، پښتو او دري یو ګډ اداري معیار لري.",
  aboutSecurityTitle: "امنیت لومړی",
  aboutSecurityText: "د پلټنې ثبتونه، د غوښتنو د شمېر محدودیتونه او خوندي خبري اداره.",
  aboutAiTitle: "له انساني اېډېټر سره AI",
  aboutAiText: "د لنډیز او ژباړې مرسته؛ هېڅکله د معلوماتو جوړول نه.",
  aboutContactText: "د ملګرتیاوو، سمونو او خبري ادارې په اړه پوښتنې.",
  footerNote: "له افغانستان، مرکزي او جنوبي آسیا خپلواک او درې ژبیز راپورونه. د بودا میډیا ګروپ خپرونه.",
  languageEnglish: "English",
  languagePashto: "پښتو",
  languageDari: "دری",
  all: "ټول",
  filters: "فلټر",
  clear: "پاکول",
  loadingMore: "نور بار کیږي…",
  noMore: "نور خبرونه نشته",
};

const fa: Record<DictKey, string> = {
  brand: "بودا نیوز",
  tagline: "یک منطقه. سه زبان. بدون هیاهو.",
  skip: "رفتن به محتوای اصلی",
  home: "صفحه اصلی",
  search: "جستجو",
  menu: "منو",
  close: "بستن",
  theme: "ظاهر",
  light: "روشن",
  dark: "تاریک",
  language: "زبان",
  live: "زنده",
  breaking: "فوری",
  latest: "آخرین اخبار",
  latestKicker: "آخرین",
  recordKicker: "سابقه",
  briefing: "خلاصه",
  opinionKicker: "دیدگاه و تحلیل",
  globeText: "یک منطقه، گزارش‌شده به سه زبان. میز زنده داستان‌هایی را دنبال می‌کند که از مرزها عبور می‌کنند.",
  aiSectionTitle: "از خبرگزاری بپرسید، نه از الگوریتم.",
  aiSectionText: "هر پاسخ بر گزارش‌های همین سایت استوار است. اگر سابقه ناکافی باشد، دستیار آن را می‌گوید.",
  firstEditionTitle: "اولین شماره در حال آماده‌سازی است.",
  firstEditionText: "داستان‌ها به‌محض انتشار از سوی خبرگزاری اینجا ظاهر می‌شوند.",
  openNewsroom: "خبرگزاری را باز کنید",
  mostRead: "پربازدیدترین‌ها",
  featured: "ویژه",
  allStories: "همه خبرها",
  readMore: "خواندن خبر",
  minRead: "دقیقه مطالعه",
  published: "منتشر شد",
  updated: "به‌روز شد",
  by: "به قلم",
  author: "نویسنده",
  views: "بازدید",
  share: "اشتراک",
  copyLink: "کاپی لینک",
  copied: "لینک کاپی شد",
  listen: "بشنوید",
  stop: "توقف",
  audioUnavailable: "پخش صدا در این مرورگر در دسترس نیست.",
  aiBrief: "خلاصه ۶۰ ثانیه‌ای هوش مصنوعی",
  aiBriefIntro: "خلاصه کوتاه و مبتنی بر متن همین خبر.",
  generateBrief: "ساخت خلاصه",
  generating: "در حال نوشتن خلاصه…",
  aiDisclaimer:
    "هوش مصنوعی ممکن است اشتباه کند. این خلاصه فقط از همین مقاله ساخته شده و گزارش مستقل نیست.",
  askAi: "از بودا AI بپرسید",
  askTitle: "میز خبری هوش مصنوعی",
  askIntro: "درباره خبرهای خبرگزاری بپرسید. پاسخ‌ها بر گزارش‌های BMG استوارند.",
  askPlaceholder: "امروز درباره منطقه چه چیزی را باید بدانم؟",
  send: "ارسال",
  thinking: "در حال خواندن خبرگزاری…",
  askError: "میز هوش مصنوعی اکنون پاسخ نداد. دوباره تلاش کنید.",
  suggestion1: "خبرهای اصلی امروز کدام‌اند؟",
  suggestion2: "توافق امنیت مرزی را توضیح بده.",
  suggestion3: "امسال برای زنان چه تغییری آمد؟",
  suggestion4: "کدام خبرها دیدگاه‌اند، نه گزارش؟",
  newsletterTitle: "خلاصه BMG",
  newsletterText: "هر صبح یک ایمیل آرام: خبرهایی که مهم‌اند، به زبان خودتان.",
  emailPlaceholder: "ایمیل شما",
  subscribe: "اشتراک",
  subscribing: "در حال اشتراک…",
  subscribed: "شما در فهرست هستید.",
  newsletterError: "این کار نشد. نشانی را بررسی و دوباره تلاش کنید.",
  newsletterPrivacy: "بدون هرزنامه. هر وقت بخواهید لغو کنید.",
  newsletterConsent: "می‌خواهم خلاصه BMG را دریافت کنم و سیاست حریم خصوصی را خوانده‌ام.",
  newsletterPending: "تقریباً تمام شد. ایمیل تأییدی را که فرستادیم باز کنید و روی پیوند کلیک کنید.",
  newsletterConfirmed: "اشتراک شما تأیید شد. به خلاصه BMG خوش آمدید.",
  newsletterInvalid: "پیوند تأیید نامعتبر یا منقضی شده است.",
  unsubscribed: "شما از فهرست خلاصه BMG حذف شدید.",
  demoBadge: "محتوای نمونه",
  demoNotice:
    "این خبر محتوای نمونه‌ای است که همراه قالب خبرگزاری ارائه می‌شود. این گزارش بودا نیوز نیست، نام نویسنده جایگزین است و نقل‌قول‌ها نمونه‌اند. این خبر از موتورهای جستجو و خبرنامه حذف شده است.",
  demoHomeTitle: "محتوای نمونه برچسب خورده است",
  demoHomeBody:
    "برخی از خبرها در این سایت محتوای نمونه برای نمایش چیدمان هستند. آنها نشان نمونه دارند، نام نویسنده جایگزین است و از موتورهای جستجو، نقشه سایت و RSS حذف شده‌اند.",
  sections: "بخش‌ها",
  company: "شرکت",
  follow: "دنبال کنید",
  rights: "تمام حقوق محفوظ است.",
  independence: "مستقل · سه زبان · با حمایت خوانندگان",
  about: "درباره",
  contact: "تماس",
  tipLine: "خط امن خبر",
  privacy: "حریم خصوصی",
  terms: "شرایط",
  editorial: "سیاست تحریریه",
  searchTitle: "جستجو در خبرگزاری",
  searchPlaceholder: "نام‌ها، مکان‌ها، موضوعات…",
  searchResults: "نتیجه",
  noResults: "خبری با این جستجو پیدا نشد.",
  searchHint: "بر اساس عنوان، مکان یا موضوع جستجو کنید.",
  searchNoResultsHint: "واژه گسترده‌تری را امتحان کنید یا بخشی را ببینید.",
  related: "گزارش‌های مرتبط",
  tags: "موضوعات",
  backHome: "بازگشت به صفحه اصلی",
  notFoundTitle: "این صفحه در این شماره نیست.",
  notFoundText: "شاید لینک قدیمی است یا خبر جابه‌جا شده. صفحه اصلی جای خوبی برای شروع است.",
  loading: "در حال بارگذاری خبرگزاری…",
  errorTitle: "چیزی اشتباه شد",
  errorText: "خبرگزاری نتوانست این صفحه را بارگذاری کند. دوباره تلاش کنید.",
  retry: "تلاش دوباره",
  translationNotice: "این خبر فعلاً فقط به انگلیسی موجود است.",
  originalEnglish: "خواندن به انگلیسی",
  liveDesk: "میز زنده",
  watchLive: "تماشای پخش زنده",
  listenArticle: "شنیدن این خبر",
  contents: "در این خبر",
  askAboutArticle: "از AI درباره این خبر بپرسید",
  opinion: "دیدگاه",
  specialReport: "گزارش ویژه",
  video: "ویدیو",
  shareOn: "اشتراک در",
  print: "چاپ",
  contactUs: "تماس با خبرگزاری",
  newsroomLogin: "ورود به خبرگزاری",
  sendMessage: "ارسال پیام",
  messageSent: "پیام شما به خبرگزاری رسید.",
  messageError: "پیام ارسال نشد. دوباره تلاش کنید.",
  name: "نام",
  email: "ایمیل",
  subject: "موضوع",
  messageLabel: "پیام",
  tipIntro: "معلومات حساس نباید از ایمیل عادی یا پیام شبکه‌های اجتماعی عبور کند.",
  tipWarning: "BMG تا تأیید نهایی، کلید PGP یا شماره سیگنال منتشر نمی‌کند.",
  tipSignalLabel: "شماره سیگنال تأییدشده",
  tipSteps: "چگونه امن تماس بگیریم",
  tipNoEmail: "برای خبر حساس از ایمیل عادی استفاده نکنید.",
  tipSecureChannels: "از سیگنال یا فرم تماس برای پیام‌های غیرحساس استفاده کنید.",
  tipWhatToSend: "اسناد، تاریخ‌ها و نام‌ها را بفرستید — هویت خود را فقط اگر بخواهید.",
  tipProtectYourself: "از وسیله‌ای استفاده کنید که مشترک نیست و نسخه‌های محلی را پاک کنید.",
  privacyIntro: "بودا نیوز یک خبرگزاری است، نه شبکه تبلیغات. حداقل معلومات را جمع می‌کنیم.",
  privacyData: "ما نشانی خبرنامه، پیام‌ها، شمار بازدید و ثبت امنیتی را نگه می‌داریم. معلومات شخصی نمی‌فروشیم.",
  privacyCookies: "سایت زبان و ظاهر شما را در مرورگر ذخیره می‌کند. کوکی تبلیغاتی ندارد.",
  privacyRights: "می‌توانید اصلاح یا حذف معلومات شخصی خود را بخواهید.",
  privacyContact: "فرم تماس",
  termsIntro: "با استفاده از بودا نیوز با این شرایط موافقت می‌کنید.",
  termsUse: "می‌توانید خبرهای ما را بخوانید، لینک دهید و با ذکر منبع نقل کنید.",
  termsContent: "گزارش‌ها خدمت عامه‌اند. دیدگاه‌ها مشخص شده و نظر نویسنده را بیان می‌کنند.",
  termsLiability: "ما دقت می‌کنیم، اما سایت بدون تضمین است. معلومات امنیتی یا مالی را تأیید کنید.",
  termsChanges: "تغییرات مهم در این صفحه نشر می‌شود.",
  editorialIntro: "بودا میدیا گروپ یک نهاد خبری مستقل سه‌زبانه است.",
  editorialSourcing: "هر گزارش در حد امکان با دو منبع مستقل بررسی می‌شود. اسناد از نظر اصالت کتل می‌شوند.",
  editorialCorrections: "وقتی اشتباه کنیم، سریع اصلاح می‌کنیم و می‌گوییم چه تغییر کرد.",
  editorialAi: "هوش مصنوعی در تهیه خلاصه و ترجمه کمک می‌کند. سردبیر انسانی مسئول نشر است.",
  editorialOwnership: "BMG متعلق به خبرنگاران بنیان‌گذار آن است.",
  editorialComplaints: "شکایت‌ها به خبرگزاری برسد. در پنج روز کاری پاسخ می‌دهیم.",
  ourMission: "مأموریت ما",
  ourTeam: "خبرگزاری",
  ownership: "مالکیت و تأمین مالی",
  funding: "تأمین مالی",
  correctionsPolicy: "اصلاحات",
  aiPolicy: "سیاست هوش مصنوعی",
  aboutPageTitle: "درباره بودا مدیا گروپ — بودا نیوز",
  aboutPageDescription:
    "بودا مدیا گروپ یک خبرگزاری مستقل سه‌زبانه است که به انگلیسی، پشتو و دری درباره افغانستان، آسیای مرکزی و جنوبی گزارش نشر می‌کند.",
  aboutPageKicker: "بودا مدیا گروپ",
  aboutHeroTitle: "خبرگزاری‌ای برای منطقه‌ای که در یک زبان نمی‌گنجد.",
  aboutHeroIntro:
    "BMG به انگلیسی، پشتو و دری گزارش نشر می‌کند؛ با یک معیار تحریری واحد و یک سابقهٔ عمومی. این وب‌سایت طوری ساخته شده تا خبرگزاری بتواند در درازمدت مالک آن باشد و آن را اداره کند.",
  aboutMissionFirst:
    "ژورنالیزم مستقل در افغانستان و منطقهٔ گسترده‌تر پرهزینه، پرخطر و ضروری است. BMG برای پایدارساختن آن فعالیت می‌کند: گزارش‌های راستی‌آزمایی‌شده، منابع روشن و خبرگزاری‌ای که مردم بتوانند به زبانی بخوانند که واقعاً استفاده می‌کنند.",
  aboutMissionSecond:
    "ما سیاست و امنیت را پوشش می‌دهیم، اما به اقتصاد، آموزش، فرهنگ، ورزش و تصمیم‌های روزمره‌ای هم می‌پردازیم که بر زندگی خانواده‌ها اثر می‌گذارند. به سه زبان نشر می‌کنیم، چون خبرگزاری تک‌زبانه بیشتر مردم منطقه را کنار می‌گذارد.",
  aboutNewsroomFirst:
    "خبرگزاری بر محور یک میز مرکزی و همکاران منطقه‌ای سازمان یافته است. دبیران اطلاعات را راستی‌آزمایی می‌کنند، خبرنگاران گزارش تهیه می‌کنند و گروه تصویری عکس، گرافیک و ویدیو آماده می‌سازد. نام خبرنگاران آزاد ذکر می‌شود و حق‌الزحمهٔ آنان پرداخت می‌گردد؛ از منابع حساس محافظت می‌شود.",
  aboutNewsroomSecond:
    "هر گزارشی در این بایگانی از داشبورد خبرگزاری قابل ویرایش، اصلاح یا برداشتن از نشر است. اصلاحات در دفتر ثبت رویدادها ثبت می‌شود و تاریخ آن در گزارش می‌آید.",
  aboutOwnershipText:
    "BMG ملکیت خبرنگاران بنیان‌گذار آن است. مدل درآمدی آن حمایت خوانندگان، بازنشر و توزیع گزارش‌ها، و همکاری‌هایی است که به‌روشنی اعلام می‌شوند. کمک مالی‌ای که ممکن است بر پوشش خبری اثر بگذارد، در گزارش و در همین صفحه افشا می‌شود.",
  aboutStudioAlt: "استودیوی پخش با یک میز، نمایشگرها و نور گرم.",
  aboutLanguageTitle: "سه زبان",
  aboutLanguageText: "انگلیسی، پشتو و دری از یک معیار تحریری پیروی می‌کنند.",
  aboutSecurityTitle: "امنیت در اولویت",
  aboutSecurityText: "ثبت رویدادهای امنیتی، محدودیت درخواست‌ها و خبرگزاری محافظت‌شده.",
  aboutAiTitle: "هوش مصنوعی با نظارت دبیر انسانی",
  aboutAiText: "کمک در تهیهٔ خلاصه و ترجمه، نه ساختن اطلاعات.",
  aboutContactText: "پرسش‌ها دربارهٔ همکاری، اصلاح گزارش‌ها و خبرگزاری.",
  footerNote: "گزارش‌های مستقل و سه‌زبانه از افغانستان، آسیای مرکزی و جنوبی. انتشار از سوی بودا مدیا گروپ.",
  languageEnglish: "English",
  languagePashto: "پښتو",
  languageDari: "دری",
  all: "همه",
  filters: "فیلتر",
  clear: "پاک کردن",
  loadingMore: "در حال بارگذاری…",
  noMore: "خبر بیشتری نیست",
};

const DICTS: Record<Locale, Record<DictKey, string>> = { en, ps, fa };

type I18nContextValue = {
  locale: Locale;
  dir: "ltr" | "rtl";
  setLocale: (locale: Locale) => void;
  t: (key: DictKey, vars?: Record<string, string | number>) => string;
  formatDate: (value: string | Date | null | undefined) => string;
  formatNumber: (value: number) => string;
};

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

function initialLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  try {
    const fromPath = splitLocalePath(window.location.pathname);
    if (fromPath.hadLocale) return fromPath.locale;
    const fromUrl = new URLSearchParams(window.location.search).get("lang");
    if (isLocale(fromUrl)) return fromUrl;
    const stored = window.localStorage.getItem("bn-locale");
    if (isLocale(stored)) return stored;
  } catch {
    // storage can be blocked
  }
  return DEFAULT_LOCALE;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const route = splitLocalePath(location);
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  // The URL is the source of truth: a shared /ps/ link opens in Pashto even if
  // this browser last read English.
  useEffect(() => {
    if (route.hadLocale && route.locale !== locale) {
      setLocaleState(route.locale);
    }
  }, [route.hadLocale, route.locale, locale]);

  useEffect(() => {
    const root = document.documentElement;
    root.lang = localeHtmlLang(locale);
    root.dir = localeDir(locale);
    try {
      window.localStorage.setItem("bn-locale", locale);
    } catch {
      // ignore storage failures
    }
  }, [locale]);

  /**
   * Switching language keeps the reader on the same page by rewriting the
   * locale segment (`/en/article/x` -> `/ps/article/x`). The server resolves
   * the localized slug, so a translated URL is used when one exists.
   */
  const setLocale = useCallback(
    (next: Locale) => {
      if (next === locale) return;
      rememberLocale(next);
      setLocaleState(next);
      const search = typeof window === "undefined" ? "" : window.location.search;
      const target = route.hadLocale
        ? `/${next}${route.path === "/" ? "/" : route.path}${search}`
        : `/${next}${location === "/" ? "/" : location}${search}`;
      setLocation(target);
    },
    [locale, location, route.hadLocale, route.path, setLocation]
  );

  const t = useCallback(
    (key: DictKey, vars?: Record<string, string | number>) => {
      let value = DICTS[locale][key] ?? DICTS.en[key] ?? key;
      if (vars) {
        for (const [name, replacement] of Object.entries(vars)) {
          value = value.replaceAll(`{${name}}`, String(replacement));
        }
      }
      return value;
    },
    [locale]
  );

  const formatDate = useCallback(
    (value: string | Date | null | undefined) => {
      if (!value) return "";
      const date = typeof value === "string" ? new Date(value) : value;
      if (Number.isNaN(date.getTime())) return "";
      const tag = locale === "en" ? "en-GB" : locale === "ps" ? "ps-AF" : "fa-AF";
      try {
        return new Intl.DateTimeFormat(tag, {
          day: "numeric",
          month: "short",
          year: "numeric",
        }).format(date);
      } catch {
        return date.toISOString().slice(0, 10);
      }
    },
    [locale]
  );

  const formatNumber = useCallback(
    (value: number) => {
      try {
        return new Intl.NumberFormat(locale === "en" ? "en-GB" : locale).format(value);
      } catch {
        return String(value);
      }
    },
    [locale]
  );

  const value = useMemo(
    () => ({
      locale,
      dir: localeDir(locale),
      setLocale,
      t,
      formatDate,
      formatNumber,
    }),
    [locale, setLocale, t, formatDate, formatNumber]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used inside I18nProvider");
  return context;
}
