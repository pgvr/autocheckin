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
import Head from "next/head";

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
        <Head>
          <link
            rel="apple-touch-icon"
            sizes="180x180"
            href="/icons/apple-touch-icon.png"
          />
          <link
            rel="icon"
            type="image/png"
            sizes="32x32"
            href="/icons/favicon-32x32.png"
          />
          <link
            rel="icon"
            type="image/png"
            sizes="16x16"
            href="/icons/favicon-16x16.png"
          />
          <link rel="manifest" href="/icons/site.webmanifest" />
          <link
            rel="mask-icon"
            href="/icons/safari-pinned-tab.svg"
            color="#5bbad5"
          />
          <link rel="shortcut icon" href="/icons/favicon.ico" />
          <meta name="msapplication-TileColor" content="#da532c" />
          <meta
            name="msapplication-config"
            content="/icons/browserconfig.xml"
          />
          <meta name="theme-color" content="#ffffff" />
        </Head>

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
