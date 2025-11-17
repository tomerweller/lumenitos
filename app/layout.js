import "./globals.css";

export const metadata = {
  title: "Lumenitos - Stellar Wallet",
  description: "A secure Stellar smart wallet for sending and receiving XLM",
  manifest: "/manifest.json",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <meta name="theme-color" content="#000000" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
