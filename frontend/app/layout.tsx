'use client'

import { PrivyProvider } from '@privy-io/react-auth'
import type { Metadata } from "next";
import "./globals.css";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <PrivyProvider
          appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || ''}
          config={{
            loginMethods: ['wallet', 'email', 'sms'],
            appearance: {
              theme: 'light',
              accentColor: '#676FFF',
            },
          }}
        >
          {children}
        </PrivyProvider>
      </body>
    </html>
  );
}
