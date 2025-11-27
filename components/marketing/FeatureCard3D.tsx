"use client";

import { useRef, type ReactNode, type MouseEvent } from "react";
import { cn } from "@/lib/utils";

interface FeatureCard3DProps {
  icon: ReactNode;
  title: string;
  description: string;
  className?: string;
  delay?: string;
}

export function FeatureCard3D({
  icon,
  title,
  description,
  className,
  delay = "",
}: FeatureCard3DProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = (y - centerY) / 20;
    const rotateY = (centerX - x) / 20;

    cardRef.current.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(10px)`;
  };

  const handleMouseLeave = () => {
    if (!cardRef.current) return;
    cardRef.current.style.transform = "perspective(1000px) rotateX(0) rotateY(0) translateZ(0)";
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={cn(
        "group relative p-8 rounded-2xl border border-border/50 bg-gradient-to-br from-card/80 to-card backdrop-blur-sm",
        "transition-all duration-300 ease-out cursor-pointer",
        "hover:shadow-2xl hover:shadow-primary/10",
        "animate-fade-in-up opacity-0",
        delay,
        className
      )}
      style={{ transformStyle: "preserve-3d" }}
    >
      {/* Gradient overlay on hover */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/0 to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

      {/* Glow effect */}
      <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 via-[var(--magic-violet)]/20 to-primary/20 rounded-2xl opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-500 pointer-events-none" />

      {/* Content container with 3D depth */}
      <div style={{ transform: "translateZ(30px)" }}>
        {/* Icon */}
        <div className="relative mb-6 w-16 h-16 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
          {icon}
          {/* Icon glow */}
          <div className="absolute inset-0 rounded-xl bg-primary/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </div>

        {/* Title */}
        <h3 className="relative text-2xl font-semibold mb-3 group-hover:text-primary transition-colors duration-300 font-display">
          {title}
        </h3>

        {/* Description */}
        <p className="relative text-muted-foreground leading-relaxed">{description}</p>
      </div>

      {/* Decorative corner glow */}
      <div className="absolute bottom-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors duration-500 pointer-events-none" />

      {/* Border gradient on hover */}
      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none gradient-border" />
    </div>
  );
}
