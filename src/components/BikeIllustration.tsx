/** Placeholder artwork shown until a real product photo is added. */
export default function BikeIllustration({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 300 180" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <g stroke="#3f3f46" strokeWidth="7">
        <circle cx="70" cy="120" r="48" />
        <circle cx="230" cy="120" r="48" />
      </g>
      <g stroke="#71717a" strokeWidth="1.5">
        <circle cx="70" cy="120" r="40" />
        <circle cx="230" cy="120" r="40" />
      </g>
      <g stroke={color} strokeWidth="7">
        <path d="M70 120 L135 122 L110 52 Z" />
        <path d="M110 52 L205 56 L135 122" />
        <path d="M205 56 L230 120" />
      </g>
      <g stroke="#e4e4e7" strokeWidth="5">
        <path d="M110 52 L104 34" />
        <path d="M90 32 L122 32" strokeWidth="8" />
        <path d="M205 56 L200 38 L222 34" />
      </g>
      <circle cx="135" cy="122" r="10" stroke="#e4e4e7" strokeWidth="4" />
    </svg>
  );
}
