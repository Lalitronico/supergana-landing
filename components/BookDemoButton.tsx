import type { ReactNode } from "react";
import { SITE } from "@/lib/config";

type Props = {
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
};

export function BookDemoButton({ children, className, ariaLabel }: Props) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      className={className}
      data-cal-namespace={SITE.bookingNamespace}
      data-cal-link={SITE.bookingCalLink}
      data-cal-config='{"layout":"month_view"}'
    >
      {children}
    </button>
  );
}
