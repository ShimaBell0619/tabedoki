import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import type { FoodCategory } from '../../domain/food';
import { foodIconChoices, type FoodIconName } from '../../domain/food-icons';
import { FoodIcon } from './FoodIcon';
import { Icon } from '../../components/Icon';

type Props = {
  foodName: string;
  category: FoodCategory;
  selected?: FoodIconName;
  blocked: boolean;
  error?: string;
  onSelect: (name: FoodIconName | null) => void;
  onClose: () => void;
};
/** The native dialog traps focus and handles Escape, including on mobile. */
export function FoodIconPicker({ foodName, category, selected, blocked, error, onSelect, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className="icon-picker" aria-labelledby="icon-picker-title" onClose={onClose}>
    <div className="icon-picker-heading">
      <h2 id="icon-picker-title">{foodName}のアイコン</h2>
      <Button variant="plain" type="button" aria-label="閉じる" onClick={() => dialog.current?.close()}>
        <Icon name="x" />
      </Button>
    </div>
    {error && <p role="alert" className="icon-picker-error">{error}</p>}
    <div className="icon-picker-options">
      <button type="button" className="icon-picker-option" disabled={blocked} aria-pressed={selected === undefined}
        onClick={() => onSelect(null)} autoFocus={selected === undefined}>
        <FoodIcon name={foodName} category={category}/><span>自動</span>
      </button>
      {foodIconChoices.map(choice => <button key={choice.name} type="button" className="icon-picker-option"
        aria-pressed={selected === choice.name} disabled={blocked}
        autoFocus={selected === choice.name} onClick={() => onSelect(choice.name)}>
        <Icon name={choice.name}/><span>{choice.label}</span>
      </button>)}
    </div>
  </dialog>;
}
