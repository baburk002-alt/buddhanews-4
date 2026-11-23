import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHero({
  kicker,
  title,
  intro,
  titleLang,
  titleDir,
  introLang,
  introDir,
  accent = "var(--brand)",
}: {
  kicker: string;
  title: string;
  intro: string;
  titleLang?: string;
  titleDir?: "ltr" | "rtl";
  introLang?: string;
  introDir?: "ltr" | "rtl";
  accent?: string;
}) {
  return (
    <header
      className="border-b border-line py-10 lg:py-14"
      style={{
        background: `radial-gradient(820px 320px at 12% 0%, color-mix(in srgb, ${accent} 14%, transparent), transparent 70%)`,
      }}
    >
      <div className="container-news">
        <p className="kicker mb-3" style={{ color: accent }}>
          {kicker}
        </p>
        <h1 lang={titleLang} dir={titleDir} className="headline max-w-4xl text-[clamp(2.2rem,5vw,4.3rem)] text-foreground">{title}</h1>
        <p lang={introLang} dir={introDir} className="mt-4 max-w-2xl text-[1rem] leading-relaxed text-muted-foreground">{intro}</p>
      </div>
    </header>
  );
}

export function PolicySection({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("border-b border-line py-8 last:border-0", className)}>
      <h2 className="font-display text-2xl font-semibold text-foreground">{title}</h2>
      <div className="prose-news mt-3 max-w-3xl text-[0.98rem]">{children}</div>
    </section>
  );
}

export function PolicyLayout({ children }: { children: ReactNode }) {
  return <div className="container-news max-w-4xl py-4">{children}</div>;
}
