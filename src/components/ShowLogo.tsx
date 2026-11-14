import { useId } from 'react';

export function ShowLogo() {
  const id = useId();
  return <svg className="show-logo" viewBox="0 0 380 148" role="img" aria-label="FAMILY FEUD" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id={id + 'gold'} x2="0" y2="1"><stop stopColor="#fff2ac"/><stop offset=".5" stopColor="#ffd45a"/><stop offset="1" stopColor="#a76624"/></linearGradient>
      <linearGradient id={id + 'blue'} x2="1" y2="1"><stop stopColor="#164ce0"/><stop offset="1" stopColor="#041131"/></linearGradient>
    </defs>
    <path d="M6 64 49 14 332 14 374 64 326 130 54 130Z" fill="#030a26" stroke="#349bff" strokeWidth="2"/>
    <path d="M19 65 54 23 326 23 361 65 320 121 60 121Z" fill={`url(#${id}blue)`} stroke={`url(#${id}gold)`} strokeWidth="3"/>
    <path d="M36 65 62 34h256l26 31-32 45H68Z" fill="none" stroke="#49d9ff" strokeOpacity=".45"/>
    <path d="M47 65h30m226 0h30M63 78h18m218 0h18" stroke="#49d9ff" strokeWidth="2" strokeLinecap="round"/>
    <path d="m190 1 5 12 13 4-13 4-5 12-5-12-13-4 13-4Zm0 114 4 10 11 4-11 4-4 10-4-10-11-4 11-4Z" fill={`url(#${id}gold)`}/>
    <g textAnchor="middle" fontFamily="Arial Black,Arial,sans-serif" fontWeight="900" direction="ltr">
      <text x="190" y="62" fill="#fff9ef" fontSize="27" letterSpacing="6">FAMILY</text>
      <text x="190" y="104" fill={`url(#${id}gold)`} fontSize="48" letterSpacing="2">FEUD</text>
    </g>
  </svg>;
}
