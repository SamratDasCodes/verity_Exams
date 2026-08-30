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
  deleteQuiz,
  deleteAttempt,
  clearAttemptsForQuiz,
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
  headerImageUrl?: string
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
    const createdQuiz = await insertQuiz(cleanTitle, validation.data, headerImageUrl?.trim() || undefined);
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

// 1b. Append Additional Questions to Existing Quiz (Admin only)
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

// 4. Fetch Public Quiz for Trainee (Anti-cheat: strips out correct_answer, supports subset count & time limit)
export async function getPublicQuizAction(
  quizId: string,
  countParam?: number,
  timeParam?: number
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

    // Strip out correct_answer so students cannot peek inside DevTools Network response
    const allSanitized: PublicQuestionItem[] = quiz.raw_json.map((item, originalIndex) => ({
      id: item.id || `q_${originalIndex}`,
      originalIndex,
      question: item.question,
      options: item.options,
      topic: item.topic,
    }));

    let questionsToServe = allSanitized;
    const requestedCount = countParam && countParam > 0 ? countParam : undefined;

    // Stratified topic quotas sampling
    if (quiz.topic_quotas && Object.keys(quiz.topic_quotas).length > 0 && !requestedCount) {
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
      time_limit_minutes: timeParam && timeParam > 0 ? timeParam : quiz.time_limit_minutes,
      header_image_url: quiz.header_image_url,
      topic_quotas: quiz.topic_quotas,
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
  tabSwitches: number = 0
): Promise<{
  success: boolean;
  result?: SubmissionResult;
  error?: string;
}> {
  const cleanName = traineeName?.trim();
  if (!cleanName) {
    return { success: false, error: "Trainee name is required before submission." };
  }

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
      tabSwitches
    );
    // Mark live proctoring session as submitted
    await recordStudentHeartbeat(quizId, cleanName, maxScore, maxScore, "submitted", tabSwitches);

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
        breakdown,
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

    for (const id of sourceQuizIds) {
      const q = await fetchQuizById(id);
      if (q && Array.isArray(q.raw_json)) {
        for (const item of q.raw_json) {
          rawQuestions.push({
            ...item,
            topic: item.topic || q.title, // Tag with parent quiz title if not already tagged
          });
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

    const newQuiz = await insertQuiz(
      title.trim(),
      finalQuestions,
      headerImageUrl?.trim() || undefined,
      hasQuotas ? topicQuotas : undefined
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


