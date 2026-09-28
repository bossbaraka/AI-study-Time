-- ================================================================
-- LEARNING DOMAIN — Phase 2
--
-- Adds persistence for the four aggregates that already have a domain
-- engine, a persistence port and tests: assessment sessions, goals,
-- roadmaps and learning-unit executions.
--
-- NON-DESTRUCTIVE: this migration only CREATEs. It drops no table, no
-- column and no row, and it does not alter the auth gateway tables beyond
-- adding foreign keys that point AT "User".
--
-- Authoring note: `prisma migrate diff` is unavailable in the environment
-- this was written in (the schema-engine binary cannot be fetched), so the
-- SQL is hand-written to match `prisma/schema.prisma`. It is verified by
-- applying it to a clean PostgreSQL database and exercising every model
-- through PrismaClient in the repository integration suite.
-- ================================================================

-- CreateTable
CREATE TABLE "AssessmentSession" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "topicState" JSONB NOT NULL DEFAULT '{}',
    "lastTopic" TEXT,
    "profile" JSONB,
    "sessionTopics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentQuestion" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "question" JSONB NOT NULL,
    "scoring" JSONB NOT NULL,

    CONSTRAINT "AssessmentQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentAnswer" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "assessmentQuestionId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "response" JSONB NOT NULL,
    "points" DOUBLE PRECISION NOT NULL,
    "difficulty" TEXT NOT NULL,
    "questionType" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssessmentAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Goal" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'discovered',
    "desiredOutcome" TEXT NOT NULL,
    "currentLevel" TEXT NOT NULL,
    "targetLevel" TEXT NOT NULL,
    "motivation" JSONB NOT NULL,
    "targetDomain" JSONB NOT NULL,
    "timeframe" JSONB NOT NULL,
    "weeklyCommitment" JSONB NOT NULL,
    "constraints" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "successCriteria" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "diagnosisContext" JSONB,
    "validation" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createIdempotencyKey" TEXT,
    "lockIdempotencyKey" TEXT,
    "revisesGoalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lockedAt" TIMESTAMP(3),

    CONSTRAINT "Goal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Roadmap" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "weeklyCommitment" DOUBLE PRECISION NOT NULL,
    "totalEstimatedHours" DOUBLE PRECISION NOT NULL,
    "estimatedDuration" JSONB NOT NULL,
    "timeFeasibility" JSONB NOT NULL,
    "generationContext" JSONB NOT NULL,
    "generationKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Roadmap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoadmapMilestone" (
    "id" TEXT NOT NULL,
    "roadmapId" TEXT NOT NULL,
    "milestoneId" TEXT NOT NULL,
    "capabilityId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "learningOutcome" TEXT NOT NULL,
    "estimatedHours" DOUBLE PRECISION NOT NULL,
    "goalAlignment" TEXT NOT NULL,
    "maintenance" BOOLEAN NOT NULL DEFAULT false,
    "dependencies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "checkpoint" JSONB NOT NULL,

    CONSTRAINT "RoadmapMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningUnit" (
    "id" TEXT NOT NULL,
    "roadmapId" TEXT NOT NULL,
    "milestoneId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "estimatedMinutes" INTEGER NOT NULL,
    "expectedOutcome" TEXT NOT NULL,
    "completionEvidence" TEXT NOT NULL,

    CONSTRAINT "LearningUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningUnitExecution" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "roadmapId" TEXT NOT NULL,
    "milestoneId" TEXT NOT NULL,
    "learningUnitId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "evaluatedAt" TIMESTAMP(3),
    "evidence" JSONB,
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningUnitExecution_pkey" PRIMARY KEY ("id")
);

-- ------------------------------------------------------------
-- Unique constraints — each one encodes a real domain invariant
-- ------------------------------------------------------------

-- A question id is unique within one session's bank.
CREATE UNIQUE INDEX "AssessmentQuestion_sessionId_questionId_key" ON "AssessmentQuestion"("sessionId", "questionId");

-- Idempotent answer submission: a retried submissionId cannot double-count.
CREATE UNIQUE INDEX "AssessmentAnswer_sessionId_submissionId_key" ON "AssessmentAnswer"("sessionId", "submissionId");

-- Idempotent goal creation and locking per student. NULLs are distinct in
-- PostgreSQL, so goals created without a key never collide.
CREATE UNIQUE INDEX "Goal_studentId_createIdempotencyKey_key" ON "Goal"("studentId", "createIdempotencyKey");
CREATE UNIQUE INDEX "Goal_studentId_lockIdempotencyKey_key" ON "Goal"("studentId", "lockIdempotencyKey");

-- One roadmap per (student, goal, goalVersion, engineVersion) — replaces the
-- racy in-memory scan the engine used to rely on.
CREATE UNIQUE INDEX "Roadmap_generationKey_key" ON "Roadmap"("generationKey");
-- Monotonic per-student roadmap versions cannot collide under concurrency.
CREATE UNIQUE INDEX "Roadmap_studentId_version_key" ON "Roadmap"("studentId", "version");

-- Deterministic domain ids repeat across roadmap versions, so they are
-- unique per roadmap only.
CREATE UNIQUE INDEX "RoadmapMilestone_roadmapId_milestoneId_key" ON "RoadmapMilestone"("roadmapId", "milestoneId");
CREATE UNIQUE INDEX "RoadmapMilestone_roadmapId_order_key" ON "RoadmapMilestone"("roadmapId", "order");
CREATE UNIQUE INDEX "LearningUnit_roadmapId_unitId_key" ON "LearningUnit"("roadmapId", "unitId");
CREATE UNIQUE INDEX "LearningUnit_milestoneId_order_key" ON "LearningUnit"("milestoneId", "order");

-- One execution per unit per roadmap: a retry mutates, never appends.
CREATE UNIQUE INDEX "LearningUnitExecution_roadmapId_learningUnitId_key" ON "LearningUnitExecution"("roadmapId", "learningUnitId");

-- ------------------------------------------------------------
-- Query-driven indexes (no speculative ones)
-- ------------------------------------------------------------

-- getActiveSession / listByStudent
CREATE INDEX "AssessmentSession_studentId_status_idx" ON "AssessmentSession"("studentId", "status");
-- getLatestCompletedResult: newest completed diagnosis first
CREATE INDEX "AssessmentSession_studentId_completedAt_idx" ON "AssessmentSession"("studentId", "completedAt" DESC);
CREATE INDEX "AssessmentAnswer_sessionId_idx" ON "AssessmentAnswer"("sessionId");
-- getActiveGoal
CREATE INDEX "Goal_studentId_status_idx" ON "Goal"("studentId", "status");
-- getActiveRoadmap
CREATE INDEX "Roadmap_studentId_status_idx" ON "Roadmap"("studentId", "status");
CREATE INDEX "Roadmap_goalId_idx" ON "Roadmap"("goalId");
CREATE INDEX "LearningUnit_roadmapId_idx" ON "LearningUnit"("roadmapId");
CREATE INDEX "LearningUnitExecution_studentId_status_idx" ON "LearningUnitExecution"("studentId", "status");
CREATE INDEX "LearningUnitExecution_roadmapId_idx" ON "LearningUnitExecution"("roadmapId");

-- ------------------------------------------------------------
-- Foreign keys — ownership and referential integrity
-- ------------------------------------------------------------

ALTER TABLE "AssessmentSession" ADD CONSTRAINT "AssessmentSession_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AssessmentQuestion" ADD CONSTRAINT "AssessmentQuestion_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AssessmentSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AssessmentAnswer" ADD CONSTRAINT "AssessmentAnswer_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AssessmentSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssessmentAnswer" ADD CONSTRAINT "AssessmentAnswer_assessmentQuestionId_fkey" FOREIGN KEY ("assessmentQuestionId") REFERENCES "AssessmentQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Goal" ADD CONSTRAINT "Goal_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_revisesGoalId_fkey" FOREIGN KEY ("revisesGoalId") REFERENCES "Goal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Roadmap" ADD CONSTRAINT "Roadmap_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Roadmap" ADD CONSTRAINT "Roadmap_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RoadmapMilestone" ADD CONSTRAINT "RoadmapMilestone_roadmapId_fkey" FOREIGN KEY ("roadmapId") REFERENCES "Roadmap"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LearningUnit" ADD CONSTRAINT "LearningUnit_roadmapId_fkey" FOREIGN KEY ("roadmapId") REFERENCES "Roadmap"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LearningUnit" ADD CONSTRAINT "LearningUnit_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "RoadmapMilestone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LearningUnitExecution" ADD CONSTRAINT "LearningUnitExecution_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LearningUnitExecution" ADD CONSTRAINT "LearningUnitExecution_roadmapId_fkey" FOREIGN KEY ("roadmapId") REFERENCES "Roadmap"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- Composite: an execution cannot reference a unit outside its own roadmap.
ALTER TABLE "LearningUnitExecution" ADD CONSTRAINT "LearningUnitExecution_roadmapId_learningUnitId_fkey" FOREIGN KEY ("roadmapId", "learningUnitId") REFERENCES "LearningUnit"("roadmapId", "unitId") ON DELETE CASCADE ON UPDATE CASCADE;
