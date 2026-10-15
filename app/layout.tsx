import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GTM Unit Economics Engine",
  description:
    "Trace every marketing dollar through channel, motion, cohort, churn and expansion.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
