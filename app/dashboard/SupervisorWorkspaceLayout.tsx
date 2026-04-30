import {
  HEADER_TO_LINK_GAP,
  LINK_TO_CONTENT_GAP,
  MENU_ANCHOR_BOTTOM,
  MENU_ANCHOR_LEFT,
  MENU_ANCHOR_Z_INDEX,
  TOP_NAV_HEIGHT,
  WORKSPACE_BOTTOM_PADDING,
  WORKSPACE_HORIZONTAL_PADDING,
} from "./layoutConfig";

type Props = {
  topNav: React.ReactNode;
  content: React.ReactNode;
  floatingMenu?: React.ReactNode;
};

export default function SupervisorWorkspaceLayout({
  topNav,
  content,
  floatingMenu,
}: Props) {
  return (
    <section
      style={{
        position: "relative",
        height: "100%",
        minHeight: 0,
        width: "100%",
        display: "flex",
        flexDirection: "column",
        paddingTop: HEADER_TO_LINK_GAP,
        paddingBottom: WORKSPACE_BOTTOM_PADDING,
        paddingLeft: WORKSPACE_HORIZONTAL_PADDING,
        paddingRight: WORKSPACE_HORIZONTAL_PADDING,
      }}
    >
      {topNav ? (
        <div
          style={{
            minHeight: TOP_NAV_HEIGHT + LINK_TO_CONTENT_GAP,
            height: TOP_NAV_HEIGHT + LINK_TO_CONTENT_GAP,
            display: "flex",
            alignItems: "flex-start",
            flex: "0 0 auto",
          }}
        >
          {topNav}
        </div>
      ) : null}

      <div
        style={{
          flex: 1,
          minHeight: 0,
          width: "100%",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          overflow: "hidden",
          paddingTop: 6,
        }}
      >
        {content}
      </div>

      {floatingMenu && (
        <div
          style={{
            position: "absolute",
            left: MENU_ANCHOR_LEFT,
            bottom: MENU_ANCHOR_BOTTOM,
            zIndex: MENU_ANCHOR_Z_INDEX,
          }}
        >
          {floatingMenu}
        </div>
      )}
    </section>
  );
}
