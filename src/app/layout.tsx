import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Eloquence - Video & Audio Recording',
  description: 'Record high-quality video and audio with a beautiful, simple interface',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <div className="min-h-screen bg-background">
          {/* Navigation */}
          <nav className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
            <div className="container mx-auto px-6 py-4">
              <div className="flex items-center justify-between"> 
                <div className="flex items-center space-x-4">
                  <h1 className="text-xl font-bold">Eloquence</h1>
                  <span className="text-xs px-2 py-1 bg-muted rounded-full">
                    Beta
                  </span>
                </div>
                <div className="flex items-center space-x-4">
                  <a 
                    href="https://github.com" 
                    className="text-muted-foreground hover:text-foreground transition-colors text-sm"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    GitHub
                  </a>
                  <a 
                    href="/docs" 
                    className="text-muted-foreground hover:text-foreground transition-colors text-sm"
                  >
                    Docs
                  </a>
                </div>
              </div>
            </div>
          </nav>
          
          {/* Main Content */}
          {children}
          
          {/* Footer */}
          <footer className="border-t mt-20">
            <div className="container mx-auto px-6 py-8">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  © 2024 Eloquence. Built with Next.js and shadcn/ui.
                </p>
                <div className="flex items-center space-x-6 text-sm text-muted-foreground">
                  <a href="/privacy" className="hover:text-foreground transition-colors">
                    Privacy
                  </a>
                  <a href="/terms" className="hover:text-foreground transition-colors">
                    Terms
                  </a>
                  <a href="/support" className="hover:text-foreground transition-colors">
                    Support
                  </a>
                </div>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  )
}
