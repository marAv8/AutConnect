import AppUserHeader from "@/app/components/AppUserHeader";

export default function PortalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <div className="app-shell-pad">
        <AppUserHeader />
      </div>
      {children}
    </>
  );
}
