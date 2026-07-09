import React from 'react';
import { Link } from 'wouter';
import { motion } from 'framer-motion';
import { Monitor, ArrowRight, Zap, Shield, Sparkles, Layout } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground overflow-hidden flex flex-col font-sans">
      <header className="fixed top-0 left-0 right-0 z-50 px-6 py-4 flex items-center justify-between glass-panel border-b-0 rounded-b-2xl max-w-7xl mx-auto mt-2">
        <div className="flex items-center gap-2 font-bold text-xl tracking-tight">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20">
            <Monitor className="w-4 h-4" />
          </div>
          NovaOS
        </div>
        <nav className="flex items-center gap-4">
          <Link href="/sign-in" className="text-sm font-medium hover:text-primary transition-colors">
            Sign In
          </Link>
          <Link href="/sign-up" className="text-sm font-medium bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">
            Get Started
          </Link>
        </nav>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center pt-24 pb-16 px-4">
        {/* Hero Section */}
        <section className="w-full max-w-5xl mx-auto text-center relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-primary/15 blur-[60px] rounded-full pointer-events-none" />
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="relative z-10"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8 border border-primary/20">
              <Sparkles className="w-4 h-4" />
              Introducing the future of web workspaces
            </div>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 text-glow leading-tight">
              Your intelligent<br />
              desktop <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">in the cloud.</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              A sleek, professional web operating system that feels like a real desktop environment. Experience the power of AI integrated directly into your workflow.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/sign-up" className="flex items-center gap-2 bg-primary text-primary-foreground px-8 py-4 rounded-xl text-lg font-semibold hover:scale-105 active:scale-95 transition-all shadow-xl shadow-primary/30 group">
                Enter NovaOS
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="mt-20 relative z-10 w-full max-w-4xl mx-auto"
          >
            <div className="aspect-[16/10] rounded-2xl border border-border/50 bg-card/40 backdrop-blur-sm shadow-2xl overflow-hidden p-2 relative flex items-center justify-center">
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-white/5 pointer-events-none" />
              {/* Fake UI mockup */}
              <div className="w-full h-full rounded-xl bg-background border overflow-hidden relative shadow-inner">
                {/* Fake Taskbar */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-2xl glass-panel-heavy flex gap-2">
                  <div className="w-10 h-10 rounded-xl bg-white/20" />
                  <div className="w-10 h-10 rounded-xl bg-white/20" />
                  <div className="w-10 h-10 rounded-xl bg-white/20" />
                </div>
                {/* Fake Window */}
                <div className="absolute top-1/4 left-1/4 w-1/2 h-1/2 rounded-xl glass-panel border border-white/20 shadow-xl overflow-hidden">
                  <div className="h-8 border-b border-white/10 flex items-center px-3 gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <div className="w-3 h-3 rounded-full bg-amber-400" />
                    <div className="w-3 h-3 rounded-full bg-green-400" />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Features Section */}
        <section className="w-full max-w-5xl mx-auto mt-32 grid md:grid-cols-3 gap-8">
          <div className="p-6 rounded-2xl border bg-card hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 text-primary">
              <Zap className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold mb-2">Lightning Fast</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">Built for speed. Instant loading, smooth animations, and a responsive window manager.</p>
          </div>
          <div className="p-6 rounded-2xl border bg-card hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 text-primary">
              <Layout className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold mb-2">Beautiful Interface</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">Crafted with attention to detail. Glassmorphism, deep customizable themes, and fluid layouts.</p>
          </div>
          <div className="p-6 rounded-2xl border bg-card hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 text-primary">
              <Shield className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold mb-2">Private & Secure</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">Your data stays yours. Secured by industry-standard authentication and robust isolation.</p>
          </div>
        </section>
      </main>
      
      <footer className="py-8 text-center text-sm text-muted-foreground border-t bg-card/50">
        NovaOS Concept &copy; {new Date().getFullYear()}. Crafted for Replit.
      </footer>
    </div>
  );
}
