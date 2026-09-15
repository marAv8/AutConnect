import {
  MODE_CONTENT_MARGIN_BOTTOM,
  MODE_CONTENT_MARGIN_TOP,
} from "./layoutConfig";

type Props = {
  children: React.ReactNode;
};

export default function ModeContentFrame({ children }: Props) {
  return (
    <div
      className="dashboard-mode-content-frame"
      style={{
        width: "100%",
        marginTop: `var(--dashboard-mode-content-margin-top, ${MODE_CONTENT_MARGIN_TOP}px)`,
        marginBottom: MODE_CONTENT_MARGIN_BOTTOM,
        display: "flex",
        justifyContent: "center",
      }}
    >
      {children}
    </div>
  );
}
