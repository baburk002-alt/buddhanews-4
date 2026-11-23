import { ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

type SectionHeadingProps = {
  kicker?: string;
  title: string;
  href?: string;
  linkLabel?: string;
  className?: string;
};

export function SectionHeading({ kicker, title, href, linkLabel, className }: SectionHeadingProps) {
  return (
    <div className={cn("mb-7 flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b border-line pb-4", className)}>
      <div className="min-w-0">
        {kicker && <p className="kicker mb-2 text-brand">{kicker}</p>}
        <h2 className="headline text-[clamp(1.6rem,3vw,2.25rem)] text-foreground">{title}</h2>
      </div>
      {href && linkLabel && (
        <Link
          href={href}
          className="group inline-flex min-h-11 shrink-0 items-center gap-2 text-sm font-bold text-teal hover:text-brand"
        >
          {linkLabel}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}
