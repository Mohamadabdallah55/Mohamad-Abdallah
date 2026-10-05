export function IbnTaymiyyahLogo({ className = 'h-16 w-16 md:h-20 md:w-20' }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center rounded-2xl bg-white p-1.5 shadow-[0_0_20px_rgba(255,255,255,0.4)] ${className}`}>
      <svg
        viewBox="0 0 500 500"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-full select-none"
      >
        {/* Background rounded subtle border */}
        <defs>
          <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#d4af37" />
            <stop offset="50%" stopColor="#c5a059" />
            <stop offset="100%" stopColor="#997a38" />
          </linearGradient>
        </defs>

        {/* Outer Arch Frame (Mihrab) */}
        <path
          d="M250 40 C 250 40, 220 100, 140 160 C 120 175, 115 220, 115 320 L 135 320 C 135 225, 140 185, 155 172 C 225 118, 250 65, 250 65 C 250 65, 275 118, 345 172 C 360 185, 365 225, 365 320 L 385 320 C 385 220, 380 175, 360 160 C 280 100, 250 40, 250 40 Z"
          fill="#064e3b"
        />

        {/* Crescent on apex of outer arch */}
        <path
          d="M250 25 C 242 25, 235 32, 235 40 C 235 48, 242 55, 250 55 C 253 55, 256 54, 258 52 C 252 51, 247 46, 247 40 C 247 34, 252 29, 258 28 C 256 26, 253 25, 250 25 Z"
          fill="#064e3b"
        />

        {/* Mosque Dome Silhouette */}
        <path
          d="M250 170 C 205 170, 180 215, 180 270 L 320 270 C 320 215, 295 170, 250 170 Z"
          fill="#064e3b"
        />
        {/* Crescent on dome */}
        <path
          d="M250 152 C 246 152, 242 156, 242 161 C 242 166, 246 170, 250 170 C 252 170, 254 169, 255 168 C 251 167, 248 164, 248 161 C 248 158, 251 155, 255 154 C 254 153, 252 152, 250 152 Z"
          fill="#064e3b"
        />
        <rect x="248.5" y="161" width="3" height="10" fill="#064e3b" />

        {/* Mosque Base and Small Arches */}
        <rect x="165" y="270" width="170" height="10" fill="#064e3b" />
        <path
          d="M135 285 L 365 285 L 365 330 L 135 330 Z"
          fill="#064e3b"
        />
        {/* White Base Arches */}
        <path
          d="M205 330 L 205 305 C 205 295, 215 288, 225 288 C 235 288, 245 295, 245 305 L 245 330 Z"
          fill="#ffffff"
        />
        <path
          d="M255 330 L 255 305 C 255 295, 265 288, 275 288 C 285 288, 295 295, 295 305 L 295 330 Z"
          fill="#ffffff"
        />
        <path
          d="M185 330 L 185 315 C 185 305, 192 300, 198 300 L 198 330 Z"
          fill="#ffffff"
        />
        <path
          d="M302 330 L 302 300 C 308 300, 315 305, 315 315 L 315 330 Z"
          fill="#ffffff"
        />

        {/* Minaret on Right */}
        <rect x="315" y="210" width="30" height="100" fill="#064e3b" />
        {/* Minaret Balcony */}
        <rect x="310" y="200" width="40" height="10" fill="#064e3b" />
        {/* Minaret Tower Top */}
        <rect x="320" y="160" width="20" height="40" fill="#064e3b" />
        {/* Minaret Window */}
        <rect x="325" y="170" width="10" height="18" rx="5" fill="#ffffff" />
        {/* Minaret Cap */}
        <polygon points="330,135 318,160 342,160" fill="#064e3b" />
        {/* Crescent on minaret */}
        <circle cx="330" cy="132" r="3.5" fill="#064e3b" />

        {/* Open Quran Pages (Golden book wings below mosque) */}
        <path
          d="M250 365 C 210 335, 150 330, 100 340 C 145 365, 205 365, 250 375 Z"
          fill="url(#goldGradient)"
        />
        <path
          d="M250 365 C 290 335, 350 330, 400 340 C 355 365, 295 365, 250 375 Z"
          fill="url(#goldGradient)"
        />
        {/* Secondary Lower Page Curves */}
        <path
          d="M250 375 C 205 365, 145 365, 100 340 C 135 385, 200 380, 250 385 Z"
          fill="#b38a36"
        />
        <path
          d="M250 375 C 295 365, 355 365, 400 340 C 365 385, 300 380, 250 385 Z"
          fill="#b38a36"
        />

        {/* Calligraphy Text: مسجد ابن تيمية */}
        <text
          x="250"
          y="420"
          textAnchor="middle"
          fontSize="46"
          fontWeight="900"
          fontFamily="'Tajawal', 'Cairo', sans-serif"
          fill="#064e3b"
          letterSpacing="0.5"
        >
          مسجد ابن تيمية
        </text>

        {/* Bottom Gold Line and Eight-pointed Star */}
        <line x1="125" y1="448" x2="225" y2="448" stroke="url(#goldGradient)" strokeWidth="3" strokeLinecap="round" />
        <line x1="275" y1="448" x2="375" y2="448" stroke="url(#goldGradient)" strokeWidth="3" strokeLinecap="round" />

        {/* Rub el Hizb (8-pointed star in center) */}
        <g transform="translate(250, 448)">
          <rect x="-9" y="-9" width="18" height="18" fill="none" stroke="url(#goldGradient)" strokeWidth="2.5" />
          <rect x="-9" y="-9" width="18" height="18" fill="none" stroke="url(#goldGradient)" strokeWidth="2.5" transform="rotate(45)" />
        </g>
      </svg>
    </div>
  );
}
