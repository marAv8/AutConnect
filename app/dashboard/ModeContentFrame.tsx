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
      style={{
        width: "100%",
        marginTop: MODE_CONTENT_MARGIN_TOP,
        marginBottom: MODE_CONTENT_MARGIN_BOTTOM,
        display: "flex",
        justifyContent: "center",
      }}
    >
      {children}
    </div>
  );
}
