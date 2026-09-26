"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Users,
  Award,
  TrendingUp,
  Calendar,
  Copy,
  Check,
  Clock,
  RefreshCw,
  PlusCircle,
  Sparkles,
  FileText,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Activity,
  Radio,
  Filter,
  Trash2,
  Lightbulb,
  Folder,
  Tag,
  ExternalLink,
  Search,
  AlertTriangle,
  ChevronRight,
  ShieldCheck,
  Timer,
  Share2,
  Sliders,
  Eye,
  X,
  HelpCircle,
} from "lucide-react";
import {
  getQuizAnalyticsAction,
  getLiveProctoringAction,
  deleteAttemptAction,
  clearAttemptsForQuizAction,
  deleteQuizAction,
} from "@/app/actions/quiz";
import { Quiz, Attempt, QuestionBreakdown, ActiveStudentSession } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import AddQuestionsModal from "@/components/AddQuestionsModal";

interface QuizAnalyticsClientProps {
  initialQuiz: Quiz;
  initialAttempts: Attempt[];
  serverIp?: string;
}

export default function QuizAnalyticsClient({
  initialQuiz,
  initialAttempts,
  serverIp,
}: QuizAnalyticsClientProps) {
  const router = useRouter();
  const [currentQuiz, setCurrentQuiz] = useState<Quiz>(initialQuiz);
  const [attempts, setAttempts] = useState<Attempt[]>(initialAttempts);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  // Tabs: "completed" (Submissions & Performance) | "live_monitor" (Classroom Proctoring Desk)
  const [activeTab, setActiveTab] = useState<"completed" | "live_monitor">("completed");
  const [liveSessions, setLiveSessions] = useState<ActiveStudentSession[]>([]);

  // Search & Filter for Submissions Table
  const [searchQuery, setSearchQuery] = useState("");
  const [modeFilter, setModeFilter] = useState<"all" | "exam" | "practice">("all");

  // Custom link configurations
  const defaultCount = Math.min(20, currentQuiz.raw_json?.length || 20);
  const [customCount, setCustomCount] = useState<number>(defaultCount);
  const [customTime, setCustomTime] = useState<number>(currentQuiz.time_limit_minutes || 20);

  // Modals & Inspectors
  const [isAddQuestionsOpen, setIsAddQuestionsOpen] = useState(false);
  const [inspectedAttempt, setInspectedAttempt] = useState<Attempt | null>(null);
  const [filterType, setFilterType] = useState<"all" | "wrong" | "correct">("all");

  // Deletion States
  const [attemptToDelete, setAttemptToDelete] = useState<Attempt | null>(null);
  const [deletingAttempt, setDeletingAttempt] = useState(false);

  const [isClearingAll, setIsClearingAll] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);

  const [isDeletingQuiz, setIsDeletingQuiz] = useState(false);
  const [deletingQuiz, setDeletingQuiz] = useState(false);

  // Real-time Proctoring Poller (every 3.5s)
  useEffect(() => {
    let isMounted = true;

    const pollLiveSessions = async () => {
      try {
        const res = await getLiveProctoringAction(currentQuiz.id);
        if (isMounted && res.success && res.sessions) {
          setLiveSessions(res.sessions);
        }
      } catch (err) {
        console.error("Live session poll failed:", err);
      }
    };

    pollLiveSessions();
    const interval = setInterval(pollLiveSessions, 3500);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [currentQuiz.id]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const res = await getQuizAnalyticsAction(currentQuiz.id);
      if (res.success && res.attempts) {
        setAttempts(res.attempts);
      }
      if (res.success && res.quiz) {
        setCurrentQuiz(res.quiz);
      }
    } catch (err) {
      console.error("Failed to refresh analytics:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAttempt = async () => {
    if (!attemptToDelete) return;
    setDeletingAttempt(true);
    try {
      const res = await deleteAttemptAction(attemptToDelete.id);
      if (res.success) {
        setAttempts((prev) => prev.filter((a) => a.id !== attemptToDelete.id));
        if (inspectedAttempt && inspectedAttempt.id === attemptToDelete.id) {
          setInspectedAttempt(null);
        }
        setAttemptToDelete(null);
      }
    } catch (err) {
      console.error("Failed to delete attempt:", err);
    } finally {
      setDeletingAttempt(false);
    }
  };

  const handleClearAllAttempts = async () => {
    setClearingAll(true);
    try {
      const res = await clearAttemptsForQuizAction(currentQuiz.id);
      if (res.success) {
        setAttempts([]);
        setInspectedAttempt(null);
        setIsClearingAll(false);
      }
    } catch (err) {
      console.error("Failed to clear attempts:", err);
    } finally {
      setClearingAll(false);
    }
  };

  const handleDeleteQuiz = async () => {
    setDeletingQuiz(true);
    try {
      const res = await deleteQuizAction(currentQuiz.id);
      if (res.success) {
        router.push("/dashboard");
      }
    } catch (err) {
      console.error("Failed to delete quiz:", err);
    } finally {
      setDeletingQuiz(false);
    }
  };

  const handleCopyLink = (url: string, key: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(url);
      setCopied(key);
      setTimeout(() => setCopied(null), 2500);
    }
  };

  // Base URL & Custom Links
  const baseUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/quiz/${currentQuiz.id}`
      : serverIp
      ? `http://${serverIp}:3000/quiz/${currentQuiz.id}`
      : `/quiz/${currentQuiz.id}`;

  const validCustomCount = Math.min(Math.max(1, customCount), currentQuiz.raw_json.length);
  const validCustomTime = Math.min(Math.max(1, customTime), 180);
  const customShareUrl = `${baseUrl}?count=${validCustomCount}&time=${validCustomTime}`;
  const practiceShareUrl = `${baseUrl}?mode=practice`;

  // Calculated Analytics KPI Metrics
  const sampleMaxScore = currentQuiz.raw_json ? currentQuiz.raw_json.length : 1;
  const totalAttendees = attempts.length;
  const totalScore = attempts.reduce((acc, a) => acc + a.score, 0);
  const avgScore = totalAttendees > 0 ? (totalScore / totalAttendees).toFixed(1) : "0";
  const avgPercentage =
    totalAttendees > 0 && sampleMaxScore > 0
      ? Math.round((Number(avgScore) / sampleMaxScore) * 100)
      : 0;
  const highestAttempt =
    attempts.length > 0 ? attempts.reduce((prev, curr) => (curr.score > prev.score ? curr : prev)) : null;
  const passingCount = attempts.filter((a) => {
    const max = a.max_score || sampleMaxScore;
    return max > 0 && a.score / max >= 0.5;
  }).length;
  const passRate = totalAttendees > 0 ? Math.round((passingCount / totalAttendees) * 100) : 0;

  const activeLiveCount = liveSessions.filter((s) => s.status === "in_progress").length;

  // Filtered Submissions List
  const filteredAttempts = attempts.filter((attempt) => {
    const matchesSearch = attempt.trainee_name.toLowerCase().includes(searchQuery.toLowerCase().trim());
    const matchesMode =
      modeFilter === "all"
        ? true
        : modeFilter === "practice"
        ? attempt.mode === "practice"
        : attempt.mode !== "practice";
    return matchesSearch && matchesMode;
  });

  // Inspected Attempt Question Breakdown
  const getInspectedBreakdown = (attempt: Attempt): QuestionBreakdown[] => {
    if (attempt.breakdown && attempt.breakdown.length > 0) {
      return attempt.breakdown;
    }
    return [];
  };

  const activeBreakdown = inspectedAttempt ? getInspectedBreakdown(inspectedAttempt) : [];
  const wrongCount = activeBreakdown.filter((q) => !q.isCorrect).length;
  const correctCount = activeBreakdown.filter((q) => q.isCorrect).length;

  const filteredBreakdown = activeBreakdown.filter((q) => {
    if (filterType === "wrong") return !q.isCorrect;
    if (filterType === "correct") return q.isCorrect;
    return true;
  });

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-16">
      {/* Top Navbar */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs sm:text-sm font-semibold transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Dashboard</span>
            </Link>
            <span className="text-gray-300 hidden sm:inline">|</span>
            <div className="min-w-0 hidden md:block">
              <span className="text-xs text-gray-500 font-medium">Question Set Analytics & Proctoring</span>
              <h1 className="text-sm font-bold text-gray-900 truncate">{currentQuiz.title}</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchAnalytics}
              disabled={loading}
              className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 text-xs font-medium transition inline-flex items-center gap-1.5 shadow-sm"
              title="Refresh Analytics"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-[#0056D2]" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              onClick={() => setIsAddQuestionsOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-[#0056D2] hover:bg-blue-100 text-xs sm:text-sm font-semibold transition inline-flex items-center gap-1.5"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Add Questions</span>
            </button>

            <a
              href={`/quiz/${currentQuiz.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg bg-[#0056D2] hover:bg-[#0045A8] text-white text-xs sm:text-sm font-semibold transition inline-flex items-center gap-1.5 shadow"
            >
              <span>Preview Exam</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Quiz Banner & Meta Card */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-3 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {currentQuiz.category && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#0056D2] bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-md">
                    <Folder className="w-3 h-3" />
                    <span>{currentQuiz.category}</span>
                  </span>
                )}
                {currentQuiz.tags &&
                  currentQuiz.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-md"
                    >
                      <Tag className="w-3 h-3 text-gray-400" />
                      <span>{tag}</span>
                    </span>
                  ))}
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-50 text-[#0056D2] font-semibold border border-blue-200">
                  {currentQuiz.raw_json.length} Total Questions in Pool
                </span>
                {currentQuiz.time_limit_minutes ? (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 font-semibold border border-amber-200 flex items-center gap-1">
                    <Timer className="w-3 h-3" />
                    {currentQuiz.time_limit_minutes} mins limit
                  </span>
                ) : null}
              </div>

              <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight leading-snug">
                {currentQuiz.title}
              </h2>

              <p className="text-xs text-gray-500 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" /> Created on {formatDate(currentQuiz.created_at)}
              </p>
            </div>

            {/* Quick Share Link Launchpad */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between space-y-3 lg:max-w-md w-full">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-gray-800 flex items-center gap-1.5">
                  <Share2 className="w-3.5 h-3.5 text-[#0056D2]" /> Share Links with Candidates
                </span>
                <span className="text-[11px] text-gray-500">Instant Access</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-2.5 py-1.5">
                  <span className="text-gray-500 font-medium">Questions:</span>
                  <input
                    type="number"
                    min={1}
                    max={currentQuiz.raw_json.length}
                    value={customCount}
                    onChange={(e) => setCustomCount(parseInt(e.target.value, 10) || 1)}
                    className="w-12 text-center font-bold text-[#0056D2] focus:outline-none"
                  />
                </div>
                <div className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-2.5 py-1.5">
                  <span className="text-gray-500 font-medium">Time (min):</span>
                  <input
                    type="number"
                    min={1}
                    max={180}
                    value={customTime}
                    onChange={(e) => setCustomTime(parseInt(e.target.value, 10) || 1)}
                    className="w-12 text-center font-bold text-amber-700 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => handleCopyLink(customShareUrl, "custom")}
                  className="flex-1 py-1.5 px-3 rounded-lg bg-green-50 hover:bg-green-100 border border-green-200 text-green-700 font-semibold text-xs transition flex items-center justify-center gap-1.5 shadow-sm"
                >
                  {copied === "custom" ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied === "custom" ? "Copied!" : `Copy Exam (${validCustomCount} Qs)`}</span>
                </button>

                <button
                  onClick={() => handleCopyLink(practiceShareUrl, "practice")}
                  className="flex-1 py-1.5 px-3 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 font-semibold text-xs transition flex items-center justify-center gap-1.5 shadow-sm"
                >
                  {copied === "practice" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Lightbulb className="w-3.5 h-3.5 text-amber-500" />}
                  <span>{copied === "practice" ? "Copied!" : "Practice Drill"}</span>
                </button>

                <button
                  onClick={() => handleCopyLink(baseUrl, "full")}
                  className="py-1.5 px-3 rounded-lg bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 font-medium text-xs transition flex items-center justify-center gap-1"
                >
                  {copied === "full" ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>Full</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Executive KPI Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Card 1: Total Submissions */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#0056D2] flex items-center justify-center shrink-0 border border-blue-100">
              <Users className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500 font-medium">Total Submissions</p>
              <h3 className="text-2xl font-extrabold text-gray-900 mt-0.5">{totalAttendees}</h3>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {attempts.filter((a) => a.mode === "practice").length} Practice •{" "}
                {attempts.filter((a) => a.mode !== "practice").length} Exam
              </p>
            </div>
          </div>

          {/* Card 2: Average Score */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500 font-medium">Average Score</p>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <h3 className="text-2xl font-extrabold text-gray-900">{avgScore}</h3>
                <span className="text-xs text-gray-500 font-semibold">({avgPercentage}%)</span>
              </div>
              <p className="text-[11px] text-gray-400 mt-0.5">Max benchmark: {sampleMaxScore} pts</p>
            </div>
          </div>

          {/* Card 3: Pass Rate */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
              <Award className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500 font-medium">Pass Rate (≥50%)</p>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <h3 className="text-2xl font-extrabold text-gray-900">{passRate}%</h3>
                <span className="text-xs text-gray-500 font-medium">({passingCount}/{totalAttendees})</span>
              </div>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Top Score: {highestAttempt ? highestAttempt.score : 0} pts
              </p>
            </div>
          </div>

          {/* Card 4: Live Active Proctoring */}
          <div
            onClick={() => setActiveTab("live_monitor")}
            className={`border rounded-2xl p-5 shadow-sm flex items-center gap-4 cursor-pointer transition ${
              activeTab === "live_monitor"
                ? "bg-emerald-50/70 border-emerald-300 ring-2 ring-emerald-500/20"
                : "bg-white border-gray-200 hover:border-emerald-200"
            }`}
          >
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100 relative">
              <Radio className="w-6 h-6 text-emerald-600" />
              {activeLiveCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-white" />
                </span>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500 font-medium">Live Active Candidates</p>
              <h3 className="text-2xl font-extrabold text-gray-900 mt-0.5">{activeLiveCount} Active</h3>
              <p className="text-[11px] text-emerald-600 font-semibold mt-0.5 flex items-center gap-1">
                <span>Streaming live desk</span>
                <ChevronRight className="w-3 h-3" />
              </p>
            </div>
          </div>
        </div>

        {/* Tab Selection Navigation */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center border-b border-gray-200 px-6 pt-4 gap-6 bg-slate-50/50">
            <button
              onClick={() => setActiveTab("completed")}
              className={`pb-4 font-bold text-sm sm:text-base border-b-2 transition flex items-center gap-2 ${
                activeTab === "completed"
                  ? "border-[#0056D2] text-[#0056D2]"
                  : "border-transparent text-gray-500 hover:text-gray-900"
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Completed Submissions ({attempts.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("live_monitor")}
              className={`pb-4 font-bold text-sm sm:text-base border-b-2 transition flex items-center gap-2 ${
                activeTab === "live_monitor"
                  ? "border-emerald-600 text-emerald-700"
                  : "border-transparent text-gray-500 hover:text-gray-900"
              }`}
            >
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <span>Live Classroom Monitor ({activeLiveCount} Taking Exam)</span>
            </button>
          </div>

          {/* TAB 1: Completed Submissions View */}
          {activeTab === "completed" && (
            <div className="p-6 space-y-4">
              {/* Filter & Action Toolbar */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 flex-1 max-w-md">
                  <div className="relative w-full">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search candidate by name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-[#0056D2] focus:bg-white transition"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center bg-gray-100 p-1 rounded-xl border border-gray-200 text-xs">
                    <button
                      onClick={() => setModeFilter("all")}
                      className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                        modeFilter === "all" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800"
                      }`}
                    >
                      All ({attempts.length})
                    </button>
                    <button
                      onClick={() => setModeFilter("exam")}
                      className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                        modeFilter === "exam" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800"
                      }`}
                    >
                      Exams ({attempts.filter((a) => a.mode !== "practice").length})
                    </button>
                    <button
                      onClick={() => setModeFilter("practice")}
                      className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                        modeFilter === "practice" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800"
                      }`}
                    >
                      Practice ({attempts.filter((a) => a.mode === "practice").length})
                    </button>
                  </div>

                  {attempts.length > 0 && (
                    <button
                      onClick={() => setIsClearingAll(true)}
                      className="px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-semibold transition inline-flex items-center gap-1.5 shadow-sm"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Clear All Responses</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Table or Empty State */}
              {loading && attempts.length === 0 ? (
                <div className="py-16 text-center text-gray-500 flex flex-col items-center justify-center gap-2">
                  <div className="w-8 h-8 border-3 border-[#0056D2]/30 border-t-[#0056D2] rounded-full animate-spin" />
                  <p className="text-xs font-medium">Loading submissions...</p>
                </div>
              ) : filteredAttempts.length === 0 ? (
                <div className="py-16 text-center bg-gray-50 border border-gray-200 rounded-2xl p-8">
                  <Users className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                  <p className="text-base font-bold text-gray-800">No submissions found</p>
                  <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
                    {searchQuery
                      ? `No candidate submissions matching "${searchQuery}".`
                      : "Share the exam link with candidates to start receiving results and answers."}
                  </p>
                  <button
                    onClick={() => handleCopyLink(customShareUrl, "custom")}
                    className="mt-4 px-4 py-2 rounded-xl bg-[#0056D2] hover:bg-[#0045A8] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition shadow"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy Exam Link
                  </button>
                </div>
              ) : (
                <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50/80 border-b border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                        <th className="py-3.5 px-6">Candidate</th>
                        <th className="py-3.5 px-4">Score</th>
                        <th className="py-3.5 px-4">Accuracy</th>
                        <th className="py-3.5 px-4 text-center">Answer Sheet</th>
                        <th className="py-3.5 px-4 text-right">Submitted At</th>
                        <th className="py-3.5 px-4 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                      {filteredAttempts.map((attempt) => {
                        const max = attempt.max_score || sampleMaxScore;
                        const pct = max > 0 ? Math.round((attempt.score / max) * 100) : 0;
                        let badgeColor = "bg-red-50 text-red-700 border-red-200";
                        if (pct >= 80) badgeColor = "bg-green-50 text-green-700 border-green-200";
                        else if (pct >= 50) badgeColor = "bg-amber-50 text-amber-700 border-amber-200";

                        return (
                          <tr key={attempt.id} className="hover:bg-blue-50/30 transition group">
                            {/* Candidate Info with Badges */}
                            <td className="py-4 px-6">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-blue-50 text-[#0056D2] font-bold text-sm flex items-center justify-center border border-blue-200 shrink-0">
                                  {attempt.trainee_name.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className="font-bold text-gray-900 group-hover:text-[#0056D2] transition truncate">
                                      {attempt.trainee_name}
                                    </h4>
                                    {attempt.mode === "practice" && (
                                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-bold flex items-center gap-1">
                                        <Lightbulb className="w-3 h-3 text-amber-500" />
                                        Practice
                                      </span>
                                    )}
                                    {attempt.auto_submitted && (
                                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 font-bold flex items-center gap-1">
                                        <Clock className="w-3 h-3 text-purple-500" />
                                        Auto-Submitted
                                      </span>
                                    )}
                                    {attempt.tab_switches && attempt.tab_switches > 0 ? (
                                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 font-bold flex items-center gap-1">
                                        ⚠️ {attempt.tab_switches} tab switch{attempt.tab_switches > 1 ? "es" : ""}
                                      </span>
                                    ) : (
                                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200 font-medium">
                                        0 switches
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Score */}
                            <td className="py-4 px-4">
                              <span className="font-extrabold text-gray-900 text-base">{attempt.score}</span>
                              <span className="text-gray-400 text-xs font-normal"> / {max}</span>
                            </td>

                            {/* Percentage Badge */}
                            <td className="py-4 px-4">
                              <span className={`text-xs px-3 py-1 rounded-full border font-bold ${badgeColor}`}>
                                {pct}%
                              </span>
                            </td>

                            {/* Detailed Answers Action */}
                            <td className="py-4 px-4 text-center">
                              {attempt.mode === "practice" || !attempt.breakdown || attempt.breakdown.length === 0 ? (
                                <span className="text-xs text-gray-400 italic">Practice Drill (Logged)</span>
                              ) : (
                                <button
                                  onClick={() => setInspectedAttempt(attempt)}
                                  className="px-3 py-1.5 rounded-lg bg-[#0056D2]/10 hover:bg-[#0056D2]/20 text-[#0056D2] font-bold text-xs transition inline-flex items-center gap-1.5 border border-[#0056D2]/20 shadow-sm"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  <span>View Answers</span>
                                </button>
                              )}
                            </td>

                            {/* Date & Time */}
                            <td className="py-4 px-4 text-right text-xs text-gray-500">
                              <div className="flex items-center justify-end gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-gray-400" />
                                <span>{formatDate(attempt.submitted_at)}</span>
                              </div>
                            </td>

                            {/* Delete Action */}
                            <td className="py-4 px-4 text-center">
                              <button
                                onClick={() => setAttemptToDelete(attempt)}
                                title={`Delete submission for ${attempt.trainee_name}`}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Live Classroom Proctoring Monitor */}
          {activeTab === "live_monitor" && (
            <div className="p-6 space-y-6">
              {/* Header Status Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-emerald-50/60 border border-emerald-200 rounded-2xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <Radio className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-emerald-950">Real-Time Proctoring Stream Active</h3>
                    <p className="text-xs text-emerald-700">Heartbeats polling continuously every 3.5 seconds.</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs px-3 py-1.5 rounded-full bg-white text-emerald-800 border border-emerald-200 font-bold flex items-center gap-2 shadow-sm">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>{activeLiveCount} Currently Taking Exam</span>
                  </span>
                </div>
              </div>

              {/* Candidates Grid */}
              {liveSessions.length === 0 ? (
                <div className="py-16 text-center bg-gray-50 border border-gray-200 rounded-2xl p-8">
                  <Radio className="w-12 h-12 text-gray-400 mx-auto mb-3 animate-pulse" />
                  <p className="text-base font-bold text-gray-800">Waiting for candidates to start the assessment</p>
                  <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
                    When candidates open the examination link and enter their names, their live question progress and
                    anti-cheat metrics will stream here in real-time.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {liveSessions.map((session) => {
                    const isSubmitted = session.status === "submitted";
                    const pct =
                      session.total_questions > 0
                        ? Math.round((session.answered_count / session.total_questions) * 100)
                        : 0;

                    return (
                      <div
                        key={session.id}
                        className={`p-5 rounded-2xl border transition bg-white shadow-sm flex flex-col justify-between space-y-4 ${
                          isSubmitted
                            ? "border-emerald-200 bg-emerald-50/20"
                            : "border-gray-200 hover:border-blue-300 hover:shadow-md"
                        }`}
                      >
                        {/* Header: Avatar, Name, Status */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-11 h-11 rounded-full bg-blue-50 text-[#0056D2] font-bold text-base flex items-center justify-center border border-blue-200 shrink-0">
                              {session.trainee_name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-extrabold text-gray-900 text-sm truncate">{session.trainee_name}</h4>
                              <p className="text-[11px] text-gray-500 mt-0.5">
                                {session.auto_submitted
                                  ? "Time expired (Auto-finalized)"
                                  : isSubmitted
                                  ? "Exam finished"
                                  : "In examination"}
                              </p>
                            </div>
                          </div>

                          <span
                            className={`text-xs px-2.5 py-1 rounded-full font-bold flex items-center gap-1.5 shrink-0 border ${
                              session.auto_submitted
                                ? "bg-purple-100 text-purple-800 border-purple-200"
                                : isSubmitted
                                ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                : "bg-blue-50 text-[#0056D2] border-blue-200"
                            }`}
                          >
                            {session.auto_submitted ? (
                              <>
                                <Clock className="w-3.5 h-3.5 text-purple-600" />
                                <span>Auto-Submitted</span>
                              </>
                            ) : isSubmitted ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Submitted</span>
                              </>
                            ) : (
                              <>
                                <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                                <span>Active</span>
                              </>
                            )}
                          </span>
                        </div>

                        {/* Proctoring Warning Badge: Tab-Switches Tracker */}
                        <div>
                          {session.tab_switches && session.tab_switches > 0 ? (
                            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-bold flex items-center justify-between">
                              <span className="flex items-center gap-1.5">
                                <AlertTriangle className="w-4 h-4 text-amber-600" />
                                <span>Focus Loss / Tab Switches</span>
                              </span>
                              <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 font-extrabold text-[11px]">
                                {session.tab_switches} time{session.tab_switches > 1 ? "s" : ""}
                              </span>
                            </div>
                          ) : (
                            <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-500 text-xs font-medium flex items-center justify-between">
                              <span className="flex items-center gap-1.5">
                                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                                <span>Anti-Cheat Integrity</span>
                              </span>
                              <span className="text-[11px] font-semibold text-emerald-700">0 switches</span>
                            </div>
                          )}
                        </div>

                        {/* Progress Bar */}
                        <div>
                          <div className="flex items-center justify-between text-xs mb-1.5">
                            <span className="text-gray-500 font-medium">
                              Progress: <strong className="text-gray-900">{session.answered_count}</strong> of{" "}
                              {session.total_questions} Answered
                            </span>
                            <span className="font-extrabold text-blue-600">{pct}%</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                            <div
                              className={`h-2.5 rounded-full transition-all duration-500 ${
                                isSubmitted ? "bg-emerald-500" : "bg-[#0056D2]"
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>

                        {/* Heartbeat Timestamp */}
                        <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-gray-400" /> Last heartbeat
                          </span>
                          <span>{formatDate(session.last_active)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* ------------------------------------------------------------- */}
      {/* Detailed Answer Sheet Inspector Modal */}
      {/* ------------------------------------------------------------- */}
      {inspectedAttempt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-scale-in">
          <div className="w-full max-w-4xl bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 bg-slate-50 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-blue-100 text-[#0056D2] font-bold text-sm flex items-center justify-center border border-blue-200 shrink-0">
                  {inspectedAttempt.trainee_name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-extrabold text-base text-gray-900 truncate">
                      {inspectedAttempt.trainee_name}&apos;s Assessment Answer Sheet
                    </h3>
                    {inspectedAttempt.auto_submitted && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-300 font-bold flex items-center gap-1">
                        ⏱️ Auto-submitted (Time Expired)
                      </span>
                    )}
                    {inspectedAttempt.tab_switches && inspectedAttempt.tab_switches > 0 ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 font-bold flex items-center gap-1">
                        ⚠️ {inspectedAttempt.tab_switches} tab switch{inspectedAttempt.tab_switches > 1 ? "es" : ""}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Score: <strong>{inspectedAttempt.score}</strong> / {inspectedAttempt.max_score || sampleMaxScore} (
                    {Math.round(
                      (inspectedAttempt.score / (inspectedAttempt.max_score || sampleMaxScore || 1)) * 100
                    )}
                    %) • Submitted {formatDate(inspectedAttempt.submitted_at)}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setInspectedAttempt(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Auto-submitted Notice Banner */}
            {inspectedAttempt.auto_submitted && (
              <div className="px-6 py-3 bg-purple-50 border-b border-purple-200 flex items-start sm:items-center gap-2.5 text-xs text-purple-900">
                <Clock className="w-4 h-4 text-purple-600 shrink-0 mt-0.5 sm:mt-0" />
                <span>
                  <strong>Automatic Submission Notice:</strong> This assessment was automatically submitted because the examinee left without submitting and the allocated time limit expired. Saved answers up to that point were graded.
                </span>
              </div>
            )}

            {/* Filter Tabs */}
            <div className="px-6 py-3 border-b border-gray-200 bg-white flex items-center gap-2">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wide mr-2 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" /> Filter:
              </span>
              <button
                onClick={() => setFilterType("all")}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                  filterType === "all" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                All Questions ({activeBreakdown.length})
              </button>
              <button
                onClick={() => setFilterType("correct")}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                  filterType === "correct"
                    ? "bg-green-600 text-white"
                    : "bg-green-50 text-green-700 hover:bg-green-100 border border-green-200"
                }`}
              >
                Correct ({correctCount})
              </button>
              <button
                onClick={() => setFilterType("wrong")}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                  filterType === "wrong"
                    ? "bg-red-600 text-white"
                    : "bg-red-50 text-red-700 hover:bg-red-100 border border-red-200"
                }`}
              >
                Incorrect ({wrongCount})
              </button>
            </div>

            {/* Questions Breakdown List */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {filteredBreakdown.length === 0 ? (
                <div className="py-12 text-center text-gray-500">
                  <p className="text-sm font-medium">No questions matching this filter.</p>
                </div>
              ) : (
                filteredBreakdown.map((item, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-xl border transition ${
                      item.isCorrect ? "bg-green-50/40 border-green-200" : "bg-red-50/40 border-red-200"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <span
                          className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 ${
                            item.isCorrect ? "bg-green-600 text-white" : "bg-red-600 text-white"
                          }`}
                        >
                          {(item.originalIndex ?? item.questionIndex ?? idx) + 1}
                        </span>
                        <h4 className="font-bold text-sm text-gray-900 leading-snug">{item.question}</h4>
                      </div>
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 shrink-0 ${
                          item.isCorrect ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                        }`}
                      >
                        {item.isCorrect ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" /> Correct
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3.5 h-3.5" /> Incorrect
                          </>
                        )}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 rounded-lg border bg-white border-gray-200">
                        <span className="text-gray-400 font-medium block text-[11px]">Candidate&apos;s Answer:</span>
                        <span className={`font-bold ${item.isCorrect ? "text-green-700" : "text-red-700"}`}>
                          {item.selectedAnswer || "Not Answered"}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-lg border bg-white border-gray-200">
                        <span className="text-gray-400 font-medium block text-[11px]">Correct Answer:</span>
                        <span className="font-bold text-green-700">{item.correctAnswer}</span>
                      </div>
                    </div>

                    {item.explanation && (
                      <div className="mt-2.5 pt-2.5 border-t border-gray-200/80 text-xs text-gray-600 leading-relaxed">
                        <strong className="text-gray-800">💡 Explanation: </strong>
                        {item.explanation}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog: Delete Single Attempt */}
      {attemptToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="font-bold text-gray-900 text-base">Delete Candidate Submission?</h3>
            <p className="text-xs text-gray-500">
              Are you sure you want to delete the submission for <strong>{attemptToDelete.trainee_name}</strong>? This
              action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setAttemptToDelete(null)}
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAttempt}
                disabled={deletingAttempt}
                className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold"
              >
                {deletingAttempt ? "Deleting..." : "Delete Submission"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog: Clear All Attempts */}
      {isClearingAll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="font-bold text-red-600 text-base flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" /> Clear All Responses?
            </h3>
            <p className="text-xs text-gray-600">
              This will permanently delete all <strong>{attempts.length}</strong> candidate submissions for this question
              set.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsClearingAll(false)}
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleClearAllAttempts}
                disabled={clearingAll}
                className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold"
              >
                {clearingAll ? "Clearing..." : "Yes, Clear All"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Questions Modal */}
      <AddQuestionsModal
        quiz={currentQuiz}
        isOpen={isAddQuestionsOpen}
        onClose={() => setIsAddQuestionsOpen(false)}
        onQuestionsAdded={(updated) => {
          setCurrentQuiz(updated);
          setIsAddQuestionsOpen(false);
        }}
      />
    </div>
  );
}
