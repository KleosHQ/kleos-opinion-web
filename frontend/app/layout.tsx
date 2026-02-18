'use client'

import { PrivyProvider } from '@privy-io/react-auth'
import { toSolanaWalletConnectors } from '@privy-io/react-auth/solana'
import { SolanaWalletGuard } from '@/components/SolanaWalletGuard'
import "./globals.css";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID

  if (!privyAppId) {
    return (
      <html lang="en" className="dark">
        <body className="bg-black text-white min-h-screen flex items-center justify-center p-8">
          <div className="max-w-2xl text-center">
            <h1 className="text-4xl font-bold mb-4 text-red-500">Configuration Error</h1>
            <p className="text-xl mb-6 text-gray-300">
              Privy App ID is missing. Please set <code className="bg-gray-800 px-2 py-1 rounded">NEXT_PUBLIC_PRIVY_APP_ID</code> in your <code className="bg-gray-800 px-2 py-1 rounded">frontend/.env.local</code> file.
            </p>
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 text-left">
              <p className="text-sm text-gray-400 mb-2">Create <code className="text-white">frontend/.env.local</code> with:</p>
              <pre className="bg-black p-4 rounded text-green-400 text-sm overflow-x-auto">
{`NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id_here
NEXT_PUBLIC_API_URL=http://localhost:3001/api`}
              </pre>
              <p className="text-sm text-gray-400 mt-4">
                Get your Privy App ID from{' '}
                <a href="https://privy.io" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                  https://privy.io
                </a>
              </p>
            </div>
          </div>
        </body>
      </html>
    )
  }

  return (
    <html lang="en" className="dark">
      <body className="bg-black text-white">
        <PrivyProvider
          appId={privyAppId}
          config={{
            loginMethods: ['wallet', 'email'],
            appearance: {
              walletChainType: 'solana-only',
            },
            externalWallets: {
              solana: {
                connectors: toSolanaWalletConnectors({
                  shouldAutoConnect: false,
                }),
              },
            },
            embeddedWallets: {
              solana: {
                createOnLogin: 'off', // Don't auto-create wallets, user must manually connect
              },
            },
          }}
        >
          <SolanaWalletGuard>
            {children}
          </SolanaWalletGuard>
        </PrivyProvider>
      </body>
    </html>
  );
}
