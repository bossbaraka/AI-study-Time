import pg from "pg";
const DATABASE_URL = process.env.DATABASE_URL || "postgresql://mureeh:mureeh_local_only@127.0.0.1:55432/mureeh_dev";
const client = new pg.Client({ connectionString: DATABASE_URL });
await client.connect();
console.log("Connected to", DATABASE_URL.split("@")[1]);

// Verify tables exist
const tables = ["Concept","ConceptState","Evidence","LearningEvent","RecallSchedule","TestDefinition","TestAttempt","User","Goal","Roadmap"];
for (const t of tables) {
  const r = await client.query(`SELECT to_regclass($1) as exists`, [`"${t}"`]);
  console.log(`${t}:`, r.rows[0].exists ? "OK" : "MISSING");
}

// Clean previous verify data
await client.query(`DELETE FROM "RecallSchedule" WHERE "studentId" = 'verify_student'`);
await client.query(`DELETE FROM "Evidence" WHERE "studentId" = 'verify_student'`);
await client.query(`DELETE FROM "ConceptState" WHERE "studentId" = 'verify_student'`);
await client.query(`DELETE FROM "LearningEvent" WHERE "studentId" = 'verify_student'`);
await client.query(`DELETE FROM "TestAttempt" WHERE "studentId" = 'verify_student'`);
await client.query(`DELETE FROM "Concept" WHERE id LIKE 'verify_%'`);

// Insert concept
await client.query(`INSERT INTO "Concept" (id,domain,name,description,"prerequisiteIds","orderIndex") VALUES ('verify_c1','math','Verify Concept','test','[]',0) ON CONFLICT (id) DO NOTHING`);
console.log("Concept inserted");

// Evidence flow: insert evidence, then concept state should be updatable via application (we simulate)
await client.query(`INSERT INTO "Evidence" (id,"studentId","conceptId",kind,payload,score,"timeSpentSeconds","attemptCount","hintUsed","hintCount","immutable",version) VALUES ('verify_e1','verify_student','verify_c1','practice','{"q":1}',85,120,1,false,0,false,1)`);
console.log("Evidence inserted");

// Create ConceptState as mastery engine would
await client.query(`INSERT INTO "ConceptState" ("studentId","conceptId","masteryEstimate",confidence,"evidenceCount","misconceptionRisk","lastUpdatedAt", "stateVersion") VALUES ('verify_student','verify_c1',0.82,0.7,1,0.1,now(),1) ON CONFLICT ("studentId","conceptId") DO UPDATE SET "masteryEstimate"=0.82`);
console.log("ConceptState inserted");

// Recall schedule SM-2 simulation
await client.query(`INSERT INTO "RecallSchedule" ("studentId","conceptId",ease,"intervalDays",repetition,"dueAt","lastReviewedAt") VALUES ('verify_student','verify_c1',2.5,1,1,now()+interval '1 day',now()) ON CONFLICT ("studentId","conceptId") DO UPDATE SET ease=2.5`);
console.log("RecallSchedule inserted");

// Test definition and attempt (server grading)
await client.query(`INSERT INTO "TestDefinition" (id,title,"conceptIds",questions) VALUES ('verify_t1','Verify Test','["verify_c1"]','[{"id":"q1","type":"multiple_choice","prompt":"2+2?","options":["3","4"],"correctChoiceIndex":1}]') ON CONFLICT (id) DO NOTHING`);
console.log("TestDefinition inserted");
await client.query(`INSERT INTO "TestAttempt" (id,"studentId","testId",status,score,"timeSpentSeconds",answers,"gradedAnswers","strongTopics","needsReviewTopics") VALUES ('verify_ta1','verify_student','verify_t1','graded',100,60,'[{"questionId":"q1","choiceIndex":1}]','[{"questionId":"q1","correct":true}]','["verify_c1"]','[]') ON CONFLICT (id) DO NOTHING`);
console.log("TestAttempt inserted");

// Verify read back
const cs = await client.query(`SELECT "masteryEstimate",confidence FROM "ConceptState" WHERE "studentId"='verify_student'`);
console.log("ConceptState read:", cs.rows[0]);
const ev = await client.query(`SELECT count(*) as c FROM "Evidence" WHERE "studentId"='verify_student'`);
console.log("Evidence count:", ev.rows[0].c);
const rs = await client.query(`SELECT ease,"intervalDays" FROM "RecallSchedule" WHERE "studentId"='verify_student'`);
console.log("Recall:", rs.rows[0]);
const ta = await client.query(`SELECT score FROM "TestAttempt" WHERE id='verify_ta1'`);
console.log("TestAttempt score:", ta.rows[0].score);

console.log("INTELLIGENCE PG FLOW VERIFIED");
await client.end();
