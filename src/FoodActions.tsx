import { useId, useRef, useState } from 'react';
import type { Food } from './food';
import { Icon } from './Icon';

type Props = {
  item: Food;
  blocked: boolean;
  onEdit: () => void;
  onFinish: () => void;
  onDiscard: () => void;
  onRemove: () => void;
};

export function FoodActions({ item, blocked, onEdit, onFinish, onDiscard, onRemove }: Props) {
  const id = useId();
  const menu = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  function act(action: () => void) {
    menu.current?.hidePopover();
    action();
  }
  return <div className="food-actions">
    <button type="button" className="edit-food" disabled={blocked} onClick={onEdit} aria-label={`${item.name}を編集`}>編集</button>
    <button type="button" className="finish-food" disabled={blocked} onClick={onFinish} aria-label={item.status === 'active' ? `${item.name}を使い切り` : undefined}>
      <Icon name="check" />{item.status === 'active' ? '使い切り' : '戻す'}
    </button>
    <button type="button" className="icon-button" disabled={blocked} popoverTarget={id} aria-label={`${item.name}のその他の操作`} onClick={event => {
      const rect = event.currentTarget.getBoundingClientRect();
      setPosition({ top: Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - 120)), left: Math.max(8, Math.min(rect.right - 164, window.innerWidth - 172)) });
    }}><Icon name="ellipsis" /></button>
    <div id={id} ref={menu} popover="auto" className="action-menu" style={position} aria-label={`${item.name}の操作`}>
      {item.status === 'active' && <button type="button" disabled={blocked} onClick={() => act(onDiscard)} aria-label={`${item.name}を廃棄`}>廃棄として記録</button>}
      <button type="button" className="delete" disabled={blocked} onClick={() => act(onRemove)} aria-label={`${item.name}を削除`}>削除</button>
    </div>
  </div>;
}
