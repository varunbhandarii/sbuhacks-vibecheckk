/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      animation: {
        float: "float 6s ease-in-out infinite",
        "fade-slide-up": "fadeSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) both",
        shimmer: "shimmer 2s ease-in-out infinite",
        "pulse-glow": "pulseGlow 2s ease-in-out infinite",
        "dot-bounce": "dotBounce 1.4s ease-in-out infinite",
        "aurora-1": "aurora-drift 12s ease-in-out infinite",
        "aurora-2": "aurora-drift-2 15s ease-in-out infinite",
        "aurora-3": "aurora-drift-3 10s ease-in-out infinite",
      },
      colors: {
        neon: {
          purple: "#a855f7",
          pink: "#ec4899",
          cyan: "#06b6d4",
          violet: "#8b5cf6",
        },
      },
    },
  },
  plugins: [],
};
