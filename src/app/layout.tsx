import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/layout/Header";
import ReminderChecker from "@/components/layout/ReminderChecker";
import OnboardingTour from "@/components/layout/OnboardingTour";
import ErrorBoundary from "@/components/ErrorBoundary";
import BottomNav from "@/components/layout/BottomNav";
import NearbyChecker from "@/components/layout/NearbyChecker";
import QueryProvider from "@/components/providers/QueryProvider";
import { ToastProvider } from "@/components/ui/Toast";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "ArriendaYa",
  description: "Plataforma de arriendo de inmuebles",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={inter.variable}>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <Header />
        <QueryProvider>
          <ToastProvider>
            <ReminderChecker />
            <OnboardingTour />
            <ErrorBoundary>
              <main className="mx-auto max-w-6xl px-4 py-6 pb-20 md:pb-6">{children}</main>
            </ErrorBoundary>
            <BottomNav />
            <NearbyChecker />
          </ToastProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
