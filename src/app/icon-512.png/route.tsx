import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  const size = 512;
  return new ImageResponse(
    (
      <div style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center", background: "#0b1f3a", borderRadius: 80 }}>
        <svg width={size * 0.78} height={size * 0.78} viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#00000055" />
            </filter>
          </defs>
          <g filter="url(#shadow)">
            <rect x="66" y="24" width="48" height="40" rx="6" fill="#ffc54d" stroke="#0b1f3a" strokeWidth="2" />
            <g transform="translate(70,30)">
              <rect x="0" y="0" width="40" height="8" rx="4" fill="#ffd36e" />
              {[...Array(5)].map((_, i) => (
                <rect key={`row-${i}`} x="0" y={12 + i * 6} width="40" height="4" rx="2" fill="#ffe39a" />
              ))}
            </g>
          </g>
          <g transform="translate(22,22) rotate(-5)" filter="url(#shadow)">
            <circle cx="52" cy="52" r="42" fill="#febb02" stroke="#0b1f3a" strokeWidth="4" />
            <circle cx="52" cy="52" r="4" fill="#0b1f3a" />
            {[...Array(12)].map((_, i) => (
              <rect key={`tick-${i}`} x={52 - 1.5} y={10} width={3} height={7} fill="#0b1f3a" transform={`rotate(${i * 30} 52 52)`} />
            ))}
            <rect x={52 - 2} y={52 - 22} width={4} height={22} fill="#0b1f3a" transform={`rotate(-15 52 52)`} />
            <rect x={52 - 2} y={52 - 32} width={4} height={32} fill="#0b1f3a" />
          </g>
        </svg>
      </div>
    ),
    { width: size, height: size }
  );
}
