import { GRID_FRAME_MAX_WIDTH } from "./layoutConfig";

type Props = {
  children: React.ReactNode;
};

export default function GridFrame({ children }: Props) {
  return (
    <div
      style={{
        width: "100%",
        maxWidth: GRID_FRAME_MAX_WIDTH + 172,
        margin: "0 auto",
        borderRadius: 24,
        background: "rgb(246 246 246 / 56%)",
        border: "none",
        boxShadow: "var(--shadow-dashboard-tray)",
        padding: "22px 34px 28px",
        boxSizing: "border-box",
      }}
    >
      {children}
    </div>
  );
}
