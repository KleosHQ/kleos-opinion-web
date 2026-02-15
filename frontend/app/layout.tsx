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
              createOnLogin: 'users-without-wallets',
            },
            solanaChains: [
              {
                id: 'solana:mainnet',
                name: 'Solana Mainnet',
                network: 'mainnet',
                rpcUrl: 'https://api.mainnet-beta.solana.com',
              },
              {
                id: 'solana:devnet',
                name: 'Solana Devnet',
                network: 'devnet',
                rpcUrl: 'https://api.devnet.solana.com',
              },
            ],
          }}
        >
          {children}
        </PrivyProvider>
      </body>
    </html>
  );
}
