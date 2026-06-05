import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type OverlayContainerProps = {
  children: ReactNode;
  className?: string;
};

export default function OverlayContainer({
  children,
  className,
}: OverlayContainerProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-8 backdrop-blur-[3px]">
      <div
        className={cn(
          "paper-surface max-h-full w-full overflow-y-auto p-8",
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}
