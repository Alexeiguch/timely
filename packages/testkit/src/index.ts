import { taskSchema } from '@timely/contracts';
export const sampleTask = taskSchema.parse({ id:'c6b4a1d2-0000-4000-8000-000000000001',title:'Make room for a walk',notes:'A synthetic test task.',priority:'low',schedule:{date:'2026-09-29',time:'10:00',duration:45},reminders:{enabled:false,before:true,overdue:true},rule:null });
