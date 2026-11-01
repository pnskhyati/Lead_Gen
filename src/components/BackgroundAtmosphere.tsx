export default function BackgroundAtmosphere() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
      {/* Sophisticated gradient background that adapts to dark / light mode */}
      <div className="absolute inset-0 atmosphere-bg" />

      {/* SVG Fractal noise grain */}
      <div className="grain" />

      {/* Atmospheric lighting blurs from Sophisticated Dark design */}
      <div className="absolute top-0 left-0 w-[400px] h-[400px] bg-[#0D2D2A] rounded-full blur-[120px] opacity-40 -ml-20 -mt-20 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-[#A9BFA5] rounded-full blur-[160px] opacity-10 -mr-32 -mb-32 pointer-events-none" />
      <div className="absolute top-1/2 left-1/4 w-[600px] h-[600px] rounded-full blur-[180px] opacity-[0.05] pointer-events-none" style={{ background: 'radial-gradient(circle, #A9BFA5 0%, #15423B 60%, transparent 80%)' }} />

      {/* Subtle organic vector contour curves */}
      <svg 
        className="absolute inset-0 w-full h-full opacity-15"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
        viewBox="0 0 1440 900"
      >
        <path
          d="M-100 250 C 320 180, 680 420, 1100 210 C 1320 100, 1500 160, 1600 220"
          fill="none"
          stroke="#A9BFA5"
          strokeWidth="0.75"
          strokeDasharray="4 6"
        />
        <path
          d="M-50 480 C 280 340, 720 620, 1180 390 C 1380 300, 1520 380, 1600 420"
          fill="none"
          stroke="#A9BFA5"
          strokeWidth="0.75"
        />
        <path
          d="M0 720 C 350 560, 800 820, 1240 610 C 1420 520, 1560 590, 1650 640"
          fill="none"
          stroke="#A9BFA5"
          strokeWidth="0.5"
          strokeDasharray="2 8"
        />
        <circle cx="1150" cy="280" r="160" fill="none" stroke="#A9BFA5" strokeWidth="0.5" strokeOpacity="0.3" />
        <circle cx="180" cy="620" r="220" fill="none" stroke="#A9BFA5" strokeWidth="0.4" strokeDasharray="2 4" strokeOpacity="0.2" />
      </svg>
    </div>
  );
}

