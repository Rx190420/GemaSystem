const P1 = 'M 586.691406 616.171875 L 449.171875 616.171875 C 445.800781 616.171875 443.070312 613.4375 443.070312 610.066406 L 443.070312 294.570312 C 443.070312 161.789062 560.171875 53.761719 704.113281 53.761719 L 852.492188 53.761719 C 855.855469 53.761719 858.585938 56.496094 858.585938 59.867188 L 858.585938 185.777344 C 858.585938 189.144531 855.855469 191.878906 852.492188 191.878906 L 704.113281 191.878906 C 642.726562 191.878906 592.789062 237.945312 592.789062 294.570312 L 592.789062 610.066406 C 592.789062 613.4375 590.058594 616.171875 586.691406 616.171875'
const P2 = 'M 735.875 750.011719 L 735.875 624.019531 C 735.875 620.746094 738.460938 618.09375 741.738281 617.933594 C 800.40625 615.113281 847.203125 570.195312 847.203125 515.378906 L 847.203125 469.914062 C 847.203125 466.546875 844.464844 463.8125 841.101562 463.8125 L 741.980469 463.8125 C 738.613281 463.8125 735.875 461.082031 735.875 457.710938 L 735.875 331.800781 C 735.875 328.429688 738.613281 325.703125 741.980469 325.703125 L 990.816406 325.703125 C 994.1875 325.703125 996.921875 328.429688 996.921875 331.800781 L 996.921875 515.378906 C 996.921875 646.234375 883.1875 753.046875 742.121094 756.121094 C 738.699219 756.195312 735.875 753.4375 735.875 750.011719'

export default function PageLoader({ hiding = false }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: '#000',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      animation: hiding ? 'pl-out .45s ease both' : 'pl-in .3s ease both',
    }}>
      <style>{`
        @keyframes pl-in  { from { opacity:0 } to { opacity:1 } }
        @keyframes pl-out { from { opacity:1 } to { opacity:0 } }

        /* El rect del clipPath escala de 0 → 1 desde abajo, llenando el logo */
        #pg-clip-rect {
          transform-box: fill-box;
          transform-origin: 50% 100%;
          animation: pg-rise 2.6s cubic-bezier(.45,.05,.55,.95) infinite;
        }
        @keyframes pg-rise {
          0%          { transform: scaleY(0); }
          60%         { transform: scaleY(1); }
          78%, 86%    { transform: scaleY(1); }
          100%        { transform: scaleY(0); }
        }

        /* Glow en el grupo de paths rellenos */
        #pg-filled {
          animation: pg-glow 2.6s cubic-bezier(.45,.05,.55,.95) infinite;
        }
        @keyframes pg-glow {
          0%        { filter: none; }
          60%, 78%  { filter: drop-shadow(0 0 10px #a78bfa) drop-shadow(0 0 28px #6366f155); }
          88%       { filter: none; }
          100%      { filter: none; }
        }

        /* Flash blanco al llenarse */
        #pg-flash {
          animation: pg-flash 2.6s ease infinite;
        }
        @keyframes pg-flash {
          0%,59%,88%,100% { opacity: 0; }
          72%             { opacity: .12; }
          79%             { opacity: 0; }
        }

        /* Label */
        .pg-label {
          animation: pg-lbl 2.6s ease infinite;
        }
        @keyframes pg-lbl {
          0%,50%  { opacity:.3; letter-spacing:.08em; }
          70%,82% { opacity:1;  letter-spacing:.18em; }
          100%    { opacity:.3; letter-spacing:.08em; }
        }
      `}</style>

      {/*
        Un único <svg> — sin divs intermedios que Chrome pueda compositar.
        El clipPath con <rect> animado por CSS es nativo SVG: cero artefactos.
      */}
      <svg
        viewBox="443 53 554 703"
        width="88"
        height="112"
        style={{ overflow: 'visible' }}
      >
        <defs>
          {/* Gradiente vertical de abajo (índigo) a arriba (blanco) */}
          <linearGradient
            id="pgGrad"
            x1="720" y1="756"
            x2="720" y2="53"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%"   stopColor="#4f46e5" />
            <stop offset="50%"  stopColor="#8b5cf6" />
            <stop offset="85%"  stopColor="#c4b5fd" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity=".9" />
          </linearGradient>

          {/* Clip que sube de abajo a arriba */}
          <clipPath id="pgClip">
            <rect id="pg-clip-rect" x="443" y="53" width="554" height="703" />
          </clipPath>
        </defs>

        {/* Silueta tenue siempre visible */}
        <path d={P1} fill="white" opacity="0.07" />
        <path d={P2} fill="white" opacity="0.07" />

        {/* Relleno con glow — clipPath lo revela de abajo hacia arriba */}
        <g id="pg-filled" clipPath="url(#pgClip)">
          <path d={P1} fill="url(#pgGrad)" />
          <path d={P2} fill="url(#pgGrad)" />
        </g>

        {/* Flash blanco en el pico */}
        <g id="pg-flash" clipPath="url(#pgClip)">
          <path d={P1} fill="white" />
          <path d={P2} fill="white" />
        </g>
      </svg>

      <p className="pg-label" style={{
        marginTop: 20,
        color: '#fff',
        fontWeight: 800,
        fontSize: 13,
        letterSpacing: '.12em',
        textTransform: 'uppercase',
        fontFamily: 'system-ui, sans-serif',
        userSelect: 'none',
      }}>
        GemaSystem
      </p>
    </div>
  )
}
