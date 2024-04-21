import "~/styles/globals.css";
import { type Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import { DefaultSeo } from "next-seo";
import { ThemeProvider } from "next-themes";
import { type AppType } from "next/app";
import { Inter } from "next/font/google";
import localFont from "next/font/local";

import { api } from "~/utils/api";
import { Toaster } from "~/components/ui/sonner";

import { seoConfig } from "~/seo.config";

const calFont = localFont({
  src: "../assets/CalSans-SemiBold.woff2",
  variable: "--font-cal",
});
const interFont = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const MyApp: AppType<{ session: Session | null }> = ({
  Component,
  pageProps: { session, ...pageProps },
}) => {
  return (
    <ThemeProvider enableSystem attribute="class">
      <SessionProvider session={session}>
        <style jsx global>{`
          html {
            --font-cal: ${calFont.style.fontFamily};
            --font-inter: ${interFont.style.fontFamily};
          }
        `}</style>

        <main className={`min-h-screen font-sans`}>
          <DefaultSeo {...seoConfig} />
          <Component {...pageProps} />
          <Toaster />
        </main>
      </SessionProvider>
    </ThemeProvider>
  );
};

export default api.withTRPC(MyApp);
