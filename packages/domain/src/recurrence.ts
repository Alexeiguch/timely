import { Temporal } from '@js-temporal/polyfill';
import { v5 } from 'uuid';
import { ruleSchema, civilDate, type Rule, type Selector, type Task, type Occurrence } from '@timely/contracts';
import { date } from './time';
export function canonicalRule(input: Rule): Rule {
  const rule = ruleSchema.parse(input);
  if (rule.frequency === 'weekly') rule.weekdays = [...new Set(rule.weekdays)].sort((a,b) => a-b);
  if ((rule.frequency === 'monthly' || rule.frequency === 'yearly') && rule.selector.kind === 'days') rule.selector.days = [...new Set(rule.selector.days)].sort((a,b) => a-b);
  return rule;
}
function selectedDays(month: Temporal.PlainDate, selector: Selector, policy: Rule['invalidDate']): Map<number,string> {
  const result = new Map<number,string>();
  if (selector.kind === 'last-day') result.set(month.daysInMonth, 'last');
  else if (selector.kind === 'days') {
    for (const nominal of [...selector.days].sort((a,b)=>a-b)) {
      if (nominal > month.daysInMonth && policy === 'skip') continue;
      const effective = Math.min(nominal, month.daysInMonth);
      if (!result.has(effective)) result.set(effective, `day:${nominal}`);
    }
  } else {
    const matches: number[] = [];
    for (let day = 1; day <= month.daysInMonth; day++) {
      const weekday = month.with({ day }).dayOfWeek;
      if (selector.weekday === 'weekday' ? weekday <= 5 : weekday === selector.weekday) matches.push(day);
    }
    const chosen = selector.ordinal === -1 ? matches.at(-1) : matches[selector.ordinal - 1];
    if (chosen !== undefined) result.set(chosen, `ordinal:${selector.ordinal}:${selector.weekday}`);
  }
  return result;
}
export type Slot = { date: string; key: string };
/** Hard bounded supported calendar and requested window. Count starts at anchor, not range start. */
export function expand(input: Rule, from: string, through: string): Slot[] {
  const rule = canonicalRule(input); civilDate.parse(from); civilDate.parse(through);
  const first = date(from), last = date(through);
  const days = first.until(last).days;
  if (days < 0 || days >= 366) throw new Error('Projection window must contain 1–366 days');
  return scan(rule, first, last);
}
function scan(rule: Rule, first: Temporal.PlainDate, last: Temporal.PlainDate, limit = Infinity): Slot[] {
  const through = last.toString();
  const anchor = date(rule.anchor);
  const end = rule.end.kind === 'date' && rule.end.date < through ? date(rule.end.date) : last;
  const startWeek = (d: Temporal.PlainDate) => d.subtract({ days: (d.dayOfWeek - (rule.frequency === 'weekly' ? rule.firstWeekday : 1) + 7) % 7 });
  const result: Slot[] = [];
  let count = 0; let cachedMonth = ''; let selection = new Map<number,string>();
  // At most 73,414 dates (1900–2100); never depends on an unbounded rule end.
  for (let day = anchor; Temporal.PlainDate.compare(day, end) <= 0; day = day.add({ days: 1 })) {
    let key: string | undefined;
    if (rule.frequency === 'daily') { if (anchor.until(day).days % rule.interval === 0) key = day.toString(); }
    else if (rule.frequency === 'weekly') {
      if (startWeek(anchor).until(startWeek(day)).days / 7 % rule.interval === 0 && rule.weekdays.includes(day.dayOfWeek)) key = day.toString();
    } else {
      const months = (day.year-anchor.year)*12 + day.month-anchor.month;
      const eligible = rule.frequency === 'monthly' ? months % rule.interval === 0 : (day.year-anchor.year) % rule.interval === 0 && day.month === rule.month;
      if (eligible) {
        const month = day.toString().slice(0,7);
        if (month !== cachedMonth) { cachedMonth = month; selection = selectedDays(day.with({ day: 1 }),rule.selector,rule.invalidDate); }
        const selected = selection.get(day.day);
        if (selected) key = `${month}/${selected}`;
      }
    }
    if (!key) continue;
    count++;
    if (rule.end.kind === 'count' && count > rule.end.count) break;
    if (Temporal.PlainDate.compare(day,first) >= 0) result.push({ date: day.toString(), key });
    if (result.length >= limit) break;
  }
  return result;
}
export function preview(rule: Rule, from = rule.anchor, limit = 5): Slot[] {
  civilDate.parse(from);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('Preview limit must be 1–100');
  return scan(canonicalRule(rule), date(from), date('2100-12-31'), limit);
}

export function occurrence(task: Task, revisionId: string, slot: Slot): Occurrence {
  return { id: v5(`${revisionId}/${slot.key}`,task.id), definitionId: task.id, revisionId, slot: slot.key, originalDate: slot.date, title: task.title, notes: task.notes, priority: task.priority, schedule: { ...task.schedule, date: slot.date }, reminders: { ...task.reminders }, state: 'pending', terminal: null, deleted: false, order: '' };
}
export function ruleSummary(rule: Rule): string {
  const every = rule.interval === 1 ? 'Every' : `Every ${rule.interval}`;
  if (rule.frequency === 'daily') return `${every} ${rule.interval === 1 ? 'day' : 'days'}`;
  const weekdays = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  if (rule.frequency === 'weekly') return `${every} ${rule.interval === 1 ? 'week' : 'weeks'} on ${rule.weekdays.map(n=>weekdays[n-1]).join(', ')}`;
  const selector = rule.selector;
  const selection = selector.kind === 'last-day' ? 'the last day' : selector.kind === 'days' ? `day ${selector.days.join(', ')}` : `the ${{1:'first',2:'second',3:'third',4:'fourth',[-1]:'last'}[selector.ordinal]} ${selector.weekday === 'weekday' ? 'weekday' : weekdays[selector.weekday-1]}`;
  return `${every} ${rule.frequency === 'monthly' ? (rule.interval===1?'month':'months') : (rule.interval===1?'year':'years')} on ${selection}${rule.frequency === 'yearly' ? ` of month ${rule.month}` : ''}`;
}
