import { readFileSync } from "node:fs";
import path from "node:path";
import FirstActivationDiagnosticClient from "./FirstActivationDiagnosticClient";

// Rendered only after the authenticated dashboard server page accepts the exact
// opt-in. On a full document load this runs during parsing, before hydration.
// The client component handles login's client-side server-action redirect too.
export default function FirstActivationDiagnostic() {
  const source = readFileSync(path.join(process.cwd(), "diagnostics/provider-first-activation.js"), "utf8");
  const delivery = process.env.NODE_ENV === "development" && !process.env.VERCEL
    ? readFileSync(path.join(process.cwd(), "diagnostics/localTraceDelivery.js"), "utf8") : "";
  const script = `if (location.pathname === "/dashboard" && new URLSearchParams(location.search).getAll("debugFirstActivation").length === 1 && new URLSearchParams(location.search).get("debugFirstActivation") === "1") { ${source}\n${delivery} }`;
  return <>
    <span hidden data-first-activation-bootstrap dangerouslySetInnerHTML={{ __html: `<script>${script.replace(/<\/script/gi, "<\\/script")}</script>` }} />
    <FirstActivationDiagnosticClient />
  </>;
}
