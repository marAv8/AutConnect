import type { Metadata } from "next";
import GlassBadgeLab from "./GlassBadgeLab";

export const metadata: Metadata = {
  title: "AutConnect Frosted Glass Lab",
};

/** Isolated optical study; it does not read or mutate application data. */
export default function GlassBadgeLabPage() {
  return <GlassBadgeLab />;
}
