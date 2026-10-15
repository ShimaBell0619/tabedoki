import { Icon } from './Icon';

export function Brand() {
  return <a href="/" aria-label="たべどき ホーム"
    className="brand flex items-center gap-2.5 text-[22px] font-extrabold tracking-[-.04em] no-underline mobile:text-xl tiny:gap-2">
    <span className={`brand-mark grid size-9 place-items-center rounded-[11px] bg-primary [&_.icon]:size-[23px]
          [&_.icon]:brightness-0 [&_.icon]:invert mobile:size-8 mobile:rounded-[9px] mobile:[&_.icon]:size-[21px]`}>
      <Icon name="cooking-pot" />
    </span>たべどき
  </a>;
}
