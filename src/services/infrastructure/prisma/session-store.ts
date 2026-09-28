/**
 * Prisma adapter for `AssessmentSessionStore` (§5).
 *
 * Two rules hold this file together:
 *
 * **No Prisma type escapes.** Every method returns the domain shape, never a
 * `PrismaAssessmentSession`. Row→domain translation happens here and nowhere
 * else, which is what keeps the answer key and the timestamps from leaking.
 *
 * **`findById` is not an ownership check.** The port deliberately takes an id
 * only; the engine resolves ownership afterwards and answers 404 for a
 * session that belongs to someone else. Keeping that decision in the domain
 * means the security rule is in one tested place instead of duplicated
 * across every adapter.
 */
import type { PrismaClient, Prisma } from "@prisma/client";

import type { BankItem } from "@/services/assessment/question-bank";
import type { AssessmentQuestion, AssessmentTopicId } from "@/types/assessment";
import type {
  StoredAssessmentResponse,
  StoredAssessmentSession,
  StoredTopicState,
} from "@/services/ports/stores";

import { currentClient, inTransaction, translateDbError } from "./context";

type Json = Prisma.InputJsonValue;

function json(value: unknown): Json {
  return (value ?? null) as Json;
}

function asObject(value: Prisma.JsonValue): Record<string, unknown> {
  return (value && typeof value === "object" && !Array.isArray(value) ? value : {}) as Record<
    string,
    unknown
  >;
}

function toIso(value: Date | null | undefined): string | undefined {
  return value ? value.toISOString() : undefined;
}

/** Deterministic surrogate keys: the domain ids repeat across sessions. */
const questionRowId = (sessionId: string, questionId: string) => `${sessionId}::${questionId}`;
const answerRowId = (sessionId: string, submissionId: string) => `${sessionId}::${submissionId}`;

type SessionRow = {
  id: string;
  studentId: string;
  status: string;
  startedAt: Date;
  completedAt: Date | null;
  topicState: Prisma.JsonValue;
  lastTopic: string | null;
  profile: Prisma.JsonValue;
  sessionTopics: string[];
  questions: {
    questionId: string;
    question: Prisma.JsonValue;
    scoring: Prisma.JsonValue;
  }[];
  answers: {
    submissionId: string;
    response: Prisma.JsonValue;
    points: number;
    difficulty: string;
    questionType: string;
    submittedAt: Date;
  }[];
};

const includeAll = {
  questions: { orderBy: { questionId: "asc" } },
  answers: { orderBy: { submittedAt: "asc" } },
} satisfies Prisma.AssessmentSessionInclude;

function toResponse(row: SessionRow["answers"][number]): StoredAssessmentResponse {
  const response = row.response as StoredAssessmentResponse["response"];
  return {
    submissionId: row.submissionId,
    response,
    points: row.points,
    difficulty: row.difficulty as StoredAssessmentResponse["difficulty"],
    questionType: row.questionType as StoredAssessmentResponse["questionType"],
    at: row.submittedAt.toISOString(),
  };
}

function toDomain(row: SessionRow): StoredAssessmentSession {
  const topics = asObject(row.topicState) as Record<string, StoredTopicState>;
  const session: StoredAssessmentSession = {
    id: row.id,
    studentId: row.studentId,
    status: row.status as StoredAssessmentSession["status"],
    startedAt: row.startedAt.toISOString(),
    completedAt: toIso(row.completedAt),
    responses: row.answers.map(toResponse),
    topics,
    lastTopic: (row.lastTopic as AssessmentTopicId | null) ?? null,
    profile: (row.profile as unknown as StoredAssessmentSession["profile"]) ?? undefined,
    sessionTopics: [...row.sessionTopics] as AssessmentTopicId[],
  };
  // The bank is reassembled from the question rows. A session with no bank
  // rows simply has none — the engine treats that as "no bank to draw from".
  if (row.questions.length > 0) {
    session.bank = row.questions.map(
      (q): BankItem => ({
        question: q.question as unknown as AssessmentQuestion,
        scoring: q.scoring as BankItem["scoring"],
      }),
    );
  }
  return session;
}

export class PrismaAssessmentSessionStore {
  constructor(private readonly prisma: PrismaClient) {}

  private get db() {
    return currentClient(this.prisma);
  }

  async listByStudent(studentId: string): Promise<StoredAssessmentSession[]> {
    const rows = await this.db.assessmentSession.findMany({
      where: { studentId },
      orderBy: { startedAt: "desc" },
      include: includeAll,
    });
    return rows.map(toDomain);
  }

  async findById(id: string): Promise<StoredAssessmentSession | undefined> {
    const row = await this.db.assessmentSession.findUnique({
      where: { id },
      include: includeAll,
    });
    return row ? toDomain(row) : undefined;
  }

  /**
   * Writes the session, its question bank and its responses as one
   * transaction (§13).
   *
   * Child rows are replaced rather than diffed. The engine is the only writer
   * of a session and always hands over its complete state, so delete-then-
   * insert is both simpler and free of drift. It must be one transaction:
   * answers carry a foreign key to their question, and a crash between the
   * two writes would leave a session whose responses reference nothing.
   *
   * A unique violation on `(sessionId, submissionId)` means a concurrent
   * submitter won the race for the same idempotency key. That is a replay,
   * not a failure (§14): the winner's committed state stands, so this write
   * is dropped instead of throwing.
   */
  async upsert(session: StoredAssessmentSession): Promise<void> {
    try {
      await inTransaction(this.prisma, () => this.write(session));
    } catch (error) {
      throw translateDbError(error);
    }
  }

  /** The row set of one session, written atomically. Runs on `this.db`. */
  private async write(session: StoredAssessmentSession): Promise<void> {
    const db = this.db;

    await db.assessmentSession.upsert({
      where: { id: session.id },
      create: {
        id: session.id,
        studentId: session.studentId,
        status: session.status,
        startedAt: new Date(session.startedAt),
        completedAt: session.completedAt ? new Date(session.completedAt) : null,
        topicState: json(session.topics),
        lastTopic: session.lastTopic ?? null,
        profile: json(session.profile ?? null),
        sessionTopics: [...(session.sessionTopics ?? [])],
      },
      update: {
        status: session.status,
        startedAt: new Date(session.startedAt),
        completedAt: session.completedAt ? new Date(session.completedAt) : null,
        topicState: json(session.topics),
        lastTopic: session.lastTopic ?? null,
        profile: json(session.profile ?? null),
        sessionTopics: [...(session.sessionTopics ?? [])],
      },
    });

    // Responses carry a foreign key to their question, so they are cleared
    // first and written last.
    await db.assessmentAnswer.deleteMany({ where: { sessionId: session.id } });

    // An absent bank means "nothing to write", not "delete the bank": a
    // session persisted before the bank was attached keeps its questions.
    if (session.bank) {
      await db.assessmentQuestion.deleteMany({ where: { sessionId: session.id } });
      await db.assessmentQuestion.createMany({
        data: session.bank.map((item) => ({
          id: questionRowId(session.id, item.question.id),
          sessionId: session.id,
          questionId: item.question.id,
          topic: item.question.topic,
          difficulty: item.question.difficulty,
          // The public half of the question. `scoring` never enters this column.
          question: json(item.question) as unknown as Json,
          scoring: json(item.scoring) as unknown as Json,
        })),
      });
    }

    if (session.responses.length > 0) {
      await db.assessmentAnswer.createMany({
        data: session.responses.map((r) => ({
          id: answerRowId(session.id, r.submissionId),
          sessionId: session.id,
          assessmentQuestionId: questionRowId(session.id, r.response.questionId),
          submissionId: r.submissionId,
          response: json(r.response),
          points: r.points,
          difficulty: r.difficulty,
          questionType: r.questionType,
          submittedAt: new Date(r.at),
        })),
      });
    }
  }

  async clear(): Promise<void> {
    // Children first: `AssessmentAnswer` → `AssessmentQuestion` → session.
    await this.db.assessmentAnswer.deleteMany();
    await this.db.assessmentQuestion.deleteMany();
    await this.db.assessmentSession.deleteMany();
  }
}
