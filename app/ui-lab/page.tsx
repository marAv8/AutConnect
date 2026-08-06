import type { Metadata } from "next";
import GlassBadgeLab from "./glass/GlassBadgeLab";

export const metadata: Metadata = { title: "AutConnect Glass Badge Study" };

export default function UiLabPage() {
  return <GlassBadgeLab />;
}
