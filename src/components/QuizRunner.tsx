"use client";

import { useState, useEffect, useRef } from "react";
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
} from "lucide-react";
import { submitQuizAttemptAction, recordStudentHeartbeatAction } from "@/app/actions/quiz";
import { QuizPublic, SubmissionResult, PublicQuestionItem } from "@/lib/types";

interface QuizRunnerProps {
  quiz: QuizPublic;
}

export default function QuizRunner({ quiz }: QuizRunnerProps) {
  // Freeze exam questions in local state so Next.js server revalidations NEVER change questions mid-exam
  const [examQuestions, setExamQuestions] = useState<PublicQuestionItem[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = sessionStorage.getItem(`active_exam_questions_${quiz.id}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      } catch {}
    }
    return quiz.questions;
  });

  const [step, setStep] = useState<"name_prompt" | "in_progress" | "completed">(() => {
    if (typeof window !== "undefined") {
      try {
        const savedStep = sessionStorage.getItem(`active_exam_step_${quiz.id}`);
        if (savedStep === "in_progress") return "in_progress";
      } catch {}
    }
    return "name_prompt";
  });

  const [traineeName, setTraineeName] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        return sessionStorage.getItem(`active_exam_name_${quiz.id}`) || "";
      } catch {}
    }
    return "";
  });

  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);

  const [answers, setAnswers] = useState<Record<number, string>>(() => {
    if (typeof window !== "undefined") {
      try {
        const savedAnswers = sessionStorage.getItem(`active_exam_answers_${quiz.id}`);
        if (savedAnswers) return JSON.parse(savedAnswers);
      } catch {}
    }
    return {};
  });

  const [markedForReview, setMarkedForReview] = useState<Record<number, boolean>>(() => {
    if (typeof window !== "undefined") {
      try {
        const savedMarked = sessionStorage.getItem(`active_exam_marked_${quiz.id}`);
        if (savedMarked) return JSON.parse(savedMarked);
      } catch {}
    }
    return {};
  });

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<SubmissionResult | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [refreshWarning, setRefreshWarning] = useState(false);
  const [fullscreenWarning, setFullscreenWarning] = useState(false);

  // -------------------------------------------------------------
  // Configurable Exam Timer
  // -------------------------------------------------------------
  const totalDurationSeconds = (quiz.time_limit_minutes || 0) * 60;
  const [secondsLeft, setSecondsLeft] = useState<number | null>(() => {
    if (!quiz.time_limit_minutes || quiz.time_limit_minutes <= 0) return null;
    if (typeof window !== "undefined") {
      try {
        const stored = sessionStorage.getItem(`active_exam_time_${quiz.id}`);
        if (stored) {
          const parsed = parseInt(stored, 10);
          if (!isNaN(parsed) && parsed >= 0) return parsed;
        }
      } catch {}
    }
    return quiz.time_limit_minutes * 60;
  });

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

  // Full-Screen listener
  useEffect(() => {
    if (step !== "in_progress") return;

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
  }, [step]);

  // Prevent page refresh / reload while exam is in progress
  useEffect(() => {
    if (step !== "in_progress") return;

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
  }, [step]);

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
    recordStudentHeartbeatAction(quiz.id, traineeName, answeredCount, totalQuestions, "in_progress");

    const heartbeatTimer = setInterval(() => {
      recordStudentHeartbeatAction(quiz.id, traineeName, answeredCount, totalQuestions, "in_progress");
    }, 6000);

    return () => clearInterval(heartbeatTimer);
  }, [step, traineeName, answeredCount, totalQuestions, quiz.id]);

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
    if (!traineeName.trim()) {
      setNameError("Please enter your name to begin.");
      return;
    }
    setNameError(null);

    // Request full screen
    await requestFullscreenMode();

    // Lock session questions and trainee name
    try {
      sessionStorage.setItem(`active_exam_questions_${quiz.id}`, JSON.stringify(examQuestions));
      sessionStorage.setItem(`active_exam_name_${quiz.id}`, traineeName.trim());
      sessionStorage.setItem(`active_exam_step_${quiz.id}`, "in_progress");
      if (quiz.time_limit_minutes) {
        sessionStorage.setItem(`active_exam_time_${quiz.id}`, (quiz.time_limit_minutes * 60).toString());
      }
    } catch {}

    setStep("in_progress");
    recordStudentHeartbeatAction(quiz.id, traineeName.trim(), 0, totalQuestions, "in_progress");
  };

  const handleSelectOption = (option: string) => {
    setAnswers((prev) => {
      const updated = {
        ...prev,
        [currentQuestionIdx]: option,
      };
      try {
        sessionStorage.setItem(`active_exam_answers_${quiz.id}`, JSON.stringify(updated));
      } catch {}
      recordStudentHeartbeatAction(quiz.id, traineeName, Object.keys(updated).length, totalQuestions, "in_progress");
      return updated;
    });
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
      setCurrentQuestionIdx((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentQuestionIdx > 0) {
      setCurrentQuestionIdx((prev) => prev - 1);
    }
  };

  const handleSubmitQuiz = async () => {
    setIsReviewModalOpen(false);
    setSubmitError(null);
    setSubmitting(true);

    try {
      const servedIndices = examQuestions.map((q) => q.originalIndex);
      const res = await submitQuizAttemptAction(quiz.id, traineeName, answers, servedIndices);
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
        } catch {}

        setSubmissionResult(res.result);
        setStep("completed");
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
    } catch {}
    setExamQuestions(quiz.questions);
    setAnswers({});
    setMarkedForReview({});
    setCurrentQuestionIdx(0);
    setSubmissionResult(null);
    setSecondsLeft(quiz.time_limit_minutes ? quiz.time_limit_minutes * 60 : null);
    setStep("name_prompt");
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
  if (step === "name_prompt") {
    return (
      <div className="min-h-screen flex flex-col bg-[#f3f4f6]">
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
            <span className="text-xs bg-white/15 px-3 py-1 rounded-full font-medium">
              Online Examination Portal
            </span>
          </div>
        </header>

        <div className="nav-back-bg text-white px-4 py-3 flex items-center text-sm font-medium z-10 relative shadow-inner">
          <div className="max-w-5xl mx-auto w-full flex items-center justify-between">
            <span>Assessment Entrance</span>
            <span className="text-xs text-blue-100">{quiz.title}</span>
          </div>
        </div>

        <main className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-gray-200 rounded-xl p-6 sm:p-8 shadow-md">
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-xl bg-[#0056D2]/10 text-[#0056D2] flex items-center justify-center mx-auto mb-3 font-bold">
                <Sparkles className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-bold text-gray-800">{quiz.title}</h1>
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
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
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
                    className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-3 pl-11 text-sm text-gray-800 placeholder:text-gray-400 focus:border-[#0056D2] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0056D2] transition"
                  />
                  <User className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {nameError && (
                <p className="text-xs text-red-500 font-medium">{nameError}</p>
              )}

              {/* Full-screen guidance */}
              <div className="p-3 bg-blue-50/60 border border-blue-200/80 rounded-lg text-xs text-blue-900 flex items-start gap-2">
                <Maximize2 className="w-4 h-4 text-[#0056D2] shrink-0 mt-0.5" />
                <span>
                  This exam requires <strong>Full-Screen Mode</strong>. Clicking start will launch full-screen mode to ensure exam integrity.
                </span>
              </div>

              <button
                type="submit"
                className="w-full py-3 px-4 rounded-lg bg-[#0056D2] hover:bg-[#0045A8] text-white font-semibold shadow transition flex items-center justify-center gap-2"
              >
                <span>Enter Full-Screen & Start</span>
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
        <div className="min-h-screen flex items-center justify-center p-4 bg-[#f3f4f6]">
          <p className="text-sm text-gray-500">Loading questions...</p>
        </div>
      );
    }

    const isLastQuestion = currentQuestionIdx === totalQuestions - 1;

    return (
      <div className="antialiased text-gray-800 min-h-screen flex flex-col bg-[#f3f4f6]">
        {/* Anti-refresh Warning Toast */}
        {refreshWarning && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white px-5 py-2.5 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs sm:text-sm font-semibold border border-red-700 animate-bounce">
            <AlertTriangle className="w-5 h-5 text-yellow-300 shrink-0" />
            <span>Page refresh is disabled during the exam! Please continue answering your questions.</span>
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

            {/* Trainee profile indicator */}
            <div className="flex items-center gap-2 text-xs">
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
              {quiz.total_pool_size && quiz.total_pool_size > totalQuestions && (
                <span className="text-[11px] bg-blue-900/60 px-2 py-0.5 rounded text-blue-200">
                  {totalQuestions} of {quiz.total_pool_size} pool
                </span>
              )}
            </span>
            <div className="flex items-center gap-3">
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] bg-red-900/60 text-red-100 px-2 py-0.5 rounded border border-red-700/50">
                <ShieldAlert className="w-3 h-3 text-red-300" />
                Refresh Disabled
              </span>
              <span className="text-xs text-blue-200">
                Candidate: <strong className="text-white">{traineeName}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Main Examination Container */}
        <main className="flex-grow p-4 md:px-8 max-w-3xl mx-auto w-full flex flex-col relative z-0">
          {/* Info Bar (Timer and Grid view toggle) */}
          <div className="bg-white rounded-lg shadow-sm p-3 mb-4 flex justify-between items-center border border-gray-100">
            {secondsLeft !== null ? (
              <div
                className={`flex items-center space-x-2.5 px-3 py-1.5 rounded-full border transition ${
                  secondsLeft < 300
                    ? "bg-red-50 border-red-200 text-red-700 font-bold animate-pulse"
                    : "bg-gray-100 border-gray-200 text-gray-700 font-medium"
                }`}
              >
                <div
                  className="progress-circle"
                  style={{
                    background: `conic-gradient(#d9534f ${timeProgressPct}%, #e5e7eb 0)`,
                  }}
                  title="Time Remaining"
                />
                <span className="text-sm">Time Left: {formatTimeLeft(secondsLeft)}</span>
              </div>
            ) : (
              <div className="flex items-center space-x-3 bg-gray-100 px-3 py-1.5 rounded-full border border-gray-200">
                <div
                  className="progress-circle"
                  title={`${Math.round(((currentQuestionIdx + 1) / totalQuestions) * 100)}% progress`}
                />
                <span className="text-gray-700 font-medium text-sm">
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
          <div className="bg-white rounded-xl shadow-md overflow-hidden flex-grow flex flex-col border border-gray-200">
            {/* Question Header */}
            <div className="bg-gray-50 px-5 py-4 border-b border-gray-100 flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold text-gray-800" id="current-question-label">
                  Question {currentQuestionIdx + 1} of {totalQuestions}
                </h2>
                <button
                  onClick={toggleMarkForReview}
                  className={`text-sm mt-1 flex items-center transition focus:outline-none ${
                    isMarked ? "text-yellow-600 font-semibold" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <Bookmark
                    className={`w-4 h-4 mr-1 ${isMarked ? "text-yellow-500 fill-yellow-400" : ""}`}
                  />
                  {isMarked ? "Marked for Review" : "Mark for Review"}
                </button>
              </div>

              <div
                onClick={toggleMarkForReview}
                className="text-gray-400 flex flex-col items-center cursor-pointer hover:text-gray-600"
                title="Toggle Mark for Review"
              >
                <Bookmark
                  className={`w-6 h-6 ${isMarked ? "text-yellow-500 fill-yellow-400" : ""}`}
                />
                <span className="text-xs mt-1 text-center leading-tight hidden sm:block">
                  Mark for<br />Review
                </span>
              </div>
            </div>

            {/* Question Content */}
            <div className="p-5 flex-grow">
              {currentQuestion.topic && (
                <span className="inline-block mb-2 text-[11px] font-semibold text-[#0056D2] bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full">
                  {currentQuestion.topic}
                </span>
              )}
              <p className="text-gray-800 text-lg mb-6 leading-relaxed">
                {currentQuestion.question}
              </p>

              {/* Options matching template custom-radio */}
              <div className="space-y-3">
                {currentQuestion.options.map((option, idx) => {
                  const optId = String.fromCharCode(65 + idx);
                  const isSelected = answers[currentQuestionIdx] === option;

                  return (
                    <label
                      key={idx}
                      onClick={() => handleSelectOption(option)}
                      className={`option-container flex items-center gap-3.5 sm:gap-4 p-3.5 sm:p-4 border border-gray-300 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors ${
                        isSelected ? "selected" : ""
                      }`}
                    >
                      <input
                        type="radio"
                        name={`answer_${currentQuestionIdx}`}
                        value={option}
                        checked={isSelected}
                        onChange={() => handleSelectOption(option)}
                        className="custom-radio shrink-0 focus:ring-0"
                      />
                      <span className="text-gray-700 text-sm sm:text-base leading-snug">
                        <strong className="font-bold text-gray-900 mr-2.5">{optId}.</strong>
                        <span>{option}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
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
              className="bg-gray-100 text-gray-500 border border-gray-300 px-4 py-3 rounded-lg font-medium text-sm sm:text-base hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
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
                    Submit Assessment
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
        <div
          onClick={() => setIsDrawerOpen(false)}
          className={`menu-overlay-layer fixed inset-0 bg-black bg-opacity-50 z-30 ${
            isDrawerOpen ? "open" : ""
          }`}
        />

        <div
          className={`question-menu-drawer fixed inset-y-0 left-0 w-72 bg-white shadow-xl z-40 flex flex-col h-full ${
            isDrawerOpen ? "open" : ""
          }`}
        >
          <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
            <h3 className="font-bold text-gray-800 text-lg">Questions</h3>
            <button
              onClick={() => setIsDrawerOpen(false)}
              className="text-gray-500 hover:text-gray-800 focus:outline-none p-1"
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

                let btnClass =
                  "bg-gray-100 border border-gray-300 text-gray-700 hover:bg-gray-200";
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
                    }}
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-medium text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300 ${btnClass}`}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>

            <div className="mt-8 border-t pt-4">
              <h4 className="text-sm font-semibold text-gray-500 mb-2 uppercase tracking-wide">
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
                  <div className="w-4 h-4 bg-gray-200 border border-gray-300 rounded-full mr-2" />{" "}
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
            <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl shadow-2xl p-6 sm:p-8 space-y-6">
              <div className="text-center">
                <div className="w-14 h-14 rounded-full bg-blue-50 text-[#0056D2] border border-blue-200 flex items-center justify-center mx-auto mb-3">
                  <HelpCircle className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-bold text-gray-800">Ready to Submit?</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Please review your examination status before final submission.
                </p>
              </div>

              {/* Status Breakdown Grid */}
              <div className="grid grid-cols-3 gap-2.5 text-center">
                <div className="p-3 bg-green-50 border border-green-200 rounded-xl">
                  <p className="text-xl font-bold text-green-700">{answeredCount}</p>
                  <p className="text-[11px] font-semibold text-green-800 mt-0.5">Answered</p>
                </div>
                <div
                  className={`p-3 rounded-xl border ${
                    unansweredCount > 0
                      ? "bg-red-50 border-red-200 text-red-700"
                      : "bg-gray-50 border-gray-200 text-gray-500"
                  }`}
                >
                  <p className="text-xl font-bold">{unansweredCount}</p>
                  <p className="text-[11px] font-semibold mt-0.5">Unanswered</p>
                </div>
                <div
                  className={`p-3 rounded-xl border ${
                    markedCount > 0
                      ? "bg-yellow-50 border-yellow-200 text-yellow-800"
                      : "bg-gray-50 border-gray-200 text-gray-500"
                  }`}
                >
                  <p className="text-xl font-bold">{markedCount}</p>
                  <p className="text-[11px] font-semibold mt-0.5">Marked Review</p>
                </div>
              </div>

              {/* Warning Context */}
              {unansweredCount > 0 ? (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    You still have <strong>{unansweredCount} unanswered questions</strong>. Once submitted, you cannot modify your answers.
                  </span>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-green-50 border border-green-200 text-xs text-green-800 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                  <span>Great job! You have answered all {totalQuestions} questions.</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsReviewModalOpen(false)}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-gray-300 text-gray-700 font-semibold text-xs hover:bg-gray-100 transition"
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
    const { score, maxScore, percentage, breakdown } = submissionResult;

    return (
      <div className="min-h-screen flex flex-col bg-[#f3f4f6]">
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
            <span className="text-xs bg-white/15 px-3 py-1 rounded-full font-medium">
              Official Assessment Result
            </span>
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
          <div className="bg-white rounded-xl shadow-md p-6 sm:p-8 text-center border border-gray-200">
            <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-3 bg-[#0056D2]/10 text-[#0056D2]">
              {percentage >= 70 ? (
                <Trophy className="w-8 h-8 text-amber-500" />
              ) : (
                <Award className="w-8 h-8 text-[#0056D2]" />
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
              {percentage >= 70 ? "Congratulations" : "Exam Completed"}, {traineeName}!
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              Your submission for <span className="font-semibold text-gray-700">&quot;{quiz.title}&quot;</span> has been recorded.
            </p>

            <div className="my-6 p-6 rounded-xl bg-gray-50 border border-gray-200 inline-block max-w-xs w-full">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Final Marks</p>
              <div className="text-4xl font-extrabold text-[#0056D2] mt-1">
                {score} <span className="text-xl font-normal text-gray-500">/ {maxScore}</span>
              </div>
              <p className="text-sm font-semibold text-gray-700 mt-1">{percentage}% Score</p>
            </div>

            <div>
              <button
                onClick={handleRetake}
                className="px-4 py-2.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold inline-flex items-center gap-1.5 transition"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Retake Exam
              </button>
            </div>
          </div>

          {/* Breakdown List */}
          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200 space-y-4">
            <h2 className="text-base font-bold text-gray-800 border-b pb-3">
              Detailed Question Review
            </h2>

            <div className="space-y-3">
              {breakdown.map((item) => (
                <div
                  key={item.questionIndex}
                  className={`p-4 rounded-lg border ${
                    item.isCorrect
                      ? "bg-green-50/50 border-green-200"
                      : "bg-red-50/50 border-red-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 flex-1">
                      <span className="text-xs font-bold text-gray-500 uppercase">
                        Question {item.questionIndex + 1}
                      </span>
                      <p className="text-sm font-medium text-gray-800">{item.question}</p>
                    </div>

                    <div>
                      {item.isCorrect ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Correct
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-100 px-2 py-0.5 rounded">
                          <XCircle className="w-3.5 h-3.5" /> Incorrect
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-gray-200/60 text-xs space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">Your Answer:</span>
                      <span className={`font-semibold ${item.isCorrect ? "text-green-700" : "text-red-600"}`}>
                        {item.selectedAnswer || "(No answer selected)"}
                      </span>
                    </div>
                    {!item.isCorrect && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">Correct Answer:</span>
                        <span className="font-semibold text-green-700">{item.correctAnswer}</span>
                      </div>
                    )}
                    {item.explanation && (
                      <div className="mt-2 text-[11px] text-gray-600 bg-white p-2 rounded border border-gray-200">
                        <strong className="text-[#0056D2]">Explanation: </strong>
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
