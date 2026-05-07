"use client";

import { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
};

export function PhoneFrame({ children, className = "" }: Props) {
  return (
    <div
      className={`relative cartoon-border cartoon-shadow-lg rounded-[2.5rem] bg-ink p-2 ${className}`}
    >
      <div className="absolute left-1/2 top-2 z-10 flex h-5 w-24 -translate-x-1/2 items-center justify-center rounded-b-2xl bg-ink">
        <span className="h-1.5 w-1.5 rounded-full bg-cream/40" />
      </div>
      <div className="overflow-hidden rounded-[2rem] bg-cream">{children}</div>
    </div>
  );
}
