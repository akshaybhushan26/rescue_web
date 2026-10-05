import type { Metadata } from "next";
import "./globals.css";
import "./rescue.css";
import "./minimal.css";
export const metadata: Metadata = {
  title: "Integration Rescue",
  description:
    "Diagnose broken integrations, verify repairs, and recover with confidence. A developer workbench by Akshay.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
