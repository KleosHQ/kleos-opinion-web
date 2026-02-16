'use client'

import { PrivyProvider } from '@privy-io/react-auth'
import "./globals.css";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-black text-white">
        <PrivyProvider
          appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || ''}
          config={{
            loginMethods: ['wallet', 'email', 'sms'],
            appearance: {
              theme: 'dark',
              accentColor: '#ffffff',
            },
            embeddedWallets: {
              solana: {
                createOnLogin: 'users-without-wallets',
              },
            },
          }}
        >
          {children}
        </PrivyProvider>
      </body>
    </html>
  );
}
