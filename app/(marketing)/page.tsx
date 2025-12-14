"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { 
  Paperclip, 
  Settings, 
  Rocket, 
  DollarSign, 
  Check, 
  ArrowRight, 
  X, 
  Menu,
  Wand2,
  Plus,
  ShoppingBag,
  Wallet,
  Utensils,
  Plane,
  Activity,
  List,
  Code,
  XCircle,
  ChevronDown,
  Droplets
} from "lucide-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { 
  faStripe, 
  faAirbnb, 
  faSpotify, 
  faUber, 
  faLyft, 
  faSlack, 
  faDiscord,
  faGoogle,
  faAmazon,
  faMicrosoft
} from "@fortawesome/free-brands-svg-icons";

// --- Components ---

function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="fixed top-6 left-0 right-0 z-50 flex justify-center px-6 pointer-events-none">
      <nav className="pointer-events-auto w-full max-w-3xl bg-white/5 backdrop-blur-md border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.05)] rounded-full px-2 pl-3 py-2 flex items-center justify-between transition-all duration-300 hover:bg-white/10 hover:shadow-[0_8px_32px_rgba(0,0,0,0.1)]">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group pl-2">
          <div className="relative w-5 h-5 group-hover:scale-105 transition-transform duration-200">
            <Image 
              src="/appily-logo.svg" 
              alt="Appily Logo" 
              fill
              className="object-contain"
            />
          </div>
          <span className="font-semibold text-lg tracking-tight text-[#1A2B48]">Appily</span>
        </Link>

        {/* Desktop Links */}
        <div className="hidden md:flex items-center gap-2 text-sm font-medium text-gray-600/90">
          <Link 
            href="#pricing" 
            className="px-4 py-2 rounded-full hover:bg-white/40 hover:text-black hover:shadow-sm transition-all duration-200"
          >
            Pricing
          </Link>
          <Link 
            href="#community" 
            className="px-4 py-2 rounded-full hover:bg-white/40 hover:text-black hover:shadow-sm transition-all duration-200"
          >
            Examples
          </Link>
          <Link 
            href="#faq" 
            className="px-4 py-2 rounded-full hover:bg-white/40 hover:text-black hover:shadow-sm transition-all duration-200"
          >
            FAQ
          </Link>
          <Link 
            href="https://www.notion.so/Careers-2c1e0ebc82d280cc926ecb751a12d75f?source=copy_link" 
            target="_blank"
            className="px-4 py-2 rounded-full hover:bg-white/40 hover:text-black hover:shadow-sm transition-all duration-200"
          >
            Careers
          </Link>
        </div>

        {/* CTA */}
        <div className="hidden md:flex items-center">
          <Link 
            href="/sign-up" 
            className="bg-[#1A2B48] text-white px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-[#1A2B48]/90 transition-all shadow-sm hover:shadow-md active:scale-95"
          >
            Start Building
          </Link>
        </div>

        {/* Mobile Menu Toggle */}
        <button 
          className="md:hidden text-gray-600 pr-2 hover:text-black transition-colors cursor-pointer"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="absolute top-full left-0 right-0 mt-4 bg-white/90 backdrop-blur-xl border border-gray-100 rounded-2xl p-4 flex flex-col gap-2 shadow-xl animate-in slide-in-from-top-2 origin-top">
            <Link href="#pricing" className="text-gray-600 font-medium px-4 py-3 hover:bg-gray-50 rounded-xl transition-colors" onClick={() => setIsMobileMenuOpen(false)}>Pricing</Link>
            <Link href="#community" className="text-gray-600 font-medium px-4 py-3 hover:bg-gray-50 rounded-xl transition-colors" onClick={() => setIsMobileMenuOpen(false)}>Examples</Link>
            <Link href="#faq" className="text-gray-600 font-medium px-4 py-3 hover:bg-gray-50 rounded-xl transition-colors" onClick={() => setIsMobileMenuOpen(false)}>FAQ</Link>
            <Link href="https://www.notion.so/Careers-2c1e0ebc82d280cc926ecb751a12d75f?source=copy_link" target="_blank" className="text-gray-600 font-medium px-4 py-3 hover:bg-gray-50 rounded-xl transition-colors" onClick={() => setIsMobileMenuOpen(false)}>Careers</Link>
            <Link href="/sign-up" className="bg-black text-white px-5 py-3 rounded-xl text-center font-medium mx-2 mb-1 shadow-sm active:scale-95 transition-all" onClick={() => setIsMobileMenuOpen(false)}>Start Building</Link>
          </div>
        )}
      </nav>
    </div>
  );
}

function Hero() {
  const [inputValue, setInputValue] = useState("");
  const [suffix, setSuffix] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [hasInteractedWithAttach, setHasInteractedWithAttach] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Dynamic typewriter effect
  useEffect(() => {
    const phrases = ["fitness tracker...", "vintage marketplace...", "SaaS dashboard..."];
    let currentPhraseIndex = 0;
    let currentCharIndex = 0;
    let isDeleting = false;
    let timeoutId: NodeJS.Timeout;

    const type = () => {
      const currentPhrase = phrases[currentPhraseIndex];
      
      if (isDeleting) {
        setSuffix(currentPhrase.substring(0, currentCharIndex - 1));
        currentCharIndex--;
      } else {
        setSuffix(currentPhrase.substring(0, currentCharIndex + 1));
        currentCharIndex++;
      }

      if (!isDeleting && currentCharIndex === currentPhrase.length) {
        isDeleting = true;
        timeoutId = setTimeout(type, 2000); // Pause at end of phrase
      } else if (isDeleting && currentCharIndex === 0) {
        isDeleting = false;
        currentPhraseIndex = (currentPhraseIndex + 1) % phrases.length;
        timeoutId = setTimeout(type, 500); // Pause before typing next
      } else {
        const speed = isDeleting ? 30 : 80;
        timeoutId = setTimeout(type, speed);
      }
    };

    timeoutId = setTimeout(type, 1000);

    return () => clearTimeout(timeoutId);
  }, []);

  const showGhostText = !isFocused && inputValue.length === 0;

  const handleAttachClick = () => {
    if (!hasInteractedWithAttach) {
      setShowOnboarding(true);
      setHasInteractedWithAttach(true);
    } else {
      // Open file dialog on subsequent clicks
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
        console.log("File selected:", e.target.files[0].name);
        // Here you would typically handle the file upload
    }
  };

  return (
    <section className="relative pt-44 pb-16 px-6 overflow-hidden flex flex-col items-center justify-center min-h-[70vh]">
      {/* Background Gradients */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[1200px] h-[800px] opacity-40 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-orange-100/50 rounded-full blur-[120px] mix-blend-multiply" />
        <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-blue-100/50 rounded-full blur-[120px] mix-blend-multiply" />
      </div>

      <div className="max-w-4xl mx-auto flex flex-col items-center relative z-10 w-full">
        <div className="text-center space-y-4 mb-12">
          <h1 className="text-5xl md:text-[60px] font-display font-bold tracking-tight leading-[1.1] text-[#1A2B48] pb-4">
            Build mobile apps by <br /> 
            <span className="relative inline-block px-2">
              <span className="font-serif italic relative z-10">chatting</span>
              <svg className="absolute w-full h-3 -bottom-1 left-0 text-indigo-200 -z-10" viewBox="0 0 100 10" preserveAspectRatio="none">
                 <path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="8" fill="none" />
              </svg>
            </span>
          </h1>
          <p className="text-lg md:text-xl text-[#555555] font-normal max-w-2xl mx-auto">
            Just describe your idea and watch AI build it. No coding <br className="hidden md:block" /> required, from prompt to App Store in minutes.
          </p>
        </div>

        {/* Input Box - Compact & Sleek */}
        <div className="relative w-full max-w-[700px] group">
          {/* Glow effect behind input - strengthened for visibility */}
          <div className={`absolute -inset-1 bg-gradient-to-r from-blue-400/30 to-orange-400/30 rounded-[2.5rem] blur-2xl opacity-60 group-hover:opacity-80 transition-all duration-500 ${isFocused ? 'opacity-100 scale-[1.02]' : ''}`} />
          
          <div className={`relative w-full h-[160px] bg-white rounded-3xl shadow-2xl border border-gray-200/80 overflow-visible transition-all duration-300 ${isFocused ? 'ring-2 ring-gray-900/5 border-gray-300' : ''}`}>
            <div className="absolute inset-0 p-6 flex flex-col justify-between">
              
              {/* Text Area */}
              <div className="relative w-full flex-1">
                {showGhostText && (
                  <div className="absolute inset-0 pointer-events-none text-gray-400 text-base font-normal flex items-start">
                     <span>Ask Appily to create a </span>
                     <span className="ml-1">{suffix}</span>
                     <span className="animate-pulse ml-[1px]">|</span>
                  </div>
                )}
                <textarea 
                  className="w-full h-full bg-transparent resize-none outline-none text-base font-normal text-gray-900 placeholder-gray-400"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  spellCheck={false}
                />
              </div>

              <div className="flex items-end justify-between pt-2">
                {/* Bottom Left: Attach Button */}
                <div className="relative">
                  <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      onChange={handleFileChange}
                  />
                  <button 
                    onClick={handleAttachClick}
                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors group/attach cursor-pointer"
                  >
                    <Paperclip size={18} />
                    <span className="text-sm font-medium">Attach</span>
                    
                    {/* Tooltip on Hover */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 px-3 py-1.5 bg-black text-white text-xs font-medium rounded-lg opacity-0 group-hover/attach:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                      Attach files and images
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-black"></div>
                    </div>
                  </button>

                  {/* Onboarding Popover */}
                  {showOnboarding && (
                    <div className="absolute top-full left-0 mt-4 w-64 p-4 rounded-xl bg-gray-900 text-white shadow-2xl animate-in fade-in slide-in-from-top-2 z-20">
                      <div className="flex justify-between items-start mb-1">
                        <h4 className="font-bold text-sm">Try adding a file</h4>
                        <button onClick={() => setShowOnboarding(false)} className="text-gray-400 hover:text-white">
                          <X size={14} />
                        </button>
                      </div>
                      <p className="text-xs text-gray-300 leading-relaxed">
                        Ask Appily to build based on images or existing designs.
                      </p>
                      {/* Little Triangle pointing up */}
                      <div className="absolute bottom-full left-8 border-8 border-transparent border-b-gray-900"></div>
                    </div>
                  )}
                </div>

                {/* Bottom Right: Build Button */}
                <button className="bg-[#1A2B48] text-white px-6 py-3 rounded-full text-sm font-semibold hover:bg-[#1A2B48]/90 transition-all shadow-lg hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2 cursor-pointer">
                  <Wand2 size={16} className="text-white" />
                  Build now
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SocialProof() {
  const brandIcons = [
    { name: "Spotify", icon: faSpotify },
    { name: "Uber", icon: faUber },
    { name: "Lyft", icon: faLyft },
    { name: "Slack", icon: faSlack },
    { name: "Discord", icon: faDiscord },
    { name: "Stripe", icon: faStripe },
    { name: "Airbnb", icon: faAirbnb },
    { name: "Google", icon: faGoogle },
    { name: "Amazon", icon: faAmazon },
    { name: "Microsoft", icon: faMicrosoft },
  ];
  
  return (
    <section className="py-6 border-b border-gray-50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col items-center gap-6">
          <span className="text-[10px] font-bold tracking-[0.2em] text-gray-400 uppercase">
            Trusted by builders at
          </span>
          
          <div className="w-full max-w-full overflow-hidden relative group mask-linear-fade">
            <div className="flex gap-16 items-center animate-scroll whitespace-nowrap">
              {[...brandIcons, ...brandIcons, ...brandIcons, ...brandIcons].map((brand, i) => (
                <div key={i} className="text-3xl text-gray-300 hover:text-gray-500 transition-colors duration-300 cursor-default">
                  <FontAwesomeIcon icon={brand.icon} />
                </div>
              ))}
            </div>
            <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-white to-transparent pointer-events-none" />
            <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-white to-transparent pointer-events-none" />
          </div>
        </div>
      </div>
      
      <style jsx>{`
        @keyframes scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-25%); }
        }
        .animate-scroll {
          animation: scroll 18s linear infinite;
        }
      `}</style>
    </section>
  );
}

function CommunitySection() {
  const [activePromptIndex, setActivePromptIndex] = useState<number | null>(null);

  const examples = [
    { 
      title: "HydroTrack", 
      category: "Health & Wellness", 
      description: "Track water intake with cute animated characters.",
      tags: ["Health", "Gamification", "Tracking"],
      icon: Droplets,
      color: "bg-cyan-100 text-cyan-600",
      prompt: "Create a hydration tracking app with a cute water droplet mascot. Include a daily goal progress ring, quick add buttons for different cup sizes, and a streak counter.",
      image: "/hydration app preview2.png"
    },
    { 
      title: "CoinDash", 
      category: "Finance", 
      description: "Crypto portfolio tracker with real-time alerts and tax calculation reports built-in.",
      tags: ["Finance", "Charts", "Real-time"],
      icon: Wallet,
      color: "bg-blue-100 text-blue-600",
      prompt: "Build a crypto portfolio tracker that connects to major exchanges. Display real-time price charts using a dark theme with neon accents. Include a dashboard for total asset value.",
      image: "/hydration app preview2.png"
    },
    { 
      title: "Freshly", 
      category: "Food & Drink", 
      description: "Farm-to-table delivery service app connecting local farmers directly with consumers.",
      tags: ["Marketplace", "Maps", "Delivery"],
      icon: Utensils,
      color: "bg-green-100 text-green-600",
      prompt: "I need a farm-to-table food delivery app. Users should be able to find local farmers on a map, browse seasonal produce, and schedule weekly deliveries. Green and earth-tone color scheme.",
      image: "/hydration app preview2.png"
    }
  ];

  return (
    <section id="community" className="py-16 px-6 bg-gray-50/50 scroll-mt-20">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16 space-y-4">
           <h2 className="text-3xl md:text-4xl font-display font-bold text-[#1A2B48]">
             Built by the community
           </h2>
           <p className="text-lg text-gray-500">
             See what others are building with Appily
           </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {examples.map((app, i) => (
            <div key={i} className="group flex flex-col bg-white rounded-3xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 relative">
               {/* Mock App Image */}
               <div className="relative h-64 bg-gray-50 flex justify-center items-end overflow-hidden pb-0 pt-8">
                  <div className="relative w-full h-full max-w-[280px] transform transition-transform duration-500 group-hover:scale-110 translate-y-2">
                     <Image
                      src={app.image}
                      alt={app.title}
                      fill
                      className="object-contain object-bottom drop-shadow-xl"
                    />
                  </div>
                  
                  {/* Hover Overlay with Display Prompt Button */}
                  <div className={`absolute inset-0 bg-black/20 transition-opacity duration-300 flex items-center justify-center backdrop-blur-[2px] ${activePromptIndex === i ? 'opacity-0 pointer-events-none' : 'opacity-0 group-hover:opacity-100'}`}>
                    <button 
                      onClick={() => setActivePromptIndex(i)}
                      className="bg-white text-[#1A2B48] px-5 py-2.5 rounded-full font-bold transform translate-y-4 group-hover:translate-y-0 transition-all duration-300 shadow-lg flex items-center gap-2 cursor-pointer text-sm"
                    >
                      <Code size={14} />
                      Display prompt
                    </button>
                  </div>

                  {/* Prompt Overlay (Active State) */}
                  {activePromptIndex === i && (
                    <div 
                      className="absolute inset-0 bg-[#1A2B48]/95 p-6 flex flex-col justify-center items-center z-20 animate-in fade-in duration-200 cursor-pointer"
                      onClick={() => setActivePromptIndex(null)}
                    >
                      <div className="absolute top-4 right-4 text-white/60 hover:text-white">
                        <XCircle size={20} />
                      </div>
                      <p className="text-white/90 font-mono text-xs leading-relaxed border-l-2 border-blue-400 pl-3">
                        {app.prompt}
                      </p>
                      <p className="text-white/40 text-[10px] mt-4 font-mono">
                        Click to close
                      </p>
                    </div>
                  )}
               </div>
               
               {/* Content */}
               <div className="flex-1 p-6 flex flex-col">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${app.color}`}>
                        <app.icon size={20} />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 leading-tight">{app.title}</h3>
                        <p className="text-xs text-gray-500 font-medium">{app.category}</p>
                      </div>
                    </div>
                    {i === 0 && (
                      <span className="px-2 py-1 bg-gray-100 rounded-md text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                        v2.0
                      </span>
                    )}
                  </div>
                  
                  <p className="text-sm text-gray-500 leading-relaxed mb-6 flex-1">
                    {app.description}
                  </p>
                  
                  <div className="pt-4 border-t border-gray-50 flex items-center justify-between">
                    <div className="flex gap-2">
                      {app.tags.map((tag, t) => (
                        <span key={t} className="px-2 py-1 bg-gray-100 rounded-full text-[10px] font-medium text-gray-600">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <button className="text-xs font-bold text-white bg-[#1A2B48] px-3 py-1.5 rounded-full flex items-center gap-1 hover:bg-[#1A2B48]/90 transition-colors cursor-pointer group">
                      Clone App
                      <ArrowRight size={10} className="transition-transform group-hover:translate-x-1" />
                    </button>
                  </div>
               </div>
            </div>
          ))}
        </div>

        <div className="flex justify-center">
          <button className="px-8 py-2.5 rounded-full border-2 border-gray-200 text-gray-600 font-medium hover:border-[#1A2B48] hover:text-[#1A2B48] transition-all cursor-pointer bg-white">
            Explore more
          </button>
        </div>
      </div>
    </section>
  );
}

function PricingSection() {
  const [isAnnual, setIsAnnual] = useState(true);

  const plans = [
    {
      name: "Pro",
      monthlyPrice: 59,
      annualPrice: 44,
      description: "For power users",
      features: [
        { name: "250+ messages per month", included: true },
        { name: "Code Editor", included: true },
        { name: "Private Projects", included: true },
        { name: "App Deployment", included: true },
        { name: "Priority Support", included: true },
        { name: "Source Code Export", included: true },
      ],
      button: "Upgrade to Pro",
      highlight: true,
      label: "Most Popular",
      messageLimit: "250 messages per month"
    },
    {
      name: "Beginner",
      monthlyPrice: 29,
      annualPrice: 22,
      description: "For startups",
      features: [
        { name: "100 messages per month", included: true },
        { name: "Code Editor", included: false },
        { name: "Private Projects", included: true },
        { name: "App Deployment", included: true },
        { name: "Community Support", included: true },
        { name: "Source Code Export", included: true },
      ],
      button: "Upgrade to Beginner",
      highlight: false,
      messageLimit: "100 messages per month"
    },
    {
      name: "Starter",
      monthlyPrice: 19,
      annualPrice: 14,
      description: "For creators",
      features: [
        { name: "60 messages per month", included: true },
        { name: "Code Editor", included: false },
        { name: "Private Projects", included: true },
        { name: "App Deployment", included: false },
        { name: "Community Support", included: true },
        { name: "Source Code Export", included: false },
      ],
      button: "Upgrade to Starter",
      highlight: false,
      messageLimit: "60 messages per month"
    },
    {
      name: "Free",
      monthlyPrice: 0,
      annualPrice: 0,
      description: "For hobbyists",
      features: [
        { name: "Limited to 5 messages per day", included: true },
        { name: "Code Editor", included: false },
        { name: "Private Projects", included: false },
        { name: "App Deployment", included: false },
        { name: "Basic Support", included: true },
        { name: "Source Code Export", included: false },
      ],
      button: "Get Started",
      highlight: false,
      messageLimit: "30 messages per month"
    }
  ];

  return (
    <section id="pricing" className="py-16 px-6 bg-gray-50/30 scroll-mt-20">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-6">
          <h2 className="text-3xl font-display font-bold text-gray-900 tracking-tight">Plans & Pricing</h2>
          
          {/* Toggle */}
          <div className="flex items-center justify-center gap-4 bg-white p-1.5 rounded-full border border-gray-100 shadow-sm w-fit mx-auto">
            <button 
              onClick={() => setIsAnnual(false)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer ${!isAnnual ? 'bg-[#1A2B48] text-white shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
            >
              Monthly
            </button>
            <button 
              onClick={() => setIsAnnual(true)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-2 cursor-pointer ${isAnnual ? 'bg-[#1A2B48] text-white shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
            >
              Pay Annually
              <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full">save 25%</span>
            </button>
          </div>
        </div>

        {/* Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan, index) => (
            <div 
              key={index}
              className={`relative p-6 rounded-2xl border flex flex-col h-full transition-all duration-300 ${
                plan.highlight 
                  ? 'bg-white border-[#1A2B48] shadow-[0_0_40px_-10px_rgba(26,43,72,0.15)] ring-1 ring-[#1A2B48]' 
                  : 'bg-white border-gray-100 hover:border-gray-200'
              }`}
            >
              {plan.label && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-[#1A2B48] text-white text-[10px] font-bold uppercase tracking-wider rounded-full shadow-sm">
                  {plan.label}
                </div>
              )}
              
              <div className="mb-6 space-y-2">
                <h3 className="text-sm font-semibold text-gray-900">{plan.name}</h3>
                <div className="flex items-baseline gap-1">
                   {isAnnual && plan.monthlyPrice > 0 && plan.monthlyPrice !== plan.annualPrice && (
                      <span className="text-gray-400 line-through text-lg font-medium mr-1">
                        ${plan.monthlyPrice}
                      </span>
                   )}
                  <span className="text-3xl font-bold text-gray-900">
                    ${isAnnual ? plan.annualPrice : plan.monthlyPrice}
                  </span>
                  <span className="text-sm text-gray-500">/mo</span>
                </div>
                 {isAnnual && plan.annualPrice > 0 && (
                    <p className="text-xs text-gray-400">Billed annually</p>
                 )}
                 
                <div className="w-full px-3 py-1.5 mt-3 rounded border border-gray-200 text-xs text-gray-500 bg-gray-50 text-center">
                    {plan.messageLimit}
                </div>
              </div>

              <div className="flex-1 space-y-3 mb-8">
                {plan.features.map((feature, i) => (
                  <div key={i} className={`flex items-start gap-2 text-sm ${feature.included ? 'text-gray-600' : 'text-gray-400'}`}>
                    {feature.included ? (
                       <Check size={14} className="mt-1 shrink-0 text-[#1A2B48]" />
                    ) : (
                       <X size={14} className="mt-1 shrink-0 text-gray-300" />
                    )}
                    <span>{feature.name}</span>
                  </div>
                ))}
              </div>

              <button className={`w-full py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                plan.highlight 
                  ? 'bg-[#1A2B48] text-white hover:bg-[#1A2B48]/90 shadow-sm' 
                  : 'bg-[#1A2B48] text-white hover:bg-[#1A2B48]/90 shadow-sm'
              }`}>
                {plan.button}
              </button>
            </div>
          ))}
        </div>

        {/* Enterprise Banner */}
        <div className="mt-12 p-8 rounded-2xl bg-[#1A2B48] text-white overflow-hidden relative flex flex-col md:flex-row items-center justify-between gap-6 scroll-mt-24">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-r from-blue-500 to-orange-500 rounded-full blur-[80px] opacity-20" />
          <div className="relative z-10">
            <h3 className="text-xl font-display font-bold mb-1">Enterprise Flexible</h3>
            <p className="text-gray-400 text-sm">
              Custom messages, dedicated support, onboarding services.
            </p>
          </div>
          <Link 
            href="https://calendly.com/kenny-berg-c/30min"
            target="_blank"
            className="relative z-10 whitespace-nowrap px-6 py-2.5 bg-white text-black rounded-lg text-sm font-medium hover:bg-gray-200 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer shadow-sm"
          >
            Book a Demo
          </Link>
        </div>
      </div>
    </section>
  );
}

function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs = [
    {
      question: "How does Appily instantly turn my idea into a mobile app?",
      answer: "Describe your features in natural language. Appily's specialized AI instantly builds a real, native mobile application using React Native. You can preview the app live on your phone with zero setup."
    },
    {
      question: "Do I need to know how to code to use Appily?",
      answer: "No. Appily is designed for founders and entrepreneurs. Our AI handles the entire technical stack—code generation, design, and project setup—automatically."
    },
    {
      question: "Who owns the code and intellectual property?",
      answer: "You retain full ownership of all code, assets, and intellectual property generated for your applications. You can export your code at any time."
    },
    {
      question: "Can I build apps for my business or clients using Appily?",
      answer: "Absolutely. Appily helps creators and teams build production-ready software for commercial purposes. The code export feature ensures your project is scalable from prototype to a serious business."
    },
    {
      question: "Will my app work on both iOS and Android? How do I publish it?",
      answer: "Yes, every Appily application runs natively on both iOS and Android. We offer one-click submission optimized for the Apple App Store; you can use the code export feature to easily deploy to the Google Play Store."
    }
  ];

  return (
    <section id="faq" className="py-16 px-6 bg-white scroll-mt-20">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-3xl font-display font-bold text-center text-[#1A2B48] mb-12">
          Frequently Asked Questions
        </h2>
        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <div 
              key={i} 
              className="border border-gray-100 rounded-2xl overflow-hidden transition-all duration-200 hover:border-gray-200"
            >
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full flex items-center justify-between p-6 text-left bg-white hover:bg-gray-50/50 transition-colors cursor-pointer"
              >
                <span className="font-semibold text-gray-900">{faq.question}</span>
                <ChevronDown 
                  size={20} 
                  className={`text-gray-400 transition-transform duration-300 ${openIndex === i ? 'rotate-180' : ''}`} 
                />
              </button>
              <div 
                className={`overflow-hidden transition-all duration-300 ease-in-out ${
                  openIndex === i ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'
                }`}
              >
                <div className="p-6 pt-0 text-gray-500 leading-relaxed border-t border-gray-50">
                  {faq.answer}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTASection() {
  return (
    <section className="py-16 px-6 bg-white">
      <div className="max-w-5xl mx-auto bg-[#1A2B48] rounded-[2.5rem] overflow-hidden relative px-6 py-20 text-center">
        {/* Gradient Glow Effect */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-r from-blue-500 to-orange-500 rounded-full blur-[80px] opacity-20 pointer-events-none" />
        
        <div className="relative z-10 space-y-8">
          <h2 className="text-4xl md:text-5xl font-display font-bold text-white tracking-tight">
            Ready to build your next big <br /> idea?
          </h2>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto leading-relaxed">
            You can clone any of these examples and customize them to fit your <br className="hidden md:block" />
            needs, or describe your own idea to start from scratch.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <Link 
               href="/sign-up" 
               className="px-8 py-3.5 bg-white text-[#1A2B48] rounded-full font-bold hover:bg-gray-100 transition-all hover:scale-105 active:scale-95 shadow-lg"
            >
              Start Building for Free
            </Link>
            <Link 
               href="https://calendly.com/kenny-berg-c/30min"
               target="_blank"
               className="px-8 py-3.5 bg-transparent text-white border border-white/30 rounded-full font-bold hover:bg-white/10 transition-all hover:border-white/60"
            >
              Read Documentation
            </Link>
          </div>
          <p className="text-xs text-gray-400 pt-4">
            No credit card required • Export code anytime
          </p>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-white pt-16 pb-8 px-6 border-t border-gray-100">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-10">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="relative w-6 h-6">
              <Image 
                src="/appily-logo.svg" 
                alt="Appily Logo" 
                fill
                className="object-contain"
              />
            </div>
            <span className="font-bold text-xl tracking-tight text-[#1A2B48]">Appily</span>
          </div>
          <p className="text-sm text-gray-500 max-w-xs">
            The fastest way to go from idea to App Store. Build native mobile apps just by chatting with AI.
          </p>
          <div className="flex gap-4 pt-2">
             {/* Placeholder for social icons if needed later, currently removed per request */}
          </div>
        </div>

        <div className="flex flex-wrap gap-x-12 gap-y-4 text-sm font-medium text-gray-600">
          <div className="flex flex-col gap-3">
             <span className="font-bold text-gray-900 mb-1">Product</span>
             <Link href="#pricing" className="hover:text-[#1A2B48] transition-colors">Pricing</Link>
             <Link href="#community" className="hover:text-[#1A2B48] transition-colors">Examples</Link>
             <Link href="#faq" className="hover:text-[#1A2B48] transition-colors">FAQ</Link>
          </div>
          <div className="flex flex-col gap-3">
             <span className="font-bold text-gray-900 mb-1">Company</span>
             <Link href="https://www.notion.so/Careers-2c1e0ebc82d280cc926ecb751a12d75f?source=copy_link" target="_blank" className="hover:text-[#1A2B48] transition-colors">Careers</Link>
             <Link href="/sign-up" className="hover:text-[#1A2B48] transition-colors">Start Building</Link>
          </div>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto mt-16 pt-8 border-t border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-gray-400">
         <p>© 2025 Appily Inc. All rights reserved.</p>
         <div className="flex gap-6">
           <Link href="#" className="hover:text-gray-600">Privacy Policy</Link>
           <Link href="#" className="hover:text-gray-600">Terms of Service</Link>
         </div>
      </div>
    </footer>
  );
}

export default function Page() {
  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 selection:bg-gray-100 selection:text-black">
      <Navbar />
      <main>
        <Hero />
        <SocialProof />
        <CommunitySection />
        <PricingSection />
        <FAQSection />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
}
