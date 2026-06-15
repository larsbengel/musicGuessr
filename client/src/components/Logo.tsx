interface Props {
  size?: number;
  color?: string;
}

export default function Logo({ size = 48, color = 'var(--accent)' }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Outer ring */}
      <circle cx="50" cy="50" r="44" stroke={color} strokeWidth="3.5" />

      {/* Left waveform bars: short · tall · medium */}
      <rect x="9"    y="46" width="3.5" height="8"  rx="1.75" fill={color} />
      <rect x="15.5" y="37" width="3.5" height="26" rx="1.75" fill={color} />
      <rect x="22"   y="42" width="3.5" height="16" rx="1.75" fill={color} />

      {/* Right waveform bars: medium · tall · short */}
      <rect x="74.5" y="42" width="3.5" height="16" rx="1.75" fill={color} />
      <rect x="81"   y="37" width="3.5" height="26" rx="1.75" fill={color} />
      <rect x="87.5" y="46" width="3.5" height="8"  rx="1.75" fill={color} />

      {/* Music note — stem */}
      <rect x="39.5" y="27" width="3.5" height="33" rx="1.75" fill={color} />
      {/* Music note — flag */}
      <path d="M43 27.5 C54 30 56 38 51 47" stroke={color} strokeWidth="3.5" strokeLinecap="round" />
      {/* Music note — head */}
      <ellipse cx="37" cy="61" rx="7" ry="5.5" fill={color} transform="rotate(-18 37 61)" />

      {/* Question mark (brighter to pop off the note) */}
      <text
        x="58" y="70"
        fontSize="30" fontWeight="900"
        fill="#f0e6ff"
        textAnchor="middle"
        fontFamily="system-ui, -apple-system, sans-serif"
      >?</text>
    </svg>
  );
}
