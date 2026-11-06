import Svg, { Circle, Path, Rect } from 'react-native-svg';

export const colors = {
  bg: '#131510', card: '#1C1F18', border: '#32362B', muted: '#A6AD99',
  text: '#F4F6ED', lime: '#DEFF66', ink: '#171D0C', warning: '#F7C57B',
};

const paths = {
  scan: 'M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3m13-5v3a2 2 0 0 1-2 2h-3M7 12h10',
  image: 'M4 4h16v16H4zM4 17l5-5 4 4 3-3 4 4M15 8h.01',
  box: 'M4 9v11h16V9M3 4h18v5H3zM10 13h4',
  camera: 'M4 7h4l2-3h4l2 3h4v13H4zM15 13.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  search: 'M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0ZM15 15l5 5',
  cart: 'M3 4h2l3 11h10l3-8H6M9 20h.01M17 20h.01',
  folder: 'M3 6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  arrow: 'M4 12h15m-6-6 6 6-6 6',
  back: 'M19 12H5m6 6-6-6 6-6',
  plus: 'M12 5v14M5 12h14',
  calendar: 'M4 6h16v15H4zM8 3v6m8-6v6M4 11h16',
  clock: 'M12 8v4l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
  bell: 'M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12a2 2 0 0 0 4 0',
  check: 'm5 12 4 4L19 6',
  done: 'm8 12 3 3 5-6m6 3a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
  unchecked: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
  shield: 'm12 3 7 3v5c0 5-4 8-7 10-3-2-7-5-7-10V6zM9 12l2 2 4-4',
  chevron: 'm9 6 6 6-6 6',
  close: 'm6 6 12 12M18 6 6 18',
  play: 'm9 5 11 7-11 7z',
};

export function Icon({ name, color = colors.text, size = 22 }: { name: keyof typeof paths; color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d={paths[name]} stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ScannerIllustration() {
  return (
    <Svg width={158} height={160} viewBox="0 0 158 160" fill="none" accessible={false}>
      <Path d="M15 30V16h14m100 0h14v14m0 99v14h-14m-100 0H15v-14" stroke="#546923" strokeWidth={1.4} />
      <Path d="M15 80h128M79 16v127" stroke="#B6D34F" strokeDasharray="3 5" />
      <Circle cx={79} cy={80} r={56} stroke="#B6D34F" />
      <Rect x={45} y={34} width={72} height={95} rx={10} fill="#B5D547" stroke="#334611" transform="rotate(13 81 81)" />
      <Rect x={41} y={30} width={72} height={95} rx={10} fill="#F1FFA9" stroke="#334611" strokeWidth={1.6} transform="rotate(-10 77 77)" />
      <Path d="M55 55l38-7M57 67l26-5M62 95l36-6m-34 16 20-4" stroke="#66822B" strokeWidth={2.5} strokeLinecap="round" />
      <Path d="M25 80h108" stroke="#27370D" strokeWidth={1.5} strokeDasharray="5 3" />
      <Circle cx={109} cy={112} r={18} fill="#26350D" />
      <Path d="m101 112 5 5 9-10" stroke="#DEFF66" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
