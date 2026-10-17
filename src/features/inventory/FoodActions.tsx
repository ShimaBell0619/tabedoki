import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { tracksVolume, units, type Food } from '../../domain/food';
import { Icon } from '../../components/Icon';

type Props = {
  item: Food;
  blocked: boolean;
  onEdit: () => void;
  onConsume: () => void;
  onDiscard: () => void;
  onRemove: () => void;
};

/** Less frequent lot actions stay beside the deadline, away from daily quantity controls. */
export function FoodActions({ item, blocked, onEdit, onConsume, onDiscard, onRemove }: Props) {
  return <div className="food-actions ml-auto flex shrink-0 items-center gap-1">
    <Button variant="plain" type="button" className="edit-food min-h-11 px-2 text-xs text-muted" disabled={blocked}
      onClick={onEdit} aria-label={`${item.name.trim()}を編集`}>編集</Button>
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" type="button" className="icon-button size-11" disabled={blocked}
          aria-label={`${item.name.trim()}のその他の操作`}><Icon name="ellipsis" /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="action-menu w-[176px]" aria-label={`${item.name.trim()}の操作`}>
        {item.status === 'active' && tracksVolume(item) && <DropdownMenuItem disabled={blocked} onSelect={onConsume}
          aria-label={`${item.name.trim()}を1${units[item.unit]}使い切る`}>1${units[item.unit]}使い切った</DropdownMenuItem>}
        {item.status === 'active' && <DropdownMenuItem disabled={blocked} onSelect={onDiscard} aria-label={`${item.name.trim()}を廃棄`}>廃棄として記録</DropdownMenuItem>}
        <DropdownMenuItem className="text-expired" disabled={blocked} onSelect={onRemove} aria-label={`${item.name.trim()}を削除`}>削除</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>;
}
