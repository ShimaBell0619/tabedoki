/** Vendored Lucide SVG icons (ISC); CSS masks keep strokes monochrome. */
export type IconName = 'cooking-pot' | 'search' | 'plus' | 'x' | 'check' | 'sliders-horizontal' | 'ellipsis' | 'download' | 'upload' | 'bookmark'
  | 'layout-list' | 'calendar-days' | 'shopping-basket' | 'settings' | 'egg' | 'milk' | 'bean' | 'carrot' | 'beef'
  | 'wheat' | 'soup' | 'droplets' | 'package' | 'chevron-right' | 'refresh-cw' | 'cloud' | 'file-text' | 'sandwich';
export function Icon({ name, className = '' }: { name: IconName; className?: string }) {
  const url = `url("/icons/${name}.svg")`;
  return <span aria-hidden="true" className={`icon inline-block size-5 shrink-0 bg-current ${className}`}
    style={{ maskImage: url, WebkitMaskImage: url, maskSize: 'contain', WebkitMaskSize: 'contain',
      maskPosition: 'center', WebkitMaskPosition: 'center', maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat' }} />;
}