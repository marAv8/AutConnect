type Props = {
  topNav: React.ReactNode;
  notice?: React.ReactNode;
  content: React.ReactNode;
  floatingMenu?: React.ReactNode;
  utilitiesHidden?: boolean;
  onContentPointerDown?: React.PointerEventHandler<HTMLDivElement>;
};

export default function DashboardWorkspaceLayout({
  topNav,
  notice,
  content,
  floatingMenu,
  utilitiesHidden = false,
  onContentPointerDown,
}: Props) {
  const workspaceClassName = [
    "dashboard-workspace-layout",
    notice ? "dashboard-workspace-layout--with-notice" : null,
    utilitiesHidden ? "dashboard-workspace-layout--without-utilities" : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section
      className={workspaceClassName}
      data-dashboard-shell-region="workspace"
    >
      {topNav ? (
        <div className="dashboard-stage-navigation-region">
          <div className="dashboard-stage-coordinate">{topNav}</div>
        </div>
      ) : null}

      {notice ? (
        <div className="dashboard-workspace-notice">{notice}</div>
      ) : null}

      <div
        className="dashboard-client-stage-region"
        data-dashboard-shell-region="client-stage"
        onPointerDown={onContentPointerDown}
      >
        <div className="dashboard-stage-coordinate">{content}</div>
      </div>

      {floatingMenu && !utilitiesHidden ? (
        <div
          className="dashboard-utility-footer-region"
          data-dashboard-shell-region="utility-dock"
        >
          <div className="dashboard-stage-coordinate">
            <div className="dashboard-utility-dock">{floatingMenu}</div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
