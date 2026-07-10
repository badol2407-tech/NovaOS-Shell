import React from 'react';
import { Link } from 'wouter';
import { motion } from 'framer-motion';
import { Monitor, ArrowRight, Zap, Shield, Sparkles, Layout } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-[100dvh] bg-black text-white overflow-hidden flex flex-col font-sans">
      {/* Ambient background glows */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-indigo-600/10 blur-[120px] rounded-full" />
        <div className="absolute top-10 left-10 w-[300px] h-[300px] bg-violet-700/8 blur-[100px] rounded-full" />
        <div className="absolute bottom-20 right-10 w-[400px] h-[350px] bg-blue-600/8 blur-[100px] rounded-full" />
      </div>

      <header className="fixed top-0 left-0 right-0 z-50 px-6 py-4 flex items-center justify-between max-w-7xl mx-auto mt-2 backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl">
        <div className="flex items-center gap-2 font-bold text-xl tracking-tight text-white">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Monitor className="w-4 h-4 text-white" />
          </div>
          NovaOS
        </div>
        <nav className="flex items-center gap-4">
          <Link href="/sign-in" className="text-sm font-medium text-white/70 hover:text-white transition-colors">
            Sign In
          </Link>
          <Link href="/sign-up" className="text-sm font-medium bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-500/25">
            Get Started
          </Link>
        </nav>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center pt-24 pb-16 px-4 relative z-10">
        {/* Hero Section */}
        <section className="w-full max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-sm font-medium mb-8 border border-indigo-500/20">
              <Sparkles className="w-4 h-4" />
              Introducing the future of web workspaces
            </div>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-tight">
              Your intelligent<br />
              desktop{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-blue-400">
                in the cloud.
              </span>
            </h1>
            <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto mb-10 leading-relaxed">
              A sleek, professional web operating system that feels like a real desktop environment. Experience the power of AI integrated directly into your workflow.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/sign-up"
                className="flex items-center gap-2 bg-indigo-600 text-white px-8 py-4 rounded-xl text-lg font-semibold hover:scale-105 active:scale-95 transition-all shadow-xl shadow-indigo-500/30 group"
              >
                Enter NovaOS
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </motion.div>

          {/* OS Mockup — shows black desktop */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="mt-20 relative z-10 w-full max-w-4xl mx-auto"
          >
            <div className="aspect-[16/10] rounded-2xl border border-white/10 bg-black shadow-2xl shadow-black/80 overflow-hidden p-2 relative">
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
              {/* Black desktop interior */}
              <div className="w-full h-full rounded-xl bg-black border border-white/5 overflow-hidden relative shadow-inner">
                {/* Subtle desktop glow */}
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/20 via-black to-black pointer-events-none" />
                {/* Fake Taskbar */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-2xl backdrop-blur-md bg-white/8 border border-white/10 flex gap-2">
                  <div className="w-10 h-10 rounded-xl bg-white/10" />
                  <div className="w-10 h-10 rounded-xl bg-white/10" />
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/30" />
                </div>
                {/* Fake Window */}
                <div className="absolute top-1/4 left-1/4 w-1/2 h-1/2 rounded-xl backdrop-blur-md bg-white/5 border border-white/10 shadow-xl overflow-hidden">
                  <div className="h-8 border-b border-white/8 flex items-center px-3 gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-400/70" />
                    <div className="w-3 h-3 rounded-full bg-amber-400/70" />
                    <div className="w-3 h-3 rounded-full bg-green-400/70" />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Features Section */}
        <section className="w-full max-w-5xl mx-auto mt-32 grid md:grid-cols-3 gap-8">
          {[
            {
              icon: <Zap className="w-6 h-6" />,
              title: 'Lightning Fast',
              body: 'Built for speed. Instant loading, smooth animations, and a responsive window manager.',
            },
            {
              icon: <Layout className="w-6 h-6" />,
              title: 'Beautiful Interface',
              body: 'Crafted with attention to detail. Glassmorphism, deep customizable themes, and fluid layouts.',
            },
            {
              icon: <Shield className="w-6 h-6" />,
              title: 'Private & Secure',
              body: 'Your data stays yours. Secured by industry-standard authentication and robust isolation.',
            },
          ].map((f) => (
            <div
              key={f.title}
              className="p-6 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/8 transition-colors"
            >
              <div className="w-12 h-12 rounded-xl bg-indigo-500/15 flex items-center justify-center mb-4 text-indigo-400">
                {f.icon}
              </div>
              <h3 className="text-lg font-bold mb-2 text-white">{f.title}</h3>
              <p className="text-white/45 text-sm leading-relaxed">{f.body}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="relative z-10 py-8 text-center text-sm text-white/25 border-t border-white/8">
        NovaOS &copy; {new Date().getFullYear()} — Crafted by Ashikur Rahman Badol
      </footer>
    </div>
  );
}
