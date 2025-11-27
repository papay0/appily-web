"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Sparkles,
  Smartphone,
  Rocket,
  Zap,
  MessageSquare,
  QrCode,
  Star,
  Play,
  Check,
} from "lucide-react";
import { DarkModeToggle } from "@/components/dark-mode-toggle";
import { ParticleField } from "@/components/marketing/ParticleField";
import { MagicButton } from "@/components/marketing/MagicButton";
import { LiveChatDemo } from "@/components/marketing/LiveChatDemo";
import { FeatureCard3D } from "@/components/marketing/FeatureCard3D";
import { AnimatedCounter } from "@/components/marketing/AnimatedCounter";
import { TimelineStep } from "@/components/marketing/TimelineStep";

export default function LandingPage() {
  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* ============================================
          MAGICAL BACKGROUND
          ============================================ */}
      <div className="fixed inset-0 -z-10">
        {/* Base gradient */}
        <div className="absolute inset-0 bg-[var(--gradient-hero)]" />

        {/* Animated gradient orbs */}
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/10 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-[var(--magic-violet)]/10 rounded-full blur-3xl animate-pulse-slow animation-delay-2000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-3xl animate-pulse-slow animation-delay-4000" />

        {/* Floating particles */}
        <ParticleField particleCount={25} />

        {/* Noise texture overlay */}
        <div className="absolute inset-0 noise-overlay" />
      </div>

      {/* ============================================
          FLOATING HEADER
          ============================================ */}
      <header className="fixed top-0 left-0 right-0 z-50 animate-fade-in-down">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between glass-morphism rounded-2xl px-6 py-3 shadow-lg shadow-primary/5">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="relative">
                <Image
                  src="/appily-logo.svg"
                  alt="Appily Logo"
                  width={28}
                  height={28}
                  className="transition-transform group-hover:rotate-12 group-hover:scale-110 duration-300"
                />
                {/* Sparkle on hover */}
                <Sparkles className="absolute -top-1 -right-1 w-3 h-3 text-[var(--magic-gold)] opacity-0 group-hover:opacity-100 transition-opacity animate-sparkle" />
              </div>
              <span className="text-xl font-bold font-display bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                Appily
              </span>
            </Link>
            <nav className="flex items-center gap-3">
              <DarkModeToggle />
              <Link href="/sign-in">
                <Button
                  variant="ghost"
                  className="hover:bg-primary/10 transition-all duration-300"
                >
                  Sign in
                </Button>
              </Link>
              <Link href="/sign-up">
                <Button className="bg-gradient-to-r from-primary to-primary/80 hover:shadow-lg hover:shadow-primary/25 transition-all duration-300 hover:scale-105">
                  Get started
                </Button>
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* ============================================
          HERO SECTION - "The Magic Moment"
          ============================================ */}
      <section className="container mx-auto px-4 pt-32 pb-16 md:pt-40 md:pb-24">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left side - Copy */}
            <div className="text-center lg:text-left">
              {/* Floating badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/20 bg-primary/5 backdrop-blur-sm text-primary text-sm font-medium shadow-lg shadow-primary/10 mb-8 animate-fade-in-up opacity-0 animation-delay-200">
                <Sparkles className="h-4 w-4 animate-pulse-slow" />
                <span>No coding required</span>
                <Sparkles className="h-4 w-4 animate-pulse-slow animation-delay-1000" />
              </div>

              {/* Main headline with staggered animation */}
              <h1 className="mb-8">
                <span className="block text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight font-display leading-[1.1]">
                  <span className="inline-block animate-fade-in-up opacity-0 animation-delay-400">
                    Turn your
                  </span>{" "}
                  <span className="inline-block animate-fade-in-up opacity-0 animation-delay-500">
                    ideas into
                  </span>
                  <br />
                  <span className="inline-block animate-fade-in-up opacity-0 animation-delay-600">
                    real apps
                  </span>{" "}
                  <span className="inline-block text-gradient-magic animate-fade-in-up opacity-0 animation-delay-700">
                    — just by
                  </span>
                  <br />
                  <span className="inline-block text-gradient-magic animate-fade-in-up opacity-0 animation-delay-800">
                    talking
                  </span>
                </span>
              </h1>

              {/* Description */}
              <p className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto lg:mx-0 leading-relaxed mb-10 animate-fade-in-up opacity-0 animation-delay-1000">
                Chat with AI to build native iOS and Android apps in minutes. No coding skills
                needed — describe what you want, and watch your app come to life.
              </p>

              {/* CTA buttons */}
              <div className="flex flex-col sm:flex-row items-center lg:items-start justify-center lg:justify-start gap-4 mb-8 animate-fade-in-up opacity-0 animation-delay-1200">
                <Link href="/sign-up">
                  <MagicButton size="lg" className="group">
                    Start building for free
                    <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform duration-300" />
                  </MagicButton>
                </Link>
                <Link href="#how-it-works">
                  <MagicButton variant="secondary" size="lg" className="group">
                    <Play className="h-4 w-4 group-hover:scale-110 transition-transform" />
                    See how it works
                  </MagicButton>
                </Link>
              </div>

              {/* Social proof */}
              <div className="flex flex-col sm:flex-row items-center lg:items-start justify-center lg:justify-start gap-6 text-sm text-muted-foreground animate-fade-in-up opacity-0 animation-delay-1400">
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 border-2 border-background flex items-center justify-center text-xs font-medium"
                      >
                        {String.fromCharCode(64 + i)}
                      </div>
                    ))}
                  </div>
                  <span>Join 10k+ creators</span>
                </div>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star
                      key={i}
                      className="w-4 h-4 fill-[var(--magic-gold)] text-[var(--magic-gold)]"
                    />
                  ))}
                  <span className="ml-1">4.9/5 rating</span>
                </div>
              </div>
            </div>

            {/* Right side - Live Chat Demo */}
            <div className="flex justify-center lg:justify-end animate-scale-fade-in opacity-0 animation-delay-1400">
              <LiveChatDemo />
            </div>
          </div>
        </div>
      </section>

      {/* ============================================
          SOCIAL PROOF BAR
          ============================================ */}
      <section className="py-12 border-y border-border/30 bg-card/30 backdrop-blur-sm">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16">
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold font-display text-primary">
                <AnimatedCounter target={10000} suffix="+" />
              </div>
              <div className="text-sm text-muted-foreground">Apps created</div>
            </div>
            <div className="hidden sm:block w-px h-12 bg-border/50" />
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold font-display text-primary">
                <AnimatedCounter target={50000} suffix="+" />
              </div>
              <div className="text-sm text-muted-foreground">Happy creators</div>
            </div>
            <div className="hidden sm:block w-px h-12 bg-border/50" />
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold font-display text-primary">
                <AnimatedCounter target={4} suffix="min" />
              </div>
              <div className="text-sm text-muted-foreground">Avg. build time</div>
            </div>
            <div className="hidden sm:block w-px h-12 bg-border/50" />
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold font-display text-[var(--magic-gold)]">
                <AnimatedCounter target={99} suffix="%" />
              </div>
              <div className="text-sm text-muted-foreground">Satisfaction rate</div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================
          FEATURES SECTION - "The Three Pillars"
          ============================================ */}
      <section className="container mx-auto px-4 py-24 md:py-32">
        <div className="max-w-6xl mx-auto">
          {/* Section header */}
          <div className="text-center mb-16 md:mb-20">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[var(--magic-violet)]/20 bg-[var(--magic-violet)]/5 text-[var(--magic-violet)] text-sm font-medium mb-6 animate-fade-in-up opacity-0">
              <Zap className="h-4 w-4" />
              <span>Powerful features</span>
            </div>
            <h2 className="text-3xl md:text-5xl lg:text-6xl font-bold font-display mb-6 animate-fade-in-up opacity-0 animation-delay-200">
              Everything you need to
              <br />
              <span className="text-gradient-magic">create apps</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed animate-fade-in-up opacity-0 animation-delay-400">
              Building mobile apps has never been easier. Just describe what you want, and let AI
              do the heavy lifting.
            </p>
          </div>

          {/* Feature cards with 3D effects */}
          <div className="grid md:grid-cols-3 gap-6 lg:gap-8 perspective-container">
            <FeatureCard3D
              icon={<MessageSquare className="h-8 w-8 text-primary" />}
              title="Just chat"
              description="Describe your app idea in plain English. No technical jargon needed — just tell AI what you want to build and watch it happen."
              delay="animation-delay-200"
            />
            <FeatureCard3D
              icon={<Smartphone className="h-8 w-8 text-primary" />}
              title="Works everywhere"
              description="Your apps work seamlessly on both iOS and Android. Build once, run everywhere — from iPhones to Samsung Galaxy."
              delay="animation-delay-400"
            />
            <FeatureCard3D
              icon={<Rocket className="h-8 w-8 text-primary" />}
              title="Go live"
              description="When you're ready, publish directly to the App Store and Google Play. Go from idea to live app in record time."
              delay="animation-delay-600"
            />
          </div>
        </div>
      </section>

      {/* ============================================
          HOW IT WORKS - "The Journey"
          ============================================ */}
      <section
        id="how-it-works"
        className="py-24 md:py-32 bg-gradient-to-b from-transparent via-card/50 to-transparent"
      >
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            {/* Section header */}
            <div className="text-center mb-16 md:mb-20">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/20 bg-primary/5 text-primary text-sm font-medium mb-6">
                <Play className="h-4 w-4" />
                <span>How it works</span>
              </div>
              <h2 className="text-3xl md:text-5xl lg:text-6xl font-bold font-display mb-6">
                From idea to app
                <br />
                <span className="text-gradient-magic">in 4 simple steps</span>
              </h2>
            </div>

            {/* Timeline */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4">
              <TimelineStep
                step={1}
                title="Describe"
                description="Tell AI what app you want to build in plain English"
                icon={<MessageSquare className="w-8 h-8" />}
              />
              <TimelineStep
                step={2}
                title="Watch"
                description="See AI write code and build your app in real-time"
                icon={<Sparkles className="w-8 h-8" />}
              />
              <TimelineStep
                step={3}
                title="Preview"
                description="Scan QR code to test your app on your actual phone"
                icon={<QrCode className="w-8 h-8" />}
              />
              <TimelineStep
                step={4}
                title="Publish"
                description="Deploy to App Store and Google Play with one click"
                icon={<Rocket className="w-8 h-8" />}
                isLast
              />
            </div>
          </div>
        </div>
      </section>

      {/* ============================================
          TESTIMONIALS - "Creator Stories"
          ============================================ */}
      <section className="container mx-auto px-4 py-24 md:py-32">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold font-display mb-4">
              Loved by <span className="text-gradient-magic">creators</span>
            </h2>
            <p className="text-xl text-muted-foreground">See what people are building with Appily</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                quote:
                  "I built my first app in 10 minutes. No coding experience, just chatted with AI and boom — my habit tracker was live!",
                name: "Sarah K.",
                role: "Entrepreneur",
                avatar: "S",
              },
              {
                quote:
                  "As a designer, I finally can bring my app ideas to life without waiting for developers. Game changer!",
                name: "Marcus T.",
                role: "UI/UX Designer",
                avatar: "M",
              },
              {
                quote:
                  "Published 3 apps to the App Store in my first week. The AI understands exactly what I want.",
                name: "Emily R.",
                role: "Content Creator",
                avatar: "E",
              },
            ].map((testimonial, index) => (
              <div
                key={index}
                className="group relative p-8 rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm hover:shadow-xl hover:shadow-primary/5 transition-all duration-500 animate-fade-in-up opacity-0"
                style={{ animationDelay: `${200 + index * 200}ms` }}
              >
                {/* Gradient border on hover */}
                <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 gradient-border pointer-events-none" />

                {/* Stars */}
                <div className="flex gap-1 mb-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star
                      key={i}
                      className="w-4 h-4 fill-[var(--magic-gold)] text-[var(--magic-gold)]"
                    />
                  ))}
                </div>

                {/* Quote */}
                <p className="text-foreground/90 mb-6 leading-relaxed">"{testimonial.quote}"</p>

                {/* Author */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-[var(--magic-violet)] flex items-center justify-center text-white font-semibold">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <div className="font-semibold">{testimonial.name}</div>
                    <div className="text-sm text-muted-foreground">{testimonial.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================
          FINAL CTA - "The Portal"
          ============================================ */}
      <section className="container mx-auto px-4 py-24 md:py-32">
        <div className="max-w-4xl mx-auto">
          <div className="relative group">
            {/* Portal glow background */}
            <div className="absolute inset-0 bg-gradient-to-r from-primary via-[var(--magic-violet)] to-primary opacity-20 blur-3xl rounded-full animate-portal-pulse" />

            {/* Main CTA card */}
            <div className="relative bg-gradient-to-br from-card/90 to-card/70 backdrop-blur-xl border border-primary/20 rounded-3xl p-12 md:p-16 shadow-2xl overflow-hidden">
              {/* Decorative particles */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--magic-violet)]/10 rounded-full blur-3xl animate-pulse-slow" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl animate-pulse-slow animation-delay-2000" />

              {/* Floating sparkles */}
              <Sparkles className="absolute top-8 left-8 w-6 h-6 text-[var(--magic-gold)] animate-sparkle" />
              <Sparkles className="absolute top-12 right-12 w-4 h-4 text-primary animate-sparkle animation-delay-700" />
              <Sparkles className="absolute bottom-16 left-16 w-5 h-5 text-[var(--magic-violet)] animate-sparkle animation-delay-1400" />

              <div className="relative z-10 text-center space-y-8">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
                  <Sparkles className="h-4 w-4 animate-pulse-slow" />
                  <span>Start for free today</span>
                </div>

                <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold font-display">
                  Ready to build{" "}
                  <span className="text-gradient-magic">your app?</span>
                </h2>

                <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                  Join thousands of creators bringing their ideas to life with AI. No credit card
                  required — start building in seconds.
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                  <Link href="/sign-up">
                    <MagicButton size="lg" className="text-lg px-10">
                      Get started for free
                      <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                    </MagicButton>
                  </Link>
                </div>

                {/* Trust indicators */}
                <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground pt-4">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-500" />
                    <span>Free to start</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-500" />
                    <span>No credit card</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-500" />
                    <span>Cancel anytime</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================
          FOOTER
          ============================================ */}
      <footer className="relative border-t border-border/40 bg-card/30 backdrop-blur-lg">
        {/* Wave decoration */}
        <div className="absolute -top-px left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

        <div className="container mx-auto px-4 py-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 group">
              <Image
                src="/appily-logo.svg"
                alt="Appily Logo"
                width={24}
                height={24}
                className="group-hover:rotate-12 transition-transform duration-300"
              />
              <span className="text-lg font-bold font-display">Appily</span>
            </Link>

            {/* Links */}
            <div className="flex items-center gap-8 text-sm text-muted-foreground">
              <Link
                href="#"
                className="hover:text-primary transition-colors duration-300 relative group"
              >
                Privacy
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary group-hover:w-full transition-all duration-300" />
              </Link>
              <Link
                href="#"
                className="hover:text-primary transition-colors duration-300 relative group"
              >
                Terms
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary group-hover:w-full transition-all duration-300" />
              </Link>
              <Link
                href="#"
                className="hover:text-primary transition-colors duration-300 relative group"
              >
                FAQ
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary group-hover:w-full transition-all duration-300" />
              </Link>
              <Link
                href="#"
                className="hover:text-primary transition-colors duration-300 relative group"
              >
                Contact
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary group-hover:w-full transition-all duration-300" />
              </Link>
            </div>

            {/* Copyright */}
            <div className="text-sm text-muted-foreground">
              © 2025 Appily. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
