"use client";

export default function DashboardContinuityBack() {
  return (
    <main>
      <button id="continuity-visible-back" onClick={() => history.back()}>
        Back
      </button>
    </main>
  );
}
