import "./globals.css";
import { ServiceWorkerRegistration } from "./ServiceWorkerRegistration";

const isTestnet = process.env.NEXT_PUBLIC_STELLAR_NETWORK !== 'mainnet';
const appName = isTestnet ? "Lumenitos (testnet)" : "Lumenitos";

export const metadata = {
  title: appName,
  description: "An experimental Stellar smart wallet for sending and receiving XLM",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: appName,
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <meta name="theme-color" content="#0a0a0a" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body>
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
