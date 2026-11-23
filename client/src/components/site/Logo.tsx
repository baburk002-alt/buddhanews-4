import { Link } from "wouter";
import { localePath } from "@shared/news";
import { useI18n } from "@/contexts/I18nContext";
import { cn } from "@/lib/utils";

export function LotusMark({
  className,
  inverted = false,
}: {
  className?: string;
  inverted?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn("h-9 w-9", className)}
      role="img"
      aria-label="Buddha News lotus mark"
    >
      <rect
        width="64"
        height="64"
        rx="14"
        fill={inverted ? "#f6f1e8" : "currentColor"}
        className={inverted ? undefined : "text-ink"}
      />
      <g fill="var(--brand)">
        <ellipse cx="32" cy="23" rx="5.4" ry="12" />
        <ellipse cx="32" cy="41" rx="5.4" ry="12" />
        <ellipse cx="32" cy="32" rx="5.4" ry="12" transform="rotate(58 32 32)" />
        <ellipse cx="32" cy="32" rx="5.4" ry="12" transform="rotate(-58 32 32)" />
      </g>
      <circle cx="32" cy="32" r="3.8" fill={inverted ? "#151a20" : "var(--paper)"} />
    </svg>
  );
}

export function Logo({ compact = false, className }: { compact?: boolean; className?: string }) {
  const { locale } = useI18n();
  return (
    <Link
      href={localePath(locale, "/")}
      className={cn("group inline-flex items-center gap-3", className)}
      aria-label="Buddha News home"
    >
      <LotusMark className="transition-transform duration-300 group-hover:rotate-6" />
      <span className="flex flex-col leading-none">
        <span className="font-display text-[1.45rem] font-semibold tracking-[-0.03em] text-foreground">
          Buddha
        </span>
        {!compact && (
          <span className="kicker mt-1 text-[0.6rem] text-brand">News · BMG</span>
        )}
      </span>
    </Link>
  );
}
