import AppUserHeader from "@/app/components/AppUserHeader";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <div style={{ padding: "24px 32px 0" }}>
        <AppUserHeader />
      </div>
      {children}
    </>
  );
}
