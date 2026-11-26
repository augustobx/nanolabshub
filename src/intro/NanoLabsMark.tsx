import { useId } from 'react'

export function NanoLabsMark({ size = 22 }: { size?: number }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" style={{ flexShrink: 0 }}>
      <defs>
        <linearGradient id={`${id}-fondo`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FF8A2B" />
          <stop offset="1" stopColor="#E25700" />
        </linearGradient>
        <radialGradient id={`${id}-brillo`} cx="0.3" cy="0.2" r="0.8">
          <stop offset="0" stopColor="#fff" stopOpacity="0.32" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="48" height="48" rx="14" fill={`url(#${id}-fondo)`} />
      <rect x="0" y="0" width="48" height="48" rx="14" fill={`url(#${id}-brillo)`} />
      {/* Orbital loop representing NanoLabs innovation */}
      <circle
        cx="24"
        cy="24"
        r="15"
        fill="none"
        stroke="#fff"
        strokeOpacity="0.92"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeDasharray="74 19"
        pathLength={94.25}
        style={{ transform: 'rotate(345deg)', transformOrigin: '24px 24px' }}
      />
      {/* NanoLabs dynamic N monogram */}
      <g fill="#fff">
        <path d="M16 32V16H19.6L28.2 27.8V16H31.5V32H27.9L19.3 20.2V32H16Z" />
      </g>
      {/* Diamond spark flare */}
      <path
        fill="#fff"
        d="M35.6 8.4 L36.6 11.6 L39.8 12.6 L36.6 13.6 L35.6 16.8 L34.6 13.6 L31.4 12.6 L34.6 11.6 Z"
      />
    </svg>
  )
}
