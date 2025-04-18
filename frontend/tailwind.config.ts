import type { Config } from "tailwindcss";
import { fontFamily } from "tailwindcss/defaultTheme";
import animate from "tailwindcss-animate";

export default {
  darkMode: ["class"],
  content: [
    "./src/**/*.{ts,tsx}",
    "./index.html",
    "./src/pages/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/app/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "SF Pro Display",
          "-apple-system",
          "BlinkMacSystemFont",
          "sans-serif",
        ],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        ruby: "hsl(var(--ruby))",
        wine: "hsl(var(--wine))",
        maroon: "hsl(var(--maroon))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "fade-out": {
          "0%": { opacity: "1" },
          "100%": { opacity: "0" },
        },
        "slide-up": {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "slide-down": {
          "0%": { transform: "translateY(-10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "scale-in": {
          "0%": { transform: "scale(0.95)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        pulse: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
        "pulse-slow": {
          "0%": { opacity: "0.7", transform: "scale(0.95)" },
          "50%": { opacity: "1", transform: "scale(1.05)" },
          "100%": { opacity: "0.7", transform: "scale(0.95)" },
        },
        "sphere-float": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-2px)" },
        },
        "particle-1": {
          "0%": { transform: "translate(0, 0)", opacity: "0" },
          "50%": { transform: "translate(-3px, -3px)", opacity: "0.8" },
          "100%": { transform: "translate(-5px, -5px)", opacity: "0" },
        },
        "particle-2": {
          "0%": { transform: "translate(0, 0)", opacity: "0" },
          "50%": { transform: "translate(-3px, 1px)", opacity: "0.8" },
          "100%": { transform: "translate(-5px, 2px)", opacity: "0" },
        },
        "particle-3": {
          "0%": { transform: "translate(0, 0)", opacity: "0" },
          "50%": { transform: "translate(2px, 2px)", opacity: "0.8" },
          "100%": { transform: "translate(4px, 4px)", opacity: "0" },
        },
        "particle-4": {
          "0%": { transform: "translate(0, 0)", opacity: "0" },
          "50%": { transform: "translate(3px, -2px)", opacity: "0.8" },
          "100%": { transform: "translate(5px, -4px)", opacity: "0" },
        },
        breathe: {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.03)" },
        },
        "spin-slow": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        progress: {
          "0%": { width: "0%" },
          "100%": { width: "100%" },
        },
        wave: {
          "0%, 100%": { transform: "rotate(0deg)" },
          "25%": { transform: "rotate(-15deg)" },
          "75%": { transform: "rotate(15deg)" },
        },
        kick: {
          "0%, 100%": { transform: "rotate(0deg)" },
          "50%": { transform: "rotate(10deg)" },
        },
        peek: {
          "0%": { transform: "translateY(100%)" },
          "100%": { transform: "translateY(0)" },
        },
        dance: {
          "0%": { transform: "translateY(0) rotate(0deg)" },
          "25%": { transform: "translateY(-5px) rotate(-5deg)" },
          "50%": { transform: "translateY(0) rotate(0deg)" },
          "75%": { transform: "translateY(-5px) rotate(5deg)" },
          "100%": { transform: "translateY(0) rotate(0deg)" },
        },
        stretch: {
          "0%": { transform: "scaleY(1)" },
          "50%": { transform: "scaleY(1.1)" },
          "100%": { transform: "scaleY(1)" },
        },
        "stretch-arm": {
          "0%": { transform: "rotate(0deg)" },
          "50%": { transform: "rotate(-15deg)" },
          "100%": { transform: "rotate(0deg)" },
        },
        "infinite-scroll-x": {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-100%)" },
        },
        "infinite-scroll-x-reverse": {
          from: { transform: "translateX(-100%)" },
          to: { transform: "translateX(0)" },
        },
        "infinite-scroll-y": {
          from: { transform: "translateY(0)" },
          to: { transform: "translateY(-100%)" },
        },
        "infinite-scroll-y-reverse": {
          from: { transform: "translateY(-100%)" },
          to: { transform: "translateY(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.5s ease-out forwards",
        "fade-out": "fade-out 0.5s ease-out forwards",
        "slide-up": "slide-up 0.5s ease-out forwards",
        "slide-down": "slide-down 0.5s ease-out forwards",
        "scale-in": "scale-in 0.3s ease-out forwards",
        pulse: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "pulse-slow": "pulse-slow 3s ease-in-out infinite",
        "sphere-float": "sphere-float 3s ease-in-out infinite",
        "particle-1": "particle-1 3s ease-in-out infinite",
        "particle-2": "particle-2 3.5s ease-in-out infinite",
        "particle-3": "particle-3 2.7s ease-in-out infinite",
        "particle-4": "particle-4 4s ease-in-out infinite",
        breathe: "breathe 3s ease-in-out infinite",
        "spin-slow": "spin 6s linear infinite",
        progress: "progress 30s linear forwards",
        wave: "wave 1.5s ease-in-out infinite",
        kick: "kick 1s ease-in-out infinite",
        peek: "peek 0.5s ease-out forwards",
        dance: "dance 1.5s ease-in-out infinite",
        stretch: "stretch 3s ease-in-out infinite",
        "infinite-scroll-x": "infinite-scroll-x 25s linear infinite",
        "infinite-scroll-x-reverse":
          "infinite-scroll-x-reverse 25s linear infinite",
        "infinite-scroll-y": "infinite-scroll-y 25s linear infinite",
        "infinite-scroll-y-reverse":
          "infinite-scroll-y-reverse 25s linear infinite",
      },
    },
  },
  plugins: [animate],
} satisfies Config;
