import { generateClinicalReflectionForEntry } from "@/app/api/insights/clinicalReflectionEngine";
import { buildGatewayContextForEntry } from "./gatewayBuilder";
import { generateClinicalHandoff, type ClinicalHandoff } from "./clinicalHandoff";
import type { GatewayContext } from "./types";

export type ClinicalHandoffValidationDiagnostics = {
  gatewayContextBuildSuccess: boolean;
  clinicalHandoffGenerationSuccess: boolean;
  generationTimeMs: number;
  clinicalEventCount: number;
  attentionEventCount: number;
  supervisorDirectiveCount: number;
  confidence: ClinicalHandoff["confidence"] | null;
  failureStage: "gateway_context" | "clinical_handoff" | null;
};

export type ClinicalHandoffValidationResult = {
  legacyReflection: string | null;
  clinicalHandoff: ClinicalHandoff | null;
  gatewayContext: GatewayContext | null;
  diagnostics: ClinicalHandoffValidationDiagnostics;
};

export async function generateClinicalHandoffValidation(
  entryId: string
): Promise<ClinicalHandoffValidationResult> {
  const startedAt = Date.now();
  const legacyReflection = await generateClinicalReflectionForEntry(entryId);
  let gatewayContext: GatewayContext | null = null;
  let clinicalHandoff: ClinicalHandoff | null = null;
  let failureStage: ClinicalHandoffValidationDiagnostics["failureStage"] = null;

  try {
    gatewayContext = await buildGatewayContextForEntry(entryId);
    if (!gatewayContext) {
      failureStage = "gateway_context";
    } else {
      clinicalHandoff = generateClinicalHandoff(gatewayContext);
      if (!clinicalHandoff) {
        failureStage = "clinical_handoff";
      }
    }
  } catch {
    failureStage = gatewayContext ? "clinical_handoff" : "gateway_context";
  }

  const diagnostics: ClinicalHandoffValidationDiagnostics = {
    gatewayContextBuildSuccess: gatewayContext !== null,
    clinicalHandoffGenerationSuccess: clinicalHandoff !== null,
    generationTimeMs: Date.now() - startedAt,
    clinicalEventCount: gatewayContext?.clinicalEvents.length ?? 0,
    attentionEventCount: gatewayContext?.attentionEvents.length ?? 0,
    supervisorDirectiveCount: gatewayContext?.supervisorDirectives.length ?? 0,
    confidence: clinicalHandoff?.confidence ?? null,
    failureStage,
  };

  logValidationDiagnostics(diagnostics);

  return {
    legacyReflection,
    clinicalHandoff,
    gatewayContext,
    diagnostics,
  };
}

function logValidationDiagnostics(diagnostics: ClinicalHandoffValidationDiagnostics) {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  console.info("[clinical-handoff-validation]", diagnostics);
}
