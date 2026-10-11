import { Icon } from './Icon';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { categories, units, MAX_TEMPLATES, initialFoodForm, validateTemplates, type FoodTemplate } from './food';

type Draft = Omit<FoodTemplate, 'id'>;
const places = { chilled: '冷蔵', frozen: '冷凍', pantry: '常温' } as const;
const kinds = { 'best-before': '賞味期限', 'use-by': '消費期限' } as const;
function blankDraft(): Draft {
  const { deadline: _deadline, ...draft } = initialFoodForm();
  return draft;
}

type Props = {
  templates: FoodTemplate[];
  blocked: boolean;
  error: string;
  onError: (message: string) => void;
  onSave: (templates: FoodTemplate[]) => boolean;
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
      quantity: template.quantity, place: template.place, unit: template.unit,
    } : blankDraft());
    onError(''); setEditing(true);
  }
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const template = { ...draft, name: draft.name.trim(), id: editingId ?? crypto.randomUUID() };
    const next = editingId ? templates.map(value => value.id === editingId ? template : value) : [...templates, template];
    try { validateTemplates(next); }
    catch (cause) { onError(cause instanceof Error ? cause.message : '入力項目を確認してください。'); return; }
    if (!onSave(next)) return;
    setEditing(false); onError('');
  }
  function remove(template: FoodTemplate) {
    if (!window.confirm(`定番食品「${template.name}」を削除しますか？\n登録済みの食品には影響しません。定番の削除は取り消せません。`)) return;
    if (onSave(templates.filter(value => value.id !== template.id))) closeButton.current?.focus();
  }
  return <div className="template-manager">
    <div className="dialog-head"><div><h2 id="dialog-heading">{editing ? (editingId ? '定番食品を編集' : '定番食品を追加') : '定番食品を管理'}</h2></div><button ref={closeButton} type="button" className="close" aria-label="閉じる" onClick={onDone}><Icon name="x" /></button></div>
    {editing ? <form className="food-form template-form" onSubmit={save}>
      <p className="form-help">登録時の初期値です。期限の日付は毎回入力します。</p>
      <label><span>定番食品名 <span className="required">必須</span></span><input autoFocus required maxLength={80} value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })}/></label>
      <div className="form-group"><label>期限の種類<select value={draft.kind} onChange={event => setDraft({ ...draft, kind: event.target.value as Draft['kind'] })}>{Object.entries(kinds).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>食品カテゴリ<select value={draft.category} onChange={event => setDraft({ ...draft, category: event.target.value as Draft['category'] })}>{Object.entries(categories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
      <label>保存場所<select value={draft.place} onChange={event => setDraft({ ...draft, place: event.target.value as Draft['place'] })}>{Object.entries(places).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <div className="form-group"><label>初期数量<input type="number" required min="1" max="999" step="1" value={draft.quantity || ''} onChange={event => setDraft({ ...draft, quantity: Number(event.target.value) })}/></label><label>数量の単位<select value={draft.unit} onChange={event => setDraft({ ...draft, unit: event.target.value as Draft['unit'] })}>{Object.entries(units).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="dialog-actions"><button type="button" className="secondary outline" onClick={() => { setEditing(false); onError(''); }}>一覧に戻る</button><button type="submit" className="primary" disabled={blocked}>定番を保存</button></div>
    </form> : <>
      <p className="form-help">登録済みの食品には影響しません。</p>
      <div className="template-toolbar"><span>{templates.length} / {MAX_TEMPLATES}件</span><button type="button" className="secondary" disabled={blocked || templates.length >= MAX_TEMPLATES} onClick={() => edit()}>定番食品を追加</button></div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {templates.length ? <ul className="template-list" aria-label="登録済みの定番食品">{templates.map(template => <li key={template.id}><div><h3>{template.name}</h3><p>{categories[template.category]} · {places[template.place]} · {kinds[template.kind]} · {template.quantity}{units[template.unit]}</p></div><div className="food-actions"><button type="button" disabled={blocked} onClick={() => edit(template)} aria-label={`定番の${template.name}を編集`}>編集</button><button type="button" className="delete" disabled={blocked} onClick={() => remove(template)} aria-label={`定番の${template.name}を削除`}>削除</button></div></li>)}</ul> : <p className="template-empty">定番食品はまだありません。よく買う食品を追加してください。</p>}
      <div className="dialog-actions"><button type="button" className="primary" onClick={onDone}>{returning ? '食品登録に戻る' : '完了'}</button></div>
    </>}
  </div>;
}
