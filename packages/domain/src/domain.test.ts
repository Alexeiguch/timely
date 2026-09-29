import { describe, expect, it } from 'vitest';
import { defaults, taskSchema, ruleSchema, type Rule, type Task } from '@timely/contracts';
import { expand, preview, occurrence, boundaries, status, instant, setState, move, planReminders, progress } from './index';
const task: Task = taskSchema.parse({ id:'c6b4a1d2-0000-4000-8000-000000000001',title:'Read a chapter', notes:'',priority:null,schedule:{date:'2026-09-29',time:'10:00',duration:45},reminders:{enabled:true,before:true,overdue:true},rule:null });
const revision = 'c6b4a1d2-0000-4000-8000-000000000002';
const item = occurrence(task,revision,{date:'2026-09-29',key:'single'});
const monthly: Rule = {frequency:'monthly',anchor:'2024-01-31',interval:1,selector:{kind:'days',days:[31]},invalidDate:'clamp',end:{kind:'never'}};
describe('civil time and state',()=>{
 it.each([[null,null,'2026-09-30T00:00Z'],[null,45,'2026-09-30T00:00Z'],['10:00',null,'2026-09-29T10:00Z'],['10:00',45,'2026-09-29T10:45Z']] as const)('resolves time %s and duration %s',(time,duration,due)=>{
  expect(boundaries({...task.schedule,time,duration},'UTC').due).toBe(Date.parse(due));
 });
 it('uses exact due equality without auto completing',()=>{ const due=boundaries(item.schedule,'UTC').due; expect(status(item,'UTC',due-1)).toBe('in progress'); expect(status(item,'UTC',due)).toBe('overdue'); expect(item.state).toBe('pending'); });
 it('handles London gaps, folds and short days',()=>{
  expect(instant('2026-03-29','01:30','Europe/London')).toBe(Date.parse('2026-03-29T01:30Z'));
  expect(instant('2026-10-25','01:30','Europe/London')).toBe(Date.parse('2026-10-25T00:30Z'));
  expect(boundaries({date:'2026-03-29',time:null,duration:null},'Europe/London').due-instant('2026-03-29','00:00','Europe/London')).toBe(23*3600000);
 });
 it('handles non-hour zones and elapsed overnight durations',()=>{
  expect(instant('2026-09-29','09:00','Asia/Kathmandu')).toBe(Date.parse('2026-09-29T03:15Z'));
  expect(instant('2026-09-29','09:00','America/Montevideo')).toBe(Date.parse('2026-09-29T12:00Z'));
  expect(boundaries({date:'2026-03-28',time:'23:30',duration:240},'Europe/London').due).toBe(Date.parse('2026-03-29T03:30Z'));
 });
 it('keeps identity and original schedule after a move, and terminal snapshots after travel',()=>{
  const moved=move(item,'2026-10-01'); expect(moved.id).toBe(item.id); expect(moved.originalDate).toBe('2026-09-29');
  const done=setState(moved,'completed','Europe/London',Date.parse('2026-10-01T12:00Z'));
  expect(status(done,'Pacific/Auckland',Date.parse('2027-01-01T00:00Z'))).toBe('completed'); expect(done.terminal?.zone).toBe('Europe/London'); expect(setState(done,'pending','UTC',0).terminal).toBeNull();
 });
});
describe('recurrence',()=>{
 it('clamps monthly dates without drift',()=>expect(expand(monthly,'2024-01-01','2024-05-31').map(s=>s.date)).toEqual(['2024-01-31','2024-02-29','2024-03-31','2024-04-30','2024-05-31']));
 it('deduplicates collisions before applying the count limit',()=>{
  const rule={...monthly,anchor:'2025-02-01',selector:{kind:'days' as const,days:[31,30,28,29]},end:{kind:'count' as const,count:3}};
  expect(expand(rule,'2025-02-01','2025-05-01').map(s=>s.date)).toEqual(['2025-02-28','2025-03-28','2025-03-29']);
 });
 it('skips unavailable dates when chosen',()=>expect(preview({...monthly,invalidDate:'skip'}).map(s=>s.date)).toEqual(['2024-01-31','2024-03-31','2024-05-31','2024-07-31','2024-08-31']));
 it('finds last calendar weekday',()=>expect(preview({...monthly,anchor:'2026-01-01',selector:{kind:'ordinal',ordinal:-1,weekday:'weekday'}}).map(s=>s.date)).toEqual(['2026-01-30','2026-02-27','2026-03-31','2026-04-30','2026-05-29']));
 it('keeps the leap-day anchor',()=>expect(preview({frequency:'yearly',anchor:'2024-02-29',month:2,selector:{kind:'days',days:[29]},interval:1,invalidDate:'clamp',end:{kind:'never'}}).map(s=>s.date)).toEqual(['2024-02-29','2025-02-28','2026-02-28','2027-02-28','2028-02-29']));
 it.each([1,7])('anchors every-two-week rules across New Year, first weekday %s',firstWeekday=>{
  const rule=ruleSchema.parse({frequency:'weekly',anchor:'2025-12-29',weekdays:[1,4],firstWeekday,interval:2,invalidDate:'clamp',end:{kind:'date',date:'2026-01-15'}});
  expect(preview(rule).map(s=>s.date)).toEqual(['2025-12-29','2026-01-01','2026-01-12','2026-01-15']);
 });
 it('counts slots before the displayed window',()=>expect(expand({...monthly,end:{kind:'count',count:2}},'2024-03-01','2024-05-31')).toEqual([]));
 it('rejects impossible dates and oversized windows',()=>{ expect(()=>ruleSchema.parse({...monthly,anchor:'2026-02-30'})).toThrow(); expect(()=>expand(monthly,'2024-01-01','2025-01-01')).toThrow(); });
 it('keeps deterministic identity after state and schedule edits',()=>expect(occurrence(task,revision,{date:'2026-09-29',key:'single'}).id).toBe(item.id));
});
describe('reminder and progress policy',()=>{
 it('uses 09:30 and 10:55 for a 10:00/45-minute task',()=>expect(planReminders(item,defaults,'UTC',Date.parse('2026-09-29T09:00Z')).map(p=>new Date(p.due).toISOString())).toEqual(['2026-09-29T09:30:00.000Z','2026-09-29T10:55:00.000Z']));
 it('uses morning reminders for effort-only tasks',()=>expect(planReminders({...item,schedule:{...item.schedule,time:null}},defaults,'UTC',Date.parse('2026-09-29T08:00Z')).map(p=>new Date(p.due).toISOString())).toEqual(['2026-09-29T09:00:00.000Z','2026-09-30T09:00:00.000Z']));
 it('never plans terminal, deleted, opted-out, stale-before or old overdue reminders',()=>{
  const now=Date.parse('2026-09-29T10:00Z'); expect(planReminders(item,defaults,'UTC',now).map(p=>p.kind)).toEqual(['overdue']);
  for(const patch of [{state:'completed' as const},{state:'skipped' as const},{deleted:true},{reminders:{enabled:false,before:true,overdue:true}}]) expect(planReminders({...item,...patch},defaults,'UTC',now)).toEqual([]);
  expect(planReminders(item,defaults,'UTC',Date.parse('2026-09-29T12:00Z'))).toEqual([]);
 });
 it('distinguishes month and elapsed progress, excludes skips, handles zero',()=>{
  const now=Date.parse('2026-09-29T12:00Z'); const done=setState(item,'completed','UTC',now);const future=move(item,'2026-10-01'); const skipped=setState(item,'skipped','UTC',now);
  expect(progress([done,future,skipped],'UTC',now)).toEqual({completed:1,total:2,ratio:0.5});expect(progress([done,future,skipped],'UTC',now,true)).toEqual({completed:1,total:1,ratio:1});expect(progress([skipped],'UTC',now).ratio).toBeNull();
 });
});
