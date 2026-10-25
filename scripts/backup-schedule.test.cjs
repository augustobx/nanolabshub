"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),{DatabaseSync}=require("node:sqlite"),{latestSlot,configurationHash,ensureScheduleSchema}=require("./backup-schedule.cjs");
const base={hourLocal:2,intervalHours:6,autoRestore:true,weekdays:"0,1,2,3,4,5,6"};
test("six-hour slots use Buenos Aires calendar boundaries and exact idempotent keys",()=>{
 for(const [utc,slot] of [["2026-10-25T04:59:59Z","2026-10-24T20:00"],["2026-10-25T05:00:00Z","2026-10-25T02:00"],["2026-10-25T11:00:00Z","2026-10-25T08:00"],["2026-10-25T22:59:00Z","2026-10-25T14:00"],["2026-10-25T23:00:00Z","2026-10-25T20:00"]])assert.equal(latestSlot(base,new Date(utc)).slotKey,slot);
 assert.equal(latestSlot(base,new Date("2026-10-25T05:10:00Z")).key,latestSlot(base,new Date("2026-10-25T10:59:59Z")).key);
});
test("catch-up queues only the latest due slot, with legacy daily key compatibility",()=>{
 assert.equal(latestSlot(base,new Date("2026-11-03T20:30:00Z")).slotKey,"2026-11-03T14:00");
 const daily=latestSlot({...base,intervalHours:24,autoRestore:false},new Date("2026-10-25T05:30:00Z"));assert.equal(daily.key,"scheduled:2026-10-25");assert.equal(daily.legacy,true);
 const weekly=latestSlot({...base,weekdays:"0"},new Date("2026-10-27T05:30:00Z"));assert.equal(weekly.slotKey,"2026-10-25T20:00");
});
test("changed frequency or restore policy has a new key; weekday ordering is canonical",()=>{
 const now=new Date("2026-10-25T05:30:00Z"),a=latestSlot(base,now);
 assert.notEqual(a.key,latestSlot({...base,intervalHours:12},now).key);assert.notEqual(a.key,latestSlot({...base,autoRestore:false},now).key);
 assert.equal(configurationHash(base),configurationHash({...base,weekdays:"6,5,4,3,2,1,0"}));
 for(const invalid of [{intervalHours:5},{hourLocal:6},{hourLocal:-1}])assert.throws(()=>latestSlot({...base,...invalid},now));
});
test("schedule migration is additive, idempotent and preserves legacy agenda and last run",()=>{
 const d=new DatabaseSync(":memory:");try{d.exec("CREATE TABLE backup_schedules(slug TEXT PRIMARY KEY,last_run_day TEXT);INSERT INTO backup_schedules VALUES('onlyfood','2026-10-24')");ensureScheduleSchema(d);ensureScheduleSchema(d);const row=d.prepare("SELECT * FROM backup_schedules").get();assert.equal(row.last_run_day,"2026-10-24");assert.equal(row.interval_hours,24);assert.equal(row.auto_restore,0);assert.equal(row.last_run_slot,null);}finally{d.close();}
});
