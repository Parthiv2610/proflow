import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geistSans = Geist({ subsets: ['latin'], variable: '--font-geist-sans' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })

export const metadata: Metadata = {
  title: 'ProFlow — Your All-in-One Productivity Workspace',
  description:
    'ProFlow is a productivity workspace for tasks, projects, calendar, notes, habits, goals, and focus sessions.',
  generator: 'v0.app',
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#1a1626',
  userScalable: true,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`dark ${geistSans.variable} ${geistMono.variable}`}>
      <body className="bg-background font-sans antialiased">
        <script dangerouslySetInnerHTML={{ __html: `
          window.onerror = function(msg, src, line, col, err) {
            var e = { message: msg, source: src, line: line, col: col, stack: err && err.stack, time: new Date().toISOString() };
            try { localStorage.setItem('proflow-last-error', JSON.stringify(e)); } catch(x) {}
          };
          window.onunhandledrejection = function(ev) {
            var reason = ev.reason || ev;
            var msg = reason.message || String(reason);
            var e = { message: msg, stack: reason.stack && reason.stack.slice(0,500), time: new Date().toISOString() };
            try { localStorage.setItem('proflow-last-error', JSON.stringify(e)); } catch(x) {}
          };
        ` }} />
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
