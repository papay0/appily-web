"use client";

import { useRef, useState, type ReactNode, type MouseEvent } from "react";
import { cn } from "@/lib/utils";

interface MagicButtonProps {
  children: ReactNode;
  className?: string;
  variant?: "primary" | "secondary";
  size?: "default" | "lg";
  onClick?: () => void;
  href?: string;
}

export function MagicButton({
  children,
  className,
  variant = "primary",
  size = "default",
  onClick,
}: MagicButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);
  const [sparkles, setSparkles] = useState<{ id: number; x: number; y: number }[]>([]);

  const handleMouseMove = (e: MouseEvent<HTMLButtonElement>) => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    buttonRef.current.style.transform = `translate(${x * 0.1}px, ${y * 0.1}px)`;
  };

  const handleMouseLeave = () => {
    if (!buttonRef.current) return;
    buttonRef.current.style.transform = "translate(0, 0)";
  };

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Add ripple
    const rippleId = Date.now();
    setRipples((prev) => [...prev, { id: rippleId, x, y }]);
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== rippleId));
    }, 600);

    // Add sparkles
    const sparkleCount = 6;
    const newSparkles = Array.from({ length: sparkleCount }, (_, i) => ({
      id: Date.now() + i,
      x: x + (Math.random() - 0.5) * 60,
      y: y + (Math.random() - 0.5) * 60,
    }));
    setSparkles((prev) => [...prev, ...newSparkles]);
    setTimeout(() => {
      setSparkles((prev) => prev.filter((s) => !newSparkles.find((ns) => ns.id === s.id)));
    }, 700);

    onClick?.();
  };

  const baseStyles =
    "relative overflow-hidden rounded-full font-medium transition-all duration-300 magnetic-hover inline-flex items-center justify-center";

  const variantStyles = {
    primary:
      "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground hover:shadow-2xl hover:shadow-primary/30",
    secondary:
      "border-2 border-primary/30 bg-transparent text-foreground hover:bg-primary/5 hover:border-primary/50 hover:shadow-lg",
  };

  const sizeStyles = {
    default: "px-6 py-3 text-base",
    lg: "px-8 py-4 text-lg h-14",
  };

  return (
    <button
      ref={buttonRef}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
    >
      {/* Shimmer overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full hover:translate-x-full transition-transform duration-1000 pointer-events-none" />

      {/* Ripple effects */}
      {ripples.map((ripple) => (
        <span
          key={ripple.id}
          className="absolute bg-white/30 rounded-full pointer-events-none animate-[ripple_0.6s_ease-out]"
          style={{
            left: ripple.x,
            top: ripple.y,
            width: 10,
            height: 10,
            transform: "translate(-50%, -50%)",
          }}
        />
      ))}

      {/* Sparkles */}
      {sparkles.map((sparkle) => (
        <span
          key={sparkle.id}
          className="absolute w-2 h-2 bg-white rounded-full pointer-events-none animate-sparkle"
          style={{
            left: sparkle.x,
            top: sparkle.y,
            transform: "translate(-50%, -50%)",
          }}
        />
      ))}

      {/* Content */}
      <span className="relative z-10 flex items-center gap-2">{children}</span>

      {/* Glow effect on hover */}
      <div className="absolute inset-0 rounded-full opacity-0 hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-primary/0 via-white/10 to-primary/0 pointer-events-none" />
    </button>
  );
}
