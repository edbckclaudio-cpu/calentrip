import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  const size = 192;
  return new ImageResponse(
    (
      <div style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center", background: "#0b1f3a", borderRadius: 28 }}>
        <svg width={size * 0.78} height={size * 0.78} viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#00000055" />
            </filter>
          </defs>
          <g filter="url(#shadow)">
            <rect x="58" y="20" width="56" height="44" rx="6" fill="#ffc54d" stroke="#0b1f3a" strokeWidth="2" />
            <g transform="translate(62,28)">
              <rect x="0" y="0" width="48" height="8" rx="4" fill="#ffd36e" />
              {[...Array(5)].map((_, i) => (
                <rect key={`row-${i}`} x="0" y={12 + i * 6} width="48" height="4" rx="2" fill="#ffe39a" />
              ))}
            </g>
          </g>
          <g transform="translate(18,18) rotate(-5)" filter="url(#shadow)">
            <circle cx="42" cy="42" r="36" fill="#febb02" stroke="#0b1f3a" strokeWidth="3" />
            <circle cx="42" cy="42" r="4" fill="#0b1f3a" />
            {[...Array(12)].map((_, i) => (
              <rect key={`tick-${i}`} x={42 - 1} y={8} width={2} height={6} fill="#0b1f3a" transform={`rotate(${i * 30} 42 42)`} />
            ))}
            <rect x={42 - 2} y={42 - 18} width={4} height={18} fill="#0b1f3a" transform={`rotate(-15 42 42)`} />
            <rect x={42 - 1.5} y={42 - 26} width={3} height={26} fill="#0b1f3a" />
          </g>
        </svg>
      </div>
    ),
    { width: size, height: size }
  );
}
