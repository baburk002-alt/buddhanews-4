import type { Locale } from "../shared/news";
import { createArticle, getDb, updateSettings } from "./db";
import { articles } from "../drizzle/schema";

type Copy = { title: string; summary: string; content: string };

type SeedArticle = {
  slug: string;
  category: string;
  subcategory?: string;
  coverImage: string;
  coverAlt: string;
  authorName: string;
  featured?: boolean;
  breaking?: boolean;
  readMinutes: number;
  tags: string[];
  daysAgo: number;
  en: Copy;
  ps: Copy;
  fa: Copy;
};

const IMG = {
  summit: "/manus-storage/async-images/akRWbaZIfF90516gm3G7jf/image-1.webp",
  education: "/manus-storage/async-images/akRWbaZIfF90516gm3G7jf/image-2.webp",
  rights: "/manus-storage/async-images/akRWbaZIfF90516gm3G7jf/image-3.webp",
  energy: "/manus-storage/async-images/akRWbaZIfF90516gm3G7jf/image-4.webp",
  trade: "/manus-storage/async-images/akRWbaZIfF90516gm3G7jf/image-5.webp",
  cricket: "/manus-storage/async-images/YXI3U8B7PmDNHU8a8gDjhr/image-1.webp",
  silkRoad: "/manus-storage/async-images/YXI3U8B7PmDNHU8a8gDjhr/image-2.webp",
  women: "/manus-storage/async-images/YXI3U8B7PmDNHU8a8gDjhr/image-3.webp",
  studio: "/manus-storage/async-images/YXI3U8B7PmDNHU8a8gDjhr/image-4.webp",
  economy: "/manus-storage/async-images/YXI3U8B7PmDNHU8a8gDjhr/image-5.webp",
};

export const SEED: SeedArticle[] = [
  {
    slug: "regional-summit-border-security-accord",
    category: "afghanistan",
    subcategory: "politics",
    coverImage: IMG.summit,
    coverAlt: "Delegates seated around a round table at a regional summit in a softly lit conference hall.",
    authorName: "Farid Rahimi",
    featured: true,
    breaking: true,
    readMinutes: 6,
    tags: ["diplomacy", "border security", "regional summit"],
    daysAgo: 0,
    en: {
      title: "Regional Summit Ends With Border-Security Accord and a Cautious Opening",
      summary:
        "Six neighboring states agreed on a joint border-monitoring mechanism, but stopped short of formal recognition of the Taliban administration.",
      content: `Delegations from six neighboring states closed a two-day regional summit on Thursday with an agreement to share border-security data and establish a joint monitoring room, according to a communiqué released after the talks.

The mechanism will begin as a six-month pilot. Officials say it is intended to reduce cross-border smuggling and coordinate responses to armed groups along the region's long and porous frontiers. Each participating state will second two liaison officers to the monitoring room.

The communiqué did not use the word "recognition" in connection with the Taliban administration. Several delegates said formal ties remain conditional on progress in girls' education and an inclusive political process.

## What was agreed

- A joint border-monitoring room staffed by liaison officers from each state.
- A shared list of wanted smuggling networks, reviewed every quarter.
- A technical working group on rail and energy connectivity.
- A humanitarian corridor covering medicine and food shipments.

## What was not

The summit ended without a joint statement on Afghanistan's frozen central-bank reserves, an issue that has divided participants for more than a year. Two delegations also blocked a proposal to invite Taliban representatives as observers.

Analysts said the meeting's value lay in keeping channels open rather than in any single deliverable. "The region is buying time and building habits of consultation," said one researcher briefed on the talks, who asked not to be named because the discussions were private.

For border communities, the practical test will be whether the monitoring room changes anything at crossings, where traders and families still wait hours for clearance. Officials said the first progress report is due in March.`,
    },
    ps: {
      title: "سیمه‌ایزه غونډه د پولې امنیت توافق او یوې محتاطې پرانیستې سره پای ته ورسېده",
      summary:
        "شپږ ګاونډیو هېوادونو د ګډې پولې د څار میکانیزم پر سر توافق وکړ، خو د طالبانو ادارې رسمي پیژندنه یې ونه کړه.",
      content: `د شپږو ګاونډیو هېوادونو استازو دوه ورځنۍ سیمه‌ایزه غونډه د پولې امنیتي معلوماتو شریکولو او د ګډې څارنې خونې جوړولو هوکړې سره پای ته ورسوله.

دا میکانیزم به د شپږو میاشتو لپاره د ازموینې په توګه پیل شي. چارواکي وايي هدف یې د پولې هاخوا قاچاق کمول او د وسله والو ډلو په وړاندې همغږي دي. هر ګډونوال هېواد به دوه اړیکه ټینګونکي افسران دې خونې ته واستوي.

په اعلامیه کې د طالبانو ادارې د پیژندنې کلمه نه ده راغلې. څو استازو وویل چې رسمي اړیکې لا هم د نجونو زده کړې او د ټولو ښکېلو خواوو په سياسي بهیر پورې تړلې دي.

## څه توافق شول

- د ګډې پولې څارنې خونه چې هر هېواد پکې افسران لري.
- د غوښتل شوو قاچاقي شبکو ګډه لړلیک چې هره ربع کتنه کیږي.
- د ریل او انرژۍ د نښلولو تخنیکي کاري ګروپ.
- بشري دهلیز د درملو او خوراکي توکو لپاره.

## څه نه شول

غونډه د افغانستان د کنګل شوو مرکزي بانکي زېرمو په اړه ګډه اعلامیه ونه لرله. دوه پلاويو د طالبانو د استازو د څارونکو په توګه د بلنې وړاندیز هم ونه منلو.

شنونکي وايي د غونډې ارزښت د اړیکو ساتل دي، نه یوازې یو توافق. یوې سرچینې چې نوم یې نه ښکاري وویل: "سیمه وخت اخلي او د مشورې عادت جوړوي."

د پولې خلکو لپاره به ریښتینی ازموینه دا وي چې ایا څارنه په تګ راتګ کې بدلون راولي، هلته چې سوداګر او کورنۍ لا هم ساعتونه انتظار کوي.`,
    },
    fa: {
      title: "نشست منطقه‌ای با توافق امنیت مرزی و آغازی محتاطانه پایان یافت",
      summary:
        "شش کشور همسایه بر سازوکار مشترک نظارت مرزی توافق کردند، اما از به رسمیت شناختن رسمی اداره طالبان خودداری نمودند.",
      content: `هیئت‌های شش کشور همسایه نشست دو روزه منطقه‌ای را با توافق بر سر اشتراک معلومات امنیت مرزی و ایجاد اتاق نظارت مشترک به پایان رساندند.

این سازوکار ابتدا به‌صورت آزمایشی شش‌ماهه آغاز می‌شود. مقام‌ها می‌گویند هدف آن کاهش قاچاق فرامرزی و هماهنگی در برابر گروه‌های مسلح در مرزهای طولانی منطقه است. هر کشور دو افسر ارتباطی به اتاق نظارت معرفی می‌کند.

در بیانیه پایانی واژه «به رسمیت شناختن» درباره اداره طالبان به کار نرفته است. شماری از نمایندگان گفتند روابط رسمی همچنان به پیشرفت در آموزش دختران و یک روند سیاسی فراگیر مشروط است.

## آنچه توافق شد

- اتاق مشترک نظارت مرزی با افسران ارتباطی هر کشور.
- فهرست مشترک شبکه‌های قاچاق تحت تعقیب که هر سه ماه بازبینی می‌شود.
- گروه کاری تخنیکی برای اتصال خط آهن و انرژی.
- دهلیز بشردوستانه برای انتقال دارو و مواد غذایی.

## آنچه توافق نشد

نشست بدون بیانیه مشترک درباره ذخایر مسدودشده بانک مرکزی افغانستان پایان یافت؛ موضوعی که بیش از یک سال شرکت‌کنندگان را تقسیم کرده است. دو هیئت نیز پیشنهاد دعوت از نمایندگان طالبان به‌عنوان ناظر را رد کردند.

تحلیلگران می‌گویند ارزش نشست در باز نگه داشتن کانال‌ها بود، نه در یک دستاورد مشخص. یک پژوهشگر که نامش را فاش نکرد گفت: «منطقه زمان می‌خرد و عادت مشورت را می‌سازد.»

برای باشندگان مرز، آزمون واقعی این است که آیا اتاق نظارت در گذرگاه‌ها تغییری می‌آورد، جایی که بازرگانان و خانواده‌ها هنوز ساعت‌ها منتظر می‌مانند.`,
    },
  },
  {
    slug: "community-classrooms-girls-remote-provinces",
    category: "afghanistan",
    subcategory: "women",
    coverImage: IMG.education,
    coverAlt: "Girls reading shared books at wooden desks in a sunlit community classroom.",
    authorName: "Laila Ahmadi",
    featured: true,
    readMinutes: 7,
    tags: ["education", "girls", "remote provinces"],
    daysAgo: 1,
    en: {
      title: "In Remote Provinces, Community Classrooms Keep Girls Learning",
      summary:
        "With formal secondary schooling still restricted, families and volunteer teachers are running home-based classes — and quietly documenting every lesson.",
      content: `In a village three hours from the nearest paved road, twenty-three girls sit on woven mats with shared textbooks open on low wooden desks. The class meets four mornings a week in a room lent by a family. A hand-drawn timetable on the wall lists mathematics, Dari literature and natural science.

The teacher, a former secondary-school instructor who asked that her name not be published, says attendance has grown since the class began last spring. "Mothers bring their daughters before sunrise," she said. "They know what is at stake."

## A patchwork of local solutions

Community classes are not a substitute for a national school system. They rely on donated books, volunteer time and the tolerance of local officials. Attendance records are kept in paper notebooks and photographed each week, so families have evidence if formal schooling reopens.

Aid groups say the model works best where a trusted local institution — a mosque committee, a women's shura or a clinic — hosts the class. Where no such anchor exists, classes are more vulnerable to closure.

## The cost of keeping going

Families describe a quiet calculation: sending a daughter to a nearby city for informal courses costs money and carries risk; keeping her at home costs nothing but limits her world. Most choose a middle path, combining home study with a relative's tutoring.

Teachers say the hardest problem is not books but continuity. A class that loses its room, or its teacher, may not restart. "Every semester we begin again," one organizer said.

BMG is not publishing locations or full names in this report to protect the students and teachers involved.`,
    },
    ps: {
      title: "په لرې پرتو ولایتونو کې ټولنیز صنفونه نجونې زده کړې ته ساتي",
      summary:
        "د منځنيو زده کړو د محدودیتونو په دوام، کورنۍ او رضاکار ښوونکي کورني صنفونه چلوي او هر درس په خاموشۍ سره ثبتوي.",
      content: `له نږدې پخې سړک درې ساعته لرې یوه کلي کې، ۲۳ نجونې پر وړلو د فرشو پر سر ناستې دي او ګډ کتابونه یې پر ټیټو لرګینو میزونو پرتې دي. صنف په اونۍ کې څلور سهارونه د یوې کورنۍ په ورکړل شوې کوټه کې جوړیږي. پر دیوال د لاس په لیکل شوي مهال ویش کې ریاضي، دري ادبیات او طبیعي علوم لیکل شوي.

ښوونکې، چې پخوا د منځني ښوونځي استاده وه او غواړي نوم یې ونه لیکل شي، وايي له تېر پسرلي راهیسې د زده کوونکو شمېر زیات شوی. "مورې خپلې لوڼې له لمر پخوا راولي،" هغې وویل. "دوی پوهیږي چې څه په خطر کې دي."

## د محلي حلونو ټوټه ټوټه لاره

ټولنیز صنفونه د ملي ښوونځي سیستم بدیل نه دي. دوی پر بسپنه شوو کتابونو، رضاکار وخت او د سیمه ییزو چارواکو زغم تکیه کوي. د حاضری ثبت په کاغذي کتابچه کې کیږي او هره اونۍ عکس اخیستل کیږي، تر څو کورنۍ د رسمي زده کړو د بیا پیل په صورت کې شواهد ولري.

مرستندویه موسسې وايي دا ماډل هلته ښه کار کوي چې یو باوري محلي بنسټ — د جومات کمیټه، د ښځو شورا یا کلینیک — صنف ته ځای ورکړي. چېرې چې دا ډول بنسټ نه وي، صنفونه د بندیدو خطر سره مخ دي.

## د دوام بیه

کورنۍ یو ډول خاموش حساب کوي: یوه لور نږدې ښار ته د غیر رسمي کورسونو لپاره لیږل پیسې او خطر لري؛ کور کې ساتل یې لګښت نه لري خو د هغې نړۍ محدودوي. ډیری یې منځنی لار غوره کوي.

ښوونکي وايي تر ټولو سخت ستونزه کتابونه نه دي، دوام دی. هغه صنف چې خپله کوټه یا ښوونکی له لاسه ورکړي، ممکن بیا پیل نشي. "هره نیمه کاله موږ له سره پیل کوو،" یو تنظیم کوونکی وویل.

د زده کوونکو او ښوونکو د ساتنې لپاره BMG په دې راپور کې ځایونه او بشپړ نومونه نه خپروي.`,
    },
    fa: {
      title: "در ولایات دوردست، صنف‌های اجتماعی دختران را در حال یادگیری نگه می‌دارند",
      summary:
        "با ادامه محدودیت آموزش متوسطه، خانواده‌ها و معلمان داوطلب صنف‌های خانه‌ای برگزار می‌کنند و هر درس را بی‌صدا ثبت می‌نمایند.",
      content: `در روستایی سه ساعت دورتر از نزدیک‌ترین جاده اسفالت‌شده، بیست و سه دختر روی گلیم‌ها نشسته‌اند و کتاب‌های مشترک روی میزهای چوبی کوتاه باز است. صنف چهار صبح در هفته در اتاقی که یک خانواده در اختیار گذاشته برگزار می‌شود. روی دیوار برنامه‌ای دست‌نویس شامل ریاضی، ادبیات دری و علوم طبیعی دیده می‌شود.

معلم، که پیش‌تر در مکتب متوسطه درس می‌داد و خواست نامش نشر نشود، می‌گوید از آغاز صنف در بهار گذشته شمار شاگردان افزایش یافته است. او گفت: «مادران دختران خود را پیش از طلوع آفتاب می‌آورند. آن‌ها می‌دانند چه چیزی در خطر است.»

## ترکیبی از راه‌حل‌های محلی

صنف‌های اجتماعی جایگزین نظام مکتب ملی نیستند. آن‌ها به کتاب‌های اهدایی، وقت داوطلبانه و تحمل مقام‌های محلی وابسته‌اند. حاضری در دفترهای کاغذی ثبت و هر هفته عکس‌برداری می‌شود تا خانواده‌ها در صورت بازگشایی مکتب رسمی شاهد داشته باشند.

نهادهای امدادی می‌گویند این الگو جایی بهتر کار می‌کند که یک نهاد محلی مورد اعتماد — کمیته مسجد، شورای زنان یا کلینیک — میزبان صنف باشد. در نبود چنین تکیه‌گاهی، صنف‌ها بیشتر در معرض تعطیلی‌اند.

## بهای ادامه دادن

خانواده‌ها محاسبه‌ای خاموش دارند: فرستادن دختر به شهر نزدیک برای کورس غیررسمی پول و خطر دارد؛ نگه داشتن او در خانه هزینه ندارد اما جهانش را محدود می‌کند. بیشتر راه میانه را انتخاب می‌کنند.

معلمان می‌گویند سخت‌ترین مشکل کتاب نیست، تداوم است. صنفی که اتاق یا معلمش را از دست بدهد ممکن است دوباره آغاز نشود. یک برگزارکننده گفت: «هر نیم‌سال از نو شروع می‌کنیم.»

BMG برای حفاظت از شاگردان و معلمان، مکان و نام کامل را در این گزارش نشر نمی‌کند.`,
    },
  },
  {
    slug: "un-rights-council-civil-freedoms-assessment",
    category: "afghanistan",
    subcategory: "human-rights",
    coverImage: IMG.rights,
    coverAlt: "Empty delegate desks and microphones in a United Nations style human rights chamber.",
    authorName: "Sahar Nazari",
    featured: true,
    readMinutes: 5,
    tags: ["United Nations", "civil freedoms", "human rights"],
    daysAgo: 2,
    en: {
      title: "UN Human Rights Council Releases New Assessment on Civil Freedoms",
      summary:
        "The report documents restrictions on assembly, expression and women's employment, and calls for a coordinated international response.",
      content: `The United Nations Human Rights Council has published a new assessment of civil freedoms in Afghanistan, drawing on interviews with more than 180 people conducted over eight months.

The report describes a narrowing space for public assembly, growing restrictions on independent media and the continued exclusion of women from most paid employment. It also documents arbitrary detention of critics and the use of travel bans against families.

## Recommendations

The council calls on member states to coordinate documentation efforts, expand safe migration pathways for at-risk Afghans and maintain humanitarian funding for health and education. It stops short of recommending a specific sanctions package.

The Taliban administration has rejected previous UN reports as politically motivated. A spokesperson said the latest assessment "ignores security realities and the will of the Afghan people."

## A record for the future

Researchers say the report's value is archival as much as diplomatic. Testimony collected now can support future accountability processes, provided it is stored securely and with informed consent.

BMG has reviewed the summary and methodology. The full report is available through the council's documentation portal.`,
    },
    ps: {
      title: "د ملګرو ملتونو د بشري حقونو شورا د مدني ازادیو نوی ارزونه خپره کړه",
      summary:
        "راپور پر غونډو، بیان او د ښځو پر کار د محدودیتونو شواهد وړاندې کوي او د همغږي نړیوال غبرګون غوښتنه کوي.",
      content: `د ملګرو ملتونو د بشري حقونو شورا د افغانستان د مدني ازادیو نوی ارزونه خپره کړه چې پر اتو میاشتو کې له ۱۸۰ څخه زیاتو خلکو سره مرکو ولاړه ده.

راپور د عامه غونډو د ځای تنګیدل، پر خپلواکو رسنیو د محدودیتونو زیاتیدل او د ښځو دوامداره محرومیت له ډیرو معاش لرونکو کارونو څخه تشریح کوي. همدارنګه د نیوکونکو غیرقانوني نیول او پر کورنیو د سفر بندیزونه مستند کوي.

## وړاندیزونه

شورا غړو هېوادونو ته وړاندیز کوي چې د مستندولو هڅې همغږي کړي، د خطر سره مخ افغانانو لپاره خوندي مهاجرت لارې پراخې کړي او د روغتیا او زده کړې بشري بودجه وساتي. د بندیزونو د ځانګړې بستې وړاندیز نه کوي.

د طالبانو ادارې پخواني راپورونه سیاسي انګیزه لرونکي بللي. ویاند وویل نوی ارزونه "امنیتي واقعیتونه او د افغان خلکو اراده نه ګوري."

## د راتلونکي لپاره ثبت

څیړونکي وايي د راپور ارزښت دیپلوماتیک او آرشیفي دواړه دی. اوس ثبت شوې شاهدۍ کولای شي راتلونکي حساب ورکولو بهیر ملاتړ وکړي، که په خوندي ډول او په informed رضایت ساتل شي.

BMG لنډیز او میتودولوژي کتلي دي. بشپړ راپور د شورا د اسنادو په پورتال کې شته.`,
    },
    fa: {
      title: "شورای حقوق بشر سازمان ملل ارزیابی تازه‌ای از آزادی‌های مدنی منتشر کرد",
      summary:
        "گزارش محدودیت‌های تجمع، بیان و اشتغال زنان را مستند می‌کند و خواستار پاسخ هماهنگ بین‌المللی است.",
      content: `شورای حقوق بشر سازمان ملل ارزیابی تازه‌ای از آزادی‌های مدنی در افغانستان منتشر کرد که بر مصاحبه با بیش از ۱۸۰ تن در هشت ماه استوار است.

گزارش از تنگ‌تر شدن فضای تجمع عمومی، افزایش محدودیت رسانه‌های مستقل و ادامه محرومیت زنان از بیشتر کارهای مزدبگیرانه سخن می‌گوید. بازداشت خودسرانه منتقدان و ممنوعیت سفر برای خانواده‌ها نیز مستند شده است.

## توصیه‌ها

شورا از کشورهای عضو می‌خواهد تلاش‌های مستندسازی را هماهنگ کنند، مسیرهای مهاجرت امن برای افغان‌های در معرض خطر بگشایند و بودجه بشردوستانه صحت و آموزش را حفظ کنند. پیشنهاد بسته مشخص تحریم را مطرح نمی‌کند.

اداره طالبان گزارش‌های پیشین ملل متحد را دارای انگیزه سیاسی خوانده است. یک سخنگو گفت ارزیابی تازه «واقعیت‌های امنیتی و اراده مردم افغانستان را نادیده می‌گیرد.»

## سندی برای آینده

پژوهشگران می‌گویند ارزش گزارش هم دیپلوماتیک و هم آرشیوی است. شهادت‌هایی که اکنون ثبت می‌شوند می‌توانند روندهای آینده پاسخگویی را پشتیبانی کنند، به شرط ذخیره امن و رضایت آگاهانه.

BMG خلاصه و روش‌شناسی را بررسی کرده است. گزارش کامل از طریق پورتال اسناد شورا در دسترس است.`,
    },
  },
  {
    slug: "central-asia-energy-grid-expansion-milestone",
    category: "business",
    subcategory: "mining-energy",
    coverImage: IMG.energy,
    coverAlt: "High-voltage transmission pylons running through a mountain valley at dusk.",
    authorName: "Omid Karimi",
    featured: true,
    readMinutes: 5,
    tags: ["energy", "Central Asia", "infrastructure"],
    daysAgo: 3,
    en: {
      title: "Central Asian Energy Grid Expansion Reaches Key Milestone",
      summary:
        "A new 500-kilovolt line links three provincial substations, part of a plan to cut winter outages and export surplus power.",
      content: `A new 500-kilovolt transmission line connecting three provincial substations has entered service after two years of construction, the regional grid operator said this week.

The line is the first phase of a larger plan to reinforce the region's north-south corridor. Officials say it will reduce winter outages in upland districts and allow surplus summer power to flow toward export markets.

## Financing and delays

The project was financed by a combination of development-bank loans and national budget funds. It ran eight months behind schedule because of land-acquisition disputes and a shortage of specialized transformers.

A second phase, covering a further 180 kilometers of line and two new substations, is scheduled to begin next year. Whether it proceeds on time will depend on a financing review due in the spring.

## What it means for households

Engineers say the immediate benefit is stability, not lower bills. The line gives the grid operator more options when a single substation fails, reducing the risk of cascading blackouts.

Consumer tariffs are set separately and are not expected to change this winter. The operator has published a maintenance schedule on its website.`,
    },
    ps: {
      title: "د مرکزي آسیا د انرژۍ شبکې پراختیا مهم پړاو ته ورسېده",
      summary:
        "نوی ۵۰۰ کیلوولټه کرښه درې ولایتي سبسټیشنونه نښلوي؛ د ژمي د بندونو کمولو او د اضافي بریښنا د صادراتو پلان برخه ده.",
      content: `د سیمه ییزې شبکې چلونکې موسسې دې اونۍ وویل چې دوه کاله وروسته د درې ولایتي سبسټیشنونو نښلونکې نوې ۵۰۰ کیلوولټه انتقالي کرښه په کار پیل شوه.

دا کرښه د سیمې د شمال-جنوب دهلیز د پیاوړتیا د لوی پلان لومړی پړاو دی. چارواکي وايي دا به د غرنیو ولسوالیو ژمني بندونه کم کړي او د اوړي اضافي بریښنا صادراتو ته لاره هواره کړي.

## تمویل او ځنډ

پروژه د پراختیایي بانکونو پورونو او ملي بودجې له ترکیب تمویل شوه. د ځمکې د اخیستنې د شخړو او د ځانګړو ټرانسفارمرونو د کمښت له امله اتو میاشتو ځنډ سره مخ شوه.

دویم پړاو چې ۱۸۰ کیلومتره نوره کرښه او دوه نوي سبسټیشنونه لري، د راتلونکي کال لپاره ټاکل شوی. په وخت پیلیدل یې د پسرلي د تمویل بیاکتنې پورې تړلي دي.

## د کورنیو لپاره معنا

انجینران وايي سمدلاسه ګټه ثبات دی، نه د بل کمیدل. کرښه چلونکې موسسې ته د یو سبسټیشن د خرابیدو په صورت کې زیات انتخابونه ورکوي او د زنځیري قطعیدو خطر کموي.

د مصرفوونکو تعرفې جلا ټاکل کیږي او تمه نه کیږي چې دا ژمی بدلې شي.`,
    },
    fa: {
      title: "توسعه شبکه انرژی آسیای میانه به مرحله کلیدی رسید",
      summary:
        "یک خط جدید ۵۰۰ کیلوولتی سه سب‌استیشن ولایتی را به هم وصل می‌کند؛ بخشی از طرح کاهش قطعی زمستانی و صادرات برق اضافی.",
      content: `شرکت عامل شبکه منطقه‌ای این هفته گفت یک خط انتقال جدید ۵۰۰ کیلوولتی که سه سب‌استیشن ولایتی را به هم وصل می‌کند، پس از دو سال ساخت وارد خدمت شد.

این خط مرحله نخست طرح بزرگ‌تر تقویت دهلیز شمال-جنوب منطقه است. مقام‌ها می‌گویند قطعی زمستانی در ولسوالی‌های کوهستانی را کاهش می‌دهد و امکان صادرات برق اضافی تابستان را فراهم می‌سازد.

## تأمین مالی و تأخیر

پروژه با ترکیبی از وام بانک‌های توسعه و بودجه ملی تأمین مالی شد. به دلیل منازعات خرید زمین و کمبود ترانسفورماتورهای خاص، هشت ماه تأخیر داشت.

مرحله دوم شامل ۱۸۰ کیلومتر خط دیگر و دو سب‌استیشن جدید، سال آینده آغاز می‌شود. آغاز به‌موقع آن به بازبینی تأمین مالی در بهار بستگی دارد.

## معنای آن برای خانه‌ها

مهندسان می‌گویند سود فوری ثبات است، نه کاهش بیل. این خط به شرکت شبکه هنگام خرابی یک سب‌استیشن گزینه‌های بیشتری می‌دهد و خطر قطعی زنجیره‌ای را کم می‌کند.

تعرفه مصرف‌کنندگان جداگانه تعیین می‌شود و انتظار نمی‌رود این زمستان تغییر کند.`,
    },
  },
  {
    slug: "new-trade-corridors-regional-exports",
    category: "business",
    subcategory: "trade",
    coverImage: IMG.trade,
    coverAlt: "Stacked shipping containers and a freight train at a Central Asian terminal at blue hour.",
    authorName: "Nadia Sultani",
    readMinutes: 4,
    tags: ["trade", "rail", "customs"],
    daysAgo: 4,
    en: {
      title: "New Trade Corridors Open Opportunity for Regional Exports",
      summary:
        "Freight operators say simplified customs and a new rail link could cut transit times by a third, if financing holds.",
      content: `A new rail-and-road corridor linking three landlocked provinces to a southern port carried its first commercial container train last week, according to the transport ministry.

The route combines a rehabilitated rail spur with a streamlined customs arrangement. Operators say transit times for non-perishable goods could fall from 18 days to about 12 once the system is fully operational.

## The numbers behind the promise

Officials estimate the corridor can handle 4 million tons a year at full capacity. Current traffic is a fraction of that. Reaching the target depends on new rolling stock, a second border crossing and reliable power for cold storage.

Exporters of dried fruit and carpets say the biggest obstacle is not distance but predictability. "A buyer in Europe does not care that the route is shorter if the container arrives two weeks late," one exporter said.

## Risks to watch

Freight rates remain volatile, and the corridor crosses territory where insurance premiums are high. A financing package for the next phase has not been finalized.

The ministry says a joint committee will publish monthly transit data, a measure intended to build confidence among shippers.`,
    },
    ps: {
      title: "نوي سوداګریز دهلیزونه د سیمه ییزو صادراتو لپاره فرصتونه برابروي",
      summary:
        "د بار وړلو شرکتونه وايي ساده کړل شوي ګمرکي پروسې او نوې ریل کرښه کولای شي د سفر وخت دریمه برخه کم کړي، که تمویل دوام وکړي.",
      content: `د ترانسپورت وزارت وايي د درې وچو ولایتونو د جنوبي بندر سره نښلونکې نوې ریل او سړک لار تېره اونۍ لومړی سوداګریز کانټینر ریل وویست.

دا لار د بیا رغول شوې ریل کرښې او ساده شوې ګمرکي پروسې ترکیب دی. چلونکي وايي د نه خرابیدونکو توکو د سفر وخت له ۱۸ ورځو شاوخوا ۱۲ ته راښکته کیدای شي.

## د ژمنې شمېرې

چارواکي اټکل کوي چې بشپړ ظرفیت سره دا دهلیز کولای شي کال کې ۴ میلیونه ټنه انتقال کړي. اوسنی ترافیک یې یوازې یوه برخه ده. د هدف رسیدل نوي ریل ګاډي، دویم پوله‌ای تګ راتګ او د سړو ذخیرو لپاره باوري بریښنا ته اړتیا لري.

د وچو میوو او قالینو صادرونکي وايي تر ټولو لوی خنډ واټن نه، وړاندوینه ده. یو صادرونکی وویل: "په اروپا کې پیرودونکی دې ته نه ګوري چې لار لنډه ده، که کانټینر دوه اونۍ ناوخته ورسیږي."

## د پاملرنې خطرونه

د بار نرخونه لا هم بدلونکي دي او لار هغه سیمې ته ځي چې د بیمې فیسونه لوړ دي. د راتلونکي پړاو لپاره د تمویل بسته نه ده نهایي شوې.

وزارت وايي ګډه کمیټه به میاشتني ترانزیتي معلومات خپاره کړي.`,
    },
    fa: {
      title: "دهلیزهای جدید تجارتی فرصت‌های تازه برای صادرات منطقه‌ای ایجاد می‌کنند",
      summary:
        "شرکت‌های باربری می‌گویند ساده‌سازی گمرک و خط آهن جدید می‌تواند زمان ترانزیت را یک‌سوم کاهش دهد، به شرط ادامه تأمین مالی.",
      content: `وزارت ترانسپورت گفت دهلیز جدید ریل و جاده که سه ولایت محاط به خشکه را به یک بندر جنوبی وصل می‌کند، هفته گذشته نخستین قطار کانتینری تجارتی خود را اعزام کرد.

این مسیر ترکیبی از خط آهن بازسازی‌شده و روش ساده‌شده گمرکی است. شرکت‌های عامل می‌گویند زمان ترانزیت کالاهای غیرفاسدشدنی از ۱۸ روز به حدود ۱۲ روز کاهش می‌یابد.

## اعداد پشت وعده

مقام‌ها برآورد می‌کنند این دهلیز در ظرفیت کامل سالانه چهار میلیون تن را جابه‌جا کند. ترافیک فعلی بخش کوچکی از آن است. رسیدن به هدف به واگن‌های جدید، گذرگاه دوم مرزی و برق قابل اعتماد برای ذخیره سرد نیاز دارد.

صادرکنندگان میوه خشک و قالین می‌گویند بزرگ‌ترین مانع فاصله نیست، قابل پیش‌بینی بودن است. یک صادرکننده گفت: «خریدار در اروپا به کوتاه بودن مسیر اهمیت نمی‌دهد اگر کانتینر دو هفته دیر برسد.»

## خطرهای قابل توجه

نرخ‌های بار هنوز بی‌ثبات است و مسیر از مناطقی می‌گذرد که حق بیمه بالا دارد. بسته تأمین مالی مرحله بعد نهایی نشده است.

وزارت می‌گوید یک کمیته مشترک معلومات ماهانه ترانزیت را نشر می‌کند.`,
    },
  },
  {
    slug: "national-cricket-team-thrilling-series-victory",
    category: "sports",
    subcategory: "cricket",
    coverImage: IMG.cricket,
    coverAlt: "A cricket batsman silhouetted under floodlights in front of a packed night stadium.",
    authorName: "Bilal Noori",
    featured: true,
    readMinutes: 3,
    tags: ["cricket", "national team", "series"],
    daysAgo: 1,
    en: {
      title: "National Cricket Team Secures Thrilling Victory in International Series",
      summary:
        "A last-over finish in front of a packed stadium gave the national side its first series win of the season.",
      content: `The national cricket team won its first international series of the season on Sunday, chasing down a target of 168 with two balls to spare in front of a sold-out stadium.

Opening batsman Rahmat Shah anchored the chase with 71 runs from 52 balls, while the lower order held its nerve after two quick wickets in the 18th over. The winning run came from a clipped drive through midwicket.

## A patient build

The visitors had set a competitive total on a slow pitch, relying on spin through the middle overs. The home side's plan was simpler: keep wickets in hand and attack the final five overs. It worked, narrowly.

The captain credited the bowlers for restricting the opposition to 167. "We were maybe ten runs short with the ball," he said. "The batters covered it."

## What comes next

The team travels next month for a three-match away series. Selectors say two uncapped players will join the squad as cover for injuries.

Cricket remains one of the country's most watched sports, with viewing figures peaking during the final over.`,
    },
    ps: {
      title: "د کرکټ ملي ټیم په نړیوالو سیالیو کې په زړه پورې بریا ترلاسه کړه",
      summary:
        "د پای وروستي اوور په پایله کې، د ډکې لوبغالي په وړاندې ملي ټیم د موسم لومړنۍ لړۍ وګټله.",
      content: `د کرکټ ملي ټیم یکشنبه د موسم لومړنۍ نړیواله لړۍ وګټله او د ډک لوبغالي په وړاندې یې ۱۶۸ هدف دوه توپو پاتې کیدو سره بشپړ کړ.

پرانیستونکي بېټسمین رحمت شاه ۵۲ توپو کې ۷۱ منډې وکړې، او لاندینیو بېټسمینانو د ۱۸م اوور د دوو چټکو ویکټو وروسته زړه ساتلی. ګټونکې منډه د مډویکټ له لارې د یوې نرمې ډرایو څخه راغله.

## صبرناکه جوړونه

میلمنو په ورو پچ کې سیالۍ وړ مجموعه جوړه کړه او د منځنیو اوورونو په اوږدو کې پر سپین تکیه وکړه. کوربه ټیم پلان ساده و: ویکټې وساتل او وروستي پنځه اوورونه برید وکړل.

کپتان د بالرانو د محدودیت ستاینه وکړه. "موږ شاید لس منډې کمې وې،" هغه وویل. "بېټسمینانو یې پوره کړې."

## بل څه

ټیم به راتلونکې میاشت د درې لوبو لپاره بهر سفر وکړي. ټاکونکي وايي دوه نوي لوبغاړي به د زخمیانو د بدلون په توګه شامل شي.

کرکټ د هېواد له ډیرو کتل شوو ورزشونو څخه دی.`,
    },
    fa: {
      title: "تیم ملی کریکت در مسابقات بین‌المللی به پیروزی هیجان‌انگیزی دست یافت",
      summary:
        "پایان در اور آخر در برابر استادیوم پرتماشاچی، نخستین برد سری این فصل را برای تیم ملی رقم زد.",
      content: `تیم ملی کریکت یکشنبه نخستین سری بین‌المللی این فصل را برد و در برابر استادیوم پر، هدف ۱۶۸ را با دو توپ باقی‌مانده تکمیل کرد.

رحمت شاه، بتسمان آغازین، با ۷۱ دوش از ۵۲ توپ لنگر انداخت و بازیکنان پایین‌تر پس از دو ویکت سریع در اور هجدهم آرامش خود را حفظ کردند. دوش برنده با یک درایو آرام از میدویکت آمد.

## ساخت صبورانه

مهمانان روی پیچ کند مجموع رقابتی ساختند و روی اسپین در اورهای میانی تکیه کردند. پلان میزبان ساده بود: ویکت‌ها را نگه دار و پنج اور آخر حمله کن.

کاپیتان از توپ‌اندازان به خاطر محدود کردن حریف به ۱۶۷ ستایش کرد. او گفت: «شاید ده دوش کم بودیم؛ بتسمان‌ها جبران کردند.»

## بعد از این

تیم ماه آینده برای سری سه مسابقه سفر می‌کند. انتخاب‌کنندگان می‌گویند دو بازیکن بدون سابقه به‌عنوان جانشین مصدومان اضافه می‌شوند.`,
    },
  },
  {
    slug: "preserving-silk-road-heritage-calligraphy",
    category: "culture",
    subcategory: "heritage",
    coverImage: IMG.silkRoad,
    coverAlt: "An artisan's hands restoring a gold-leaf manuscript with brushes and ink pots.",
    authorName: "Zohra Yousufi",
    featured: true,
    readMinutes: 7,
    tags: ["heritage", "calligraphy", "conservation"],
    daysAgo: 5,
    en: {
      title: "Preserving Ancient Silk Road Heritage and Calligraphy Traditions",
      summary:
        "A new conservation workshop is training young artisans to repair manuscripts and keep a fragile craft alive.",
      content: `In a converted courtyard house, six young apprentices lean over a nineteenth-century manuscript, learning to lift a water stain without lifting the ink beneath it.

The workshop opened this year with support from a heritage foundation and a local university. Its aim is practical: train a new generation of conservators while documenting private collections that have never been catalogued.

## A craft of patience

Conservation is slow work. A single folio can take a week: testing paper, matching pigments, humidifying and flattening. The apprentices spend their first month on blank practice sheets before touching an original.

The lead conservator, who trained abroad and returned five years ago, says the biggest risk is not theft but neglect. "Paper dies quietly," she said. "Heat, damp, insects, sunlight. By the time a family notices, it is often too late."

## Between scholarship and survival

The workshop also trains artisans in bookbinding and gold-leaf illumination, skills with a small but real market among collectors and museums. Graduates are expected to take on paid commissions, not only restoration.

A digitization unit photographs each page at high resolution. The images are stored with the owner's consent and shared with researchers under a controlled licence.

## What remains fragile

Funding is secure for two years. After that, the workshop must cover part of its costs through services. Its organizers are cautious about growth: taking on too many objects at once is how small conservation labs fail.

For now, the apprentices keep practicing. One held up a repaired folio to the window, checking the light through the paper, and smiled.`,
    },
    ps: {
      title: "د ورېښمو د لرغونې لارې د کلتوري میراثونو او خوشنویسۍ ساتنه",
      summary:
        "نوی د ساتنې ورکشاپ ځوان هنرمندان روزي چې لاسوندونه ورغوي او یو نازک هنر ژوندی وساتي.",
      content: `په یوه بیارغول شوې انګړ لرونکې کور کې، شپږ ځوان زده کوونکي پر نولسمې پیړۍ د یوه لاسوند سر ټیټوي او زده کوي چې د اوبو داغ لیرې کړي پرته له دې چې لاندې رنګ له مینځه یوسي.

ورکشاپ سږکال د یوې کلتوري بنسټ او محلي پوهنتون په ملاتړ پرانیستل شو. هدف یې عملي دی: د ساتونکو نوې نسل روزل او هغه شخصي ټولګې مستندول چې هېڅکله نه دي فهرست شوې.

## د صبر هنر

ساتنه ورو کار دی. یوه پاڼه ممکن یوه اونۍ وخت واخلي: د کاغذ ازموینه، د رنګونو برابرول، لندبل او هوارول. زده کوونکي لومړی میاشت پر تشو تمریني پاڼو تېروي.

مشره ساتونکې چې بهر زده کړې کړې او پنځه کاله مخکې راستنه شوې، وايي تر ټولو لوی خطر غلا نه، بې پاملرنه ده. "کاغذ په خاموشۍ مري،" هغې وویل. "تودوخه، لندبل، حشرات، لمر. کله چې کورنۍ پوهه شي، ډیر ناوخته وي."

## د پوهې او ژوند ترمنځ

ورکشاپ هنرمندان د کتاب تړلو او د سرو زرو د روښانه کولو هم روزي، چې د راټولونکو او موزیمونو ترمنځ کوچنی خو ریښتینی بازار لري. فارغان باید معاش لرونکې کارونه هم واخلي.

د ډیجیټل کولو برخه هره پاڼه په لوړ کیفیت عکس اخلي. عکسونه د مالک په رضایت ساتل کیږي او له څیړونکو سره په کنټرول شوې جواز ورکول کیږي.

## څه نازک پاتې دي

تمویل دوه کاله خوندي دی. له هغې وروسته ورکشاپ باید د خدماتو له لارې لګښت پوره کړي. تنظیم کوونکي د ودې په اړه محتاط دي.`,
    },
    fa: {
      title: "حفظ میراث فرهنگی جاده ابریشم و سنت‌های خوشنویسی اصیل",
      summary:
        "یک ورکشاپ جدید حفاظت، هنرمندان جوان را آموزش می‌دهد تا نسخه‌های خطی را مرمت کنند و یک هنر شکننده را زنده نگه دارند.",
      content: `در خانه‌ای حیاط‌دار که بازسازی شده، شش شاگرد جوان روی نسخه خطی قرن نوزدهم خم شده‌اند و یاد می‌گیرند لکه آب را بدون برداشتن مرکب زیرین بردارند.

ورکشاپ امسال با حمایت یک بنیاد میراث فرهنگی و دانشگاه محلی افتتاح شد. هدف آن عملی است: تربیت نسل جدید مرمت‌کار و مستندسازی مجموعه‌های خصوصی که هرگز فهرست نشده‌اند.

## هنر صبر

مرمت کار کندی است. یک برگ می‌تواند یک هفته وقت بگیرد: آزمایش کاغذ، تطبیق رنگدانه، رطوبت‌دهی و صاف‌کاری. شاگردان ماه اول را روی برگ‌های تمرینی خالی می‌گذرانند.

مرمت‌کار ارشد که در خارج آموزش دیده و پنج سال پیش برگشته، می‌گوید بزرگ‌ترین خطر دزدی نیست، بی‌توجهی است. او گفت: «کاغذ بی‌صدا می‌میرد. گرما، رطوبت، حشره، آفتاب. وقتی خانواده متوجه شود، اغلب دیر است.»

## میان دانش و بقا

ورکشاپ هنرمندان را در صحافی و تذهیب طلا نیز آموزش می‌دهد؛ مهارت‌هایی با بازاری کوچک اما واقعی میان مجموعه‌داران و موزیم‌ها. فارغان باید سفارش‌های مزدی بگیرند.

بخش دیجیتال‌سازی هر صفحه را با کیفیت بالا عکس‌برداری می‌کند. تصاویر با رضایت مالک ذخیره و با مجوز کنترل‌شده با پژوهشگران شریک می‌شود.

## آنچه شکننده می‌ماند

تأمین مالی دو سال تضمین است. پس از آن ورکشاپ باید بخشی از هزینه را از خدمات پوشش دهد. برگزارکنندگان در رشد محتاط‌اند.`,
    },
  },
  {
    slug: "opinion-strategic-economic-future-south-central-asia",
    category: "opinion",
    subcategory: "analysis",
    coverImage: IMG.economy,
    coverAlt: "Aerial night view of a city skyline with light trails and abstract trade-route lines.",
    authorName: "Dr. Mariam Hashimi",
    readMinutes: 8,
    tags: ["opinion", "economy", "trade"],
    daysAgo: 6,
    en: {
      title: "Opinion: The Strategic Economic Future of South-Central Asia",
      summary:
        "The region's next decade will be decided less by aid than by whether its borders become cheaper to cross.",
      content: `Every few years a new map promises to connect South and Central Asia. Pipelines, rail lines, fiber routes and "corridors" are announced with ribbon cuttings and communiqués. Few survive the first budget review.

The reason is not geography. The region is difficult, but so are the Alps, and Europe moves millions of trucks across them every year. The binding constraint is the cost of crossing a border: time, paperwork, inspections, insurance and uncertainty.

## Three tests

A corridor is real only if it passes three tests. First, a shipper can predict the total cost before loading. Second, a truck or train can cross without unloading. Third, a dispute has a forum that resolves it in days, not months.

Most announced corridors fail at least two. They are political projects first and logistics projects second. That is not always a reason to oppose them — political buy-in can create the conditions for reform — but it is a reason to be honest about timelines.

## What would change the math

Three interventions matter more than a new highway. Digitizing customs documents so they are accepted at both ends. Harmonizing axle-load and driver-licence rules. And publishing reliable transit times, so insurers can price risk instead of guessing at it.

None of these requires a new institution. They require officials to give up a little discretion. That is the hard part.

## A modest forecast

The region will not become a single market this decade. But it can become a place where a container of dried fruit reaches a port in twelve predictable days instead of eighteen unpredictable ones. That would raise incomes for farmers and traders without a single summit.

Aid will still matter for health and education. It will not build a middle class. Predictable borders might.`,
    },
    ps: {
      title: "نظر: د سویلي او مرکزي آسیا ستراتیژیک اقتصادي راتلونکی",
      summary:
        "د سیمې راتلونکې لسیزه به د مرستو په پرتله په دې ټاکل کیږي چې پولې یې د تیریدو لپاره ارزانه شي.",
      content: `هر څو کاله یوه نوې نقشه د سویلي او مرکزي آسیا نښلولو ژمنه کوي. پایپ لاینونه، ریل کرښې، فایبر لارې او "دهلیزونه" د پرانستې مراسمو او اعلامیو سره اعلانیږي. لږ یې لومړنۍ بودجې بیاکتنې ته رسیدلی شي.

دلیل جغرافیه نه ده. سیمه سخته ده، خو الپ هم سخت دي او اروپا هر کال میلیونونه لاریونه پرې تیروي. اصلي خنډ د پولې د تیریدو بیه ده: وخت، کاغذونه، کتنې، بیمه او ناڅرګندتیا.

## درې ازموینې

دهلیز یوازې هغه وخت ریښتینی دی چې درې ازموینې پوره کړي. لومړی، بار وړونکی د بار کولو مخکې ټوله بیه وړاندوینه کړای شي. دویم، لاری یا ریل پرته له تخلیې پوله تیره کړای شي. دریم، شخړه دې ورځو کې حل کړي، نه میاشتو.

ډیری اعلان شوي دهلیزونه لږ تر لږه دوه ازموینې نه پوره کوي. دوی لومړی سیاسي پروژې دي، بیا لوژستیکي. دا تل د مخالفت دلیل نه دی، خو د مهال ویش د رښتینولۍ دلیل دی.

## څه حساب بدلوي

درې اقدامات له نوي لویې لارې زیات اهمیت لري: د ګمرکي اسنادو ډیجیټل کول چې دواړو خواوو ومني؛ د اکسل بار او د چلوونکي جواز قواعد همغږي کول؛ او د ترانزیت باوري وخت خپرول، تر څو بیمه شرکتونه خطر ارزښت ورکړي.

هیڅ یې نوې موسسې ته اړتیا نه لري. چارواکي باید لږ اختیار پرېږدي. سخت برخه همدا ده.

## یوه محتاطه وړاندوینه

سیمه به دا لسیزه یو واحد بازار نه شي. خو کولای شي د وچو میوو یو کانټینر په ۱۲ باوري ورځو کې بندر ته ورسوي، نه په ۱۸ ناباوره ورځو کې.`,
    },
    fa: {
      title: "دیدگاه: آینده استراتژیک اقتصادی جنوب و مرکز آسیا",
      summary:
        "دهه آینده منطقه کمتر با کمک تعیین می‌شود و بیشتر با این که عبور از مرزهایش ارزان‌تر شود.",
      content: `هر چند سال نقشه تازه‌ای وعده اتصال جنوب و مرکز آسیا را می‌دهد. پایپ‌لاین‌ها، خطوط آهن، مسیرهای فایبر و «دهلیزها» با مراسم افتتاح و بیانیه اعلام می‌شوند. اندکی از آن‌ها از نخستین بازبینی بودجه جان به سلامت می‌برند.

دلیل جغرافیا نیست. منطقه دشوار است، اما آلپ هم دشوار است و اروپا هر سال میلیون‌ها لاری از آن عبور می‌دهد. محدودیت اصلی هزینه عبور از مرز است: زمان، کاغذبازی، بازرسی، بیمه و نااطمینانی.

## سه آزمون

دهلیز تنها زمانی واقعی است که سه آزمون را بگذراند. نخست، صادرکننده بتواند پیش از بارگیری هزینه کل را پیش‌بینی کند. دوم، لاری یا قطار بدون تخلیه از مرز بگذرد. سوم، اختلاف در روزها حل شود، نه ماه‌ها.

بیشتر دهلیزهای اعلام‌شده دست‌کم دو آزمون را رد می‌کنند. آن‌ها نخست پروژه سیاسی‌اند و سپس لوژستیکی. این همیشه دلیل مخالفت نیست، اما دلیل صداقت درباره زمان‌بندی است.

## چه چیزی معادله را تغییر می‌دهد

سه اقدام از یک شاهراه جدید مهم‌تر است: دیجیتال‌سازی اسناد گمرکی که دو طرف بپذیرند؛ هماهنگ‌سازی قواعد بار محور و جواز راننده؛ و نشر زمان‌های قابل اعتماد ترانزیت تا بیمه‌گران خطر را قیمت کنند.

هیچ‌کدام نهاد جدید نمی‌خواهد. مقام‌ها باید کمی از اختیار خود بگذرند. بخش دشوار همین است.

## پیش‌بینی محتاطانه

منطقه این دهه بازار واحد نمی‌شود. اما می‌تواند جایی شود که یک کانتینر میوه خشک در ۱۲ روز قابل پیش‌بینی به بندر برسد، نه در ۱۸ روز نامعلوم.`,
    },
  },
  {
    slug: "international-womens-day-reflections-resilience",
    category: "specials",
    subcategory: "womens-day",
    coverImage: IMG.women,
    coverAlt: "A woman in a saffron headscarf standing in her tailoring workshop with fabric behind her.",
    authorName: "Laila Ahmadi",
    readMinutes: 8,
    tags: ["women", "International Women's Day", "resilience"],
    daysAgo: 7,
    en: {
      title: "Special Feature: International Women's Day Reflections and Resilience",
      summary:
        "Six women describe the work they do, the risks they carry and the futures they are building.",
      content: `For International Women's Day, BMG spoke with six women across three provinces about work, family and the future. They asked that some details be withheld to protect their safety. Their words have been lightly edited for length.

## "I keep the workshop open"

A tailor in her forties employs four women in a two-room workshop. "When the orders stopped coming from the city, I started making school uniforms for families who pay in installments. It is not profit. It is keeping the machines running."

## "The classroom is my office"

A former teacher runs a home-based class for girls. "We do not call it a school. We call it a study circle. The name matters less than the books."

## "I document everything"

A midwife keeps handwritten records of every birth and referral. "One day someone will ask what happened here. I want the answer to be on paper."

## "I learned to negotiate"

A shopkeeper says she now buys directly from a wholesaler instead of through a male relative. "The first time they laughed at me. The second time they gave me a price."

## "I write at night"

A young poet publishes under a pen name. "During the day I am careful. At night I am free. Both are true."

## "I want my daughter to choose"

A mother of three says her priority is simple. "I do not need her to be brave like me. I want her to have choices I did not have."

The women described exhaustion, but also a stubborn continuity: work that continues because someone decides it will.`,
    },
    ps: {
      title: "ځانګړې خپرونه: د ښځو د نړیوالې ورځې په مناسبت ځانګړی راپور",
      summary:
        "شپږ ښځې خپل کار، هغه خطرونه چې یې زغمي او هغه راتلونکی چې جوړوي بیانوي.",
      content: `د ښځو د نړیوالې ورځې په مناسبت BMG په درې ولایتونو کې له شپږو ښځو سره د کار، کورنۍ او راتلونکي په اړه خبرې وکړې. دوی وغوښتل ځینې جزئیات د خوندیتوب لپاره ونه لیکل شي.

## "زه ورکشاپ پرانیستی ساتم"

څلوېښت کلنه خیاطه په دوه کوټو ورکشاپ کې څلور ښځې کاروي. "کله چې له ښاره فرمایشونه بند شول، د هغو کورنیو لپاره د ښوونځي یونیفورمونه جوړول پیل کړل چې قسطونه ورکوي. دا ګټه نه ده، ماشینونه روان ساتل دي."

## "صنف زما دفتر دی"

پخوانۍ ښوونکې د نجونو لپاره کورنی صنف چلوي. "موږ ورته ښوونځی نه وایو. د مطالعې حلقه وایو. نوم له کتابونو کم اهمیت لري."

## "زه هر څه ثبتوم"

قابله د هر زیږون او راجع کولو لاسي یادښتونه ساتي. "یوه ورځ به څوک وپوښتي دلته څه وشول. غواړم ځواب پر کاغذ وي."

## "زه مذاکره زده کړه"

دوکانداره وايي اوس له عمده پلورونکي څخه مستقیم اخلي. "لومړی ځل راته وخندل. دویم ځل یې بیه راکړه."

## "زه شپه لیکم"

ځوانه شاعره په مستعار نوم خپروي. "ورځ موږ محتاط یو. شپه موږ آزاد یو. دواړه رښتیا دي."

## "غواړم لور مې انتخاب ولري"

درې ماشومانو مور وايي لومړیتوب یې ساده دی. "نه غواړم زما په څیر زړوره وي. غواړم هغه انتخابونه ولري چې زه نه لرم."

ښځو ستړیا بیان کړه، خو دوامداره دوام یې هم: کار چې دوام کوي ځکه چې څوک پریکړه کوي.`,
    },
    fa: {
      title: "گزارش ویژه: بازخوانی پایداری و روز جهانی زن",
      summary:
        "شش زن از کار، خطرها و آینده‌ای که می‌سازند می‌گویند.",
      content: `به مناسبت روز جهانی زن، BMG با شش زن در سه ولایت درباره کار، خانواده و آینده گفتگو کرد. آن‌ها خواستند برخی جزئیات برای حفظ امنیتشان ذکر نشود.

## «ورکشاپ را باز نگه می‌دارم»

خیاط چهل‌ساله‌ای در ورکشاپ دو اتاقه چهار زن را کار می‌دهد. «وقتی سفارش‌ها از شهر قطع شد، برای خانواده‌هایی که قسطی می‌پردازند یونیفورم مکتب دوختن را شروع کردم. این سود نیست، ماشین‌ها را روشن نگه داشتن است.»

## «صنف دفتر من است»

معلم پیشین صنف خانه‌ای برای دختران برگزار می‌کند. «ما آن را مکتب نمی‌نامیم. حلقه مطالعه می‌نامیم. نام از کتاب‌ها کم‌اهمیت‌تر است.»

## «همه چیز را ثبت می‌کنم»

قابله‌ای از هر زایمان و ارجاع یادداشت دستی نگه می‌دارد. «روزی کسی خواهد پرسید اینجا چه شد. می‌خواهم پاسخ روی کاغذ باشد.»

## «مذاکره را یاد گرفتم»

فروشنده‌ای می‌گوید اکنون مستقیم از عمده‌فروش خرید می‌کند. «بار اول به من خندیدند. بار دوم قیمت دادند.»

## «شب می‌نویسم»

شاعر جوان با نام مستعار منتشر می‌کند. «روز محتاطم. شب آزاد. هر دو درست است.»

## «می‌خواهم دخترم انتخاب داشته باشد»

مادر سه فرزند می‌گوید اولویت او ساده است. «نمی‌خواهم مثل من شجاع باشد. می‌خواهم انتخاب‌هایی داشته باشد که من نداشتم.»

زنان خستگی را توصیف کردند، اما تداومی سرسختانه را نیز: کاری که ادامه می‌یابد چون کسی تصمیم می‌گیرد.`,
    },
  },
  {
    slug: "taliban-leadership-rift-media-policy",
    category: "afghanistan",
    subcategory: "taliban-rift",
    coverImage: IMG.summit,
    coverAlt: "A dimly lit meeting room with empty chairs around a long table.",
    authorName: "Farid Rahimi",
    readMinutes: 5,
    tags: ["Taliban", "media policy", "politics"],
    daysAgo: 2,
    en: {
      title: "Rifts Within Taliban Leadership Surface Over Media Policy",
      summary:
        "Provincial officials and the central administration are giving contradictory instructions on press access, journalists say.",
      content: `Journalists in three provinces say they are receiving contradictory instructions from Taliban officials about covering public events, suggesting a widening split between the central administration and provincial governors.

In one province, a governor's office invited reporters to a development announcement and then barred cameras at the door. In another, a local media office demanded that interviews be approved in advance, a rule not announced nationally.

## A pattern, not a single order

A senior editor who tracks media restrictions said the inconsistency is itself the policy. "There is no single press law they all follow. Each office improvises. That makes it impossible to know what is allowed."

Taliban spokespeople have denied internal divisions. A statement this week said all officials act under a single chain of command.

## Consequences for reporting

The uncertainty pushes journalists toward self-censorship. Several said they now avoid stories that require official comment, because the process of obtaining it is unpredictable.

International media organizations have called for a clear, published media law. So far, no draft has been made public.

BMG verifies media-access incidents through at least two independent sources before reporting them.`,
    },
    ps: {
      title: "د طالبانو په مشرتابه کې د رسنیو د تګلارې پر سر اختلافونه ښکاره شول",
      summary:
        "خبریالان وايي ولایتي چارواکي او مرکزي اداره د رسنیو د لاسرسي په اړه متضاد لارښوونې ورکوي.",
      content: `په درې ولایتونو کې خبریالان وايي د طالبانو چارواکو د عامه پیښو د پوښښ په اړه متضادې لارښوونې ورکړې، چې د مرکزي ادارې او ولایتي والیانو ترمنځ د اختلاف زیاتیدو نښه ده.

په یوه ولایت کې د والي دفتر خبریالان د پراختیایي اعلان ته بلل، بیا یې په دروازه کې کامرې بندې کړې. په بل کې سیمه ییز رسنیز دفتر غوښتنه وکړه چې مرکې باید مخکې تصویب شي، هغه قاعده چې په ملي کچه نه ده اعلان شوې.

## یو نمونه، نه یو حکم

د رسنیو د محدودیتونو تعقیبوونکې یوې لوړې مدیرې وویل ناهمغږي خپله تګلاره ده. "دوی ټول یو قانون نه تعقیبوي. هر دفتر خپل ډول چلند کوي. پدې توګه پوهیدل ناممکن دي چې څه اجازه لري."

د طالبانو ویاندویانو داخلي اختلاف رد کړ. دا اونۍ اعلامیه وویل ټول چارواکي د یوې قوماندې لړۍ لاندې کار کوي.

## د راپور ورکولو پایلې

ناڅرګندتیا خبریالان خپل ځان سانسور ته هڅوي. څو وویل اوس له هغو کیسو ډډه کوي چې رسمي څرګندونې ته اړتیا لري، ځکه پروسه ناڅرګنده ده.

نړیوالې رسنیزې موسسې د روښانه او خپرې شوې رسنیزې قانون غوښتنه کوي. تر اوسه هېڅ مسوده نه ده خپره شوې.

BMG د رسنیو د لاسرسي پیښې د لږ تر لږه دوو خپلواکو سرچینو له لارې تاییدوي.`,
    },
    fa: {
      title: "شکاف در رهبری طالبان بر سر سیاست رسانه‌ها آشکار شد",
      summary:
        "خبرنگاران می‌گویند مقام‌های ولایتی و اداره مرکزی درباره دسترسی مطبوعات دستورهای متناقض می‌دهند.",
      content: `خبرنگاران در سه ولایت می‌گویند از مقام‌های طالبان درباره پوشش رویدادهای عمومی دستورهای متناقض دریافت می‌کنند؛ نشانه‌ای از شکاف گسترده‌تر میان اداره مرکزی و والیان ولایتی.

در یک ولایت، دفتر والی خبرنگاران را به اعلان توسعه دعوت کرد و سپس دوربین‌ها را در دروازه ممنوع ساخت. در ولایتی دیگر، دفتر رسانه‌ای محلی خواست مصاحبه‌ها پیش از نشر تأیید شوند؛ قاعده‌ای که در سطح ملی اعلان نشده است.

## یک الگو، نه یک دستور

یک سردبیر ارشد که محدودیت‌های رسانه‌ای را پیگیری می‌کند گفت ناهماهنگی خودش سیاست است. «قانون واحد مطبوعاتی وجود ندارد که همه پیروی کنند. هر دفتر بداهه عمل می‌کند. این دانستن آنچه مجاز است را ناممکن می‌سازد.»

سخنگویان طالبان اختلاف داخلی را رد کرده‌اند. بیانیه‌ای این هفته گفت همه مقام‌ها زیر یک زنجیره فرماندهی کار می‌کنند.

## پیامدها برای گزارش‌دهی

نااطمینانی خبرنگاران را به خودسانسوری سوق می‌دهد. شماری گفتند اکنون از گزارش‌هایی که به اظهارنظر رسمی نیاز دارد پرهیز می‌کنند، زیرا روند دریافت آن قابل پیش‌بینی نیست.

نهادهای بین‌المللی رسانه‌ای خواستار قانون روشن و منتشرشده مطبوعات شده‌اند. تا کنون پیش‌نویسی نشر نشده است.

BMG رویدادهای دسترسی رسانه‌ای را پیش از نشر با دست‌کم دو منبع مستقل تأیید می‌کند.`,
    },
  },
  {
    slug: "journalists-growing-pressure-independent-reporting",
    category: "afghanistan",
    subcategory: "media",
    coverImage: IMG.rights,
    coverAlt: "A quiet press briefing room with empty chairs and microphones.",
    authorName: "Sahar Nazari",
    readMinutes: 6,
    tags: ["press freedom", "journalists", "survey"],
    daysAgo: 3,
    en: {
      title: "Journalists Describe Growing Pressure on Independent Reporting",
      summary:
        "A new survey of 120 reporters finds rising self-censorship, fewer female colleagues and a shrinking space for investigation.",
      content: `A survey of 120 working journalists across five provinces found that most believe the space for independent reporting has narrowed over the past year.

Seventy-one percent said they had withheld a story or softened its language because of pressure or fear of consequences. Forty-four percent said they had lost a colleague who left the country. Only 18 percent of respondents were women, down from 26 percent two years earlier.

## Where pressure comes from

Respondents described pressure from several directions: official media offices, local commanders, family concerns about safety, and economic insecurity. Few described a single, formal censorship order. Instead, they described a climate in which the boundaries are unclear.

"Red lines move," one radio editor said. "What was allowed last month is a problem this month."

## What newsrooms are doing

Some outlets have introduced security training, anonymous bylines and encrypted tip lines. Others have cut investigative units because they cannot afford legal support.

The survey's authors recommend a shared legal fund, a verified incident tracker and better mental-health support. They acknowledge that none of these replaces a protective legal environment.

BMG participated in the survey as a respondent and did not fund it.`,
    },
    ps: {
      title: "خبریالان د خپلواک راپور ورکولو پر زیاتیدونکي فشار خبرې کوي",
      summary:
        "له ۱۲۰ خبریالانو نوی سروې ښیي چې ځان سانسور زیات شوی، ښځینه همکاران کم شوي او د څیړنې ځای تنګ شوی.",
      content: `په پنځو ولایتونو کې له ۱۲۰ فعالو خبریالانو سروې وموندله چې ډیری یې باور لري د خپلواک راپور ورکولو ځای په تېر کال کې تنګ شوی.

۷۱ سلنه وویل د فشار یا د پایلو له ویرې یې یو راپور بند کړ یا ژبه یې نرمه کړه. ۴۴ سلنه وویل یو همکار یې له لاسه ورکړ چې هېواد یې پرېښود. یوازې ۱۸ سلنه ګډونوالې ښځې وې، چې دوه کاله مخکې ۲۶ سلنه وې.

## فشار له کومه راځي

ګډونوالو د څو خواوو فشار بیان کړ: رسمي رسنیز دفترونه، سیمه ییز قوماندانان، د کورنیو اندېښنې او اقتصادي ناامني. لږو یې یو رسمي سانسوري حکم یاد کړ. پرځای یې داسې فضا بیان کړه چې پکې پولې ناڅرګندې دي.

یوې رادیویي مدیرې وویل: "سره کرښې ځای بدلوي. هغه څه چې تېره میاشت اجازه درلودل، دا میاشت ستونزه ده."

## رسنۍ څه کوي

ځینو رسنیو امنیتي روزنه، بې نومه لیکنې او کوډ شوې د خبر رسولو لارې معرفي کړې. نورو څیړنیزې څانګې کمې کړې ځکه حقوقي ملاتړ نشي کولی.

د سروې لیکوالان ګډ حقوقي صندوق، د پیښو تایید شوی تعقیبوونکی او د رواني روغتیا غوره ملاتړ وړاندیز کوي. دوی مني چې دا هېڅ یې هم د ساتونکي قانوني چاپیریال ځای نه شي نیولی.

BMG په سروې کې د ګډونوال په توګه برخه اخیستې او تمویل یې نه دی کړی.`,
    },
    fa: {
      title: "خبرنگاران از فشار فزاینده بر گزارش‌دهی مستقل می‌گویند",
      summary:
        "یک نظرسنجی از ۱۲۰ خبرنگار افزایش خودسانسوری، کاهش همکاران زن و تنگ‌تر شدن فضای تحقیق را نشان می‌دهد.",
      content: `نظرسنجی از ۱۲۰ خبرنگار فعال در پنج ولایت نشان داد بیشتر آنان باور دارند فضای گزارش‌دهی مستقل در سال گذشته تنگ‌تر شده است.

۷۱ درصد گفتند به دلیل فشار یا ترس از پیامدها گزارشی را نگه داشتند یا زبان آن را نرم کردند. ۴۴ درصد گفتند همکاری را از دست دادند که کشور را ترک کرد. تنها ۱۸ درصد پاسخ‌دهندگان زن بودند، در حالی که دو سال پیش ۲۶ درصد بود.

## فشار از کجا می‌آید

پاسخ‌دهندگان فشار از چند جهت را توصیف کردند: دفاتر رسمی رسانه، فرماندهان محلی، نگرانی خانواده‌ها و ناامنی اقتصادی. اندکی دستور رسمی سانسور را ذکر کردند. به‌جای آن فضایی توصیف شد که در آن مرزها روشن نیست.

یک سردبیر رادیو گفت: «خطوط سرخ جابه‌جا می‌شوند. آنچه ماه گذشته مجاز بود، این ماه مشکل است.»

## رسانه‌ها چه می‌کنند

برخی رسانه‌ها آموزش امنیتی، امضای مستعار و خطوط خبری رمزگذاری‌شده را معرفی کرده‌اند. برخی واحدهای تحقیقی را کاهش داده‌اند چون توان حمایت حقوقی ندارند.

نویسندگان نظرسنجی صندوق حقوقی مشترک، ردیاب تأییدشده رویدادها و حمایت بهتر صحت روانی را توصیه می‌کنند. آن‌ها می‌پذیرند هیچ‌یک جای محیط حقوقی محافظت‌کننده را نمی‌گیرد.

BMG به‌عنوان پاسخ‌دهنده در نظرسنجی شرکت کرد و مالی آن را تأمین نکرد.`,
    },
  },
  {
    slug: "inside-bmg-newsroom-how-we-verify-a-story",
    category: "videos",
    coverImage: IMG.studio,
    coverAlt: "An empty modern television news studio with a curved video wall and anchor desk.",
    authorName: "BMG Video Desk",
    readMinutes: 3,
    tags: ["video", "verification", "newsroom"],
    daysAgo: 0,
    en: {
      title: "Inside the BMG Newsroom: How We Verify a Story",
      summary:
        "A short video walkthrough of the checks a BMG report passes before publication — sourcing, documents, translation and legal review.",
      content: `This short video follows a single story through the BMG newsroom, from the first tip to publication.

## The steps

A reporter files a draft with every claim linked to a source. An editor checks that at least two independent sources support the central allegation. Documents are reviewed for authenticity by a second team. The translation desk compares the English, Pashto and Dari versions line by line.

Finally, a legal reviewer checks naming, privacy and defamation risk. If a source is at risk, names and locations are withheld.

## Why it takes time

Verification is the most expensive part of journalism and the least visible. A story that takes three days to confirm may be published in three minutes.

The video is available with Pashto and Dari subtitles on the BMG YouTube channel.`,
    },
    ps: {
      title: "د BMG د خبرونو په خونه کې: موږ یو راپور څنګه تاییدوو",
      summary:
        "لنډ ویډیو د هغو کتنو لنډیز چې یو راپور یې مخکې له خپریدو تېریږي — سرچینې، اسناد، ژباړه او حقوقي کتنه.",
      content: `دا لنډه ویډیو یو راپور د BMG د خبرونو په خونه کې تعقیبوي، له لومړنۍ سرچینې تر خپریدو.

## پړاوونه

خبریال مسوده سپاري او هر ادعا له سرچینې سره نښلوي. مدیر ګوري چې لږ تر لږه دوه خپلواکې سرچینې اصلي ادعا تاییدوي. اسناد د بل ټیم لخوا د اصالت لپاره کتل کیږي. ژباړنې څانګه انګلیسي، پښتو او دري نسخې کرښه په کرښه پرتله کوي.

په پای کې حقوقي کتونکی نومونه، خصوصیت او د تهمت خطر ګوري. که سرچینه په خطر کې وي، نومونه او ځایونه نه ښودل کیږي.

## ولې وخت نیسي

تایید د خبریالۍ تر ټولو ګران او لږ ښکاره برخه ده. هغه راپور چې درې ورځې تایید ته اړتیا لري، ممکن په درې دقیقو کې خپور شي.

ویډیو د پښتو او دري ژبو د لاندې لیکنو سره د BMG په یوټیوب چینل شته.`,
    },
    fa: {
      title: "درون خبرگزاری BMG: چگونه یک گزارش را تأیید می‌کنیم",
      summary:
        "یک ویدیوی کوتاه از بررسی‌هایی که یک گزارش پیش از نشر طی می‌کند — منابع، اسناد، ترجمه و بازبینی حقوقی.",
      content: `این ویدیوی کوتاه یک گزارش را از نخستین سرنخ تا نشر در خبرگزاری BMG دنبال می‌کند.

## مراحل

خبرنگار مسوده‌ای می‌سپارد که هر ادعای آن به منبع وصل است. سردبیر بررسی می‌کند که دست‌کم دو منبع مستقل ادعای اصلی را تأیید کنند. اسناد برای اصالت توسط تیم دوم بررسی می‌شوند. بخش ترجمه نسخه‌های انگلیسی، پشتو و دری را خط به خط مقایسه می‌کند.

در پایان بازبین حقوقی نام‌ها، حریم خصوصی و خطر افترا را بررسی می‌کند. اگر منبع در خطر باشد، نام و مکان ذکر نمی‌شود.

## چرا وقت می‌گیرد

تأیید پرهزینه‌ترین و کم‌دیده‌ترین بخش روزنامه‌نگاری است. گزارشی که سه روز تأیید می‌خواهد ممکن است در سه دقیقه نشر شود.

ویدیو با زیرنویس پشتو و دری در کانال یوتیوب BMG موجود است.`,
    },
  },
  {
    slug: "water-sharing-talks-drought-farmers",
    category: "business",
    subcategory: "agriculture",
    coverImage: IMG.energy,
    coverAlt: "A dry irrigation canal running through farmland toward distant mountains.",
    authorName: "Omid Karimi",
    readMinutes: 5,
    tags: ["water", "agriculture", "drought"],
    daysAgo: 8,
    en: {
      title: "Water-Sharing Talks Resume as Drought Pressures Farmers",
      summary:
        "Negotiators return to the table with a narrower agenda: irrigation schedules, reservoir releases and a joint drought early-warning system.",
      content: `Water-sharing negotiations resumed this week after a six-month pause, with a deliberately narrow agenda intended to produce a first agreement before the spring planting season.

Officials from four provinces are discussing irrigation schedules for shared canals, reservoir release rules and a joint drought early-warning system. A broader allocation treaty remains off the table.

## Farmers are already adapting

In the lower valley, farmers say they have switched part of their land from wheat to drought-tolerant pulses and are sharing wells. "We do not wait for a treaty," one farmer said. "We wait for water."

Agricultural extension workers report that some families are selling livestock to buy fodder, a sign of stress that usually precedes debt.

## A small window

Hydrologists say snowpack in the upper catchments is below average for a second year. If spring rains disappoint, the negotiations will be tested before any agreement is signed.

The talks are scheduled to reconvene next month. A joint technical committee will publish weekly canal data for the first time.`,
    },
    ps: {
      title: "د اوبو د شریکولو خبرې بیا پیل شوې، وچکالي بزګران فشار ته اچوي",
      summary:
        "مذاکره کوونکي د نوي اجنډا سره راستانه شول: د اوبو لګولو مهال ویش، د بند د اوبو خوشې کول او ګډ د وچکالۍ مخکینۍ خبرداری سیستم.",
      content: `د اوبو د شریکولو خبرې دې اونۍ د شپږو میاشتو ځنډ وروسته بیا پیل شوې، د پسرلي د کرلو موسم مخکې د لومړي توافق لپاره.

د څلورو ولایتونو چارواکي د ګډو کانالونو د اوبو لګولو مهال ویش، د بند د خوشې کولو قواعد او ګډ د وچکالۍ مخکینۍ خبرداری سیستم په اړه خبرې کوي. پراخه د اوبو د ویش تړون لا هم پر میز نه دی.

## بزګران لا دمخه تطبیق کوي

په لاندې دره کې بزګران وايي یوه برخه ځمکه یې له غنمو د وچکالۍ زغمونکو نباتاتو ته بدله کړې او څاګانې شریکوي. یو بزګر وویل: "موږ د تړون انتظار نه کوو. د اوبو انتظار کوو."

د کرنې د ترویج کارکوونکي وايي ځینې کورنۍ مالونه پلوري تر څو خوراک واخلي، چې معمولا د پور مخکې نښه ده.

## کوچنی کړکۍ

هایډرولوژیستان وايي د پورتنۍ حوزې واوره دویم کال له اوسط څخه کمه ده. که د پسرلي باران ناهیلی وي، خبرې به د لاسلیک مخکې ازموینه شي.

خبرې راتلونکې میاشت بیا پیل کیږي. ګډ تخنیکي کمیټه به لومړی ځل اونیز کانال معلومات خپاره کړي.`,
    },
    fa: {
      title: "مذاکرات تقسیم آب با فشار خشکسالی بر کشاورزان از سر گرفته شد",
      summary:
        "مذاکره‌کنندگان با دستور کار محدودتر بازگشتند: برنامه آبیاری، رهاسازی مخزن و سیستم مشترک هشدار زودهنگام خشکسالی.",
      content: `مذاکرات تقسیم آب این هفته پس از شش ماه توقف با دستور کار عمداً محدود از سر گرفته شد تا پیش از فصل کاشت بهار نخستین توافق حاصل شود.

مقام‌های چهار ولایت درباره برنامه آبیاری کانال‌های مشترک، قواعد رهاسازی مخزن و سیستم مشترک هشدار زودهنگام خشکسالی گفتگو می‌کنند. معاهده گسترده‌تر تخصیص آب روی میز نیست.

## کشاورزان از قبل تطبیق می‌کنند

در دره پایین، کشاورزان می‌گویند بخشی از زمین را از گندم به حبوبات مقاوم به خشکی تغییر داده‌اند و چاه‌ها را شریک می‌سازند. یک کشاورز گفت: «ما منتظر معاهده نیستیم. منتظر آب هستیم.»

مروجان کشاورزی می‌گویند برخی خانواده‌ها دام می‌فروشند تا علوفه بخرند؛ نشانه فشاری که معمولاً پیش از قرض است.

## پنجره کوچک

هیدرولوژیست‌ها می‌گویند برف حوضه‌های بالا برای دومین سال کمتر از میانگین است. اگر باران بهار ناامید کند، مذاکرات پیش از امضا آزموده می‌شود.

مذاکرات ماه آینده از سر گرفته می‌شود. کمیته تخنیکی مشترک برای نخستین بار معلومات هفتگی کانال را نشر می‌کند.`,
    },
  },
  {
    slug: "south-asian-diaspora-remittances-record",
    category: "world",
    subcategory: "south-asia",
    coverImage: IMG.economy,
    coverAlt: "A city at night with light trails suggesting money moving across borders.",
    authorName: "Nadia Sultani",
    readMinutes: 4,
    tags: ["remittances", "diaspora", "South Asia"],
    daysAgo: 9,
    en: {
      title: "South Asian Diaspora Remittances Hit Record, but Costs Remain High",
      summary:
        "Families received more money than ever last year, yet fees and exchange-rate spreads still take a heavy cut.",
      content: `Remittances to South Asian countries reached a record last year, according to new figures from a regional development bank, as diaspora workers sent more money home despite a weaker global economy.

The same figures show that the average cost of sending money remains above the global target of 3 percent. In some corridors, fees and exchange-rate spreads together take more than 6 percent of the amount sent.

## Who pays

The burden falls disproportionately on low-income senders, who are more likely to use cash-based agents with higher fees. Digital services are cheaper but require identification and a bank account, which many workers lack.

## Policy options

The bank recommends capping transfer fees, publishing exchange-rate spreads and allowing remittance history to count as credit history. Several countries in the region have already introduced partial measures.

For receiving families, the difference is concrete: a 3 percent saving on a monthly transfer can cover a child's school supplies or a month of medicine.`,
    },
    ps: {
      title: "د سویلي آسیا د بهر مېشتو خلکو لیږل شوې پیسې ریکارډ ته ورسیدې، خو لګښتونه لوړ دي",
      summary:
        "کورنیو تېر کال تر بل هر وخت زیاتې پیسې ترلاسه کړې، خو فیسونه او د اسعارو توپیر لا هم لویه برخه خوري.",
      content: `د سیمه ییزې پراختیایي بانک د نوو شمېرو له مخې د سویلي آسیا هېوادونو ته د بهر مېشتو خلکو لیږل شوې پیسې تېر کال ریکارډ ته ورسیدې، سره له دې چې نړیوال اقتصاد کمزوری و.

همدا شمېرې ښیي چې د پیسو لیږلو اوسط لګښت لا هم د نړیوال ۳ سلنې هدف څخه پورته دی. په ځینو لارو کې فیس او د اسعارو توپیر یوځای د لیږل شوې پیسې له ۶ سلنې زیات خوري.

## څوک ورکوي

بار په غیر متناسب ډول پر ټیټ عاید لرونکو لیږونکو دی، چې ډیر وخت لوړ فیس لرونکي نغدي استازي کاروي. ډیجیټل خدمات ارزانه دي خو پیژندنه او بانکي حساب غواړي، چې ډیر کارګر نه لري.

## سیاسي انتخابونه

بانک وړاندیز کوي د انتقال فیس محدود شي، د اسعارو توپیر خپور شي او د لیږلو تاریخ د کریډیټ تاریخ په توګه ومنل شي. ځینو هېوادونو دمخه جزئي اقدامات کړي.

د ترلاسه کوونکو کورنیو لپاره توپیر ریښتینی دی: پر میاشتني لیږلو ۳ سلنه سپما د ماشوم د ښوونځي توکو یا یوه میاشت درملو لپاره بس ده.`,
    },
    fa: {
      title: "حواله‌های دیاسپورای جنوب آسیا رکورد زد، اما هزینه‌ها بالا مانده است",
      summary:
        "خانواده‌ها سال گذشته بیش از هر زمان پول دریافت کردند، اما فیس و تفاوت نرخ اسعار بخش سنگینی را می‌گیرد.",
      content: `بر اساس ارقام جدید یک بانک توسعه منطقه‌ای، حواله‌های ارسالی به کشورهای جنوب آسیا سال گذشته رکورد زد، هرچند اقتصاد جهانی ضعیف بود.

همین ارقام نشان می‌دهد میانگین هزینه ارسال پول هنوز بالاتر از هدف جهانی سه درصد است. در برخی مسیرها فیس و تفاوت نرخ اسعار با هم بیش از شش درصد مبلغ را می‌گیرند.

## چه کسی می‌پردازد

بار به‌طور نامتناسب بر فرستندگان کم‌درآمد است که بیشتر از نمایندگان نقدی با فیس بالا استفاده می‌کنند. خدمات دیجیتال ارزان‌ترند اما شناسایی و حساب بانکی می‌خواهند که بسیاری از کارگران ندارند.

## گزینه‌های سیاستی

بانک توصیه می‌کند فیس انتقال محدود شود، تفاوت نرخ اسعار نشر گردد و سابقه حواله به‌عنوان سابقه اعتباری پذیرفته شود. چند کشور منطقه اقدامات جزئی گرفته‌اند.

برای خانواده‌های دریافت‌کننده تفاوت واقعی است: صرفه‌جویی سه درصد در حواله ماهانه می‌تواند لوازم مکتب یک کودک یا یک ماه دارو را پوشش دهد.`,
    },
  },
];

function copyFor(article: SeedArticle, locale: Locale): Copy {
  return article[locale];
}

/**
 * Demonstration content must never read like verified reporting.
 *
 * Two things are removed mechanically rather than by hand, so a future edit
 * cannot quietly reintroduce them:
 *   1. every quoted passage (fabricated quotations are the most damaging kind
 *      of fake news), including quoted sub-headings;
 *   2. personal bylines, which would attach a fictional reporter's name to
 *      invented events.
 */
export const DEMO_BYLINE = "Buddha News Demo Desk";

export const DEMO_NOTICE =
  "> **Demonstration content.** Sample material supplied with the Buddha News template. Events, organisations and details are illustrative; nothing in this story is a factual news report.";

export function stripQuotations(text: string): string {
  return text
    .split("\n")
    .map(line => {
      // A heading made only of a quotation ("I keep the workshop open") is
      // dropped: without the quote there is no heading left.
      if (/^\s*#{1,6}\s*["«“].*["»”]\s*$/.test(line)) return "";
      return line
        .split(/(?<=[.!?؟])\s+/)
        .filter(sentence => !/["«»“”]/.test(sentence))
        .join(" ");
    })
    .filter(line => line.trim().length > 0)
    .join("\n");
}

export function demoCopy(copy: Copy): Copy {
  const content = stripQuotations(copy.content);
  return {
    title: copy.title,
    summary: copy.summary,
    content: `${DEMO_NOTICE}\n\n${content}`,
  };
}

export async function seedNewsroom(): Promise<{ seeded: boolean; count: number }> {
  const db = await getDb();
  if (!db) {
    console.warn("[Seed] Database unavailable; skipping seed");
    return { seeded: false, count: 0 };
  }

  const existing = await db.select({ id: articles.id }).from(articles).limit(1);
  if (existing.length > 0) {
    console.log("[Seed] Articles already present; seed skipped");
    return { seeded: false, count: 0 };
  }

  const now = Date.now();
  let count = 0;
  for (const article of SEED) {
    const publishedAt = new Date(now - article.daysAgo * 24 * 60 * 60 * 1000);
    const translations = (["en", "ps", "fa"] as Locale[]).map(locale => {
      const copy = demoCopy(copyFor(article, locale));
      return { locale, title: copy.title, summary: copy.summary, content: copy.content };
    });
    await createArticle({
      slug: article.slug,
      status: "published",
      category: article.category,
      subcategory: article.subcategory ?? null,
      coverImage: article.coverImage,
      coverAlt: article.coverAlt,
      authorName: DEMO_BYLINE,
      featured: article.featured ?? false,
      breaking: article.breaking ?? false,
      readMinutes: article.readMinutes,
      tags: article.tags,
      isDemo: true,
      publishedAt,
      translations,
    });
    count += 1;
  }

  await updateSettings({
    siteName: "Buddha News",
    tagline: "One region. Three languages. No noise.",
    contactEmail: "newsroom@buddhanews.example",
    liveStreamUrl: "",
    tipSignal: "",
    announcement: "",
    ogImage: IMG.summit,
  });

  console.log(`[Seed] Inserted ${count} stories with three locales each`);
  return { seeded: true, count };
}
