import type { Metadata } from "next";
import BadgeLab from "./BadgeLab";

export const metadata: Metadata = {
  title: "AutConnect Badge Material Lab",
};

/** Isolated route for tuning the reusable orbit badge without clinical data. */
export default function BadgeLabPage() {
  return <BadgeLab />;
}
