import AppUserHeader from "@/app/components/AppUserHeader";
import AuthenticatedViewportStabilizer from "@/app/components/AuthenticatedViewportStabilizer";

export default function PortalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <AuthenticatedViewportStabilizer />
      <div className="app-shell-pad">
        <AppUserHeader />
      </div>
      {children}
    </>
  );
}
