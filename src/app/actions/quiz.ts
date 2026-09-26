"use server";

import { revalidatePath } from "next/cache";
import { isAuthenticated } from "@/lib/auth";
import {
  fetchAllQuizzes,
  fetchQuizById,
  insertQuiz,
  appendQuestionsToQuiz,
  fetchAttemptsByQuizId,
  fetchAllAttempts,
  insertAttempt,
  recordStudentHeartbeat,
  fetchLiveStudentSessions,
  updateQuizHeaderImage,
  updateQuizCategoryAndTags,
  deleteQuiz,
  deleteAttempt,
  clearAttemptsForQuiz,
  fetchStudentAttempt,
  fetchStudentActiveSession,
  saveStudentSessionProgress,
  autoFinalizeExpiredSessions,
} from "@/lib/supabase/db";
import {
  Quiz,
  QuizPublic,
  QuizWithStats,
  Attempt,
  SubmissionResult,
  ActiveStudentSession,
  QuestionItem,
  PublicQuestionItem,
} from "@/lib/types";
import { validateQuestionJson } from "@/lib/validator";

// 1. Create Quiz Action (Admin only)
export async function createQuizAction(
  title: string,
  rawJsonText: string,
  headerImageUrl?: string,
  category?: string,
  tags?: string[]
): Promise<{ success: boolean; quiz?: Quiz; error?: string }> {
  const isAuth = await isAuthenticated();
  if (!isAuth) {
    return { success: false, error: "Unauthorized. Please log in with the admin PIN." };
  }

  const validation = validateQuestionJson(rawJsonText);
  if (!validation.valid || !validation.data) {
    return { success: false, error: validation.error };
  }

  const cleanTitle = title?.trim() || validation.suggestedTitle;
  if (!cleanTitle) {
    return { success: false, error: "Please enter a title for the quiz." };
  }

  try {
    const cleanCategory = category?.trim() || undefined;
    const cleanTags = tags && tags.length > 0 ? tags.map((t) => t.trim()).filter(Boolean) : undefined;
    const createdQuiz = await insertQuiz(
      cleanTitle,
      validation.data,
      headerImageUrl?.trim() || undefined,
      undefined,
      cleanCategory,
      cleanTags
    );
    try {
      revalidatePath("/dashboard");
    } catch {
      // Ignored outside Next.js request context
    }
    return { success: true, quiz: createdQuiz };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Database error";
    return { success: false, error: `Failed to save quiz: ${message}` };
  }
}

// 1b. Update Quiz Category and Tags (Admin only)
export async function updateQuizCategoryAndTagsAction(
  quizId: string,
  category?: string,
  tags?: string[]
): Promise<{ success: boolean; quiz?: Quiz; error?: string }> {
  const isAuth = await isAuthenticated();
  if (!isAuth) {
    return { success: false, error: "Unauthorized. Please log in with the admin PIN." };
  }

  try {
    const cleanCategory = category?.trim() || undefined;
    const cleanTags = tags ? tags.map((t) => t.trim()).filter(Boolean) : undefined;
    const updated = await updateQuizCategoryAndTags(quizId, cleanCategory, cleanTags);
    try {
      revalidatePath("/dashboard");
    } catch {
      // Ignored outside Next.js request context
    }
    return { success: true, quiz: updated };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Database error";
    return { success: false, error: `Failed to update category and tags: ${message}` };
  }
}

// 1c. Append Additional Questions to Existing Quiz (Admin only)
export async function appendQuestionsAction(
  quizId: string,
  rawJsonText: string
): Promise<{ success: boolean; quiz?: Quiz; addedCount?: number; error?: string }> {
  const isAuth = await isAuthenticated();
  if (!isAuth) {
    return { success: false, error: "Unauthorized. Please log in with the admin PIN." };
  }

  if (!quizId) {
    return { success: false, error: "Quiz ID is required." };
  }

  const validation = validateQuestionJson(rawJsonText);
  if (!validation.valid || !validation.data) {
    return { success: false, error: validation.error };
  }

  try {
    const updatedQuiz = await appendQuestionsToQuiz(quizId, validation.data);
    revalidatePath("/dashboard");
    revalidatePath(`/quiz/${quizId}`);
    return {
      success: true,
      quiz: updatedQuiz,
      addedCount: validation.data.length,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Database error";
    return { success: false, error: `Failed to append questions: ${message}` };
  }
}

// 2. Fetch Quizzes with attendee count and average score (Admin only)
export async function getDashboardQuizzesAction(): Promise<{
  success: boolean;
  quizzes?: QuizWithStats[];
  error?: string;
}> {
  const isAuth = await isAuthenticated();
  if (!isAuth) {
    return { success: false, error: "Unauthorized." };
  }

  try {
    const quizzes = await fetchAllQuizzes();
    const attempts = await fetchAllAttempts();

    const quizzesWithStats: QuizWithStats[] = quizzes.map((q) => {
      const quizAttempts = attempts.filter((a) => a.quiz_id === q.id);
      const total_attempts = quizAttempts.length;
      const totalScore = quizAttempts.reduce((acc, a) => acc + a.score, 0);
      const average_score = total_attempts > 0 ? Number((totalScore / total_attempts).toFixed(1)) : 0;

      return {
        ...q,
        total_attempts,
        average_score,
      };
    });

    return { success: true, quizzes: quizzesWithStats };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error fetching quizzes";
    return { success: false, error: message };
  }
}

// 3. Fetch Quiz Analytics (Admin only)
export async function getQuizAnalyticsAction(quizId: string): Promise<{
  success: boolean;
  quiz?: Quiz;
  attempts?: Attempt[];
  error?: string;
}> {
  const isAuth = await isAuthenticated();
  if (!isAuth) {
    return { success: false, error: "Unauthorized." };
  }

  try {
    const quiz = await fetchQuizById(quizId);
    if (!quiz) {
      return { success: false, error: "Quiz not found." };
    }
    const attempts = await fetchAttemptsByQuizId(quizId);
    return { success: true, quiz, attempts };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error fetching analytics";
    return { success: false, error: message };
  }
}

function shuffleArray<T>(array: T[]): T[] {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// 4. Fetch Public Quiz for Trainee (Anti-cheat: strips out correct_answer in exam mode, supports subset count & time limit)
export async function getPublicQuizAction(
  quizId: string,
  countParam?: number,
  timeParam?: number,
  modeParam?: string
): Promise<{
  success: boolean;
  quiz?: QuizPublic;
  error?: string;
}> {
  try {
    const quiz = await fetchQuizById(quizId);
    if (!quiz) {
      return { success: false, error: "Quiz not found or may have been removed." };
    }

    const isPractice = modeParam === "practice";

    // In exam mode, strip out correct_answer so students cannot peek inside DevTools Network response.
    // In practice mode, include correct_answer and explanation so interactive learning is instant and smooth!
    const allSanitized: PublicQuestionItem[] = quiz.raw_json.map((item, originalIndex) => ({
      id: item.id || `q_${originalIndex}`,
      originalIndex,
      question: item.question,
      options: item.options,
      topic: item.topic,
      ...(isPractice ? {
        correct_answer: item.correct_answer,
        explanation: item.explanation,
      } : {}),
    }));

    let questionsToServe = allSanitized;
    const requestedCount = countParam && countParam > 0 ? countParam : undefined;

    // Stratified topic quotas sampling (for exam mode)
    if (!isPractice && quiz.topic_quotas && Object.keys(quiz.topic_quotas).length > 0 && !requestedCount) {
      const topicGroups: Record<string, PublicQuestionItem[]> = {};
      for (const item of allSanitized) {
        const top = item.topic || "General";
        if (!topicGroups[top]) topicGroups[top] = [];
        topicGroups[top].push(item);
      }

      const stratifiedSelection: PublicQuestionItem[] = [];
      for (const [top, quota] of Object.entries(quiz.topic_quotas)) {
        const available = topicGroups[top] || [];
        if (available.length > 0 && quota > 0) {
          const sampled = shuffleArray(available).slice(0, quota);
          stratifiedSelection.push(...sampled);
        }
      }

      if (stratifiedSelection.length > 0) {
        questionsToServe = shuffleArray(stratifiedSelection);
      }
    } else if (requestedCount && requestedCount < allSanitized.length) {
      questionsToServe = shuffleArray(allSanitized).slice(0, requestedCount);
    }

    const publicQuiz: QuizPublic = {
      id: quiz.id,
      created_at: quiz.created_at,
      title: quiz.title,
      questions: questionsToServe,
      total_questions: questionsToServe.length,
      total_pool_size: allSanitized.length,
      time_limit_minutes: isPractice ? undefined : (timeParam && timeParam > 0 ? timeParam : quiz.time_limit_minutes),
      header_image_url: quiz.header_image_url,
      topic_quotas: quiz.topic_quotas,
      mode: isPractice ? "practice" : "exam",
    };

    return { success: true, quiz: publicQuiz };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error loading quiz";
    return { success: false, error: message };
  }
}

// 5. Submit Trainee Quiz Attempt (Secure server-side grading)
export async function submitQuizAttemptAction(
  quizId: string,
  traineeName: string,
  userAnswers: Record<number, string>,
  servedOriginalIndices?: number[],
  tabSwitches: number = 0,
  mode: "exam" | "practice" = "exam",
  auto_submitted: boolean = false,
  auto_submitted_reason?: "time_expired" | "tab_switches_exceeded"
): Promise<{
  success: boolean;
  result?: SubmissionResult;
  error?: string;
}> {
  const cleanName = traineeName?.trim();
  if (!cleanName) {
    return { success: false, error: "Trainee name is required before submission." };
  }

  const effectiveReason: "time_expired" | "tab_switches_exceeded" | undefined =
    auto_submitted_reason || (auto_submitted && tabSwitches >= 10 ? "tab_switches_exceeded" : auto_submitted ? "time_expired" : undefined);

  try {
    const quiz = await fetchQuizById(quizId);
    if (!quiz) {
      return { success: false, error: "Quiz not found." };
    }

    const allQuestions = quiz.raw_json;
    const indicesToGrade =
      servedOriginalIndices && servedOriginalIndices.length > 0
        ? servedOriginalIndices
        : allQuestions.map((_, idx) => idx);

    const maxScore = indicesToGrade.length;
    let score = 0;

    const breakdown = indicesToGrade.map((origIdx, servedIdx) => {
      const q = allQuestions[origIdx];
      const selected = userAnswers[servedIdx] || "";
      const isCorrect = Boolean(q && selected.trim() === q.correct_answer.trim());
      if (isCorrect) {
        score += 1;
      }
      return {
        questionIndex: servedIdx,
        originalIndex: origIdx,
        question: q?.question || `Question ${servedIdx + 1}`,
        selectedAnswer: selected,
        correctAnswer: q?.correct_answer || "",
        isCorrect,
        explanation: q?.explanation,
      };
    });

    const savedAttempt = await insertAttempt(
      quizId,
      cleanName,
      score,
      maxScore,
      breakdown,
      userAnswers,
      tabSwitches,
      mode,
      auto_submitted,
      effectiveReason
    );
    // Mark live proctoring session as submitted
    await saveStudentSessionProgress(quizId, cleanName, {
      status: "submitted",
      auto_submitted,
      auto_submitted_reason: effectiveReason,
      answered_count: maxScore,
      total_questions: maxScore,
      tab_switches: tabSwitches,
    });

    const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

    return {
      success: true,
      result: {
        attemptId: savedAttempt.id,
        traineeName: cleanName,
        score,
        maxScore,
        percentage,
        tab_switches: tabSwitches,
        mode,
        breakdown,
        auto_submitted,
        auto_submitted_reason: effectiveReason,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to submit attempt";
    return { success: false, error: message };
  }
}

// 6. Record Student Progress Heartbeat (Live Proctoring)
export async function recordStudentHeartbeatAction(
  quizId: string,
  traineeName: string,
  answeredCount: number,
  totalQuestions: number,
  status: "in_progress" | "submitted" = "in_progress",
  tabSwitches: number = 0
): Promise<{ success: boolean; session?: ActiveStudentSession; error?: string }> {
  if (!quizId || !traineeName?.trim()) {
    return { success: false, error: "Missing required parameters" };
  }
  try {
    const session = await recordStudentHeartbeat(
      quizId,
      traineeName,
      answeredCount,
      totalQuestions,
      status,
      tabSwitches
    );
    return { success: true, session };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error updating heartbeat";
    return { success: false, error: message };
  }
}

// 6a. Check Existing Student Session on Login / Re-login
export async function checkStudentSessionAction(
  quizId: string,
  traineeName: string
): Promise<{
  success: boolean;
  status: "none" | "in_progress" | "completed" | "auto_submitted";
  session?: ActiveStudentSession;
  attempt?: Attempt;
  submissionResult?: SubmissionResult;
  secondsLeft?: number;
  message?: string;
  error?: string;
}> {
  if (!quizId || !traineeName?.trim()) {
    return { success: false, status: "none", error: "Missing quizId or traineeName" };
  }
  const cleanName = traineeName.trim();
  try {
    // 1. Auto-finalize any sessions that expired
    await autoFinalizeExpiredSessions(quizId);

    // 2. Check if a completed attempt exists
    const completedAttempt = await fetchStudentAttempt(quizId, cleanName);
    if (completedAttempt) {
      const isAuto = Boolean(completedAttempt.auto_submitted);
      const isCheating =
        completedAttempt.auto_submitted_reason === "tab_switches_exceeded" ||
        (completedAttempt.tab_switches && completedAttempt.tab_switches >= 10);

      const message = isCheating
        ? "🚨 Disqualified: You previously accessed this assessment and exceeded 10 tab switches. Your exam was terminated and submitted for cheating."
        : isAuto
        ? "⚠️ Time Expired: You previously started this exam and left without submitting. Your exam was automatically finalized and submitted when the allocated due time expired."
        : `Assessment Completed: You have already completed and submitted this assessment on ${new Date(
            completedAttempt.submitted_at
          ).toLocaleDateString()}.`;

      return {
        success: true,
        status: isAuto ? "auto_submitted" : "completed",
        attempt: completedAttempt,
        submissionResult: {
          attemptId: completedAttempt.id,
          traineeName: completedAttempt.trainee_name,
          score: completedAttempt.score,
          maxScore: completedAttempt.max_score,
          percentage:
            completedAttempt.max_score > 0
              ? Math.round((completedAttempt.score / completedAttempt.max_score) * 100)
              : 0,
          tab_switches: completedAttempt.tab_switches,
          mode: completedAttempt.mode,
          breakdown: completedAttempt.breakdown || [],
          auto_submitted: isAuto,
          auto_submitted_reason: isCheating ? "tab_switches_exceeded" : isAuto ? "time_expired" : undefined,
        },
        message,
      };
    }

    // 3. Check for an in-progress session
    const activeSession = await fetchStudentActiveSession(quizId, cleanName);
    if (activeSession && activeSession.status === "in_progress") {
      // If student has 10 or more tab switches, finalize immediately
      if (activeSession.tab_switches && activeSession.tab_switches >= 10) {
        await autoFinalizeExpiredSessions(quizId);
        const autoAttempt = await fetchStudentAttempt(quizId, cleanName);
        if (autoAttempt) {
          return {
            success: true,
            status: "auto_submitted",
            attempt: autoAttempt,
            submissionResult: {
              attemptId: autoAttempt.id,
              traineeName: autoAttempt.trainee_name,
              score: autoAttempt.score,
              maxScore: autoAttempt.max_score,
              percentage:
                autoAttempt.max_score > 0
                  ? Math.round((autoAttempt.score / autoAttempt.max_score) * 100)
                  : 0,
              tab_switches: autoAttempt.tab_switches,
              mode: autoAttempt.mode,
              breakdown: autoAttempt.breakdown || [],
              auto_submitted: true,
              auto_submitted_reason: "tab_switches_exceeded",
            },
            message:
              "🚨 Disqualified: Exam Terminated for Cheating. You exceeded 10 tab switches.",
          };
        }
      }

      let secondsLeft: number | undefined = undefined;
      if (activeSession.expires_at) {
        const expMs = new Date(activeSession.expires_at).getTime();
        const diffSec = Math.round((expMs - Date.now()) / 1000);
        if (diffSec <= 0) {
          // Time expired right now, run auto finalize
          await autoFinalizeExpiredSessions(quizId);
          const autoAttempt = await fetchStudentAttempt(quizId, cleanName);
          if (autoAttempt) {
            return {
              success: true,
              status: "auto_submitted",
              attempt: autoAttempt,
              submissionResult: {
                attemptId: autoAttempt.id,
                traineeName: autoAttempt.trainee_name,
                score: autoAttempt.score,
                maxScore: autoAttempt.max_score,
                percentage:
                  autoAttempt.max_score > 0
                    ? Math.round((autoAttempt.score / autoAttempt.max_score) * 100)
                    : 0,
                tab_switches: autoAttempt.tab_switches,
                mode: autoAttempt.mode,
                breakdown: autoAttempt.breakdown || [],
                auto_submitted: true,
                auto_submitted_reason: "time_expired",
              },
              message:
                "⚠️ Time Expired: Your allocated exam time has passed. Your answers have been automatically submitted.",
            };
          }
        }
        secondsLeft = Math.max(1, diffSec);
      }

      const answeredCount = activeSession.answers ? Object.keys(activeSession.answers).length : 0;
      return {
        success: true,
        status: "in_progress",
        session: activeSession,
        secondsLeft,
        message: `Welcome back, ${activeSession.trainee_name}! We found your in-progress exam. Resuming from Question ${
          (activeSession.current_question_idx || 0) + 1
        } with ${answeredCount} saved answers.`,
      };
    }

    return { success: true, status: "none" };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error checking student session";
    return { success: false, status: "none", error: message };
  }
}

// 6b. Start / Initialize Active Student Session
export async function startStudentSessionAction(
  quizId: string,
  traineeName: string,
  totalQuestions: number,
  servedIndices: number[],
  timeLimitMinutes?: number,
  mode: "exam" | "practice" = "exam"
): Promise<{ success: boolean; session?: ActiveStudentSession; error?: string }> {
  if (!quizId || !traineeName?.trim()) {
    return { success: false, error: "Missing required parameters" };
  }
  const cleanName = traineeName.trim();
  const now = new Date();
  const expiresAt =
    timeLimitMinutes && timeLimitMinutes > 0
      ? new Date(now.getTime() + timeLimitMinutes * 60 * 1000).toISOString()
      : undefined;

  try {
    const session = await saveStudentSessionProgress(quizId, cleanName, {
      total_questions: totalQuestions,
      answered_count: 0,
      current_question_idx: 0,
      answers: {},
      served_indices: servedIndices,
      status: "in_progress",
      mode,
      started_at: now.toISOString(),
      expires_at: expiresAt,
      tab_switches: 0,
    });
    return { success: true, session };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error starting student session";
    return { success: false, error: message };
  }
}

// 6c. Save Student Progress (Called on "Next", Option Select, and Nav)
export async function saveStudentProgressAction(
  quizId: string,
  traineeName: string,
  currentQuestionIdx: number,
  answers: Record<number, string>,
  servedIndices?: number[],
  tabSwitches: number = 0,
  mode: "exam" | "practice" = "exam"
): Promise<{ success: boolean; session?: ActiveStudentSession; error?: string }> {
  if (!quizId || !traineeName?.trim()) {
    return { success: false, error: "Missing required parameters" };
  }
  try {
    const session = await saveStudentSessionProgress(quizId, traineeName.trim(), {
      current_question_idx: currentQuestionIdx,
      answers,
      answered_count: Object.keys(answers).length,
      served_indices: servedIndices,
      tab_switches: tabSwitches,
      mode,
      status: "in_progress",
    });
    return { success: true, session };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error saving student progress";
    return { success: false, error: message };
  }
}

// 7. Fetch Live Proctoring Sessions (Admin only)
export async function getLiveProctoringAction(
  quizId: string
): Promise<{ success: boolean; sessions?: ActiveStudentSession[]; error?: string }> {
  const isAuth = await isAuthenticated();
  if (!isAuth) {
    return { success: false, error: "Unauthorized." };
  }
  try {
    const sessions = await fetchLiveStudentSessions(quizId);
    return { success: true, sessions };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error fetching live sessions";
    return { success: false, error: message };
  }
}

// 8. Update Quiz Header Image / Logo (Admin only)
export async function updateQuizHeaderImageAction(
  quizId: string,
  headerImageUrl?: string
): Promise<{ success: boolean; quiz?: Quiz; error?: string }> {
  const isAuth = await isAuthenticated();
  if (!isAuth) {
    return { success: false, error: "Unauthorized." };
  }
  try {
    const updated = await updateQuizHeaderImage(quizId, headerImageUrl?.trim() || undefined);
    revalidatePath("/dashboard");
    revalidatePath(`/quiz/${quizId}`);
    return { success: true, quiz: updated };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error updating header image";
    return { success: false, error: message };
  }
}

// 9. Delete Entire Question Set (Admin only)
export async function deleteQuizAction(
  quizId: string
): Promise<{ success: boolean; error?: string }> {
  const isAuth = await isAuthenticated();
  if (!isAuth) {
    return { success: false, error: "Unauthorized." };
  }
  try {
    await deleteQuiz(quizId);
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error deleting question set";
    return { success: false, error: message };
  }
}

// 10. Delete Individual Candidate Attempt (Admin only)
export async function deleteAttemptAction(
  attemptId: string
): Promise<{ success: boolean; error?: string }> {
  const isAuth = await isAuthenticated();
  if (!isAuth) {
    return { success: false, error: "Unauthorized." };
  }
  try {
    await deleteAttempt(attemptId);
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error deleting attempt";
    return { success: false, error: message };
  }
}

// 11. Clear All Attempts for Quiz (Admin only)
export async function clearAttemptsForQuizAction(
  quizId: string
): Promise<{ success: boolean; error?: string }> {
  const isAuth = await isAuthenticated();
  if (!isAuth) {
    return { success: false, error: "Unauthorized." };
  }
  try {
    await clearAttemptsForQuiz(quizId);
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error clearing attempts";
    return { success: false, error: message };
  }
}

// 12. Create Combined Quiz from multiple existing quizzes (Admin only)
export async function createCombinedQuizAction(params: {
  title: string;
  sourceQuizIds: string[];
  deduplicate?: boolean;
  topicQuotas?: Record<string, number>;
  headerImageUrl?: string;
}): Promise<{
  success: boolean;
  quiz?: Quiz;
  totalCount?: number;
  deduplicatedCount?: number;
  error?: string;
}> {
  const isAuth = await isAuthenticated();
  if (!isAuth) {
    return { success: false, error: "Unauthorized." };
  }

  const { title, sourceQuizIds, deduplicate, topicQuotas, headerImageUrl } = params;

  if (!title || !title.trim()) {
    return { success: false, error: "Please provide a title for the combined question set." };
  }

  if (!sourceQuizIds || sourceQuizIds.length < 2) {
    return { success: false, error: "Please select at least 2 question sets to combine." };
  }

  try {
    const rawQuestions: QuestionItem[] = [];
    const sourceCategories = new Set<string>();
    const sourceTags = new Set<string>();
    sourceTags.add("Combined");

    for (const id of sourceQuizIds) {
      const q = await fetchQuizById(id);
      if (q) {
        if (q.category && q.category.trim()) sourceCategories.add(q.category.trim());
        q.tags?.forEach((t) => {
          if (t && t.trim()) sourceTags.add(t.trim());
        });
        if (Array.isArray(q.raw_json)) {
          for (const item of q.raw_json) {
            rawQuestions.push({
              ...item,
              topic: item.topic || q.title, // Tag with parent quiz title if not already tagged
            });
          }
        }
      }
    }

    if (rawQuestions.length === 0) {
      return { success: false, error: "The selected question sets contain no questions." };
    }

    let finalQuestions = rawQuestions;
    let deduplicatedCount = 0;

    if (deduplicate) {
      const seen = new Set<string>();
      finalQuestions = [];
      for (const item of rawQuestions) {
        const norm = item.question.trim().toLowerCase();
        if (!seen.has(norm)) {
          seen.add(norm);
          finalQuestions.push(item);
        } else {
          deduplicatedCount++;
        }
      }
    }

    const hasQuotas = topicQuotas && Object.values(topicQuotas).some((v) => v > 0);

    const mergedCategory = sourceCategories.size === 1 ? Array.from(sourceCategories)[0] : undefined;
    const mergedTags = Array.from(sourceTags);

    const newQuiz = await insertQuiz(
      title.trim(),
      finalQuestions,
      headerImageUrl?.trim() || undefined,
      hasQuotas ? topicQuotas : undefined,
      mergedCategory,
      mergedTags
    );

    try {
      revalidatePath("/dashboard");
    } catch {
      // Ignored outside Next.js request context
    }
    return {
      success: true,
      quiz: newQuiz,
      totalCount: finalQuestions.length,
      deduplicatedCount,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error creating combined quiz";
    return { success: false, error: message };
  }
}


