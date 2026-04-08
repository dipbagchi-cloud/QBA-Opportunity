import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "@/components/ui/toaster";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Q-CRM - AI-Powered Lead & Opportunity Management",
  description:
    "Intelligent CRM system with autonomous AI agents for sales operations automation, predictive analytics, and conversational assistance.",
  keywords: [
    "CRM",
    "AI",
    "Sales",
    "Lead Management",
    "Opportunity Tracking",
    "Sales Automation",
    "Q-CRM",
  ],
  authors: [{ name: "Your Company" }],
  viewport: "width=device-width, initial-scale=1",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0ea5e9" },
    { media: "(prefers-color-scheme: dark)", color: "#0c4a6e" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Auto-reload on ChunkLoadError after new deployments
              window.addEventListener('error', function(e) {
                if (
                  e.message && (
                    e.message.includes('Loading chunk') ||
                    e.message.includes('ChunkLoadError') ||
                    e.message.includes('Failed to fetch dynamically imported module')
                  )
                ) {
                  if (!sessionStorage.getItem('chunk_reload')) {
                    sessionStorage.setItem('chunk_reload', '1');
                    window.location.reload();
                  } else {
                    sessionStorage.removeItem('chunk_reload');
                  }
                }
              });
              // Clear reload flag on successful load
              window.addEventListener('load', function() {
                sessionStorage.removeItem('chunk_reload');
              });
            `,
          }}
        />
      </head>
      <body className={`${jakarta.variable} antialiased font-sans`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
