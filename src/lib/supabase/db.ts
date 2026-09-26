import { createClient, SupabaseClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { Quiz, Attempt, QuestionItem, QuestionBreakdown, ActiveStudentSession } from "../types";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  SUPABASE_URL &&
  SUPABASE_KEY &&
  !SUPABASE_URL.includes("placeholder") &&
  !SUPABASE_KEY.includes("placeholder")
);

let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!supabaseInstance && SUPABASE_URL && SUPABASE_KEY) {
    supabaseInstance = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false },
    });
  }
  return supabaseInstance;
}

// Local File-based DB Fallback for frictionless local demo / development
const LOCAL_DB_PATH = path.join(process.cwd(), ".local_quiz_store.json");

interface LocalStore {
  quizzes: Quiz[];
  attempts: Attempt[];
  live_sessions?: ActiveStudentSession[];
}

function getLocalStore(): LocalStore {
  try {
    if (fs.existsSync(LOCAL_DB_PATH)) {
      const data = fs.readFileSync(LOCAL_DB_PATH, "utf-8");
      return JSON.parse(data);
    }
  } catch (err) {
    console.error("Error reading local db fallback:", err);
  }

  // Initial seed data for instant testing if local store doesn't exist
  const initialStore: LocalStore = {
    quizzes: [
      {
        id: "demo-general-knowledge-001",
        created_at: new Date().toISOString(),
        title: "World Capitals & Science Quickfire",
        raw_json: [
          {
            question: "What is the capital of France?",
            options: ["London", "Paris", "Berlin", "Madrid"],
            correct_answer: "Paris",
          },
          {
            question: "Which element has the chemical symbol 'O'?",
            options: ["Gold", "Oxygen", "Osmium", "Silver"],
            correct_answer: "Oxygen",
          },
          {
            question: "What is the largest planet in our solar system?",
            options: ["Earth", "Mars", "Jupiter", "Saturn"],
            correct_answer: "Jupiter",
          },
        ],
      },
    ],
    attempts: [
      {
        id: "demo-attempt-001",
        quiz_id: "demo-general-knowledge-001",
        trainee_name: "Alex Johnson",
        score: 3,
        max_score: 3,
        submitted_at: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: "demo-attempt-002",
        quiz_id: "demo-general-knowledge-001",
        trainee_name: "Samantha Miller",
        score: 2,
        max_score: 3,
        submitted_at: new Date(Date.now() - 1800000).toISOString(),
      },
    ],
  };

  saveLocalStore(initialStore);
  return initialStore;
}

function saveLocalStore(store: LocalStore) {
  try {
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(store, null, 2), "utf-8");
  } catch (err) {
    console.error("Error saving local store fallback:", err);
  }
}

// High-level unified Database Methods
export async function fetchAllQuizzes(): Promise<Quiz[]> {
  const supabase = getSupabaseClient();
  if (supabase) {
    const { data, error } = await supabase
      .from("quizzes")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) {
      return data as Quiz[];
    }
    console.warn("Supabase fetch failed, checking local store fallback:", error?.message);
  }

  const store = getLocalStore();
  return store.quizzes.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export async function fetchQuizById(id: string): Promise<Quiz | null> {
  const supabase = getSupabaseClient();
  if (supabase) {
    const { data, error } = await supabase
      .from("quizzes")
      .select("*")
      .eq("id", id)
      .single();
    if (!error && data) {
      return data as Quiz;
    }
    console.warn("Supabase fetch quiz failed:", error?.message);
  }

  const store = getLocalStore();
  return store.quizzes.find((q) => q.id === id) || null;
}

export async function insertQuiz(
  title: string,
  raw_json: QuestionItem[],
  header_image_url?: string,
  topic_quotas?: Record<string, number>,
  category?: string,
  tags?: string[]
): Promise<Quiz> {
  const supabase = getSupabaseClient();
  if (supabase) {
    const payload: Record<string, unknown> = { title, raw_json };
    if (header_image_url) payload.header_image_url = header_image_url;
    if (topic_quotas) payload.topic_quotas = topic_quotas;
    if (category) payload.category = category;
    if (tags && tags.length > 0) payload.tags = tags;

    let { data, error } = await supabase
      .from("quizzes")
      .insert([payload])
      .select()
      .single();

    if (error && error.message?.includes("column")) {
      const fallback = await supabase
        .from("quizzes")
        .insert([{ title, raw_json }])
        .select()
        .single();
      data = fallback.data;
      error = fallback.error;
    }

    if (!error && data) {
      return { ...data, header_image_url, topic_quotas, category, tags } as Quiz;
    }
    console.error("Supabase insert quiz failed:", error?.message);
    if (isSupabaseConfigured || process.env.VERCEL) {
      throw new Error(`Database Error: ${error?.message || "Failed to insert quiz into Supabase"}`);
    }
  }

  if (process.env.VERCEL) {
    throw new Error(
      "Database not connected: Supabase environment variables are missing on Vercel. Please add SUPABASE_URL and SUPABASE_ANON_KEY in Vercel and click Redeploy."
    );
  }

  const store = getLocalStore();
  const newQuiz: Quiz = {
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `quiz-${Date.now()}`,
    created_at: new Date().toISOString(),
    title,
    raw_json,
    header_image_url: header_image_url || undefined,
    topic_quotas: topic_quotas || undefined,
    category: category || undefined,
    tags: tags && tags.length > 0 ? tags : undefined,
  };
  store.quizzes.unshift(newQuiz);
  saveLocalStore(store);
  return newQuiz;
}

export async function updateQuizCategoryAndTags(
  quizId: string,
  category?: string,
  tags?: string[]
): Promise<Quiz> {
  const store = getLocalStore();
  const idx = store.quizzes.findIndex((q) => q.id === quizId);
  if (idx !== -1) {
    store.quizzes[idx].category = category || undefined;
    store.quizzes[idx].tags = tags || undefined;
    saveLocalStore(store);
  }

  const supabase = getSupabaseClient();
  if (supabase) {
    const { data, error } = await supabase
      .from("quizzes")
      .update({ category: category || null, tags: tags || [] })
      .eq("id", quizId)
      .select()
      .single();

    if (!error && data) {
      return data as Quiz;
    }
    console.warn("Supabase update category/tags failed:", error?.message);
  }

  const existing = await fetchQuizById(quizId);
  if (!existing) throw new Error("Quiz not found");
  return { ...existing, category: category || undefined, tags: tags || undefined };
}

export async function updateQuizHeaderImage(
  quizId: string,
  header_image_url?: string
): Promise<Quiz> {
  const store = getLocalStore();
  const idx = store.quizzes.findIndex((q) => q.id === quizId);
  if (idx !== -1) {
    store.quizzes[idx].header_image_url = header_image_url || undefined;
    saveLocalStore(store);
    return store.quizzes[idx];
  }
  const existing = await fetchQuizById(quizId);
  if (!existing) throw new Error("Quiz not found");
  return { ...existing, header_image_url };
}

export async function appendQuestionsToQuiz(
  quizId: string,
  additionalQuestions: QuestionItem[]
): Promise<Quiz> {
  const existing = await fetchQuizById(quizId);
  if (!existing) {
    throw new Error("Quiz not found.");
  }

  const updatedRawJson = [...existing.raw_json, ...additionalQuestions];

  const supabase = getSupabaseClient();
  if (supabase) {
    const { data, error } = await supabase
      .from("quizzes")
      .update({ raw_json: updatedRawJson })
      .eq("id", quizId)
      .select()
      .single();

    if (!error && data) {
      return data as Quiz;
    }
    console.warn("Supabase update quiz failed, updating local store:", error?.message);
  }

  const store = getLocalStore();
  const quizIdx = store.quizzes.findIndex((q) => q.id === quizId);
  if (quizIdx !== -1) {
    store.quizzes[quizIdx].raw_json = updatedRawJson;
    saveLocalStore(store);
    return store.quizzes[quizIdx];
  }

  return { ...existing, raw_json: updatedRawJson };
}

export async function fetchAttemptsByQuizId(quizId: string): Promise<Attempt[]> {
  await autoFinalizeExpiredSessions(quizId);
  const supabase = getSupabaseClient();
  if (supabase) {
    const { data, error } = await supabase
      .from("attempts")
      .select("*")
      .eq("quiz_id", quizId)
      .order("submitted_at", { ascending: false });
    if (!error && data) {
      return data as Attempt[];
    }
    console.warn("Supabase fetch attempts failed:", error?.message);
  }

  const store = getLocalStore();
  return store.attempts
    .filter((a) => a.quiz_id === quizId)
    .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());
}

export async function fetchAllAttempts(): Promise<Attempt[]> {
  const supabase = getSupabaseClient();
  if (supabase) {
    const { data, error } = await supabase.from("attempts").select("*");
    if (!error && data) {
      return data as Attempt[];
    }
  }
  const store = getLocalStore();
  return store.attempts;
}

export async function insertAttempt(
  quizId: string,
  traineeName: string,
  score: number,
  maxScore: number,
  breakdown?: QuestionBreakdown[],
  answers?: Record<number, string>,
  tab_switches: number = 0,
  mode: "exam" | "practice" = "exam",
  auto_submitted: boolean = false
): Promise<Attempt> {
  const supabase = getSupabaseClient();
  if (supabase) {
    const payload: Record<string, unknown> = {
      quiz_id: quizId,
      trainee_name: traineeName,
      score,
      max_score: maxScore,
      tab_switches,
      auto_submitted,
    };
    // Per user instructions: do NOT save heavy breakdown or answer lists for practice mode
    if (mode === "exam") {
      if (breakdown) payload.breakdown = breakdown;
      if (answers) payload.answers = answers;
    }

    let { data, error } = await supabase
      .from("attempts")
      .insert([payload])
      .select()
      .single();

    if (error && error.message?.includes("column")) {
      // Fallback if remote schema doesn't yet have tab_switches or auto_submitted column
      const fallbackPayload: Record<string, unknown> = {
        quiz_id: quizId,
        trainee_name: traineeName,
        score,
        max_score: maxScore,
      };
      if (mode === "exam") {
        if (breakdown) fallbackPayload.breakdown = breakdown;
        if (answers) fallbackPayload.answers = answers;
      }

      const fallback = await supabase
        .from("attempts")
        .insert([fallbackPayload])
        .select()
        .single();
      data = fallback.data;
      error = fallback.error;
    }

    if (!error && data) {
      return {
        ...data,
        breakdown: mode === "exam" ? breakdown : undefined,
        answers: mode === "exam" ? answers : undefined,
        tab_switches,
        mode,
        auto_submitted,
      } as Attempt;
    }
    console.warn("Supabase insert attempt failed, saving to local store:", error?.message);
  }

  const store = getLocalStore();
  const newAttempt: Attempt = {
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `att-${Date.now()}`,
    quiz_id: quizId,
    trainee_name: traineeName,
    score,
    max_score: maxScore,
    tab_switches,
    mode,
    auto_submitted,
    breakdown: mode === "exam" ? breakdown : undefined,
    answers: mode === "exam" ? answers : undefined,
    submitted_at: new Date().toISOString(),
  };
  store.attempts.unshift(newAttempt);
  saveLocalStore(store);
  return newAttempt;
}

export async function fetchStudentAttempt(
  quizId: string,
  traineeName: string
): Promise<Attempt | null> {
  const cleanName = traineeName.trim().toLowerCase();
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("attempts")
        .select("*")
        .eq("quiz_id", quizId)
        .ilike("trainee_name", cleanName)
        .order("submitted_at", { ascending: false })
        .limit(1);
      if (!error && data && data.length > 0) {
        return data[0] as Attempt;
      }
    } catch (err) {
      console.warn("Supabase fetchStudentAttempt error:", err);
    }
  }

  const store = getLocalStore();
  if (!store.attempts) return null;
  const found = store.attempts.find(
    (a) => a.quiz_id === quizId && a.trainee_name.toLowerCase() === cleanName
  );
  return found || null;
}

export async function fetchStudentActiveSession(
  quizId: string,
  traineeName: string
): Promise<ActiveStudentSession | null> {
  const cleanName = traineeName.trim().toLowerCase();
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("live_sessions")
        .select("*")
        .eq("quiz_id", quizId)
        .ilike("trainee_name", cleanName)
        .order("last_active", { ascending: false })
        .limit(1);
      if (!error && data && data.length > 0) {
        return data[0] as ActiveStudentSession;
      }
    } catch (err) {
      console.warn("Supabase fetchStudentActiveSession error:", err);
    }
  }

  const store = getLocalStore();
  if (!store.live_sessions) return null;
  const found = store.live_sessions.find(
    (s) => s.quiz_id === quizId && s.trainee_name.toLowerCase() === cleanName
  );
  return found || null;
}

export async function saveStudentSessionProgress(
  quizId: string,
  traineeName: string,
  updates: {
    answered_count?: number;
    total_questions?: number;
    current_question_idx?: number;
    answers?: Record<number, string>;
    served_indices?: number[];
    tab_switches?: number;
    status?: "in_progress" | "submitted";
    mode?: "exam" | "practice";
    started_at?: string;
    expires_at?: string;
    auto_submitted?: boolean;
  }
): Promise<ActiveStudentSession> {
  const cleanName = traineeName.trim();
  const now = new Date().toISOString();
  const supabase = getSupabaseClient();

  if (supabase) {
    try {
      const { data: existing } = await supabase
        .from("live_sessions")
        .select("*")
        .eq("quiz_id", quizId)
        .ilike("trainee_name", cleanName)
        .limit(1);

      if (existing && existing.length > 0) {
        const updatePayload: Record<string, unknown> = {
          last_active: now,
          ...updates,
        };
        const { data, error } = await supabase
          .from("live_sessions")
          .update(updatePayload)
          .eq("id", existing[0].id)
          .select()
          .single();

        if (!error && data) {
          return data as ActiveStudentSession;
        }
      } else {
        const insertPayload: Record<string, unknown> = {
          quiz_id: quizId,
          trainee_name: cleanName,
          last_active: now,
          started_at: updates.started_at || now,
          answered_count: updates.answered_count || 0,
          total_questions: updates.total_questions || 0,
          status: updates.status || "in_progress",
          ...updates,
        };
        const { data, error } = await supabase
          .from("live_sessions")
          .insert([insertPayload])
          .select()
          .single();

        if (!error && data) {
          return data as ActiveStudentSession;
        }
      }
    } catch (err) {
      console.warn("Supabase saveStudentSessionProgress error:", err);
    }
  }

  const store = getLocalStore();
  if (!store.live_sessions) {
    store.live_sessions = [];
  }

  const existingIdx = store.live_sessions.findIndex(
    (s) => s.quiz_id === quizId && s.trainee_name.toLowerCase() === cleanName.toLowerCase()
  );

  if (existingIdx !== -1) {
    const existing = store.live_sessions[existingIdx];
    store.live_sessions[existingIdx] = {
      ...existing,
      ...updates,
      last_active: now,
      started_at: existing.started_at || updates.started_at || now,
    };
    saveLocalStore(store);
    return store.live_sessions[existingIdx];
  } else {
    const newSession: ActiveStudentSession = {
      id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `sess-${Date.now()}`,
      quiz_id: quizId,
      trainee_name: cleanName,
      answered_count: updates.answered_count || (updates.answers ? Object.keys(updates.answers).length : 0),
      total_questions: updates.total_questions || 0,
      status: updates.status || "in_progress",
      tab_switches: updates.tab_switches || 0,
      last_active: now,
      started_at: updates.started_at || now,
      expires_at: updates.expires_at,
      current_question_idx: updates.current_question_idx || 0,
      answers: updates.answers || {},
      served_indices: updates.served_indices,
      mode: updates.mode || "exam",
      auto_submitted: updates.auto_submitted,
    };
    store.live_sessions.unshift(newSession);
    saveLocalStore(store);
    return newSession;
  }
}

export async function recordStudentHeartbeat(
  quizId: string,
  traineeName: string,
  answeredCount: number,
  totalQuestions: number,
  status: "in_progress" | "submitted" = "in_progress",
  tabSwitches: number = 0
): Promise<ActiveStudentSession> {
  return saveStudentSessionProgress(quizId, traineeName, {
    answered_count: answeredCount,
    total_questions: totalQuestions,
    status,
    tab_switches: tabSwitches,
  });
}

export async function autoFinalizeExpiredSessions(quizId?: string): Promise<Attempt[]> {
  const nowMs = Date.now();
  const autoSubmittedAttempts: Attempt[] = [];

  // 1. Fetch relevant quizzes to grade against
  const allQuizzes = await fetchAllQuizzes();
  const quizzesMap = new Map<string, Quiz>();
  for (const q of allQuizzes) {
    quizzesMap.set(q.id, q);
  }

  // 2. Fetch live sessions
  let sessionsToEvaluate: ActiveStudentSession[] = [];
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      let query = supabase.from("live_sessions").select("*").eq("status", "in_progress");
      if (quizId) {
        query = query.eq("quiz_id", quizId);
      }
      const { data, error } = await query;
      if (!error && data) {
        sessionsToEvaluate = data as ActiveStudentSession[];
      }
    } catch (err) {
      console.warn("Supabase fetch expired sessions error:", err);
    }
  }

  const store = getLocalStore();
  if (store.live_sessions) {
    const localMatches = store.live_sessions.filter((s) => {
      if (s.status !== "in_progress") return false;
      if (quizId && s.quiz_id !== quizId) return false;
      return true;
    });
    for (const ls of localMatches) {
      if (!sessionsToEvaluate.some((s) => s.id === ls.id || (s.quiz_id === ls.quiz_id && s.trainee_name.toLowerCase() === ls.trainee_name.toLowerCase()))) {
        sessionsToEvaluate.push(ls);
      }
    }
  }

  for (const session of sessionsToEvaluate) {
    const q = quizzesMap.get(session.quiz_id);
    if (!q) continue;

    // Check if session has an expires_at or calculate from started_at + time_limit_minutes
    let isExpired = false;

    if (session.expires_at) {
      const expMs = new Date(session.expires_at).getTime();
      if (!isNaN(expMs) && expMs <= nowMs) {
        isExpired = true;
      }
    } else if (q.time_limit_minutes && q.time_limit_minutes > 0) {
      const startMs = session.started_at ? new Date(session.started_at).getTime() : new Date(session.last_active).getTime();
      const limitMs = q.time_limit_minutes * 60 * 1000;
      if (!isNaN(startMs) && startMs + limitMs <= nowMs) {
        isExpired = true;
      }
    }

    if (isExpired) {
      // Check if attempt already exists to prevent duplicate submission
      const existingAttempt = await fetchStudentAttempt(session.quiz_id, session.trainee_name);
      if (existingAttempt) {
        await saveStudentSessionProgress(session.quiz_id, session.trainee_name, {
          status: "submitted",
          auto_submitted: true,
        });
        continue;
      }

      // Grade the saved answers
      const allQuestions = q.raw_json;
      const userAnswers = session.answers || {};
      const indicesToGrade =
        session.served_indices && session.served_indices.length > 0
          ? session.served_indices
          : allQuestions.map((_, idx) => idx);

      const maxScore = indicesToGrade.length;
      let score = 0;

      const breakdown = indicesToGrade.map((origIdx, servedIdx) => {
        const item = allQuestions[origIdx];
        const selected = userAnswers[servedIdx] || "";
        const isCorrect = Boolean(item && selected.trim() === item.correct_answer.trim());
        if (isCorrect) score += 1;
        return {
          questionIndex: servedIdx,
          originalIndex: origIdx,
          question: item?.question || `Question ${servedIdx + 1}`,
          selectedAnswer: selected,
          correctAnswer: item?.correct_answer || "",
          isCorrect,
          explanation: item?.explanation,
        };
      });

      // Insert auto-submitted attempt
      const newAttempt = await insertAttempt(
        session.quiz_id,
        session.trainee_name,
        score,
        maxScore,
        breakdown,
        userAnswers,
        session.tab_switches || 0,
        session.mode || "exam",
        true // auto_submitted = true
      );

      // Update session status
      await saveStudentSessionProgress(session.quiz_id, session.trainee_name, {
        status: "submitted",
        auto_submitted: true,
        answered_count: Object.keys(userAnswers).length,
      });

      autoSubmittedAttempts.push(newAttempt);
    }
  }

  return autoSubmittedAttempts;
}

export async function fetchLiveStudentSessions(quizId: string): Promise<ActiveStudentSession[]> {
  await autoFinalizeExpiredSessions(quizId);

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const twoMinutesAgo = new Date(Date.now() - 120000).toISOString();
      const { data, error } = await supabase
        .from("live_sessions")
        .select("*")
        .eq("quiz_id", quizId)
        .or(`status.eq.submitted,last_active.gte.${twoMinutesAgo}`)
        .order("last_active", { ascending: false });

      if (!error && data) {
        return data as ActiveStudentSession[];
      }
      if (error && !error.message?.includes("does not exist")) {
        console.warn("Supabase fetchLiveStudentSessions error:", error.message);
      }
    } catch (err) {
      console.warn("Supabase fetchLiveStudentSessions exception:", err);
    }
  }

  const store = getLocalStore();
  if (!store.live_sessions) return [];

  const nowMs = Date.now();
  return store.live_sessions
    .filter((s) => s.quiz_id === quizId)
    .filter((s) => s.status === "submitted" || nowMs - new Date(s.last_active).getTime() < 120000)
    .sort((a, b) => new Date(b.last_active).getTime() - new Date(a.last_active).getTime());
}

export async function deleteQuiz(quizId: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (supabase) {
    await supabase.from("attempts").delete().eq("quiz_id", quizId);
    await supabase.from("live_sessions").delete().eq("quiz_id", quizId);
    const { error } = await supabase.from("quizzes").delete().eq("id", quizId);
    if (error) {
      console.warn("Supabase delete quiz failed, falling back to local store:", error.message);
    }
  }

  const store = getLocalStore();
  store.quizzes = store.quizzes.filter((q) => q.id !== quizId);
  store.attempts = store.attempts.filter((a) => a.quiz_id !== quizId);
  if (store.live_sessions) {
    store.live_sessions = store.live_sessions.filter((s) => s.quiz_id !== quizId);
  }
  saveLocalStore(store);
  return true;
}

export async function deleteAttempt(attemptId: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (supabase) {
    const { error } = await supabase.from("attempts").delete().eq("id", attemptId);
    if (error) {
      console.warn("Supabase delete attempt failed, falling back to local store:", error.message);
    }
  }

  const store = getLocalStore();
  store.attempts = store.attempts.filter((a) => a.id !== attemptId);
  saveLocalStore(store);
  return true;
}

export async function clearAttemptsForQuiz(quizId: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (supabase) {
    await supabase.from("attempts").delete().eq("quiz_id", quizId);
    await supabase.from("live_sessions").delete().eq("quiz_id", quizId);
    const { error } = await supabase.from("attempts").delete().eq("quiz_id", quizId);
    if (error) {
      console.warn("Supabase clear attempts failed, falling back to local store:", error.message);
    }
  }

  const store = getLocalStore();
  store.attempts = store.attempts.filter((a) => a.quiz_id !== quizId);
  if (store.live_sessions) {
    store.live_sessions = store.live_sessions.filter((s) => s.quiz_id !== quizId);
  }
  saveLocalStore(store);
  return true;
}


