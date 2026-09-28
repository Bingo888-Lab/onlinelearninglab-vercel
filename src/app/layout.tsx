import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OnlineLearningLab",
  description: "Cloud learning platform: PDFs uploaded by admins, read online by students.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
        {children}
      </body>
    </html>
  );
}
