export function FeudLogo({
  size = 'large',
}: {
  size?: 'small' | 'medium' | 'large';
}) {
  const isLarge = size === 'large';
  const isSmall = size === 'small';

  return (
    <div className="relative flex flex-col items-center select-none">
      {/* Outer Golden Glow */}
      <div className="absolute inset-0 -m-3 rounded-full bg-gradient-to-r from-amber-500/25 via-blue-500/20 to-amber-500/25 blur-xl pointer-events-none" />

      {/* Main Oval Sign Marquee Container */}
      <div
        className={`relative flex flex-col items-center justify-center rounded-[35px] md:rounded-[55px] border-4 md:border-[5px] border-amber-400 bg-gradient-to-b from-[#103070] via-[#091b42] to-[#040d21] shadow-[0_0_35px_rgba(245,158,11,0.6),inset_0_2px_12px_rgba(255,255,255,0.4)] ${
          isLarge
            ? 'px-8 py-3 md:px-14 md:py-4 min-w-[260px] md:min-w-[380px]'
            : isSmall
            ? 'px-4 py-1.5 min-w-[170px]'
            : 'px-6 py-2 min-w-[220px]'
        }`}
      >
        {/* Glowing Marquee Bulbs embedded around the frame */}
        <div className="pointer-events-none absolute -inset-2 flex items-center justify-between px-3">
          <span className="h-2 w-2 md:h-2.5 md:w-2.5 rounded-full bg-amber-300 shadow-[0_0_8px_#fde047] animate-bulb-glow" />
          <span className="h-2 w-2 md:h-2.5 md:w-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_#facc15] animate-bulb-glow-alt" />
          <span className="h-2 w-2 md:h-2.5 md:w-2.5 rounded-full bg-amber-300 shadow-[0_0_8px_#fde047] animate-bulb-glow" />
          <span className="h-2 w-2 md:h-2.5 md:w-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_#facc15] animate-bulb-glow-alt" />
        </div>

        {/* 3D English FAMILY FEUD Title Only */}
        <div className="flex flex-col items-center leading-none text-center">
          {/* "FAMILY" Line */}
          <div className="relative">
            <span
              aria-hidden="true"
              className={`font-black font-display tracking-wider block text-amber-950 translate-y-1 ${
                isLarge
                  ? 'text-3xl sm:text-4xl md:text-5xl lg:text-6xl'
                  : isSmall
                  ? 'text-lg sm:text-xl'
                  : 'text-2xl sm:text-3xl'
              }`}
              style={{
                fontFamily: "'Changa', 'Rubik', sans-serif",
                textShadow: '0 3px 6px rgba(0,0,0,0.9), 0 0 15px rgba(217,119,6,0.8)',
              }}
            >
              FAMILY
            </span>
            <span
              className={`absolute inset-0 font-black font-display tracking-wider block ${
                isLarge
                  ? 'text-3xl sm:text-4xl md:text-5xl lg:text-6xl'
                  : isSmall
                  ? 'text-lg sm:text-xl'
                  : 'text-2xl sm:text-3xl'
              }`}
              style={{
                fontFamily: "'Changa', 'Rubik', sans-serif",
                background: 'linear-gradient(180deg, #FFFFFF 0%, #FFF59D 25%, #FBC02D 55%, #E65100 85%, #FFF9C4 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.8))',
              }}
            >
              FAMILY
            </span>
          </div>

          {/* "FEUD" Line */}
          <div className="relative -mt-1 md:-mt-2">
            <span
              aria-hidden="true"
              className={`font-black font-display tracking-widest block text-amber-950 translate-y-1 ${
                isLarge
                  ? 'text-3xl sm:text-4xl md:text-5xl lg:text-6xl'
                  : isSmall
                  ? 'text-lg sm:text-xl'
                  : 'text-2xl sm:text-3xl'
              }`}
              style={{
                fontFamily: "'Changa', 'Rubik', sans-serif",
                textShadow: '0 3px 6px rgba(0,0,0,0.9), 0 0 15px rgba(217,119,6,0.8)',
              }}
            >
              FEUD
            </span>
            <span
              className={`absolute inset-0 font-black font-display tracking-widest block ${
                isLarge
                  ? 'text-3xl sm:text-4xl md:text-5xl lg:text-6xl'
                  : isSmall
                  ? 'text-lg sm:text-xl'
                  : 'text-2xl sm:text-3xl'
              }`}
              style={{
                fontFamily: "'Changa', 'Rubik', sans-serif",
                background: 'linear-gradient(180deg, #FFFFFF 0%, #FFF59D 25%, #FBC02D 55%, #E65100 85%, #FFF9C4 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.8))',
              }}
            >
              FEUD
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
