import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, Smartphone, Rocket } from "lucide-react";
import { DarkModeToggle } from "@/components/dark-mode-toggle";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-accent/10">
      {/* Header */}
      <header className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">Appily</span>
          </div>
          <nav className="flex items-center gap-4">
            <DarkModeToggle />
            <Link href="/sign-in">
              <Button variant="ghost">Sign in</Button>
            </Link>
            <Link href="/sign-up">
              <Button>Get started</Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 md:py-32">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
            <Sparkles className="h-4 w-4" />
            <span>No coding required</span>
          </div>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight">
            Build native mobile apps{" "}
            <span className="text-primary">with AI</span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Turn your ideas into real iOS and Android apps in minutes.
            No coding required, no technical knowledge needed — just chat
            with AI and watch your app come to life.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link href="/sign-up">
              <Button size="lg" className="text-base px-8">
                Start building for free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="text-base px-8">
              See how it works
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">
            Free to start • No credit card required
          </p>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-20 md:py-32">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Everything you need to create apps
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Building mobile apps has never been easier. Just describe what you want,
              and let AI do the heavy lifting.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-6 rounded-lg border border-border bg-card hover:shadow-lg transition-shadow">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">
                Chat with AI to design
              </h3>
              <p className="text-muted-foreground">
                Simply describe your app idea in plain English. No technical
                jargon needed — just tell AI what you want to build.
              </p>
            </div>

            <div className="p-6 rounded-lg border border-border bg-card hover:shadow-lg transition-shadow">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Smartphone className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">
                Works on iPhone and Android
              </h3>
              <p className="text-muted-foreground">
                Your apps work seamlessly on both iOS and Android devices.
                Build once, run everywhere.
              </p>
            </div>

            <div className="p-6 rounded-lg border border-border bg-card hover:shadow-lg transition-shadow">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Rocket className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">
                Publish to app stores
              </h3>
              <p className="text-muted-foreground">
                When you're ready, publish your app directly to the
                App Store and Google Play with just a few clicks.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20 md:py-32">
        <div className="max-w-3xl mx-auto text-center bg-gradient-to-br from-primary/10 via-primary/5 to-background border border-primary/20 rounded-2xl p-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to build your app?
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Join thousands of creators bringing their ideas to life with AI.
          </p>
          <Link href="/sign-up">
            <Button size="lg" className="text-base px-8">
              Get started for free
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span>© 2025 Appily. All rights reserved.</span>
            </div>
            <div className="flex items-center gap-6">
              <Link href="#" className="hover:text-foreground transition-colors">
                Privacy
              </Link>
              <Link href="#" className="hover:text-foreground transition-colors">
                Terms
              </Link>
              <Link href="#" className="hover:text-foreground transition-colors">
                FAQ
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
