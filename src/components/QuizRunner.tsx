"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import confetti from "canvas-confetti";
import {
  X,
  Menu,
  Bookmark,
  Check,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Trophy,
  Award,
  RotateCcw,
  User,
  LayoutGrid,
  Sparkles,
  AlertTriangle,
  ShieldAlert,
  Clock,
  Maximize2,
  AlertCircle,
  HelpCircle,
  Sun,
  Moon,
  Lightbulb,
  Sliders,
  BookOpen,
} from "lucide-react";
import {
  submitQuizAttemptAction,
  recordStudentHeartbeatAction,
  checkStudentSessionAction,
  startStudentSessionAction,
  saveStudentProgressAction,
} from "@/app/actions/quiz";
import { QuizPublic, SubmissionResult, PublicQuestionItem } from "@/lib/types";

interface QuizRunnerProps {
  quiz: QuizPublic;
}

export default function QuizRunner({ quiz }: QuizRunnerProps) {
  const isPracticeMode = quiz.mode === "practice";

  // Theme state: dark mode toggle
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("verity_exam_theme", next ? "dark" : "light");
      } catch {}
      return next;
    });
  };

  // Practice Mode: unique topics in the pool
  const availableTopics = useMemo(() => {
    const map = new Map<string, number>();
    quiz.questions.forEach((q) => {
      const t = q.topic?.trim() || "General";
      map.set(t, (map.get(t) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }, [quiz.questions]);

  const [selectedTopics, setSelectedTopics] = useState<string[]>(() => {
    return availableTopics.map((t) => t.name);
  });

  const matchingQuestions = useMemo(() => {
    if (selectedTopics.length === availableTopics.length) {
      return quiz.questions;
    }
    return quiz.questions.filter((q) => {
      const t = q.topic?.trim() || "General";
      return selectedTopics.includes(t);
    });
  }, [quiz.questions, selectedTopics, availableTopics.length]);

  const [practiceQuestionCount, setPracticeQuestionCount] = useState<number>(() => {
    const total = quiz.questions.length;
    if (total <= 10) return total;
    if (total <= 25) return 10;
    return Math.min(20, total);
  });

  const [instantFeedback, setInstantFeedback] = useState<boolean>(true);

  // Tab-Switch & Focus Loss tracking (Anti-Cheat Proctoring)
  const [tabSwitches, setTabSwitches] = useState<number>(0);
  const [tabWarning, setTabWarning] = useState<string | null>(null);
  const lastSwitchTimestampRef = useRef<number>(0);

  // Freeze exam questions in local state so Next.js server revalidations NEVER change questions mid-exam
  const [examQuestions, setExamQuestions] = useState<PublicQuestionItem[]>(quiz.questions);

  const [step, setStep] = useState<"name_prompt" | "in_progress" | "completed">("name_prompt");

  const [traineeName, setTraineeName] = useState("");

  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);

  const [answers, setAnswers] = useState<Record<number, string>>({});

  const [markedForReview, setMarkedForReview] = useState<Record<number, boolean>>({});

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<SubmissionResult | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [refreshWarning, setRefreshWarning] = useState(false);
  const [fullscreenWarning, setFullscreenWarning] = useState(false);
  const [resumedNotice, setResumedNotice] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(false);

  // -------------------------------------------------------------
  // Configurable Exam Timer
  // -------------------------------------------------------------
  const totalDurationSeconds = (quiz.time_limit_minutes || 0) * 60;
  const [secondsLeft, setSecondsLeft] = useState<number | null>(() => {
    if (!quiz.time_limit_minutes || quiz.time_limit_minutes <= 0) return null;
    return quiz.time_limit_minutes * 60;
  });

  // Client-side hydration: safely restore any active exam session from sessionStorage after mount
  useEffect(() => {
    try {
      if (localStorage.getItem("verity_exam_theme") === "dark") {
        setIsDarkMode(true);
      }
      const savedStep = sessionStorage.getItem(`active_exam_step_${quiz.id}`);
      if (savedStep === "in_progress") {
        const cached = sessionStorage.getItem(`active_exam_questions_${quiz.id}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setExamQuestions(parsed);
          }
        }
        const savedName = sessionStorage.getItem(`active_exam_name_${quiz.id}`);
        if (savedName) setTraineeName(savedName);
        const savedAnswers = sessionStorage.getItem(`active_exam_answers_${quiz.id}`);
        if (savedAnswers) setAnswers(JSON.parse(savedAnswers));
        const savedMarked = sessionStorage.getItem(`active_exam_marked_${quiz.id}`);
        if (savedMarked) setMarkedForReview(JSON.parse(savedMarked));
        const storedSwitches = sessionStorage.getItem(`active_exam_tab_switches_${quiz.id}`);
        if (storedSwitches) setTabSwitches(parseInt(storedSwitches, 10) || 0);
        const storedTime = sessionStorage.getItem(`active_exam_time_${quiz.id}`);
        if (storedTime) {
          const parsedTime = parseInt(storedTime, 10);
          if (!isNaN(parsedTime) && parsedTime >= 0) setSecondsLeft(parsedTime);
        }
        setStep("in_progress");
      }
    } catch {}
  }, [quiz.id]);

  const totalQuestions = examQuestions.length;
  const currentQuestion = examQuestions[currentQuestionIdx];
  const answeredCount = Object.keys(answers).length;
  const unansweredCount = Math.max(0, totalQuestions - answeredCount);
  const markedCount = Object.values(markedForReview).filter(Boolean).length;
  const isMarked = Boolean(markedForReview[currentQuestionIdx]);

  // Request Full-Screen
  const requestFullscreenMode = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
      setFullscreenWarning(false);
    } catch (err) {
      console.warn("Fullscreen request not permitted or user cancelled:", err);
    }
  };

  // Full-Screen listener (only in strict exam mode)
  useEffect(() => {
    if (step !== "in_progress" || isPracticeMode) return;

    const handleFullscreenChange = () => {
      const isCurrentlyFs = Boolean(document.fullscreenElement);
      if (!isCurrentlyFs) {
        setFullscreenWarning(true);
      } else {
        setFullscreenWarning(false);
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [step, isPracticeMode]);

  // Prevent page refresh / reload while exam is in progress (only in strict exam mode)
  useEffect(() => {
    if (step !== "in_progress" || isPracticeMode) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "Exam is in progress! Reloading or leaving may disrupt your assessment.";
      return e.returnValue;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const isF5 = e.key === "F5" || e.keyCode === 116;
      const isCtrlR = (e.ctrlKey || e.metaKey) && (e.key === "r" || e.key === "R" || e.keyCode === 82);

      if (isF5 || isCtrlR) {
        e.preventDefault();
        e.stopPropagation();
        setRefreshWarning(true);
        setTimeout(() => setRefreshWarning(false), 3500);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("keydown", handleKeyDown, true);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [step, isPracticeMode]);

  // Tab-Switch & Focus Loss Anti-Cheat Tracking (only in strict exam mode)
  useEffect(() => {
    if (step !== "in_progress" || isPracticeMode) return;

    const handleFocusLoss = () => {
      const now = Date.now();
      // Debounce rapid visibilitychange + blur triggers
      if (now - lastSwitchTimestampRef.current < 1200) return;
      lastSwitchTimestampRef.current = now;

      setTabSwitches((prev) => {
        const nextCount = prev + 1;
        try {
          sessionStorage.setItem(`active_exam_tab_switches_${quiz.id}`, nextCount.toString());
        } catch {}

        setTabWarning(`⚠️ Attention: Tab switch detected (#${nextCount})! This incident has been logged for the proctor.`);
        setTimeout(() => setTabWarning(null), 5000);

        // Instantly notify proctor live
        if (traineeName) {
          recordStudentHeartbeatAction(
            quiz.id,
            traineeName,
            answeredCount,
            totalQuestions,
            "in_progress",
            nextCount
          );
        }
        return nextCount;
      });
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleFocusLoss();
      }
    };

    const handleWindowBlur = () => {
      // On mobile devices, window.blur fires during touch scrolling, address bar collapse, keyboard changes, etc.
      // If it's a touch device and document is NOT hidden, do not treat it as a tab switch.
      const isTouch = typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0);
      if (isTouch && !document.hidden) {
        return;
      }
      handleFocusLoss();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [step, isPracticeMode, quiz.id, traineeName, answeredCount, totalQuestions]);

  // Timer countdown & Auto-submit
  useEffect(() => {
    if (step !== "in_progress" || secondsLeft === null) return;

    if (secondsLeft <= 0) {
      handleSubmitQuiz();
      return;
    }

    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          handleSubmitQuiz();
          return 0;
        }
        const updated = prev - 1;
        try {
          sessionStorage.setItem(`active_exam_time_${quiz.id}`, updated.toString());
        } catch {}
        return updated;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [step, secondsLeft]);

  // Live Proctoring Heartbeat: pings progress every 6 seconds
  useEffect(() => {
    if (step !== "in_progress" || !traineeName) return;

    // Initial ping
    recordStudentHeartbeatAction(
      quiz.id,
      traineeName,
      answeredCount,
      totalQuestions,
      "in_progress",
      tabSwitches
    );

    const heartbeatTimer = setInterval(() => {
      recordStudentHeartbeatAction(
        quiz.id,
        traineeName,
        answeredCount,
        totalQuestions,
        "in_progress",
        tabSwitches
      );
    }, 6000);

    return () => clearInterval(heartbeatTimer);
  }, [step, traineeName, answeredCount, totalQuestions, quiz.id, tabSwitches]);

  // Trigger confetti upon completion
  useEffect(() => {
    if (step === "completed" && submissionResult) {
      const end = Date.now() + 1.5 * 1000;
      const colors = ["#0056D2", "#10b981", "#f59e0b", "#d9534f"];

      (function frame() {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors,
        });
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors,
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      })();
    }
  }, [step, submissionResult]);

  const handleStartQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = traineeName.trim();
    if (!cleanName) {
      setNameError("Please enter your name to begin.");
      return;
    }
    setNameError(null);
    setCheckingSession(true);

    try {
      const checkRes = await checkStudentSessionAction(quiz.id, cleanName);

      if (checkRes.status === "completed" || checkRes.status === "auto_submitted") {
        if (checkRes.submissionResult) {
          setSubmissionResult(checkRes.submissionResult);
          setStep("completed");
          if (checkRes.message) {
            setResumedNotice(checkRes.message);
          }
          if (typeof window !== "undefined") {
            window.scrollTo({ top: 0, behavior: "smooth" });
          }
          setCheckingSession(false);
          return;
        }
      }

      if (checkRes.status === "in_progress" && checkRes.session) {
        const sess = checkRes.session;
        if (sess.served_indices && sess.served_indices.length > 0) {
          const qMap = new Map(quiz.questions.map((q) => [q.originalIndex, q]));
          const restored = sess.served_indices
            .map((origIdx) => qMap.get(origIdx))
            .filter(Boolean) as PublicQuestionItem[];
          if (restored.length > 0) {
            setExamQuestions(restored);
          }
        }

        const restoredAnswers = sess.answers || {};
        setAnswers(restoredAnswers);
        const restoredIdx = Math.min(
          sess.current_question_idx || 0,
          (sess.served_indices?.length || quiz.questions.length) - 1
        );
        setCurrentQuestionIdx(restoredIdx);
        setTabSwitches(sess.tab_switches || 0);

        if (checkRes.secondsLeft !== undefined) {
          setSecondsLeft(checkRes.secondsLeft);
        }

        try {
          sessionStorage.setItem(`active_exam_name_${quiz.id}`, cleanName);
          sessionStorage.setItem(`active_exam_step_${quiz.id}`, "in_progress");
          sessionStorage.setItem(`active_exam_answers_${quiz.id}`, JSON.stringify(restoredAnswers));
          if (checkRes.secondsLeft !== undefined) {
            sessionStorage.setItem(`active_exam_time_${quiz.id}`, checkRes.secondsLeft.toString());
          }
        } catch {}

        setResumedNotice(checkRes.message || `Resumed session for ${cleanName}.`);
        setTimeout(() => setResumedNotice(null), 8000);
        requestFullscreenMode().catch(() => {});
        setStep("in_progress");
        if (typeof window !== "undefined") {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
        setCheckingSession(false);
        return;
      }

      // Fresh Exam Start
      const servedIndices = examQuestions.map((q) => q.originalIndex);
      await startStudentSessionAction(
        quiz.id,
        cleanName,
        totalQuestions,
        servedIndices,
        quiz.time_limit_minutes,
        "exam"
      );

      requestFullscreenMode().catch(() => {});

      try {
        sessionStorage.setItem(`active_exam_questions_${quiz.id}`, JSON.stringify(examQuestions));
        sessionStorage.setItem(`active_exam_name_${quiz.id}`, cleanName);
        sessionStorage.setItem(`active_exam_step_${quiz.id}`, "in_progress");
        if (quiz.time_limit_minutes) {
          sessionStorage.setItem(`active_exam_time_${quiz.id}`, (quiz.time_limit_minutes * 60).toString());
        }
      } catch {}

      setStep("in_progress");
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (err) {
      console.error("Start quiz session error:", err);
      setStep("in_progress");
    } finally {
      setCheckingSession(false);
    }
  };

  const handleStartPractice = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = traineeName.trim();
    if (!cleanName) {
      setNameError("Please enter your name to begin your practice session.");
      return;
    }
    setNameError(null);
    setCheckingSession(true);

    try {
      const checkRes = await checkStudentSessionAction(quiz.id, cleanName);

      if (checkRes.status === "completed" || checkRes.status === "auto_submitted") {
        if (checkRes.submissionResult) {
          setSubmissionResult(checkRes.submissionResult);
          setStep("completed");
          if (checkRes.message) setResumedNotice(checkRes.message);
          if (typeof window !== "undefined") {
            window.scrollTo({ top: 0, behavior: "smooth" });
          }
          setCheckingSession(false);
          return;
        }
      }

      if (checkRes.status === "in_progress" && checkRes.session) {
        const sess = checkRes.session;
        if (sess.served_indices && sess.served_indices.length > 0) {
          const qMap = new Map(quiz.questions.map((q) => [q.originalIndex, q]));
          const restored = sess.served_indices
            .map((origIdx) => qMap.get(origIdx))
            .filter(Boolean) as PublicQuestionItem[];
          if (restored.length > 0) {
            setExamQuestions(restored);
          }
        }
        const restoredAnswers = sess.answers || {};
        setAnswers(restoredAnswers);
        const restoredIdx = Math.min(
          sess.current_question_idx || 0,
          (sess.served_indices?.length || quiz.questions.length) - 1
        );
        setCurrentQuestionIdx(restoredIdx);

        try {
          sessionStorage.setItem(`active_exam_name_${quiz.id}`, cleanName);
          sessionStorage.setItem(`active_exam_step_${quiz.id}`, "in_progress");
          sessionStorage.setItem(`active_exam_answers_${quiz.id}`, JSON.stringify(restoredAnswers));
        } catch {}

        setResumedNotice(checkRes.message || `Resumed practice drill for ${cleanName}.`);
        setTimeout(() => setResumedNotice(null), 8000);
        setStep("in_progress");
        if (typeof window !== "undefined") {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
        setCheckingSession(false);
        return;
      }

      // Fresh practice session
      const pool = [...matchingQuestions];
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }

      const count = Math.min(Math.max(1, practiceQuestionCount), pool.length);
      const selected = pool.slice(0, count);

      setExamQuestions(selected);
      setCurrentQuestionIdx(0);
      setAnswers({});
      setMarkedForReview({});

      const servedIndices = selected.map((q) => q.originalIndex);
      await startStudentSessionAction(
        quiz.id,
        cleanName,
        selected.length,
        servedIndices,
        undefined,
        "practice"
      );

      try {
        sessionStorage.setItem(`active_exam_questions_${quiz.id}`, JSON.stringify(selected));
        sessionStorage.setItem(`active_exam_name_${quiz.id}`, cleanName);
        sessionStorage.setItem(`active_exam_step_${quiz.id}`, "in_progress");
      } catch {}

      setStep("in_progress");
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (err) {
      console.error("Start practice session error:", err);
      setStep("in_progress");
    } finally {
      setCheckingSession(false);
    }
  };

  const handlePracticeMissedQuestions = () => {
    if (!submissionResult) return;
    const missed = submissionResult.breakdown.filter((b) => !b.isCorrect);
    if (missed.length === 0) return;

    const missedOriginalIndices = new Set(missed.map((m) => m.originalIndex));
    const nextQuestions = quiz.questions.filter((q) => missedOriginalIndices.has(q.originalIndex));

    const toServe = nextQuestions.length > 0 ? nextQuestions : quiz.questions.slice(0, missed.length);
    setExamQuestions(toServe);
    setAnswers({});
    setMarkedForReview({});
    setCurrentQuestionIdx(0);
    setSubmissionResult(null);
    setStep("in_progress");
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    try {
      sessionStorage.setItem(`active_exam_questions_${quiz.id}`, JSON.stringify(toServe));
      sessionStorage.removeItem(`active_exam_answers_${quiz.id}`);
      sessionStorage.removeItem(`active_exam_marked_${quiz.id}`);
      sessionStorage.setItem(`active_exam_step_${quiz.id}`, "in_progress");
    } catch {}
  };

  const handleSelectOption = (option: string) => {
    const updated = {
      ...answers,
      [currentQuestionIdx]: option,
    };
    setAnswers(updated);
    try {
      sessionStorage.setItem(`active_exam_answers_${quiz.id}`, JSON.stringify(updated));
    } catch {}

    // Persist to server on option select
    if (traineeName) {
      saveStudentProgressAction(
        quiz.id,
        traineeName,
        currentQuestionIdx,
        updated,
        examQuestions.map((q) => q.originalIndex),
        tabSwitches,
        isPracticeMode ? "practice" : "exam"
      );
    }
  };

  const toggleMarkForReview = () => {
    setMarkedForReview((prev) => {
      const updated = {
        ...prev,
        [currentQuestionIdx]: !prev[currentQuestionIdx],
      };
      try {
        sessionStorage.setItem(`active_exam_marked_${quiz.id}`, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const handleNext = () => {
    if (currentQuestionIdx < totalQuestions - 1) {
      const nextIdx = currentQuestionIdx + 1;
      setCurrentQuestionIdx(nextIdx);
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }

      // Persist answers on next for future access
      if (traineeName) {
        saveStudentProgressAction(
          quiz.id,
          traineeName,
          nextIdx,
          answers,
          examQuestions.map((q) => q.originalIndex),
          tabSwitches,
          isPracticeMode ? "practice" : "exam"
        );
      }
    }
  };

  const handlePrev = () => {
    if (currentQuestionIdx > 0) {
      const prevIdx = currentQuestionIdx - 1;
      setCurrentQuestionIdx(prevIdx);
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }

      if (traineeName) {
        saveStudentProgressAction(
          quiz.id,
          traineeName,
          prevIdx,
          answers,
          examQuestions.map((q) => q.originalIndex),
          tabSwitches,
          isPracticeMode ? "practice" : "exam"
        );
      }
    }
  };

  const handleSubmitQuiz = async () => {
    setIsReviewModalOpen(false);
    setSubmitError(null);
    setSubmitting(true);

    try {
      const servedIndices = examQuestions.map((q) => q.originalIndex);
      const res = await submitQuizAttemptAction(
        quiz.id,
        traineeName,
        answers,
        servedIndices,
        tabSwitches,
        isPracticeMode ? "practice" : "exam"
      );
      if (res.success && res.result) {
        // Exit fullscreen upon completion
        try {
          if (document.fullscreenElement && document.exitFullscreen) {
            await document.exitFullscreen();
          }
        } catch {}

        // Clear active session storage on successful completion
        try {
          sessionStorage.removeItem(`active_exam_questions_${quiz.id}`);
          sessionStorage.removeItem(`active_exam_name_${quiz.id}`);
          sessionStorage.removeItem(`active_exam_answers_${quiz.id}`);
          sessionStorage.removeItem(`active_exam_marked_${quiz.id}`);
          sessionStorage.removeItem(`active_exam_step_${quiz.id}`);
          sessionStorage.removeItem(`active_exam_time_${quiz.id}`);
          sessionStorage.removeItem(`active_exam_tab_switches_${quiz.id}`);
        } catch {}

        setSubmissionResult(res.result);
        setStep("completed");
        if (typeof window !== "undefined") {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      } else {
        setSubmitError(res.error || "Failed to submit your answers.");
      }
    } catch {
      setSubmitError("Network error while submitting. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetake = () => {
    try {
      sessionStorage.removeItem(`active_exam_questions_${quiz.id}`);
      sessionStorage.removeItem(`active_exam_name_${quiz.id}`);
      sessionStorage.removeItem(`active_exam_answers_${quiz.id}`);
      sessionStorage.removeItem(`active_exam_marked_${quiz.id}`);
      sessionStorage.removeItem(`active_exam_step_${quiz.id}`);
      sessionStorage.removeItem(`active_exam_time_${quiz.id}`);
      sessionStorage.removeItem(`active_exam_tab_switches_${quiz.id}`);
    } catch {}
    setTabSwitches(0);
    setExamQuestions(quiz.questions);
    setAnswers({});
    setMarkedForReview({});
    setCurrentQuestionIdx(0);
    setSubmissionResult(null);
    setSecondsLeft(quiz.time_limit_minutes ? quiz.time_limit_minutes * 60 : null);
    setStep("name_prompt");
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const formatTimeLeft = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    const hh = h > 0 ? `${h.toString().padStart(2, "0")}:` : "";
    const mm = m.toString().padStart(2, "0");
    const ss = s.toString().padStart(2, "0");
    return `${hh}${mm}:${ss}`;
  };

  const timeProgressPct =
    totalDurationSeconds > 0 && secondsLeft !== null
      ? Math.max(0, Math.min(100, Math.round((secondsLeft / totalDurationSeconds) * 100)))
      : 100;

  // -------------------------------------------------------------
  // STAGE 1: Trainee Name Prompt (Full-Screen Entrance)
  // -------------------------------------------------------------
  // STAGE 1: Trainee Name Prompt or Practice Session Customizer
  // -------------------------------------------------------------
  if (step === "name_prompt") {
    if (isPracticeMode) {
      return (
        <div className={`min-h-screen flex flex-col transition-colors duration-200 ${isDarkMode ? "bg-slate-950 text-slate-100" : "bg-[#f3f4f6] text-gray-800"}`}>
          {/* Header */}
          <header className="header-bg text-white shadow-md relative z-20">
            <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
              {quiz.header_image_url ? (
                <img
                  src={quiz.header_image_url}
                  alt={quiz.title}
                  className="h-8 sm:h-9 object-contain max-w-[220px]"
                />
              ) : (
                <div className="text-xl sm:text-2xl font-bold tracking-tight font-serif italic text-white truncate max-w-[250px] sm:max-w-md">
                  {quiz.title}
                </div>
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleDarkMode}
                  title={isDarkMode ? "Switch to Light Theme" : "Switch to Dark Theme"}
                  className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/15 transition flex items-center justify-center"
                >
                  {isDarkMode ? <Sun className="w-5 h-5 text-amber-300" /> : <Moon className="w-5 h-5" />}
                </button>
                <span className="text-xs bg-white/15 px-3 py-1 rounded-full font-medium flex items-center gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5 text-amber-300" />
                  Practice & Drill Mode
                </span>
              </div>
            </div>
          </header>

          <div className="nav-back-bg text-white px-4 py-3 flex items-center text-sm font-medium z-10 relative shadow-inner">
            <div className="max-w-5xl mx-auto w-full flex items-center justify-between">
              <span>Customize Practice Session</span>
              <span className="text-xs text-blue-100">{quiz.title}</span>
            </div>
          </div>

          <main className="flex-1 flex items-center justify-center p-4 py-8">
            <div className={`w-full max-w-lg border rounded-2xl p-6 sm:p-8 shadow-xl transition-colors ${
              isDarkMode ? "bg-slate-900 border-slate-800 text-slate-100" : "bg-white border-gray-200 text-gray-800"
            }`}>
              <div className="text-center mb-6">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto mb-3 font-bold border border-amber-500/20">
                  <Lightbulb className="w-6 h-6" />
                </div>
                <h1 className={`text-2xl font-bold ${isDarkMode ? "text-white" : "text-gray-800"}`}>
                  {quiz.title}
                </h1>
                <p className={`text-xs mt-1 ${isDarkMode ? "text-slate-400" : "text-gray-500"}`}>
                  Customize your self-paced study drill before getting started.
                </p>
              </div>

              <form onSubmit={handleStartPractice} className="space-y-5">
                {/* Student Name */}
                <div>
                  <label className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${isDarkMode ? "text-slate-300" : "text-gray-600"}`}>
                    Your Name <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={traineeName}
                      onChange={(e) => {
                        setTraineeName(e.target.value);
                        if (nameError) setNameError(null);
                      }}
                      placeholder="e.g. Alex Johnson"
                      autoFocus
                      className={`w-full border rounded-xl px-4 py-2.5 pl-11 text-sm focus:outline-none transition ${
                        isDarkMode
                          ? "bg-slate-950 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500"
                          : "bg-gray-50 border-gray-300 text-gray-800 placeholder:text-gray-400 focus:border-[#0056D2] focus:bg-white"
                      }`}
                    />
                    <User className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                  {nameError && (
                    <p className="text-xs text-red-500 font-medium mt-1">{nameError}</p>
                  )}
                </div>

                {/* Question Count Selector */}
                <div className={`p-4 rounded-xl border ${isDarkMode ? "bg-slate-950/60 border-slate-800" : "bg-gray-50/80 border-gray-200"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <label className={`text-xs font-semibold uppercase tracking-wider ${isDarkMode ? "text-slate-300" : "text-gray-700"}`}>
                      Practice Question Count
                    </label>
                    <span className="text-xs font-bold text-[#0056D2] dark:text-blue-400">
                      {practiceQuestionCount} of {matchingQuestions.length} Qs
                    </span>
                  </div>

                  {/* Preset Pills */}
                  <div className="flex items-center gap-1.5 flex-wrap mb-3">
                    {[10, 20, 30, 50]
                      .filter((n) => n < matchingQuestions.length)
                      .map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setPracticeQuestionCount(preset)}
                          className={`text-xs px-3 py-1 rounded-lg border font-semibold transition ${
                            practiceQuestionCount === preset
                              ? "bg-[#0056D2] text-white border-[#0056D2] shadow-sm"
                              : isDarkMode
                                ? "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                                : "bg-white border-gray-300 text-gray-700 hover:bg-gray-100"
                          }`}
                        >
                          {preset} Qs
                        </button>
                      ))}
                    <button
                      type="button"
                      onClick={() => setPracticeQuestionCount(matchingQuestions.length)}
                      className={`text-xs px-3 py-1 rounded-lg border font-semibold transition ${
                        practiceQuestionCount === matchingQuestions.length
                          ? "bg-[#0056D2] text-white border-[#0056D2] shadow-sm"
                          : isDarkMode
                            ? "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                            : "bg-white border-gray-300 text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      All ({matchingQuestions.length})
                    </button>
                  </div>

                  {/* Range Slider */}
                  <input
                    type="range"
                    min={1}
                    max={matchingQuestions.length}
                    value={practiceQuestionCount}
                    onChange={(e) => setPracticeQuestionCount(parseInt(e.target.value, 10))}
                    className="w-full h-2 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#0056D2]"
                  />
                  <div className="flex justify-between text-[11px] text-gray-400 mt-1">
                    <span>1 Q</span>
                    <span>Quick Drill</span>
                    <span>Full Pool ({matchingQuestions.length})</span>
                  </div>
                </div>

                {/* Topic / Chapter Filter (if multiple topics exist) */}
                {availableTopics.length > 1 && (
                  <div className={`p-4 rounded-xl border ${isDarkMode ? "bg-slate-950/60 border-slate-800" : "bg-gray-50/80 border-gray-200"}`}>
                    <div className="flex items-center justify-between mb-2">
                      <label className={`text-xs font-semibold uppercase tracking-wider ${isDarkMode ? "text-slate-300" : "text-gray-700"}`}>
                        Filter by Topic / Chapter
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedTopics.length === availableTopics.length) {
                            setSelectedTopics([availableTopics[0].name]);
                          } else {
                            setSelectedTopics(availableTopics.map((t) => t.name));
                          }
                        }}
                        className="text-[11px] text-[#0056D2] dark:text-blue-400 font-semibold hover:underline"
                      >
                        {selectedTopics.length === availableTopics.length ? "Deselect All" : "Select All"}
                      </button>
                    </div>

                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {availableTopics.map((topic) => {
                        const isChecked = selectedTopics.includes(topic.name);
                        return (
                          <label
                            key={topic.name}
                            className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition ${
                              isChecked
                                ? isDarkMode
                                  ? "bg-blue-950/40 border-blue-800 text-blue-200"
                                  : "bg-blue-50 border-blue-200 text-blue-900"
                                : isDarkMode
                                  ? "border-slate-800 bg-slate-900 text-slate-400"
                                  : "border-gray-200 bg-white text-gray-500"
                            }`}
                          >
                            <span className="flex items-center gap-2 font-medium">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  setSelectedTopics((prev) => {
                                    if (prev.includes(topic.name)) {
                                      if (prev.length === 1) return prev; // At least one topic must remain
                                      return prev.filter((t) => t !== topic.name);
                                    } else {
                                      return [...prev, topic.name];
                                    }
                                  });
                                }}
                                className="rounded text-[#0056D2] focus:ring-0"
                              />
                              <span>{topic.name}</span>
                            </span>
                            <span className="text-[10px] font-bold opacity-75">{topic.count} Qs</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Instant Feedback Toggle */}
                <label className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition ${
                  isDarkMode ? "bg-slate-950/60 border-slate-800 text-slate-300" : "bg-gray-50/80 border-gray-200 text-gray-700"
                }`}>
                  <input
                    type="checkbox"
                    checked={instantFeedback}
                    onChange={(e) => setInstantFeedback(e.target.checked)}
                    className="mt-0.5 rounded text-[#0056D2] focus:ring-0"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-gray-900 dark:text-white block">
                      💡 Instant Answers & Explanations
                    </span>
                    <span className="text-gray-500 dark:text-slate-400 block mt-0.5">
                      Reveal whether your choice is correct and show full explanations after each question.
                    </span>
                  </div>
                </label>

                {/* Friendly Notice */}
                <div className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                  isDarkMode ? "bg-emerald-950/30 border-emerald-800 text-emerald-300" : "bg-emerald-50 border-emerald-200 text-emerald-800"
                }`}>
                  <Sparkles className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>
                    <strong>Zero-Stress Practice</strong>: No timer countdown and no tab-switch tracking. Retry mistakes freely at your own pace!
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={checkingSession}
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#0056D2] to-blue-600 hover:from-[#0045A8] hover:to-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-sm shadow-md transition flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>
                    {checkingSession
                      ? "Verifying Previous Session..."
                      : `Start Practice (${practiceQuestionCount} Questions)`}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>
          </main>
        </div>
      );
    }

    // Standard Strict Examination Entrance
    return (
      <div className={`min-h-screen flex flex-col transition-colors duration-200 ${isDarkMode ? "bg-slate-950 text-slate-100" : "bg-[#f3f4f6] text-gray-800"}`}>
        {/* Header */}
        <header className="header-bg text-white shadow-md relative z-20">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
            {quiz.header_image_url ? (
              <img
                src={quiz.header_image_url}
                alt={quiz.title}
                className="h-8 sm:h-9 object-contain max-w-[220px]"
              />
            ) : (
              <div className="text-xl sm:text-2xl font-bold tracking-tight font-serif italic text-white truncate max-w-[250px] sm:max-w-md">
                {quiz.title}
              </div>
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleDarkMode}
                title={isDarkMode ? "Switch to Light Theme" : "Switch to Dark Theme"}
                className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/15 transition flex items-center justify-center"
              >
                {isDarkMode ? <Sun className="w-5 h-5 text-amber-300" /> : <Moon className="w-5 h-5" />}
              </button>
              <span className="text-xs bg-white/15 px-3 py-1 rounded-full font-medium">
                Online Examination Portal
              </span>
            </div>
          </div>
        </header>

        <div className="nav-back-bg text-white px-4 py-3 flex items-center text-sm font-medium z-10 relative shadow-inner">
          <div className="max-w-5xl mx-auto w-full flex items-center justify-between">
            <span>Assessment Entrance</span>
            <span className="text-xs text-blue-100">{quiz.title}</span>
          </div>
        </div>

        <main className="flex-1 flex items-center justify-center p-4">
          <div className={`w-full max-w-md border rounded-xl p-6 sm:p-8 shadow-md transition-colors ${
            isDarkMode ? "bg-slate-900 border-slate-800 text-slate-100" : "bg-white border-gray-200 text-gray-800"
          }`}>
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-xl bg-[#0056D2]/10 text-[#0056D2] flex items-center justify-center mx-auto mb-3 font-bold">
                <Sparkles className="w-6 h-6" />
              </div>
              <h1 className={`text-2xl font-bold ${isDarkMode ? "text-white" : "text-gray-800"}`}>{quiz.title}</h1>
              <div className="flex items-center justify-center gap-2 mt-2 flex-wrap">
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-50 text-[#0056D2] font-semibold border border-blue-200">
                  {totalQuestions} Questions
                </span>
                {quiz.time_limit_minutes && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold border border-amber-200 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {quiz.time_limit_minutes} Minutes Time Limit
                  </span>
                )}
              </div>
            </div>

            <form onSubmit={handleStartQuiz} className="space-y-4">
              <div>
                <label className={`block text-xs font-semibold uppercase tracking-wider mb-2 ${isDarkMode ? "text-slate-300" : "text-gray-600"}`}>
                  Enter Your Full Name
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={traineeName}
                    onChange={(e) => {
                      setTraineeName(e.target.value);
                      if (nameError) setNameError(null);
                    }}
                    placeholder="e.g. Alex Johnson"
                    autoFocus
                    className={`w-full border rounded-lg px-4 py-3 pl-11 text-sm focus:outline-none transition ${
                      isDarkMode
                        ? "bg-slate-950 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500"
                        : "bg-gray-50 border-gray-300 text-gray-800 placeholder:text-gray-400 focus:border-[#0056D2] focus:bg-white focus:ring-1 focus:ring-[#0056D2]"
                    }`}
                  />
                  <User className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {nameError && (
                <p className="text-xs text-red-500 font-medium">{nameError}</p>
              )}

              {/* Full-screen guidance */}
              <div className={`p-3 border rounded-lg text-xs flex items-start gap-2 ${
                isDarkMode ? "bg-blue-950/40 border-blue-900 text-blue-200" : "bg-blue-50/60 border-blue-200/80 text-blue-900"
              }`}>
                <Maximize2 className="w-4 h-4 text-[#0056D2] shrink-0 mt-0.5" />
                <span>
                  This exam requires <strong>Full-Screen Mode</strong>. Clicking start will launch full-screen mode to ensure exam integrity.
                </span>
              </div>

              <button
                type="submit"
                disabled={checkingSession}
                className="w-full py-3 px-4 rounded-lg bg-[#0056D2] hover:bg-[#0045A8] disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold shadow transition flex items-center justify-center gap-2"
              >
                <span>
                  {checkingSession
                    ? "Checking Previous Session..."
                    : "Enter Full-Screen & Start"}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            <p className="text-[11px] text-gray-400 text-center mt-6">
              Instant auto-grading upon submission. Answer keys are verified server-side.
            </p>
          </div>
        </main>
      </div>
    );
  }

  // -------------------------------------------------------------
  // STAGE 2: Live Question Runner (Generation Theme)
  // -------------------------------------------------------------
  if (step === "in_progress") {
    if (!currentQuestion) {
      return (
        <div className={`min-h-screen flex items-center justify-center p-4 ${isDarkMode ? "bg-slate-950 text-slate-400" : "bg-[#f3f4f6] text-gray-500"}`}>
          <p className="text-sm">Loading questions...</p>
        </div>
      );
    }

    const isLastQuestion = currentQuestionIdx === totalQuestions - 1;

    return (
      <div className={`antialiased min-h-screen flex flex-col transition-colors duration-200 ${isDarkMode ? "bg-slate-950 text-slate-100" : "bg-[#f3f4f6] text-gray-800"}`}>
        {/* Anti-refresh Warning Toast */}
        {refreshWarning && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white px-5 py-2.5 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs sm:text-sm font-semibold border border-red-700 animate-bounce">
            <AlertTriangle className="w-5 h-5 text-yellow-300 shrink-0" />
            <span>Page refresh is disabled during the exam! Please continue answering your questions.</span>
          </div>
        )}

        {/* Resumed Session Welcome Toast */}
        {resumedNotice && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-xs sm:text-sm font-semibold border border-emerald-700 animate-bounce max-w-md w-[90%]">
            <CheckCircle2 className="w-5 h-5 text-emerald-200 shrink-0" />
            <span>{resumedNotice}</span>
          </div>
        )}

        {/* Tab-Switch Anti-Cheat Warning Toast */}
        {tabWarning && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-amber-600 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-xs sm:text-sm font-semibold border border-amber-700 animate-bounce max-w-md w-[90%]">
            <ShieldAlert className="w-5 h-5 text-amber-200 shrink-0" />
            <span>{tabWarning}</span>
          </div>
        )}

        {/* Full-Screen Exit Warning Banner */}
        {fullscreenWarning && (
          <div className="sticky top-0 z-50 bg-amber-500 text-slate-950 px-4 py-2.5 shadow-md flex items-center justify-between gap-3 text-xs sm:text-sm font-bold border-b border-amber-600">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>Full-screen mode was exited! To maintain assessment integrity, please return to full-screen mode.</span>
            </div>
            <button
              onClick={requestFullscreenMode}
              className="px-3 py-1 bg-slate-950 text-white hover:bg-slate-800 rounded-lg text-xs font-semibold shrink-0 transition flex items-center gap-1"
            >
              <Maximize2 className="w-3.5 h-3.5" /> Return to Full-Screen
            </button>
          </div>
        )}

        {/* Header matching template */}
        <header className="header-bg text-white shadow-md relative z-20">
          <div className="px-4 py-3 flex items-center justify-between max-w-5xl mx-auto w-full">
            {/* Hamburger Menu Button */}
            <button
              onClick={() => setIsDrawerOpen(true)}
              className="p-1 focus:outline-none focus:ring-2 focus:ring-white rounded hover:bg-white/10 transition"
              title="Open Question Drawer"
            >
              <Menu className="w-7 h-7" />
            </button>

            {/* Logo / Heading Area */}
            {quiz.header_image_url ? (
              <img
                src={quiz.header_image_url}
                alt={quiz.title}
                className="h-8 sm:h-9 object-contain max-w-[220px]"
              />
            ) : (
              <div className="text-xl sm:text-2xl font-bold tracking-tight font-serif italic text-white truncate max-w-[250px] sm:max-w-md">
                {quiz.title}
              </div>
            )}

            {/* Trainee profile indicator & theme toggle */}
            <div className="flex items-center gap-2.5 text-xs">
              <button
                type="button"
                onClick={toggleDarkMode}
                title={isDarkMode ? "Switch to Light Theme" : "Switch to Dark Theme"}
                className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/15 transition flex items-center justify-center"
              >
                {isDarkMode ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4" />}
              </button>
              <span className="hidden sm:inline font-medium">{traineeName}</span>
              <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs">
                {traineeName.charAt(0).toUpperCase() || "T"}
              </div>
            </div>
          </div>
        </header>

        {/* Nav back subheader */}
        <div className="nav-back-bg text-white px-4 py-3 flex items-center text-sm font-medium z-10 relative shadow-inner">
          <div className="max-w-5xl mx-auto w-full flex items-center justify-between">
            <span className="flex items-center text-sm">
              <span className="font-semibold text-white mr-2">{quiz.title}</span>
              {isPracticeMode ? (
                <span className="text-[11px] bg-amber-500/30 text-amber-200 px-2 py-0.5 rounded border border-amber-400/30 flex items-center gap-1 font-semibold">
                  <Lightbulb className="w-3 h-3 text-amber-300" />
                  Practice Mode ({totalQuestions} Qs)
                </span>
              ) : quiz.total_pool_size && quiz.total_pool_size > totalQuestions ? (
                <span className="text-[11px] bg-blue-900/60 px-2 py-0.5 rounded text-blue-200">
                  {totalQuestions} of {quiz.total_pool_size} pool
                </span>
              ) : null}
            </span>
            <div className="flex items-center gap-3">
              {!isPracticeMode && tabSwitches > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] bg-amber-500/30 text-amber-200 px-2 py-0.5 rounded border border-amber-400/40">
                  <ShieldAlert className="w-3 h-3 text-amber-300" />
                  {tabSwitches} Switch{tabSwitches > 1 ? "es" : ""}
                </span>
              )}
              {!isPracticeMode && (
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] bg-red-900/60 text-red-100 px-2 py-0.5 rounded border border-red-700/50">
                  <ShieldAlert className="w-3 h-3 text-red-300" />
                  Refresh Disabled
                </span>
              )}
              <span className="text-xs text-blue-200">
                {isPracticeMode ? "Student: " : "Candidate: "}
                <strong className="text-white">{traineeName}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Main Examination Container */}
        <main className="flex-grow p-4 md:px-8 max-w-3xl mx-auto w-full flex flex-col relative z-0">
          {/* Info Bar (Timer and Grid view toggle) */}
          <div className={`rounded-xl shadow-sm p-3 mb-4 flex justify-between items-center border transition-colors ${
            isDarkMode ? "bg-slate-900 border-slate-800 text-slate-100" : "bg-white border-gray-100 text-gray-800"
          }`}>
            {isPracticeMode ? (
              <div className={`flex items-center space-x-2.5 px-3 py-1.5 rounded-full border ${
                isDarkMode ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-blue-50 border-blue-200 text-blue-800"
              }`}>
                <Lightbulb className="w-4 h-4 text-amber-400" />
                <span className="font-bold text-sm">
                  Practice Drill • Question {currentQuestionIdx + 1} of {totalQuestions}
                </span>
              </div>
            ) : secondsLeft !== null ? (
              <div
                className={`flex items-center space-x-2.5 px-3 py-1.5 rounded-full border transition ${
                  secondsLeft < 300
                    ? "bg-red-50 border-red-200 text-red-700 font-bold animate-pulse"
                    : isDarkMode
                      ? "bg-slate-800 border-slate-700 text-slate-200 font-medium"
                      : "bg-gray-100 border-gray-200 text-gray-700 font-medium"
                }`}
              >
                <div
                  className="progress-circle"
                  style={{
                    background: `conic-gradient(#d9534f ${timeProgressPct}%, ${isDarkMode ? "#334155" : "#e5e7eb"} 0)`,
                  }}
                  title="Time Remaining"
                />
                <span className="text-sm">Time Left: {formatTimeLeft(secondsLeft)}</span>
              </div>
            ) : (
              <div className={`flex items-center space-x-3 px-3 py-1.5 rounded-full border ${
                isDarkMode ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-gray-100 border-gray-200 text-gray-700"
              }`}>
                <div
                  className="progress-circle"
                  title={`${Math.round(((currentQuestionIdx + 1) / totalQuestions) * 100)}% progress`}
                />
                <span className="font-medium text-sm">
                  Question {currentQuestionIdx + 1} of {totalQuestions}
                </span>
              </div>
            )}

            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500 font-medium hidden sm:inline">
                {answeredCount} of {totalQuestions} answered
              </span>
              <button
                onClick={() => setIsDrawerOpen(true)}
                className="text-red-600 p-2 hover:bg-red-50 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-red-200"
                title="Open Question Grid"
              >
                <LayoutGrid className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Question Card matching template */}
          <div className={`rounded-xl shadow-md overflow-hidden flex-grow flex flex-col border transition-colors ${
            isDarkMode ? "bg-slate-900 border-slate-800 text-slate-100" : "bg-white border-gray-200 text-gray-800"
          }`}>
            {/* Question Header */}
            <div className={`px-5 py-4 border-b flex justify-between items-start transition-colors ${
              isDarkMode ? "bg-slate-950/70 border-slate-800" : "bg-gray-50 border-gray-100"
            }`}>
              <div>
                <h2 className={`text-xl font-bold ${isDarkMode ? "text-white" : "text-gray-800"}`} id="current-question-label">
                  Question {currentQuestionIdx + 1} of {totalQuestions}
                </h2>
                <button
                  onClick={toggleMarkForReview}
                  className={`text-sm mt-1 flex items-center transition focus:outline-none ${
                    isMarked
                      ? "text-yellow-500 font-semibold"
                      : isDarkMode
                        ? "text-slate-400 hover:text-slate-200"
                        : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <Bookmark
                    className={`w-4 h-4 mr-1 ${isMarked ? "text-yellow-400 fill-yellow-400" : ""}`}
                  />
                  {isMarked ? "Marked for Review" : "Mark for Review"}
                </button>
              </div>

              <div
                onClick={toggleMarkForReview}
                className={`flex flex-col items-center cursor-pointer transition ${
                  isDarkMode ? "text-slate-400 hover:text-slate-200" : "text-gray-400 hover:text-gray-600"
                }`}
                title="Toggle Mark for Review"
              >
                <Bookmark
                  className={`w-6 h-6 ${isMarked ? "text-yellow-400 fill-yellow-400" : ""}`}
                />
                <span className="text-xs mt-1 text-center leading-tight hidden sm:block">
                  Mark for<br />Review
                </span>
              </div>
            </div>

            {/* Question Content */}
            <div className="p-5 flex-grow">
              {currentQuestion.topic && (
                <span className="inline-block mb-2 text-[11px] font-semibold text-[#0056D2] bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 px-2.5 py-0.5 rounded-full">
                  {currentQuestion.topic}
                </span>
              )}
              <p className={`text-lg mb-6 leading-relaxed ${isDarkMode ? "text-slate-100" : "text-gray-800"}`}>
                {currentQuestion.question}
              </p>

              {/* Options matching template custom-radio */}
              <div className="space-y-3">
                {currentQuestion.options.map((option, idx) => {
                  const optId = String.fromCharCode(65 + idx);
                  const isSelected = answers[currentQuestionIdx] === option;
                  const isAnswered = answers[currentQuestionIdx] !== undefined;
                  const isCorrectAnswer = Boolean(
                    currentQuestion.correct_answer && option.trim() === currentQuestion.correct_answer.trim()
                  );

                  let optionColorClass = "";
                  if (isPracticeMode && instantFeedback && isAnswered) {
                    if (isCorrectAnswer) {
                      optionColorClass = isDarkMode
                        ? "border-emerald-500 bg-emerald-950/60 text-emerald-100 ring-2 ring-emerald-500/40"
                        : "border-emerald-500 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-400";
                    } else if (isSelected && !isCorrectAnswer) {
                      optionColorClass = isDarkMode
                        ? "border-rose-500 bg-rose-950/60 text-rose-100 ring-2 ring-rose-500/40"
                        : "border-rose-400 bg-rose-50 text-rose-900 ring-2 ring-rose-300";
                    } else {
                      optionColorClass = isDarkMode
                        ? "border-slate-800 bg-slate-900/40 text-slate-400 opacity-60"
                        : "border-gray-200 bg-gray-50/70 text-gray-400 opacity-60";
                    }
                  } else {
                    optionColorClass = isSelected
                      ? isDarkMode
                        ? "selected border-blue-500 bg-blue-950/50 text-white"
                        : "selected border-[#0056D2] bg-[#f0f7ff] text-gray-900"
                      : isDarkMode
                        ? "border-slate-800 bg-slate-900/90 hover:bg-slate-800/80 text-slate-200"
                        : "border-gray-300 bg-white hover:bg-gray-50 text-gray-700";
                  }

                  return (
                    <label
                      key={idx}
                      className={`option-container flex items-center gap-3.5 sm:gap-4 p-3.5 sm:p-4 border rounded-xl cursor-pointer transition-colors ${optionColorClass}`}
                    >
                      <input
                        type="radio"
                        name={`answer_${currentQuestionIdx}`}
                        value={option}
                        checked={isSelected}
                        onChange={() => handleSelectOption(option)}
                        className={`custom-radio shrink-0 focus:ring-0 ${isDarkMode ? "dark-radio" : ""}`}
                      />
                      <span className={`text-sm sm:text-base leading-snug ${isDarkMode ? (isSelected ? "text-white" : "text-slate-200") : "text-gray-700"}`}>
                        <strong className={`font-bold mr-2.5 ${isDarkMode ? "text-white" : "text-gray-900"}`}>{optId}.</strong>
                        <span>{option}</span>
                      </span>
                    </label>
                  );
                })}
              </div>

              {/* Instant Explanation Box (Practice Mode Only) */}
              {isPracticeMode && instantFeedback && answers[currentQuestionIdx] !== undefined && (
                <div className={`mt-5 p-4 rounded-xl border animate-scale-in transition ${
                  answers[currentQuestionIdx] === currentQuestion.correct_answer
                    ? isDarkMode ? "bg-emerald-950/40 border-emerald-800 text-emerald-200" : "bg-emerald-50 border-emerald-200 text-emerald-900"
                    : isDarkMode ? "bg-rose-950/40 border-rose-800 text-rose-200" : "bg-rose-50 border-rose-200 text-rose-900"
                }`}>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 font-bold text-sm">
                      {answers[currentQuestionIdx] === currentQuestion.correct_answer ? (
                        <>
                          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                          <span>Correct! Well done.</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-5 h-5 text-rose-500 shrink-0" />
                          <span>
                            Incorrect. Correct answer: <strong className="underline">{currentQuestion.correct_answer}</strong>
                          </span>
                        </>
                      )}
                    </div>

                    {answers[currentQuestionIdx] !== currentQuestion.correct_answer && (
                      <button
                        type="button"
                        onClick={() => {
                          setAnswers((prev) => {
                            const copy = { ...prev };
                            delete copy[currentQuestionIdx];
                            try {
                              sessionStorage.setItem(`active_exam_answers_${quiz.id}`, JSON.stringify(copy));
                            } catch {}
                            return copy;
                          });
                        }}
                        className={`px-3 py-1 text-xs font-bold rounded-lg border shadow-sm transition inline-flex items-center gap-1 ${
                          isDarkMode
                            ? "bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700"
                            : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Try Again</span>
                      </button>
                    )}
                  </div>

                  {currentQuestion.explanation && (
                    <div className={`mt-3 pt-3 border-t text-xs leading-relaxed ${
                      isDarkMode ? "border-slate-800/80 text-slate-300" : "border-gray-200 text-gray-700"
                    }`}>
                      <strong className="text-[#0056D2] dark:text-blue-400">💡 Explanation: </strong>
                      {currentQuestion.explanation}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Submission Error Banner */}
          {submitError && (
            <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Bottom Nav Buttons */}
          <div className="mt-4 flex justify-between items-center w-full">
            <button
              onClick={handlePrev}
              disabled={currentQuestionIdx === 0}
              className={`px-4 py-3 rounded-lg font-medium text-sm sm:text-base border transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${
                isDarkMode
                  ? "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
                  : "bg-gray-100 text-gray-500 border-gray-300 hover:bg-gray-200"
              }`}
            >
              Previous Question
            </button>

            {isLastQuestion ? (
              <button
                onClick={() => setIsReviewModalOpen(true)}
                disabled={submitting}
                className="bg-green-600 text-white px-6 py-3 rounded-lg font-medium text-sm sm:text-base hover:bg-green-700 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 flex items-center shadow-sm"
              >
                {submitting ? (
                  <span>Submitting...</span>
                ) : (
                  <>
                    <span>{isPracticeMode ? "Finish Practice Drill" : "Submit Assessment"}</span>
                    <Check className="w-5 h-5 ml-1" />
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="bg-red-600 text-white px-6 py-3 rounded-lg font-medium text-sm sm:text-base hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 flex items-center shadow-sm"
              >
                Next
                <ArrowRight className="w-5 h-5 ml-1" />
              </button>
            )}
          </div>
        </main>

        {/* Slide-over Drawer Menu */}
        {isDrawerOpen && (
          <div
            onClick={() => setIsDrawerOpen(false)}
            className="fixed inset-0 bg-black bg-opacity-50 z-30 transition-opacity"
          />
        )}

        <div
          className={`question-menu-drawer fixed inset-y-0 left-0 w-72 shadow-xl z-40 flex flex-col h-full transition-colors ${
            isDarkMode ? "bg-slate-900 border-r border-slate-800 text-slate-100" : "bg-white text-gray-800"
          } ${isDrawerOpen ? "open pointer-events-auto" : "pointer-events-none"}`}
        >
          <div className={`p-4 border-b flex justify-between items-center ${isDarkMode ? "bg-slate-950 border-slate-800" : "bg-gray-50"}`}>
            <h3 className={`font-bold text-lg ${isDarkMode ? "text-white" : "text-gray-800"}`}>Questions</h3>
            <button
              onClick={() => setIsDrawerOpen(false)}
              className={`p-1 focus:outline-none ${isDarkMode ? "text-slate-400 hover:text-white" : "text-gray-500 hover:text-gray-800"}`}
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-4 flex-grow overflow-y-auto">
            <div className="grid grid-cols-4 gap-3">
              {examQuestions.map((_, i) => {
                const isCurrent = i === currentQuestionIdx;
                const isAnswered = answers[i] !== undefined;
                const isMarkedReview = markedForReview[i] === true;

                let btnClass = isDarkMode
                  ? "bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700"
                  : "bg-gray-100 border border-gray-300 text-gray-700 hover:bg-gray-200";

                if (isCurrent) {
                  btnClass = "bg-[#0056D2] text-white shadow-md";
                } else if (isMarkedReview) {
                  btnClass = "bg-yellow-400 text-gray-900 font-bold shadow-sm";
                } else if (isAnswered) {
                  btnClass = "bg-green-500 text-white";
                }

                return (
                  <button
                    key={i}
                    onClick={() => {
                      setCurrentQuestionIdx(i);
                      setIsDrawerOpen(false);
                      if (typeof window !== "undefined") {
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }
                      if (traineeName) {
                        saveStudentProgressAction(
                          quiz.id,
                          traineeName,
                          i,
                          answers,
                          examQuestions.map((q) => q.originalIndex),
                          tabSwitches,
                          isPracticeMode ? "practice" : "exam"
                        );
                      }
                    }}
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-medium text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300 ${btnClass}`}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>

            <div className={`mt-8 border-t pt-4 ${isDarkMode ? "border-slate-800" : "border-gray-200"}`}>
              <h4 className={`text-sm font-semibold mb-2 uppercase tracking-wide ${isDarkMode ? "text-slate-400" : "text-gray-500"}`}>
                Legend
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-[#0056D2] rounded-full mr-2" /> Current
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-green-500 rounded-full mr-2" /> Answered
                </div>
                <div className="flex items-center">
                  <div className={`w-4 h-4 rounded-full mr-2 border ${isDarkMode ? "bg-slate-800 border-slate-700" : "bg-gray-200 border-gray-300"}`} />{" "}
                  Unanswered
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-yellow-400 rounded-full mr-2" /> Marked for Review
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* Pre-Submission Review Summary Modal */}
        {/* ------------------------------------------------------------- */}
        {isReviewModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-scale-in">
            <div className={`w-full max-w-md border rounded-2xl shadow-2xl p-6 sm:p-8 space-y-6 transition-colors ${
              isDarkMode ? "bg-slate-900 border-slate-800 text-slate-100" : "bg-white border-gray-200 text-gray-800"
            }`}>
              <div className="text-center">
                <div className={`w-14 h-14 rounded-full border flex items-center justify-center mx-auto mb-3 ${
                  isDarkMode ? "bg-blue-950/60 border-blue-800 text-blue-300" : "bg-blue-50 border-blue-200 text-[#0056D2]"
                }`}>
                  <HelpCircle className="w-7 h-7" />
                </div>
                <h3 className={`text-xl font-bold ${isDarkMode ? "text-white" : "text-gray-800"}`}>Ready to Submit?</h3>
                <p className={`text-xs mt-1 ${isDarkMode ? "text-slate-400" : "text-gray-500"}`}>
                  Please review your examination status before final submission.
                </p>
              </div>

              {/* Status Breakdown Grid */}
              <div className="grid grid-cols-3 gap-2.5 text-center">
                <div className={`p-3 rounded-xl border ${isDarkMode ? "bg-emerald-950/40 border-emerald-800 text-emerald-300" : "bg-green-50 border-green-200 text-green-700"}`}>
                  <p className="text-xl font-bold">{answeredCount}</p>
                  <p className="text-[11px] font-semibold mt-0.5">Answered</p>
                </div>
                <div
                  className={`p-3 rounded-xl border ${
                    unansweredCount > 0
                      ? isDarkMode ? "bg-red-950/40 border-red-800 text-red-300" : "bg-red-50 border-red-200 text-red-700"
                      : isDarkMode ? "bg-slate-800 border-slate-700 text-slate-400" : "bg-gray-50 border-gray-200 text-gray-500"
                  }`}
                >
                  <p className="text-xl font-bold">{unansweredCount}</p>
                  <p className="text-[11px] font-semibold mt-0.5">Unanswered</p>
                </div>
                <div
                  className={`p-3 rounded-xl border ${
                    markedCount > 0
                      ? isDarkMode ? "bg-amber-950/40 border-amber-800 text-amber-300" : "bg-yellow-50 border-yellow-200 text-yellow-800"
                      : isDarkMode ? "bg-slate-800 border-slate-700 text-slate-400" : "bg-gray-50 border-gray-200 text-gray-500"
                  }`}
                >
                  <p className="text-xl font-bold">{markedCount}</p>
                  <p className="text-[11px] font-semibold mt-0.5">Marked Review</p>
                </div>
              </div>

              {/* Warning Context */}
              {unansweredCount > 0 ? (
                <div className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                  isDarkMode ? "bg-amber-950/40 border-amber-800 text-amber-200" : "bg-amber-50 border-amber-200 text-amber-800"
                }`}>
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    You still have <strong>{unansweredCount} unanswered questions</strong>. Once submitted, you cannot modify your answers.
                  </span>
                </div>
              ) : (
                <div className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                  isDarkMode ? "bg-emerald-950/40 border-emerald-800 text-emerald-200" : "bg-green-50 border-green-200 text-green-800"
                }`}>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Great job! You have answered all {totalQuestions} questions.</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsReviewModalOpen(false)}
                  className={`flex-1 py-2.5 px-4 rounded-xl border font-semibold text-xs transition ${
                    isDarkMode
                      ? "border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                      : "border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  Review Questions
                </button>
                <button
                  type="button"
                  onClick={handleSubmitQuiz}
                  disabled={submitting}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold text-xs shadow-md transition flex items-center justify-center gap-1.5"
                >
                  {submitting ? (
                    <span>Submitting...</span>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Confirm & Submit</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------
  // STAGE 3: Auto-Graded Results & Breakdown Screen (Generation Theme)
  // -------------------------------------------------------------
  if (step === "completed" && submissionResult) {
    const { score, maxScore, percentage, breakdown, tab_switches } = submissionResult;

    return (
      <div className={`min-h-screen flex flex-col transition-colors duration-200 ${isDarkMode ? "bg-slate-950 text-slate-100" : "bg-[#f3f4f6] text-gray-800"}`}>
        {/* Header */}
        <header className="header-bg text-white shadow-md relative z-20">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
            {quiz.header_image_url ? (
              <img
                src={quiz.header_image_url}
                alt={quiz.title}
                className="h-8 sm:h-9 object-contain max-w-[220px]"
              />
            ) : (
              <div className="text-xl sm:text-2xl font-bold tracking-tight font-serif italic text-white truncate max-w-[250px] sm:max-w-md">
                {quiz.title}
              </div>
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleDarkMode}
                title={isDarkMode ? "Switch to Light Theme" : "Switch to Dark Theme"}
                className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/15 transition flex items-center justify-center"
              >
                {isDarkMode ? <Sun className="w-5 h-5 text-amber-300" /> : <Moon className="w-5 h-5" />}
              </button>
              <span className="text-xs bg-white/15 px-3 py-1 rounded-full font-medium">
                Official Assessment Result
              </span>
            </div>
          </div>
        </header>

        <div className="nav-back-bg text-white px-4 py-3 flex items-center text-sm font-medium z-10 relative shadow-inner">
          <div className="max-w-5xl mx-auto w-full flex items-center justify-between">
            <span>Result Overview</span>
            <span className="text-xs text-blue-100">{quiz.title}</span>
          </div>
        </div>

        <main className="flex-grow p-4 md:px-8 max-w-3xl mx-auto w-full py-8 space-y-6">
          {/* Main Score Card */}
          <div className={`rounded-xl shadow-md p-6 sm:p-8 text-center border transition-colors ${
            isDarkMode ? "bg-slate-900 border-slate-800 text-slate-100" : "bg-white border-gray-200 text-gray-800"
          }`}>
            <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-3 bg-[#0056D2]/10 text-[#0056D2]">
              {percentage >= 70 ? (
                <Trophy className="w-8 h-8 text-amber-500" />
              ) : (
                <Award className="w-8 h-8 text-[#0056D2]" />
              )}
            </div>

            <h1 className={`text-2xl sm:text-3xl font-bold ${isDarkMode ? "text-white" : "text-gray-800"}`}>
              {isPracticeMode
                ? percentage >= 70 ? "Well Done, " : "Practice Completed, "
                : percentage >= 70 ? "Congratulations, " : "Exam Completed, "}
              {traineeName}!
            </h1>
            <p className={`text-xs mt-1 ${isDarkMode ? "text-slate-400" : "text-gray-500"}`}>
              Your {isPracticeMode ? "practice attempt" : "official submission"} for <span className={`font-semibold ${isDarkMode ? "text-slate-200" : "text-gray-700"}`}>&quot;{quiz.title}&quot;</span> has been recorded.
            </p>

            {/* Anti-Cheat Focus Summary or Practice Mode Tag */}
            {isPracticeMode ? (
              <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-500/40 text-blue-600 dark:text-blue-300 text-xs font-semibold">
                <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                <span>Self-Paced Practice Drill • Attempt Logged</span>
              </div>
            ) : tab_switches && tab_switches > 0 ? (
              <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-600 dark:text-amber-300 text-xs font-semibold">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Proctoring Record: {tab_switches} tab switch{tab_switches > 1 ? "es" : ""} logged</span>
              </div>
            ) : (
              <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-600 dark:text-emerald-300 text-xs font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Clean Proctoring: 0 tab switches</span>
              </div>
            )}

            {submissionResult?.auto_submitted && (
              <div className="mt-4 max-w-md mx-auto p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs text-left flex items-start gap-2.5 shadow-sm">
                <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <p className="font-bold text-amber-900 dark:text-amber-100">Automatically Submitted (Due Time Expired)</p>
                  <p className="mt-0.5 opacity-90 leading-relaxed">
                    This assessment was automatically submitted because the exam time limit elapsed while the test was in progress. Your recorded answers up to that point have been finalized and graded.
                  </p>
                </div>
              </div>
            )}

            <div className={`my-6 p-6 rounded-xl border inline-block max-w-xs w-full ${
              isDarkMode ? "bg-slate-950 border-slate-800" : "bg-gray-50 border-gray-200"
            }`}>
              <p className={`text-xs font-semibold uppercase tracking-wider ${isDarkMode ? "text-slate-400" : "text-gray-500"}`}>
                {isPracticeMode ? "Drill Accuracy" : "Final Marks"}
              </p>
              <div className="text-4xl font-extrabold text-[#0056D2] dark:text-blue-400 mt-1">
                {score} <span className={`text-xl font-normal ${isDarkMode ? "text-slate-400" : "text-gray-500"}`}>/ {maxScore}</span>
              </div>
              <p className={`text-sm font-semibold mt-1 ${isDarkMode ? "text-slate-300" : "text-gray-700"}`}>{percentage}% Score</p>
            </div>

            <div className="flex items-center justify-center gap-2 flex-wrap">
              {isPracticeMode && breakdown.some((b) => !b.isCorrect) && (
                <button
                  onClick={handlePracticeMissedQuestions}
                  className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 shadow transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Practice Missed Questions ({breakdown.filter((b) => !b.isCorrect).length})</span>
                </button>
              )}

              <button
                onClick={handleRetake}
                className={`px-4 py-2.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition ${
                  isDarkMode
                    ? "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                    : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                }`}
              >
                {isPracticeMode ? (
                  <>
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Customize New Drill</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Retake Exam</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Breakdown List */}
          <div className={`rounded-xl shadow-md p-6 border space-y-4 transition-colors ${
            isDarkMode ? "bg-slate-900 border-slate-800 text-slate-100" : "bg-white border-gray-200 text-gray-800"
          }`}>
            <h2 className={`text-base font-bold border-b pb-3 ${isDarkMode ? "text-white border-slate-800" : "text-gray-800 border-gray-200"}`}>
              Detailed Question Review
            </h2>

            <div className="space-y-3">
              {breakdown.map((item) => (
                <div
                  key={item.questionIndex}
                  className={`p-4 rounded-lg border ${
                    item.isCorrect
                      ? isDarkMode ? "bg-emerald-950/20 border-emerald-800/60" : "bg-green-50/50 border-green-200"
                      : isDarkMode ? "bg-red-950/20 border-red-800/60" : "bg-red-50/50 border-red-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 flex-1">
                      <span className={`text-xs font-bold uppercase ${isDarkMode ? "text-slate-400" : "text-gray-500"}`}>
                        Question {item.questionIndex + 1}
                      </span>
                      <p className={`text-sm font-medium ${isDarkMode ? "text-slate-200" : "text-gray-800"}`}>{item.question}</p>
                    </div>

                    <div>
                      {item.isCorrect ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-950/50 px-2 py-0.5 rounded">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Correct
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-950/50 px-2 py-0.5 rounded">
                          <XCircle className="w-3.5 h-3.5" /> Incorrect
                        </span>
                      )}
                    </div>
                  </div>

                  <div className={`mt-3 pt-2 border-t text-xs space-y-1 ${isDarkMode ? "border-slate-800" : "border-gray-200/60"}`}>
                    <div className="flex items-center gap-2">
                      <span className={isDarkMode ? "text-slate-400" : "text-gray-500"}>Your Answer:</span>
                      <span className={`font-semibold ${item.isCorrect ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                        {item.selectedAnswer || "(No answer selected)"}
                      </span>
                    </div>
                    {!item.isCorrect && (
                      <div className="flex items-center gap-2">
                        <span className={isDarkMode ? "text-slate-400" : "text-gray-500"}>Correct Answer:</span>
                        <span className="font-semibold text-green-600 dark:text-green-400">{item.correctAnswer}</span>
                      </div>
                    )}
                    {item.explanation && (
                      <div className={`mt-2 text-[11px] p-2 rounded border ${
                        isDarkMode ? "bg-slate-950 border-slate-800 text-slate-300" : "bg-white border-gray-200 text-gray-600"
                      }`}>
                        <strong className="text-[#0056D2] dark:text-blue-400">Explanation: </strong>
                        {item.explanation}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  return null;
}
