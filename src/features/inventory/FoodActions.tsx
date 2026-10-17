import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { consumptionAction, units, type Food } from '../../domain/food';
import { Icon } from '../../components/Icon';

type Props = {
  item: Food;
  blocked: boolean;
  onEdit: () => void;
  onConsume: () => void;
  onRestore: () => void;
  lastInGroup: boolean;
  onDiscard: () => void;
  onRemove: () => void;
};

export function FoodActions({ item, blocked, onEdit, onConsume, onRestore, lastInGroup, onDiscard, onRemove }: Props) {
  return <div className="food-actions flex items-center justify-end gap-1">
    <Button variant="action" type="button" className="edit-food border-[#D9E1EB] text-muted" disabled={blocked} onClick={onEdit} aria-label={`${item.name}を編集`}>編集</Button>
    <Button variant="action" type="button" className="finish-food flex items-center gap-[5px] border-primary bg-primary text-white hover:bg-[#293F5C] [&_.icon]:size-4 [&_.icon]:brightness-0 [&_.icon]:invert"
      disabled={blocked} onClick={item.status === 'active' ? onConsume : onRestore}
      aria-label={`${item.name}を${item.status === 'active' ? consumptionAction(item.consumption, units[item.unit], lastInGroup) : '管理中に戻す'}`}>
      <Icon name={item.status === 'active' ? 'minus' : 'undo-2'} />{item.status === 'active' ? consumptionAction(item.consumption, units[item.unit], lastInGroup) : '戻す'}
    </Button>
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" type="button" className="icon-button" disabled={blocked} aria-label={`${item.name}のその他の操作`}><Icon name="ellipsis" /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="action-menu w-[164px]" aria-label={`${item.name}の操作`}>
        {item.status === 'active' && <DropdownMenuItem disabled={blocked} onSelect={onDiscard} aria-label={`${item.name}を廃棄`}>廃棄として記録</DropdownMenuItem>}
        <DropdownMenuItem className="text-expired" disabled={blocked} onSelect={onRemove} aria-label={`${item.name}を削除`}>削除</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>;
}
