type IconName = 'cooking-pot' | 'search' | 'plus' | 'x' | 'check' | 'sliders-horizontal' | 'ellipsis' | 'download' | 'upload' | 'bookmark';

export function Icon({ name }: { name: IconName }) {
  return <img className="icon block size-5 shrink-0" src={`/icons/${name}.svg`} alt="" aria-hidden="true" width="20" height="20" />;
}
