import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, Smartphone, Rocket, Zap } from "lucide-react";
import { DarkModeToggle } from "@/components/dark-mode-toggle";

export default function LandingPage() {
  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Ambient background with subtle gradient orbs */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/5" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse-slow animation-delay-2000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl animate-pulse-slow animation-delay-4000" />
      </div>

      {/* Floating header with glassmorphism */}
      <header className="fixed top-0 left-0 right-0 z-50 animate-fade-in-down">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between backdrop-blur-md bg-background/60 border border-border/40 rounded-2xl px-6 py-3 shadow-lg shadow-primary/5">
            <div className="flex items-center gap-2 group">
              <Sparkles className="h-6 w-6 text-primary transition-transform group-hover:rotate-12 group-hover:scale-110 duration-300" />
              <span className="text-xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">Appily</span>
            </div>
            <nav className="flex items-center gap-3">
              <DarkModeToggle />
              <Link href="/sign-in">
                <Button variant="ghost" className="hover:bg-primary/10 transition-all duration-300">Sign in</Button>
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

      {/* Hero Section */}
      <section className="container mx-auto px-4 pt-32 pb-20 md:pt-40 md:pb-32">
        <div className="max-w-5xl mx-auto">
          {/* Floating badge */}
          <div className="flex justify-center mb-8 animate-fade-in-up animation-delay-200">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/20 bg-primary/5 backdrop-blur-sm text-primary text-sm font-medium shadow-lg shadow-primary/10 hover:shadow-primary/20 transition-all duration-300 hover:scale-105">
              <Sparkles className="h-4 w-4 animate-pulse-slow" />
              <span>No coding required</span>
            </div>
          </div>

          {/* Main headline with gradient */}
          <h1 className="text-center mb-8 animate-fade-in-up animation-delay-400">
            <span className="block text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-4">
              <span className="inline-block hover:scale-105 transition-transform duration-300">Build</span>{" "}
              <span className="inline-block hover:scale-105 transition-transform duration-300">native</span>{" "}
              <span className="inline-block hover:scale-105 transition-transform duration-300">mobile</span>{" "}
              <span className="inline-block hover:scale-105 transition-transform duration-300">apps</span>
            </span>
            <span className="block text-5xl md:text-7xl lg:text-8xl font-bold bg-gradient-to-r from-primary via-primary to-primary/60 bg-clip-text text-transparent animate-gradient bg-[length:200%_auto]">
              with AI
            </span>
          </h1>

          {/* Description */}
          <p className="text-center text-lg md:text-xl lg:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed mb-12 animate-fade-in-up animation-delay-600">
            Turn your ideas into real iOS and Android apps in minutes.
            <br className="hidden md:block" />
            <span className="inline-block mt-2">No coding required, no technical knowledge needed — just chat with AI and watch your app come to life.</span>
          </p>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8 animate-fade-in-up animation-delay-800">
            <Link href="/sign-up">
              <Button size="lg" className="group relative overflow-hidden bg-gradient-to-r from-primary to-primary/80 hover:shadow-2xl hover:shadow-primary/30 transition-all duration-500 hover:scale-105 text-base px-8 h-14">
                <span className="relative z-10 flex items-center gap-2">
                  Start building for free
                  <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform duration-300" />
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-white/20 to-primary/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="group text-base px-8 h-14 border-2 hover:bg-primary/5 hover:border-primary/40 hover:shadow-lg transition-all duration-300 hover:scale-105">
              <span className="flex items-center gap-2">
                See how it works
                <Zap className="h-4 w-4 group-hover:rotate-12 transition-transform duration-300" />
              </span>
            </Button>
          </div>

          {/* Social proof */}
          <p className="text-center text-sm text-muted-foreground animate-fade-in-up animation-delay-1000">
            Free to start • No credit card required • Join thousands of creators
          </p>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-32 md:py-40">
        <div className="max-w-6xl mx-auto">
          {/* Section header */}
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
              Everything you need to create apps
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Building mobile apps has never been easier. Just describe what you want, and let AI do the heavy lifting.
            </p>
          </div>

          {/* Feature cards with stagger animation */}
          <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
            {[
              {
                icon: Sparkles,
                title: "Chat with AI to design",
                description: "Simply describe your app idea in plain English. No technical jargon needed — just tell AI what you want to build.",
                delay: "animation-delay-200"
              },
              {
                icon: Smartphone,
                title: "Works on iPhone and Android",
                description: "Your apps work seamlessly on both iOS and Android devices. Build once, run everywhere.",
                delay: "animation-delay-400"
              },
              {
                icon: Rocket,
                title: "Publish to app stores",
                description: "When you're ready, publish your app directly to the App Store and Google Play with just a few clicks.",
                delay: "animation-delay-600"
              }
            ].map((feature, index) => (
              <div
                key={index}
                className={`group relative p-8 rounded-2xl border border-border/50 bg-gradient-to-br from-card/50 to-card backdrop-blur-sm hover:shadow-2xl hover:shadow-primary/10 transition-all duration-500 hover:scale-[1.02] hover:-translate-y-1 animate-fade-in-up ${feature.delay}`}
              >
                {/* Gradient overlay on hover */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/0 to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                {/* Icon */}
                <div className="relative mb-6 w-16 h-16 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                  <feature.icon className="h-8 w-8 text-primary" />
                </div>

                {/* Content */}
                <h3 className="relative text-2xl font-semibold mb-3 group-hover:text-primary transition-colors duration-300">
                  {feature.title}
                </h3>
                <p className="relative text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>

                {/* Decorative element */}
                <div className="absolute bottom-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors duration-500" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-32 md:py-40">
        <div className="max-w-4xl mx-auto">
          <div className="relative group">
            {/* Animated background glow */}
            <div className="absolute -inset-1 bg-gradient-to-r from-primary via-primary/50 to-primary opacity-20 blur-2xl group-hover:opacity-30 transition-opacity duration-500 rounded-3xl" />

            {/* Main CTA card */}
            <div className="relative bg-gradient-to-br from-card/80 to-card/60 backdrop-blur-xl border border-primary/20 rounded-3xl p-12 md:p-16 shadow-2xl overflow-hidden">
              {/* Decorative elements */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl animate-pulse-slow" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl animate-pulse-slow animation-delay-2000" />

              <div className="relative z-10 text-center space-y-8">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
                  <Sparkles className="h-4 w-4" />
                  <span>Start for free today</span>
                </div>

                <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
                  Ready to build{" "}
                  <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                    your app?
                  </span>
                </h2>

                <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                  Join thousands of creators bringing their ideas to life with AI. No credit card required.
                </p>

                <Link href="/sign-up">
                  <Button size="lg" className="group relative overflow-hidden bg-gradient-to-r from-primary to-primary/80 hover:shadow-2xl hover:shadow-primary/40 transition-all duration-500 hover:scale-110 text-lg px-12 h-16 mt-4">
                    <span className="relative z-10 flex items-center gap-3">
                      Get started for free
                      <ArrowRight className="h-6 w-6 group-hover:translate-x-2 transition-transform duration-300" />
                    </span>
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-white/30 to-primary/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative border-t border-border/40 bg-card/30 backdrop-blur-lg">
        <div className="container mx-auto px-4 py-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            {/* Logo */}
            <div className="flex items-center gap-2 group">
              <Sparkles className="h-5 w-5 text-primary group-hover:rotate-12 transition-transform duration-300" />
              <span className="text-lg font-bold">Appily</span>
            </div>

            {/* Links */}
            <div className="flex items-center gap-8 text-sm text-muted-foreground">
              <Link href="#" className="hover:text-primary transition-colors duration-300 hover:scale-105 inline-block">
                Privacy
              </Link>
              <Link href="#" className="hover:text-primary transition-colors duration-300 hover:scale-105 inline-block">
                Terms
              </Link>
              <Link href="#" className="hover:text-primary transition-colors duration-300 hover:scale-105 inline-block">
                FAQ
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
