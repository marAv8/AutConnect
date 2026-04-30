import { GRID_FRAME_MAX_WIDTH } from "./layoutConfig";

type Props = {
  children: React.ReactNode;
};

export default function GridFrame({ children }: Props) {
  return (
    <div
      style={{
        width: "100%",
        maxWidth: GRID_FRAME_MAX_WIDTH,
        margin: "0 auto",
      }}
    >
      {children}
    </div>
  );
}
