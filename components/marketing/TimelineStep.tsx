"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface TimelineStepProps {
  step: number;
  title: string;
  description: string;
  icon: ReactNode;
  isLast?: boolean;
  className?: string;
}

export function TimelineStep({
  step,
  title,
  description,
  icon,
  isLast = false,
  className,
}: TimelineStepProps) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
          }
        });
      },
      { threshold: 0.3 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn(
        "relative flex flex-col items-center text-center transition-all duration-700",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8",
        className
      )}
      style={{ transitionDelay: `${step * 150}ms` }}
    >
      {/* Connector line */}
      {!isLast && (
        <div className="hidden md:block absolute top-10 left-[calc(50%+40px)] w-[calc(100%-80px)] h-0.5">
          <div
            className={cn(
              "h-full bg-gradient-to-r from-primary/50 to-primary/20 transition-all duration-1000",
              isVisible ? "w-full" : "w-0"
            )}
            style={{ transitionDelay: `${step * 150 + 300}ms` }}
          />
        </div>
      )}

      {/* Step circle with icon */}
      <div
        className={cn(
          "relative w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center mb-6",
          "border-2 border-primary/30 transition-all duration-500",
          isVisible && "animate-bounce-in"
        )}
        style={{ animationDelay: `${step * 150}ms` }}
      >
        {/* Glow effect */}
        <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />

        {/* Step number badge */}
        <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center shadow-lg">
          {step}
        </div>

        {/* Icon */}
        <div className="text-primary">{icon}</div>
      </div>

      {/* Content */}
      <div className="max-w-[200px]">
        <h3 className="text-lg font-semibold mb-2 font-display">{title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </div>
  );
}
