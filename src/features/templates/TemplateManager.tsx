import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Icon } from '../../components/Icon';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { categories, units, places, kinds, initialFoodForm, inferConsumption, consumptionLabels, type FoodTemplate } from '../../domain/food';
import { MAX_TEMPLATES, validateTemplates } from '../../domain/templates';

type Draft = Omit<FoodTemplate, 'id'>;
function blankDraft(): Draft {
  const { deadline: _deadline, ...draft } = initialFoodForm();
  return draft;
}

type Props = {
  templates: FoodTemplate[];
  blocked: boolean;
  error: string;
  onError: (message: string) => void;
  onSave: (templates: FoodTemplate[]) => Promise<boolean>;
  onDone: () => void;
  returning: boolean;
};

export function TemplateManager({ templates, blocked, error, onError, onSave, onDone, returning }: Props) {
  const [editing, setEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(blankDraft);
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!editing) closeButton.current?.focus();
    closeButton.current?.closest('dialog')?.scrollTo(0, 0);
  }, [editing]);
  function edit(template?: FoodTemplate) {
    setEditingId(template?.id ?? null);
    setDraft(template ? {
      name: template.name, category: template.category, kind: template.kind,
      quantity: template.quantity, place: template.place, unit: template.unit, consumption: template.consumption,
    } : blankDraft());
    onError(''); setEditing(true);
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const template = { ...draft, name: draft.name.trim(), id: editingId ?? crypto.randomUUID() };
    const next = editingId ? templates.map(value => value.id === editingId ? template : value) : [...templates, template];
    try { validateTemplates(next); }
    catch (cause) { onError(cause instanceof Error ? cause.message : '入力項目を確認してください。'); return; }
    if (!await onSave(next)) return;
    setEditing(false); onError('');
  }
  async function remove(template: FoodTemplate) {
    if (!window.confirm(`定番食品「${template.name}」を削除しますか？\n登録済みの食品には影響しません。定番の削除は取り消せません。`)) return;
    if (await onSave(templates.filter(value => value.id !== template.id))) closeButton.current?.focus();
  }
  return <div className="template-manager p-6 [&>.form-help]:mt-2 mobile:px-4 mobile:py-5">
    <div className="dialog-head flex items-center justify-between gap-3 [&_h2]:m-0 [&_h2]:text-[23px] [&_h2]:font-[750] [&_h2]:tracking-[-.03em] mobile:[&_h2]:text-[21px]">
          <div>
          <h2 id="dialog-heading">{editing ? (editingId ? '定番食品を編集' : '定番食品を追加') : '定番食品を管理'}</h2>
          </div>
          <Button variant="ghost" size="icon" ref={closeButton} type="button" className="close size-11 shrink-0 rounded-lg hover:bg-control-hover" aria-label="閉じる" onClick={onDone}>
          <Icon name="x" />
          </Button>
          </div>
    {editing ? <form className={`food-form template-form flex flex-col gap-[18px] px-0 pt-[18px] pb-0 [&_label]:flex [&_label]:min-w-0
          [&_label]:scroll-mb-[104px] [&_label]:flex-col [&_label]:gap-[7px] [&_label]:text-[13px] [&_label]:font-[650]
          mobile:gap-4`} onSubmit={save}>
      <p className="form-help mt-[-4px] text-xs leading-[1.7] text-muted">登録時の初期値です。期限の日付は毎回入力します。</p>
      <label>
          <span>定番食品名 <span className="required ml-1 text-[11px] font-medium text-expired">必須</span>
          </span>
          <Input autoFocus required maxLength={80} value={draft.name} onChange={event => { const name = event.target.value; setDraft({ ...draft, name, consumption: draft.consumption === inferConsumption(draft.name, draft.category) ? inferConsumption(name, draft.category) : draft.consumption }); }}/>
          </label>
      <div className="form-group grid grid-cols-2 gap-3 mobile:gap-2.5">
          <label>期限の種類<NativeSelect value={draft.kind} onChange={event => setDraft({ ...draft, kind: event.target.value as Draft['kind'] })}>{Object.entries(kinds).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</NativeSelect>
          </label>
          <label>食品カテゴリ<NativeSelect value={draft.category} onChange={event => { const category = event.target.value as Draft['category']; setDraft({ ...draft, category, consumption: draft.consumption === inferConsumption(draft.name, draft.category) ? inferConsumption(draft.name, category) : draft.consumption }); }}>{Object.entries(categories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</NativeSelect>
          </label>
          </div>
      <label>保存場所<NativeSelect value={draft.place} onChange={event => setDraft({ ...draft, place: event.target.value as Draft['place'] })}>{Object.entries(places).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</NativeSelect>
          </label>
      <div className="form-group grid grid-cols-2 gap-3 mobile:gap-2.5">
          <label>初期数量<Input type="number" required min="1" max="999" step="1" value={draft.quantity || ''} onChange={event => setDraft({ ...draft, quantity: Number(event.target.value) })}/>
          </label>
          <label>数量の単位<NativeSelect value={draft.unit} onChange={event => setDraft({ ...draft, unit: event.target.value as Draft['unit'] })}>{Object.entries(units).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</NativeSelect>
          </label>
          </div>
      <label>在庫を減らすときの表現<NativeSelect value={draft.consumption} onChange={event => setDraft({ ...draft, consumption: event.target.value as Draft['consumption'] })}>{Object.entries(consumptionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</NativeSelect></label>
      {error && <p className="form-error m-0 rounded-lg bg-expired-surface p-3 text-[13px] text-expired wrap-anywhere" role="alert">{error}</p>}
      <div className="dialog-actions mt-2 flex justify-end gap-2 sticky bottom-[-24px] z-2 mb-[-24px] border-t border-border bg-surface pt-3.5 pb-6 mobile:bottom-[-20px] mobile:mb-[-20px] mobile:pb-5">
          <Button variant="secondary" type="button" className="secondary text-muted" onClick={() => { setEditing(false); onError(''); }}>一覧に戻る</Button>
          <Button variant="default" type="submit" className="primary" disabled={blocked}>定番を保存</Button>
          </div>
    </form> : <>
      <p className="form-help mt-[-4px] text-xs leading-[1.7] text-muted">登録済みの食品には影響しません。</p>
      <div className="template-toolbar mt-5 mb-1 flex items-center justify-between gap-2.5 text-xs text-muted narrow:[&_.secondary]:px-3 narrow:[&_.secondary]:py-2 narrow:[&_.secondary]:text-xs">
          <span>{templates.length} / {MAX_TEMPLATES}件</span>
          <Button variant="secondary" type="button" className="secondary" disabled={blocked || templates.length >= MAX_TEMPLATES} onClick={() => edit()}>定番食品を追加</Button>
          </div>
      {error && <p className="form-error m-0 rounded-lg bg-expired-surface p-3 text-[13px] text-expired wrap-anywhere" role="alert">{error}</p>}
      {templates.length ? <ul className={`template-list m-0 list-none p-0 [&_li]:flex [&_li]:items-center [&_li]:justify-between [&_li]:gap-3
          [&_li]:border-b [&_li]:border-border [&_li]:py-4 [&_li>div:first-child]:min-w-0 [&_h3]:mt-0 [&_h3]:mb-[5px]
          [&_h3]:text-base [&_h3]:font-bold [&_h3]:wrap-anywhere [&_p]:m-0 [&_p]:text-xs [&_p]:text-muted
          [&_p]:wrap-anywhere [&_.food-actions]:shrink-0 narrow:[&_li]:flex-col narrow:[&_li]:items-start
          narrow:[&_.food-actions]:w-full narrow:[&_.food-actions]:justify-end`} aria-label="登録済みの定番食品">{templates.map(template => <li key={template.id}>
          <div>
          <h3>{template.name}</h3>
          <p>{categories[template.category]} · {places[template.place]} · {kinds[template.kind]} · {template.quantity}{units[template.unit]}</p>
          </div>
          <div className="food-actions flex flex-wrap items-center justify-end gap-1.5 mobile:gap-[5px]">
          <Button variant="action" type="button" disabled={blocked} onClick={() => edit(template)} aria-label={`定番の${template.name}を編集`}>編集</Button>
          <Button variant="action" type="button" className="delete text-expired" disabled={blocked} onClick={() => remove(template)} aria-label={`定番の${template.name}を削除`}>削除</Button>
          </div>
          </li>)}</ul> : <p className="template-empty py-[18px] text-[13px] leading-[1.8] text-muted">定番食品はまだありません。よく買う食品を追加してください。</p>}
      <div className="dialog-actions mt-2 flex justify-end gap-2">
          <Button variant="default" type="button" className="primary" onClick={onDone}>{returning ? '食品登録に戻る' : '完了'}</Button>
          </div>
    </>}
  </div>;
}
