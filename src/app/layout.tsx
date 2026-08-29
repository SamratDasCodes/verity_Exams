import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Online Exam Portal | Verity",
  description: "Frictionless online examination and assessment platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-[#f3f4f6] text-gray-800 antialiased min-h-screen flex flex-col font-sans selection:bg-[#0056D2] selection:text-white">
        {children}
      </body>
    </html>
  );
}
