import { expect,it } from 'vitest';
import { createSeries,projectSeries,editSeries,saveException,excludeOccurrence,deleteSeries,setState,move } from './index';
import { taskSchema } from '@timely/contracts';
const task=taskSchema.parse({id:'a0000000-0000-4000-8000-000000000000',title:'Daily walk',notes:'',priority:null,schedule:{date:'2026-09-01',time:'09:00',duration:30},reminders:{enabled:false,before:true,overdue:true},rule:{frequency:'daily',anchor:'2026-09-01',interval:1,end:{kind:'never'},invalidDate:'clamp'}});
const firstRevision='b0000000-0000-4000-8000-000000000000',nextRevision='c0000000-0000-4000-8000-000000000000';
const initial=createSeries(task,firstRevision);
const items=projectSeries(initial,'2026-09-01','2026-09-07');
it('moves one occurrence without duplicating its source or shifting cadence',()=>{const series=saveException(initial,move(items[0]!,'2026-09-08'),['schedule']);expect(projectSeries(series,'2026-09-01','2026-09-01')).toHaveLength(0);expect(projectSeries(series,'2026-09-08','2026-09-08').map(i=>i.id)).toContain(items[0]!.id);expect(projectSeries(series,'2026-09-02','2026-09-02')[0]!.id).toBe(items[1]!.id);});
it('does not regenerate an excluded occurrence',()=>expect(projectSeries(excludeOccurrence(initial,items[0]!),'2026-09-01','2026-09-07')).toHaveLength(6));
it('retains immutable history and prefix identity after a future split',()=>{
 const done=setState(items[0]!,'completed','Europe/London',Date.parse('2026-09-01T12:00Z'));
 const edited=editSeries(saveException(initial,done),items[3]!,{...task,title:'Long walk'},'future',nextRevision,'2026-09-04');
 const after=projectSeries(edited,'2026-09-01','2026-09-07');
 expect(after[0]).toEqual(done);expect(after[1]!.id).toBe(items[1]!.id);expect(after[3]!.id).toBe(items[3]!.id);expect(after[3]!.title).toBe('Long walk');expect(edited.revisions[0]).toEqual(initial.revisions[0]);expect(editSeries(edited,items[3]!,{...task,title:'Long walk'},'future',nextRevision,'2026-09-04')).toEqual(edited);
});
it('does not invent history or move past overdue slots in a whole-series edit',()=>{
 const next=editSeries(initial,items[3]!,{...task,rule:{...task.rule!,frequency:'daily',interval:2}},'series',nextRevision,'2026-09-04');
 const after=projectSeries(next,'2026-09-01','2026-09-07');expect(after.map(i=>i.schedule.date)).toEqual(['2026-09-01','2026-09-02','2026-09-03','2026-09-04','2026-09-06']);expect(after[1]!.id).toBe(items[1]!.id);
});
it('keeps late old-revision offline completion and removes equivalent pending projection',()=>{
 const edited=editSeries(initial,items[3]!,{...task,title:'Long walk'},'future',nextRevision,'2026-09-04');
 const done=setState(items[5]!,'completed','UTC',Date.parse('2026-09-07T12:00Z'));
 const merged=saveException(edited,done);const day=projectSeries(merged,'2026-09-06','2026-09-06');expect(day).toEqual([done]);
});
it('supports explicit clearing and does not clear series defaults',()=>{
 const changed=editSeries(initial,items[0]!,{...task,schedule:{...task.schedule,time:null,duration:null}},'occurrence',nextRevision,'2026-09-01');const after=projectSeries(changed,'2026-09-01','2026-09-02');expect(after[0]!.schedule.time).toBeNull();expect(after[1]!.schedule.time).toBe('09:00');
});
it('ends future generation without mutating historical revisions',()=>{const next=deleteSeries(initial,items[3]!,'future');expect(projectSeries(next,'2026-09-01','2026-09-07')).toHaveLength(3);expect(next.revisions).toEqual(initial.revisions);});
it('metadata-only future edits preserve recurrence anchor and remaining count',()=>{
 const finite={...task,rule:{frequency:'daily' as const,anchor:'2026-09-01',interval:2,end:{kind:'count' as const,count:4},invalidDate:'clamp' as const}};
 const series=createSeries(finite,firstRevision);const selected=projectSeries(series,'2026-09-01','2026-09-07')[1]!;
 const edited=editSeries(series,selected,{...finite,title:'Renamed'},'future',nextRevision,'2026-09-03');
 expect(projectSeries(edited,'2026-09-01','2026-09-30').map(i=>i.schedule.date)).toEqual(['2026-09-01','2026-09-03','2026-09-05','2026-09-07']);
});
