type BrandIconProps = {
  size: number;
  borderRadius: number;
};

export function PwaBrandIcon({ size, borderRadius }: BrandIconProps) {
  const ringInset = Math.round(size * 0.11);
  const innerRadius = Math.round(borderRadius * 0.72);
  const accentStroke = Math.max(10, Math.round(size * 0.085));

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius,
        background:
          'radial-gradient(circle at 22% 20%, rgba(56,189,248,0.18) 0%, rgba(56,189,248,0) 52%), linear-gradient(140deg, #020617 0%, #0b1224 45%, #111827 100%)',
      }}
    >
      <div
        style={{
          width: size - ringInset * 2,
          height: size - ringInset * 2,
          borderRadius: innerRadius,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(150deg, #0f172a 0%, #111827 46%, #1e293b 100%)',
          boxShadow: 'inset 0 0 0 2px rgba(148, 163, 184, 0.18)',
        }}
      >
        <svg
          width={Math.round(size * 0.58)}
          height={Math.round(size * 0.58)}
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M78 21H38.5C30.4 21 24 27.4 24 35.5C24 43.6 30.4 50 38.5 50H61.5C69.6 50 76 56.4 76 64.5C76 72.6 69.6 79 61.5 79H21"
            stroke="#E2E8F0"
            strokeWidth={accentStroke}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="80.5" cy="21" r={Math.max(4, Math.round(size * 0.032))} fill="#22D3EE" />
        </svg>
      </div>
    </div>
  );
}
