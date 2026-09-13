import type {
  AssessmentDifficulty,
  AssessmentQuestionType,
  StudentAssessmentProfile,
} from "@/types/assessment";
import type { BankItem } from "@/services/assessment/question-bank";

interface GeneratedQuestionItem {
  prompt: string;
  instructions?: string;
  context?: string;
  type: AssessmentQuestionType;
  topic: string;
  difficulty: AssessmentDifficulty;
  options?: { id: string; label: string }[];
  correctOptionId?: string;
  keywords?: string[];
  minMatches?: number;
}

const STAGE_LABELS: Record<string, string> = {
  elementary: "المرحلة الابتدائية",
  middle: "المرحلة المتوسطة (الإعدادية)",
  high_school: "المرحلة الثانوية",
  university: "المرحلة الجامعية",
  professional: "التعليم المستمر والتطوير المهني",
};

/**
 * Calls Google Gemini API if GEMINI_API_KEY is configured in the environment.
 */
async function callGemini(
  profile: StudentAssessmentProfile,
  apiKey: string,
): Promise<{ bank: BankItem[]; topics: string[] } | null> {
  const stageLabel = STAGE_LABELS[profile.stage] || profile.stage;
  const prompt = `
أنت خبير تربوي وتشخيصي لمنصة التعليم التكيفي "مريح" (Mureeh).
قم بصياغة اختبار تشخيصي تقييمي باللغة العربية مخصص تماماً لبيانات الطالب التالية:
- المادة أو الموضوع: ${profile.targetSubject}
- عمر الطالب: ${profile.age} سنة
- المرحلة الدراسية: ${stageLabel}

المطلوب:
1. توليد بين 8 إلى 10 أسئلة تشخيصية متدرجة الصعوبة (تأسيسية، متوسطة، ومتقدمة).
2. توزيع الأسئلة على 3 أو 4 مواضيع فرعية (topics) دقيقة تتبع المادة.
3. مراعاة العمر والمرحلة بدقة في لغة ومفردات وصعوبة الأسئلة.
4. التنويع بين:
   - "multiple_choice" (خيارات 4: "a", "b", "c", "d" مع تحديد correctOptionId).
   - "short_answer" (سؤال مقالي قصير مع تحديد كلمات مفتاحية keywords للاحتساب).
   - "scenario" أو "problem_solving" (سؤال يطرح سياقاً وموقفاً حقيقياً للتطبيق).

يجب أن تكون الاستجابة حصراً بصيغة JSON نظيفة بدون أي Markdown أو كتل نصية خارجية، بالهيكل التالي:
{
  "topics": ["موضوع_1", "موضوع_2", "موضوع_3"],
  "questions": [
    {
      "prompt": "نص السؤال هنا",
      "instructions": "اختر الإجابة الأدق / اشرح باختصار",
      "context": "سياق أو تمهيد (اختياري)",
      "type": "multiple_choice",
      "topic": "موضوع_1",
      "difficulty": "foundational",
      "options": [
        { "id": "a", "label": "الخيار الأول" },
        { "id": "b", "label": "الخيار الثاني" },
        { "id": "c", "label": "الخيار الثالث" },
        { "id": "d", "label": "الخيار الرابع" }
      ],
      "correctOptionId": "a"
    },
    {
      "prompt": "ما الفرق بين...",
      "instructions": "وضح ذلك بجملة أو جملتين",
      "type": "short_answer",
      "topic": "موضوع_2",
      "difficulty": "intermediate",
      "keywords": ["كلمة1", "كلمة2"],
      "minMatches": 1
    }
  ]
}
`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            responseMimeType: "application/json",
          },
        }),
      },
    );

    if (!res.ok) {
      console.warn("[Gemini API] response not ok:", res.status, await res.text().catch(() => ""));
      return null;
    }

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return null;

    const parsed = JSON.parse(rawText) as {
      topics?: string[];
      questions?: GeneratedQuestionItem[];
    };

    if (!parsed.questions || parsed.questions.length === 0) return null;

    const bank: BankItem[] = parsed.questions.map((q, idx) => {
      const id = `ai_q_${idx + 1}_${Math.random().toString(36).slice(2, 6)}`;
      const scoring =
        q.type === "multiple_choice"
          ? { kind: "option" as const, correctOptionId: q.correctOptionId ?? "a" }
          : { kind: "keywords" as const, keywords: q.keywords ?? [profile.targetSubject], minMatches: q.minMatches ?? 1 };

      return {
        question: {
          id,
          type: q.type,
          prompt: q.prompt,
          instructions: q.instructions,
          context: q.context,
          options: q.options,
          topic: q.topic || parsed.topics?.[0] || profile.targetSubject,
          difficulty: q.difficulty || "foundational",
          estimatedSeconds: q.difficulty === "advanced" ? 120 : q.difficulty === "intermediate" ? 80 : 50,
        },
        scoring,
      };
    });

    const topics = parsed.topics && parsed.topics.length > 0
      ? parsed.topics
      : Array.from(new Set(bank.map((b) => b.question.topic)));

    return { bank, topics };
  } catch (error) {
    console.error("[Gemini API] failed to generate:", error);
    return null;
  }
}

/**
 * Intelligent domain fallback generator:
 * Creates tailored, age-appropriate, beautifully structured Arabic diagnostic
 * questions when no external AI key is present or when offline.
 */
function generateDynamicFallback(
  profile: StudentAssessmentProfile,
): { bank: BankItem[]; topics: string[] } {
  const s = profile.targetSubject.trim();
  const stage = profile.stage;
  const age = profile.age;

  // Derive subtopics dynamically from the user's chosen subject
  const t0 = `المفاهيم الأساسية في ${s}`;
  const t1 = `التطبيق العملي لـ ${s}`;
  const t2 = `حل المشكلات والتحليل في ${s}`;
  const t3 = `المفاهيم المتقدمة في ${s}`;
  const topics = [t0, t1, t2, t3];

  const bank: BankItem[] = [
    // 1. Foundational Multiple Choice
    {
      question: {
        id: "ai_q_1",
        type: "multiple_choice",
        prompt: `ما هو التعريف أو المفهوم الأساسي الأكثر دقة لمجال "${s}"؟`,
        instructions: "اختر الإجابة التي تصف الأساس بدقة.",
        options: [
          { id: "a", label: `هو دراسة وتطبيق القواعد والمبادئ الجوهرية المنظمة لـ ${s}` },
          { id: "b", label: "مجموعة عشوائية من الأدوات دون منهجية محددة" },
          { id: "c", label: "مجرد حفظ نظري دون إمكانية التطبيق العملي" },
          { id: "d", label: "مجال ينطبق فقط على الحالات الخاصة دون قواعد عامة" },
        ],
        topic: t0,
        difficulty: "foundational",
        estimatedSeconds: 45,
      },
      scoring: { kind: "option", correctOptionId: "a" },
    },
    // 2. Foundational Short Answer
    {
      question: {
        id: "ai_q_2",
        type: "short_answer",
        prompt: `بناءً على فهمك، اذكر المبدأ أو الفكرة الأولى التي يجب أن يبدأ بها دارس "${s}" في ${STAGE_LABELS[stage] || "مرحلتك"}.`,
        instructions: "اكتب إجابة مختصرة وواضحة تركز على المفاهيم الجوهرية.",
        topic: t0,
        difficulty: "foundational",
        estimatedSeconds: 60,
      },
      scoring: { kind: "keywords", keywords: ["مفهوم", "أساس", "قاعدة", "مبدأ", "فهم", s], minMatches: 1 },
    },
    // 3. Intermediate Scenario
    {
      question: {
        id: "ai_q_3",
        type: "scenario",
        context: `طُلب منك في سياق عملي أو دراسي مناسب لعمر ${age} سنة حل مهمة تعتمد على مبادئ ${s}.`,
        prompt: `إذا واجهتك عقبة غير متوقعة أثناء تطبيق ${s}، ما هي الخطوة التشخيصية الأولى التي ينبغي اتخاذها؟`,
        instructions: "اختر النهج التشخيصي السليم.",
        options: [
          { id: "a", label: "تحليل المدخلات وتفكيك المشكلة إلى عناصرها الأساسية لتحديد نقطة الخلل" },
          { id: "b", label: "إعادة البدء من الصفر عشوائياً دون فحص ما تم إنجازه" },
          { id: "c", label: "تخطي الخطوة واستبعاد القواعد الأساسية" },
          { id: "d", label: "افتراض أن النظام لا يحتوي على حل والتوقف عن المحاولة" },
        ],
        topic: t1,
        difficulty: "intermediate",
        estimatedSeconds: 80,
      },
      scoring: { kind: "option", correctOptionId: "a" },
    },
    // 4. Intermediate Multiple Choice
    {
      question: {
        id: "ai_q_4",
        type: "multiple_choice",
        prompt: `عند الانتقال من الفهم النظري لـ "${s}" إلى التطبيق الواقعي، ما هو العامل الأكثر حساسية لضمان دقة النتيجة؟`,
        instructions: "حدد العامل الأكثر تأثيراً في صحة التطبيق.",
        options: [
          { id: "a", label: "السرعة العالية دون مراجعة الخطوات" },
          { id: "b", label: "الالتزام بالمعايير والتحقق التدريجي من صحة كل مرحلة" },
          { id: "c", label: "تجاهل الشروط والقيود المحيطة بالمسألة" },
          { id: "d", label: "الاعتماد على التخمين بدلاً من البرهان والبيانات" },
        ],
        topic: t1,
        difficulty: "intermediate",
        estimatedSeconds: 70,
      },
      scoring: { kind: "option", correctOptionId: "b" },
    },
    // 5. Intermediate Problem Solving
    {
      question: {
        id: "ai_q_5",
        type: "problem_solving",
        prompt: `كيف تفسر العلاقة بين المتغيرات أو المعطيات عند معالجة مسألة معقدة في مجال ${s}؟`,
        instructions: "اكتب استنتاجك المنطقي بأسلوب علمي.",
        topic: t2,
        difficulty: "intermediate",
        estimatedSeconds: 90,
      },
      scoring: { kind: "keywords", keywords: ["علاقة", "تأثير", "نتيجة", "سبب", "منطق", "تحليل", s], minMatches: 1 },
    },
    // 6. Advanced Scenario
    {
      question: {
        id: "ai_q_6",
        type: "scenario",
        context: `في اختبار إتقان متقدم لـ ${s}، ظهر تعارض بين خيارين كلاهما يقدم حلاً، لكن أحدهما أكثر استدامة وكفاءة على المدى الطويل.`,
        prompt: `ما هو المعيار الحاسم الذي يجب أن يعتمده المتخصص في ${s} للاختيار بين الحلين؟`,
        instructions: "اختر المعيار الهندسي/العلمي الأمثل.",
        options: [
          { id: "a", label: "كفاءة استخدام الموارد، وقابلية التوسع والصيانة وموثوقية النتائج" },
          { id: "b", label: "الحل الأسهل في كتابته بغض النظر عن الأخطاء المحتملة لاحقاً" },
          { id: "c", label: "اختيار الحل الأول الذي يخطر بالبال فوراً" },
          { id: "d", label: "الحل الأكثر تعقيداً شكلياً لإبهار المراجعين" },
        ],
        topic: t2,
        difficulty: "advanced",
        estimatedSeconds: 100,
      },
      scoring: { kind: "option", correctOptionId: "a" },
    },
    // 7. Advanced Multiple Choice
    {
      question: {
        id: "ai_q_7",
        type: "multiple_choice",
        prompt: `ما الذي يميز المستوى المتقدم والمبتكر في ${s} عن المستوى المتوسط؟`,
        instructions: "اختر السمة التي تعبر عن درجة الإتقان العالي.",
        options: [
          { id: "a", label: "القدرة على توقع الآثار الجانبية، والتحسين المستمر، وابتكار حلول لحالات الحافة غير المسبوقة" },
          { id: "b", label: "تطبيق الوصفات الجاهزة دون فهم أسباب عملها" },
          { id: "c", label: "تجنب معالجة أي مشكلة لم يتم التدريب عليها مسبقاً" },
          { id: "d", label: "حفظ أكبر قدر ممكن من النصوص دون ربطها بالسياق" },
        ],
        topic: t3,
        difficulty: "advanced",
        estimatedSeconds: 90,
      },
      scoring: { kind: "option", correctOptionId: "a" },
    },
    // 8. Advanced Problem Solving
    {
      question: {
        id: "ai_q_8",
        type: "problem_solving",
        prompt: `اقترح استراتيجية محكمة لتقييم واختبار موثوقية حل تم تطويره في ${s} للتأكد من عدم وجود ثغرات أو أخطاء.`,
        instructions: "لخص خطوات استراتيجية التحقق المقترحة.",
        topic: t3,
        difficulty: "advanced",
        estimatedSeconds: 110,
      },
      scoring: { kind: "keywords", keywords: ["اختبار", "تحقق", "معايير", "فحص", "تقييم", "دقة", s], minMatches: 1 },
    },
  ];

  return { bank, topics };
}

/**
 * Main entrance: Generates questions via Gemini if key is provided,
 * otherwise utilizes the intelligent dynamic engine.
 */
export async function generateAssessmentQuestions(
  profile: StudentAssessmentProfile,
): Promise<{ bank: BankItem[]; topics: string[] }> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.AI_API_KEY;
  if (apiKey) {
    const aiResult = await callGemini(profile, apiKey);
    if (aiResult && aiResult.bank.length >= 6) {
      return aiResult;
    }
  }

  return generateDynamicFallback(profile);
}
