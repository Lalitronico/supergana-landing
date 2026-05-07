"use client";

import { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
};

export function DesktopFrame({ children, className = "" }: Props) {
  return (
    <div
      className={`cartoon-border cartoon-shadow-lg overflow-hidden rounded-2xl bg-cream ${className}`}
    >
      <div className="flex items-center gap-2 border-b-[3px] border-ink bg-cream px-3 py-2">
        <div className="flex gap-1.5">
          <span className="h-3 w-3 rounded-full border-2 border-ink bg-red" />
          <span className="h-3 w-3 rounded-full border-2 border-ink bg-yellow" />
          <span className="h-3 w-3 rounded-full border-2 border-ink bg-green" />
        </div>
        <div className="ml-3 flex-1 truncate rounded-md border-2 border-ink bg-white px-2 py-1 text-[11px] text-ink/70">
          quiniela.tumarca.mx/mex-vs-usa
        </div>
      </div>
      <div className="bg-cream">{children}</div>
    </div>
  );
}
