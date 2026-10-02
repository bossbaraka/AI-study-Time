-- ================================================================
-- LEARNING INTELLIGENCE — Phase 4+ (Concepts, Events, Evidence,
-- ConceptStates, Recall, Tests, Guardian)
--
-- ADDITIVE ONLY. Drops no table, column or row. All new tables are
-- student-owned where applicable and cascade with the owning User.
-- ================================================================

-- Concept catalog (global, not per-student)
CREATE TABLE "Concept" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "prerequisites" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "difficulty" INTEGER NOT NULL DEFAULT 1,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Concept_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Concept_name_domain_key" ON "Concept"("name", "domain");
CREATE INDEX "Concept_domain_idx" ON "Concept"("domain");

-- Append-only learning event stream
CREATE TABLE "LearningEvent" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "correlationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LearningEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LearningEvent_studentId_type_idx" ON "LearningEvent"("studentId", "type");
CREATE INDEX "LearningEvent_studentId_timestamp_idx" ON "LearningEvent"("studentId", "timestamp" DESC);
CREATE INDEX "LearningEvent_correlationId_idx" ON "LearningEvent"("correlationId");
CREATE INDEX "LearningEvent_entityType_entityId_idx" ON "LearningEvent"("entityType", "entityId");
ALTER TABLE "LearningEvent" ADD CONSTRAINT "LearningEvent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Generalized evidence
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "conceptId" TEXT,
    "kind" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "score" DOUBLE PRECISION,
    "timeSpentSeconds" INTEGER,
    "attemptCount" INTEGER NOT NULL DEFAULT 1,
    "hintUsed" BOOLEAN NOT NULL DEFAULT false,
    "hintCount" INTEGER NOT NULL DEFAULT 0,
    "learningUnitId" TEXT,
    "roadmapId" TEXT,
    "assessmentSessionId" TEXT,
    "testAttemptId" TEXT,
    "immutable" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Evidence_studentId_conceptId_idx" ON "Evidence"("studentId", "conceptId");
CREATE INDEX "Evidence_studentId_createdAt_idx" ON "Evidence"("studentId", "createdAt" DESC);
CREATE INDEX "Evidence_conceptId_idx" ON "Evidence"("conceptId");
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "Concept"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Per-student, per-concept learner state
CREATE TABLE "ConceptState" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "conceptId" TEXT NOT NULL,
    "knowledge" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "retrieval" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "retention" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "transfer" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fluency" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hintDependency" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "misconceptionRisk" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "evidenceCount" INTEGER NOT NULL DEFAULT 0,
    "lastEvidenceAt" TIMESTAMP(3),
    "stateVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ConceptState_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ConceptState_studentId_conceptId_key" ON "ConceptState"("studentId", "conceptId");
CREATE INDEX "ConceptState_studentId_idx" ON "ConceptState"("studentId");
CREATE INDEX "ConceptState_conceptId_idx" ON "ConceptState"("conceptId");
ALTER TABLE "ConceptState" ADD CONSTRAINT "ConceptState_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConceptState" ADD CONSTRAINT "ConceptState_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "Concept"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Recall schedule (evidence-driven)
CREATE TABLE "RecallSchedule" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "conceptId" TEXT NOT NULL,
    "evidenceId" TEXT,
    "intervalDays" INTEGER NOT NULL DEFAULT 1,
    "easeFactor" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "repetitions" INTEGER NOT NULL DEFAULT 0,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "lastReviewedAt" TIMESTAMP(3),
    "state" TEXT NOT NULL DEFAULT 'new',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RecallSchedule_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RecallSchedule_studentId_conceptId_key" ON "RecallSchedule"("studentId", "conceptId");
CREATE INDEX "RecallSchedule_studentId_dueAt_idx" ON "RecallSchedule"("studentId", "dueAt");
CREATE INDEX "RecallSchedule_conceptId_idx" ON "RecallSchedule"("conceptId");
ALTER TABLE "RecallSchedule" ADD CONSTRAINT "RecallSchedule_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecallSchedule" ADD CONSTRAINT "RecallSchedule_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "Concept"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Test definitions (server-owned)
CREATE TABLE "TestDefinition" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "moduleId" TEXT,
    "phaseTitle" TEXT,
    "timeLimitMinutes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TestDefinition_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "TestQuestion" (
    "id" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "choices" JSONB,
    "correctChoiceIndex" INTEGER,
    "explanation" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 1,
    "rubric" JSONB,
    CONSTRAINT "TestQuestion_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TestQuestion_testId_idx" ON "TestQuestion"("testId");
ALTER TABLE "TestQuestion" ADD CONSTRAINT "TestQuestion_testId_fkey" FOREIGN KEY ("testId") REFERENCES "TestDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "TestAttempt" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "timeSpentSeconds" INTEGER NOT NULL,
    "answers" JSONB NOT NULL,
    "gradedAnswers" JSONB,
    "strongTopics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "needsReviewTopics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "recommendation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TestAttempt_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TestAttempt_studentId_testId_idx" ON "TestAttempt"("studentId", "testId");
CREATE INDEX "TestAttempt_testId_idx" ON "TestAttempt"("testId");
ALTER TABLE "TestAttempt" ADD CONSTRAINT "TestAttempt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TestAttempt" ADD CONSTRAINT "TestAttempt_testId_fkey" FOREIGN KEY ("testId") REFERENCES "TestDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Guardian relation (explicit, server-side)
CREATE TABLE "GuardianRelation" (
    "id" TEXT NOT NULL,
    "guardianId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GuardianRelation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GuardianRelation_guardianId_studentId_key" ON "GuardianRelation"("guardianId", "studentId");
CREATE INDEX "GuardianRelation_studentId_idx" ON "GuardianRelation"("studentId");
ALTER TABLE "GuardianRelation" ADD CONSTRAINT "GuardianRelation_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuardianRelation" ADD CONSTRAINT "GuardianRelation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed concepts from curriculum capabilities (idempotent)
INSERT INTO "Concept" ("id", "name", "description", "domain", "prerequisites", "difficulty", "version", "createdAt", "updatedAt") VALUES
('concept_js_variables', 'JavaScript Variables', 'Understanding var, let, const and binding semantics', 'javascript', ARRAY[]::TEXT[], 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('concept_js_scope', 'Scope', 'Lexical scope, block scope, scope chain', 'javascript', ARRAY['concept_js_variables']::TEXT[], 2, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('concept_js_closures', 'Closures', 'Functions retaining lexical scope, practical closure patterns', 'javascript', ARRAY['concept_js_scope']::TEXT[], 3, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('concept_js_prototypes', 'Prototypes', 'Prototype chain, inheritance, this binding', 'javascript', ARRAY['concept_js_scope']::TEXT[], 3, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('concept_js_async', 'Async Programming', 'Event loop, promises, async/await, data fetching', 'javascript', ARRAY['concept_js_closures']::TEXT[], 3, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('concept_js_promise', 'Promises', 'Creating and chaining promises, error handling', 'javascript', ARRAY['concept_js_async']::TEXT[], 3, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('concept_js_event_loop', 'Event Loop', 'Call stack, task queue, microtasks, rendering', 'javascript', ARRAY['concept_js_async']::TEXT[], 4, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('concept_js_async_await', 'Async/Await', 'Syntactic sugar over promises, sequential vs parallel', 'javascript', ARRAY['concept_js_promise']::TEXT[], 3, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('concept_js_functions', 'Functions', 'Declaration, expression, arrow, parameters, return', 'javascript', ARRAY['concept_js_variables']::TEXT[], 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('concept_js_arrays', 'Arrays', 'Array methods, transformation, iteration, data shaping', 'javascript', ARRAY['concept_js_functions']::TEXT[], 2, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('concept_fe_html_css', 'HTML & CSS', 'Semantic markup, layout, flexbox, grid', 'frontend', ARRAY[]::TEXT[], 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('concept_fe_dom', 'DOM and Events', 'DOM manipulation, event handling, delegation', 'frontend', ARRAY['concept_fe_html_css', 'concept_js_functions']::TEXT[], 2, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('concept_fe_responsive_a11y', 'Responsive & Accessibility', 'Responsive design, ARIA, semantic HTML', 'frontend', ARRAY['concept_fe_html_css']::TEXT[], 2, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('concept_fe_async_apis', 'Async Data & APIs', 'Fetching remote data, loading/error states', 'frontend', ARRAY['concept_fe_dom']::TEXT[], 3, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('concept_fe_framework', 'Component Framework', 'Components, props, state, composition', 'frontend', ARRAY['concept_fe_async_apis']::TEXT[], 3, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('concept_be_server', 'Server Foundations', 'Runtime, request/response lifecycle', 'backend', ARRAY[]::TEXT[], 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('concept_be_http_rest', 'HTTP and REST', 'Methods, statuses, payloads, API design', 'backend', ARRAY['concept_be_server']::TEXT[], 2, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('concept_be_databases', 'Databases', 'Data modelling, queries, migrations', 'backend', ARRAY['concept_be_http_rest']::TEXT[], 3, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('concept_be_auth', 'Authentication', 'Signup, signin, sessions, authorization', 'backend', ARRAY['concept_be_databases']::TEXT[], 3, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
