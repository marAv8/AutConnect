"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { createAbcData } from "@/app/actions/createAbcData";
import { getClinicalHelpContent } from "@/app/libs/clinicalHelp";
import { ContextualHelp } from "@/components/ContextualHelp";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type AbcRow = {
  antecedent: string;
  behavior: string;
  consequence: string;
};

type Props = {
  clientId: string;
  onClose: () => void;
  onSaved?: (entryId: string, status?: string) => void;
};

const createEmptyAbcRow = (): AbcRow => ({
  antecedent: "",
  behavior: "",
  consequence: "",
});

const columns = [
  {
    key: "antecedent",
    title: "Antecedent",
    helpKey: "Antecedent",
  },
  {
    key: "behavior",
    title: "Behavior",
    helpKey: "Behavior",
  },
  {
    key: "consequence",
    title: "Consequence",
    helpKey: "Consequence",
  },
] as const;

export default function DashboardAbcDataOverlay({ clientId, onClose, onSaved }: Props) {
  const [rows, setRows] = useState<AbcRow[]>([createEmptyAbcRow()]);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "error">("idle");

  const updateRow = (
    rowIndex: number,
    field: keyof AbcRow,
    value: string
  ) => {
    setRows((currentRows) =>
      currentRows.map((row, index) =>
        index === rowIndex
          ? {
              ...row,
              [field]: value,
            }
          : row
      )
    );
  };

  const addRow = () => {
    setRows((currentRows) => [...currentRows, createEmptyAbcRow()]);
  };

  const completeRows = rows
    .map((row) => ({
      antecedent: row.antecedent.trim(),
      behavior: row.behavior.trim(),
      consequence: row.consequence.trim(),
    }))
    .filter((row) => row.antecedent || row.behavior || row.consequence);

  const canSubmit =
    completeRows.length > 0 &&
    completeRows.every((row) => row.antecedent && row.behavior && row.consequence);

  return (
    <div className="add-note-form">
      <div className="mb-6 flex items-center">
        <button
          type="button"
          onClick={onClose}
          className="back-link"
        >
          Client
        </button>
      </div>

      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (!canSubmit || saveStatus === "saving") {
            setSaveStatus("error");
            return;
          }

          const formData = new FormData();
          formData.append("clientId", clientId);
          formData.append("rows", JSON.stringify(completeRows));

          setSaveStatus("saving");
          const result = await createAbcData(formData);
          if (result.ok && result.entryId) {
            onSaved?.(result.entryId, result.status);
            onClose();
            return;
          }

          setSaveStatus("error");
        }}
        className="grid min-h-[620px] gap-8"
      >
        <div className="grid gap-2 text-center">
          <h2 className="m-0 text-[1.45rem] font-semibold text-foreground/80">
            A-B-C Data
          </h2>
        </div>

        <div className="grid gap-7">
          {rows.map((row, rowIndex) => (
            <div
              key={rowIndex}
              className="grid gap-5 border-t border-black/8 pt-5 md:grid-cols-3"
            >
              {columns.map((column) => (
                <div key={column.key} className="grid gap-2 text-center">
                  <h3 className="m-0 inline-flex justify-center text-[1.25rem] font-semibold text-foreground/78">
                    <ContextualHelp
                      {...getClinicalHelpContent(column.helpKey)!}
                      label={column.title}
                    />
                  </h3>
                  <Textarea
                    aria-label={`${column.title} row ${rowIndex + 1}`}
                    value={row[column.key]}
                    onChange={(event) =>
                      updateRow(rowIndex, column.key, event.target.value)
                    }
                    className="min-h-[180px] resize-none p-4 text-[1rem]"
                  />
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="mt-auto grid gap-4">
          <div className="flex flex-nowrap items-center justify-center gap-4">
            <button
              type="button"
              onClick={addRow}
              aria-label="Add A-B-C data row"
              title="Add another observation"
              className="material-control more-icon-control dashboard-round-icon-control"
            >
              <Plus aria-hidden="true" size={25} strokeWidth={2} />
            </button>

            <Button
              type="submit"
              disabled={saveStatus === "saving"}
              className="add-note-primary-control px-10 py-3 text-base"
            >
              {saveStatus === "saving" ? "Saving..." : "Save Observation"}
            </Button>
          </div>
          {saveStatus === "error" ? (
            <p className="m-0 text-center text-sm font-medium text-red-700">
              Complete antecedent, behavior, and consequence before saving.
            </p>
          ) : null}
        </div>
      </form>
    </div>
  );
}
