import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'
import { Toaster } from 'react-hot-toast'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Wyoiwyget - AI-Powered E-commerce Aggregator',
  description: 'What You Order Is What You Get - Revolutionary AI-powered e-commerce aggregator with virtual try-on capabilities',
  keywords: 'e-commerce, AI, virtual try-on, product comparison, shopping, Azure',
  authors: [{ name: 'Wyoiwyget Team' }],
  creator: 'Wyoiwyget',
  publisher: 'Wyoiwyget',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL('https://wyoiwyget.yourdomain.com'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Wyoiwyget - AI-Powered E-commerce Aggregator',
    description: 'What You Order Is What You Get - Revolutionary AI-powered e-commerce aggregator with virtual try-on capabilities',
    url: 'https://wyoiwyget.yourdomain.com',
    siteName: 'Wyoiwyget',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Wyoiwyget - AI-Powered E-commerce Aggregator',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Wyoiwyget - AI-Powered E-commerce Aggregator',
    description: 'What You Order Is What You Get - Revolutionary AI-powered e-commerce aggregator with virtual try-on capabilities',
    images: ['/twitter-image.jpg'],
    creator: '@wyoiwyget',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: 'your-google-verification-code',
    yandex: 'your-yandex-verification-code',
    yahoo: 'your-yahoo-verification-code',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="h-full">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <meta name="theme-color" content="#3b82f6" />
        <meta name="msapplication-TileColor" content="#3b82f6" />
        
        {/* Preconnect to external domains for performance */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://wyoiwygetstorage.blob.core.windows.net" />
        <link rel="preconnect" href="https://wyoiwyget-postgres.postgres.database.azure.com" />
        
        {/* DNS prefetch for Azure services */}
        <link rel="dns-prefetch" href="//wyoiwyget-swa.azurestaticapps.net" />
        <link rel="dns-prefetch" href="//wyoiwyget-backend.azurecontainerapps.io" />
        <link rel="dns-prefetch" href="//wyoiwyget-ai.azurecontainerapps.io" />
      </head>
      <body className={`${inter.className} h-full antialiased`}>
        <Providers>
          <div className="min-h-full bg-gray-50 dark:bg-gray-900">
            {children}
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: '#363636',
                  color: '#fff',
                },
                success: {
                  duration: 3000,
                  iconTheme: {
                    primary: '#22c55e',
                    secondary: '#fff',
                  },
                },
                error: {
                  duration: 5000,
                  iconTheme: {
                    primary: '#ef4444',
                    secondary: '#fff',
                  },
                },
              }}
            />
          </div>
        </Providers>
      </body>
    </html>
  )
} 