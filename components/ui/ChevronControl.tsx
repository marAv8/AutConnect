import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

type ChevronControlProps = Omit<ComponentProps<"button">, "children"> & {
  direction: "left" | "right";
  treatment?: "carousel" | "raised";
};

export function ChevronControl({
  direction,
  treatment = "raised",
  className,
  type = "button",
  ...props
}: ChevronControlProps) {
  const Icon = direction === "left" ? ChevronLeft : ChevronRight;

  return (
    <button
      type={type}
      className={cn(
        "icon-chevron-control",
        treatment === "carousel"
          ? "icon-chevron-control--carousel"
          : "icon-chevron-control--raised",
        className
      )}
      {...props}
    >
      <Icon aria-hidden="true" />
    </button>
  );
}
