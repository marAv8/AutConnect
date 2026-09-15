import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { dashboardInteractionTraceBootstrap } from "./dashboard/dashboardInteractionTraceBootstrap";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

const themeInitializationScript = `
  (() => {
    try {
      const storedTheme = window.localStorage.getItem("autconnect-theme");
      const theme = storedTheme === "light" || storedTheme === "dark"
        ? storedTheme
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
      document.documentElement.classList.toggle("dark", theme === "dark");
      document.documentElement.style.colorScheme = theme;
    } catch {}
  })();
`;

export const metadata: Metadata = {
  title: "AutConnect",
  description: "AutConnect",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const interactionTraceScript =
    process.env.NODE_ENV !== "production"
      ? dashboardInteractionTraceBootstrap()
      : null;

  return (
    <html lang="en" className={manrope.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitializationScript }} />
        {interactionTraceScript ? (
          <script dangerouslySetInnerHTML={{ __html: interactionTraceScript }} />
        ) : null}
      </head>
      <body>{children}</body>
    </html>
  );
}
