import { Icon, type IconName } from '../../components/Icon';
import type { FoodCategory } from '../../domain/food';
import type { FoodIconName } from '../../domain/food-icons';
/** Use specific icons for common foods, the category for everything else. */
export function FoodIcon({ name, category, selected }: { name: string; category: FoodCategory; selected?: FoodIconName }) {
  const icon: IconName = selected ?? (/卵|たまご|玉子/.test(name) ? 'egg'
    : /牛乳|ミルク|ヨーグルト|チーズ/.test(name) ? 'milk'
    : /納豆|豆腐|豆乳/.test(name) ? 'bean'
    : /パスタ|スパゲッティ|うどん|麺/.test(name) ? 'wheat'
    : /パン|サンドイッチ/.test(name) ? 'sandwich'
    : ({ 'eggs-dairy': 'milk', produce: 'carrot', 'meat-fish': 'beef', soy: 'bean',
      staples: 'wheat', 'retort-canned': 'soup', condiments: 'droplets', other: 'package' } as const)[category]);
  return <Icon name={icon} />;
}