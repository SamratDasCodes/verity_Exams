"use client";

import { useEffect, useState } from "react";
import {
  X,
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
  CheckCheck,
  Image as ImageIcon,
  Timer,
  Radio,
  Filter,
  Trash2,
  Lightbulb,
  Folder,
  Tag,
  Edit3,
  Maximize2,
} from "lucide-react";
import Link from "next/link";
import {
  getQuizAnalyticsAction,
  getLiveProctoringAction,
  updateQuizHeaderImageAction,
  updateQuizCategoryAndTagsAction,
  deleteAttemptAction,
  clearAttemptsForQuizAction,
  deleteQuizAction,
} from "@/app/actions/quiz";
import { Quiz, Attempt, QuestionBreakdown, ActiveStudentSession } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import AddQuestionsModal from "./AddQuestionsModal";

interface AnalyticsModalProps {
  quiz: Quiz | null;
  isOpen: boolean;
  onClose: () => void;
  onQuizUpdated?: (updatedQuiz: Quiz) => void;
  onQuizDeleted?: (deletedQuizId: string) => void;
  serverIp?: string;
}

export default function AnalyticsModal({
  quiz,
  isOpen,
  onClose,
  onQuizUpdated,
  onQuizDeleted,
  serverIp,
}: AnalyticsModalProps) {
  const [currentQuiz, setCurrentQuiz] = useState<Quiz | null>(quiz);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [customCount, setCustomCount] = useState<number>(20);
  const [customTime, setCustomTime] = useState<number>(20);
  const [isAddQuestionsOpen, setIsAddQuestionsOpen] = useState(false);
  const [inspectedAttempt, setInspectedAttempt] = useState<Attempt | null>(null);
  const [filterType, setFilterType] = useState<"all" | "wrong" | "correct">("all");

  // Live Proctoring Monitor
  const [activeTab, setActiveTab] = useState<"completed" | "live_monitor">("completed");
  const [liveSessions, setLiveSessions] = useState<ActiveStudentSession[]>([]);

  const [editingHeaderImage, setEditingHeaderImage] = useState(false);
  const [headerImageInput, setHeaderImageInput] = useState("");
  const [savingHeaderImage, setSavingHeaderImage] = useState(false);

  // Category & Tags States
  const [editingCategoryTags, setEditingCategoryTags] = useState(false);
  const [editCategory, setEditCategory] = useState("");
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editTagInput, setEditTagInput] = useState("");
  const [savingCategoryTags, setSavingCategoryTags] = useState(false);

  // Deletion States
  const [attemptToDelete, setAttemptToDelete] = useState<Attempt | null>(null);
  const [deletingAttempt, setDeletingAttempt] = useState(false);

  const [isClearingAll, setIsClearingAll] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);

  const [isDeletingQuiz, setIsDeletingQuiz] = useState(false);
  const [deletingQuiz, setDeletingQuiz] = useState(false);

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
    if (!currentQuiz) return;
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

  const handleDeleteQuizFromModal = async () => {
    if (!currentQuiz) return;
    setDeletingQuiz(true);
    try {
      const res = await deleteQuizAction(currentQuiz.id);
      if (res.success) {
        setIsDeletingQuiz(false);
        onQuizDeleted?.(currentQuiz.id);
        onClose();
      }
    } catch (err) {
      console.error("Failed to delete quiz:", err);
    } finally {
      setDeletingQuiz(false);
    }
  };

  useEffect(() => {
    setCurrentQuiz(quiz);
    if (quiz) {
      setCustomCount(Math.min(20, quiz.raw_json.length));
      setHeaderImageInput(quiz.header_image_url || "");
      setEditCategory(quiz.category || "");
      setEditTags(quiz.tags || []);
    }
  }, [quiz]);

  const handleAddEditTag = (tagToAdd: string) => {
    const cleaned = tagToAdd.trim().replace(/^#/, "");
    if (cleaned && !editTags.includes(cleaned)) {
      setEditTags([...editTags, cleaned]);
    }
    setEditTagInput("");
  };

  const handleRemoveEditTag = (tagToRemove: string) => {
    setEditTags(editTags.filter((t) => t !== tagToRemove));
  };

  const handleSaveCategoryTags = async () => {
    if (!currentQuiz) return;
    setSavingCategoryTags(true);
    try {
      const res = await updateQuizCategoryAndTagsAction(
        currentQuiz.id,
        editCategory.trim() || undefined,
        editTags
      );
      if (res.success && res.quiz) {
        setCurrentQuiz(res.quiz);
        onQuizUpdated?.(res.quiz);
        setEditingCategoryTags(false);
      }
    } catch (err) {
      console.error("Failed to update category and tags:", err);
    } finally {
      setSavingCategoryTags(false);
    }
  };

  const handleSaveHeaderImage = async (urlToSave?: string) => {
    if (!currentQuiz) return;
    setSavingHeaderImage(true);
    const finalUrl = urlToSave !== undefined ? urlToSave : headerImageInput;
    try {
      const res = await updateQuizHeaderImageAction(currentQuiz.id, finalUrl.trim() || undefined);
      if (res.success && res.quiz) {
        setCurrentQuiz(res.quiz);
        onQuizUpdated?.(res.quiz);
        setHeaderImageInput(res.quiz.header_image_url || "");
        setEditingHeaderImage(false);
      }
    } catch (err) {
      console.error("Failed to update header image:", err);
    } finally {
      setSavingHeaderImage(false);
    }
  };

  const fetchAnalytics = async () => {
    if (!currentQuiz) return;
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
      console.error("Error fetching analytics:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && currentQuiz) {
      fetchAnalytics();
    } else {
      setAttempts([]);
      setInspectedAttempt(null);
      setLiveSessions([]);
    }
  }, [isOpen, currentQuiz?.id]);

  // Live Proctoring Polling (every 3.5 seconds when Live Monitor tab is open)
  useEffect(() => {
    if (!isOpen || !currentQuiz) return;

    const fetchLive = async () => {
      try {
        const res = await getLiveProctoringAction(currentQuiz.id);
        if (res.success && res.sessions) {
          setLiveSessions(res.sessions);
        }
      } catch (err) {
        console.error("Error polling live sessions:", err);
      }
    };

    fetchLive();
    const interval = setInterval(fetchLive, 3500);
    return () => clearInterval(interval);
  }, [isOpen, currentQuiz?.id, activeTab]);

  if (!isOpen || !currentQuiz) return null;

  const totalAttendees = attempts.length;
  const sampleMaxScore = attempts.length > 0 && attempts[0].max_score ? attempts[0].max_score : currentQuiz.raw_json.length;
  const totalPercentageSum = attempts.reduce((acc, curr) => {
    const max = curr.max_score || currentQuiz.raw_json.length;
    return acc + (max > 0 ? (curr.score / max) * 100 : 0);
  }, 0);
  const avgPercentage = totalAttendees > 0 ? Math.round(totalPercentageSum / totalAttendees) : 0;
  const avgScore = totalAttendees > 0 ? (attempts.reduce((acc, curr) => acc + curr.score, 0) / totalAttendees).toFixed(1) : "0";
  const highestAttempt = totalAttendees > 0 ? attempts.reduce((prev, curr) => (prev.score > curr.score ? prev : curr)) : null;

  const getShareOrigin = () => {
    if (typeof window === "undefined") return "";
    const curr = window.location.origin;
    if (serverIp && serverIp !== "localhost" && (curr.includes("localhost") || curr.includes("127.0.0.1"))) {
      return `http://${serverIp}:3000`;
    }
    return curr;
  };

  const shareOrigin = getShareOrigin();
  const baseUrl = `${shareOrigin}/quiz/${currentQuiz.id}`;
  const validCustomCount = customCount > 0 ? customCount : 20;
  const validCustomTime = customTime > 0 ? customTime : 20;
  const customShareUrl = `${baseUrl}?count=${validCustomCount}${validCustomTime > 0 ? `&time=${validCustomTime}` : ""}`;

  const handleCopyLink = async (urlToCopy: string, tag: string) => {
    await navigator.clipboard.writeText(urlToCopy);
    setCopied(tag);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleQuestionsAdded = (updatedQuiz: Quiz) => {
    setCurrentQuiz(updatedQuiz);
    onQuizUpdated?.(updatedQuiz);
  };

  const getInspectedBreakdown = (attempt: Attempt): QuestionBreakdown[] => {
    if (attempt.breakdown && Array.isArray(attempt.breakdown) && attempt.breakdown.length > 0) {
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

  const activeLiveCount = liveSessions.filter((s) => s.status === "in_progress").length;

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center p-2 sm:p-4 bg-black/50 backdrop-blur-sm animate-scale-in">
        <div className="w-full max-w-4xl bg-white border border-gray-200 rounded-2xl sm:rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh] sm:max-h-[90vh]">
          {/* Header */}
          <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-gray-200 bg-gray-50">
            {/* Top row: Title + Badges on left, Close X pinned to top-right */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-lg font-bold text-gray-800 truncate">{currentQuiz.title}</h2>
                  <span className="text-[11px] sm:text-xs px-2.5 py-0.5 rounded-full bg-blue-50 text-[#0056D2] font-semibold border border-blue-200 shrink-0">
                    {currentQuiz.raw_json.length} Qs in Pool
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> Created {formatDate(currentQuiz.created_at)}
                </p>
              </div>

              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition shrink-0"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Second row: Action Buttons */}
            <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setIsAddQuestionsOpen(true)}
                  className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 text-[#0056D2] font-semibold text-xs transition flex items-center gap-1.5"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Add More Questions</span>
                </button>

                <Link
                  href={`/dashboard/analytics/${currentQuiz.id}`}
                  className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-semibold text-xs transition flex items-center gap-1.5 shadow-sm"
                  title="Open Dedicated Full-Screen Page"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Open Separate Page ↗</span>
                </Link>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={fetchAnalytics}
                  disabled={loading}
                  title="Refresh submissions"
                  className="p-1.5 sm:p-2 rounded-lg bg-white sm:bg-gray-100 border border-gray-200 sm:border-transparent hover:bg-gray-200 text-gray-600 transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${loading ? "animate-spin text-[#0056D2]" : ""}`} />
                </button>
                <button
                  onClick={() => setIsDeletingQuiz(true)}
                  title="Delete this Question Set"
                  className="p-1.5 sm:p-2 rounded-lg bg-white sm:bg-gray-100 border border-gray-200 sm:border-transparent hover:bg-red-50 text-gray-500 hover:text-red-600 transition"
                >
                  <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Category & Tags Bar */}
          <div className="px-4 sm:px-6 py-2.5 bg-amber-50/40 border-b border-gray-200 text-xs">
            {!editingCategoryTags ? (
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <div className="flex items-center gap-1.5 font-semibold text-gray-700">
                    <Folder className="w-3.5 h-3.5 text-[#0056D2]" />
                    <span>Category:</span>
                    <span className="px-2 py-0.5 rounded bg-blue-50 text-[#0056D2] border border-blue-200 font-bold">
                      {currentQuiz.category || "Uncategorized"}
                    </span>
                  </div>

                  <div className="h-3.5 w-px bg-gray-300 hidden sm:block" />

                  <div className="flex items-center gap-1.5 font-semibold text-gray-700">
                    <Tag className="w-3.5 h-3.5 text-amber-600" />
                    <span>Tags:</span>
                    {currentQuiz.tags && currentQuiz.tags.length > 0 ? (
                      currentQuiz.tags.map((t) => (
                        <span key={t} className="px-1.5 py-0.5 rounded-full bg-white text-gray-700 border border-gray-200 text-[10px] font-semibold">
                          #{t}
                        </span>
                      ))
                    ) : (
                      <span className="text-gray-400 font-normal italic">None</span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setEditCategory(currentQuiz.category || "");
                    setEditTags(currentQuiz.tags || []);
                    setEditingCategoryTags(true);
                  }}
                  className="text-[#0056D2] hover:underline font-semibold text-[11px] inline-flex items-center gap-1"
                >
                  <Edit3 className="w-3 h-3" />
                  <span>Edit Category & Tags</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2 p-2.5 bg-white border border-gray-200 rounded-xl shadow-inner">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1">
                    <Folder className="w-3.5 h-3.5 text-[#0056D2]" />
                    <input
                      type="text"
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value)}
                      placeholder="Category e.g. Physics"
                      className="bg-gray-50 border border-gray-300 rounded-lg px-2.5 py-1 text-xs text-gray-800 focus:outline-none focus:border-[#0056D2] w-36"
                    />
                  </div>

                  <div className="flex items-center gap-1">
                    <Tag className="w-3.5 h-3.5 text-amber-600" />
                    <input
                      type="text"
                      value={editTagInput}
                      onChange={(e) => setEditTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === ",") {
                          e.preventDefault();
                          handleAddEditTag(editTagInput);
                        }
                      }}
                      placeholder="Add tag (Enter)"
                      className="bg-gray-50 border border-gray-300 rounded-lg px-2.5 py-1 text-xs text-gray-800 focus:outline-none focus:border-[#0056D2] w-32"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddEditTag(editTagInput)}
                      className="text-[11px] px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg font-semibold text-gray-700"
                    >
                      Add
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5 ml-auto">
                    <button
                      type="button"
                      disabled={savingCategoryTags}
                      onClick={handleSaveCategoryTags}
                      className="text-xs bg-[#0056D2] hover:bg-[#0045A8] text-white px-3 py-1 rounded-lg font-semibold transition"
                    >
                      {savingCategoryTags ? "Saving..." : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingCategoryTags(false)}
                      className="text-xs text-gray-500 hover:text-gray-800 px-2 py-1"
                    >
                      Cancel
                    </button>
                  </div>
                </div>

                {editTags.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    {editTags.map((t) => (
                      <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-[#0056D2] border border-blue-200 text-[10px] font-semibold">
                        #{t}
                        <button type="button" onClick={() => handleRemoveEditTag(t)} className="hover:text-red-600 font-bold ml-0.5">×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Exam Header Logo Bar */}
          <div className="px-4 sm:px-6 py-2.5 bg-blue-50/50 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <ImageIcon className="w-4 h-4 text-[#0056D2] shrink-0" />
              <span className="text-gray-600 font-medium shrink-0">Exam Heading:</span>
              {currentQuiz.header_image_url ? (
                <div className="flex items-center gap-1.5 bg-white px-2 py-0.5 rounded border border-gray-200 min-w-0 max-w-[200px] sm:max-w-[240px]">
                  <img
                    src={currentQuiz.header_image_url}
                    alt="Logo"
                    className="h-4 object-contain shrink-0"
                  />
                  <span className="text-[11px] text-gray-500 font-mono truncate">
                    {currentQuiz.header_image_url}
                  </span>
                </div>
              ) : (
                <span className="bg-white px-2 py-0.5 rounded border border-gray-200 text-gray-800 font-semibold truncate text-[11px]">
                  Title (&quot;{currentQuiz.title}&quot;)
                </span>
              )}
            </div>

            <div className="flex items-center self-end sm:self-auto">
              {!editingHeaderImage ? (
                <button
                  type="button"
                  onClick={() => setEditingHeaderImage(true)}
                  className="text-[#0056D2] hover:underline font-semibold text-[11px]"
                >
                  {currentQuiz.header_image_url ? "Change Logo / Image" : "Set Custom Logo / Image"}
                </button>
              ) : (
                <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto">
                  <input
                    type="text"
                    value={headerImageInput}
                    onChange={(e) => setHeaderImageInput(e.target.value)}
                    placeholder="Image URL"
                    className="flex-1 sm:w-48 bg-white border border-gray-300 rounded px-2 py-1 text-xs text-gray-800 focus:outline-none focus:border-[#0056D2]"
                  />
                  <button
                    type="button"
                    onClick={() => handleSaveHeaderImage("/images/generation-logo.png")}
                    className="text-[10px] text-blue-700 bg-blue-100 hover:bg-blue-200 px-2 py-1 rounded font-medium"
                  >
                    Logo
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveHeaderImage("")}
                    className="text-[10px] text-gray-600 bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded font-medium"
                  >
                    Title
                  </button>
                  <button
                    type="button"
                    disabled={savingHeaderImage}
                    onClick={() => handleSaveHeaderImage()}
                    className="text-[10px] text-white bg-[#0056D2] hover:bg-[#0045A8] px-2.5 py-1 rounded font-semibold"
                  >
                    {savingHeaderImage ? "..." : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingHeaderImage(false)}
                    className="text-[10px] text-gray-500 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Share Links & Flexible Count + Timer Bar */}
          <div className="px-4 sm:px-6 py-3 bg-gray-50/70 border-b border-gray-200 space-y-2.5 text-xs">
            {/* Top row: Questions & Timer Inputs */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#0056D2]" />
                  <span className="text-gray-700 font-medium">Questions:</span>
                  <input
                    type="number"
                    min={1}
                    max={currentQuiz.raw_json.length}
                    value={customCount}
                    onChange={(e) => setCustomCount(parseInt(e.target.value, 10) || 1)}
                    className="w-12 sm:w-14 bg-white border border-gray-300 rounded px-1.5 py-1 text-center font-bold text-[#0056D2] focus:outline-none focus:border-[#0056D2]"
                  />
                </div>

                <div className="h-4 w-px bg-gray-300 hidden sm:block" />

                <div className="flex items-center gap-1.5">
                  <Timer className="w-3.5 h-3.5 text-amber-600" />
                  <span className="text-gray-700 font-medium">Timer:</span>
                  <input
                    type="number"
                    min={1}
                    max={180}
                    value={customTime}
                    onChange={(e) => setCustomTime(parseInt(e.target.value, 10) || 1)}
                    className="w-12 sm:w-14 bg-white border border-gray-300 rounded px-1.5 py-1 text-center font-bold text-amber-700 focus:outline-none focus:border-amber-600"
                  />
                  <span className="text-gray-600 text-[11px]">min</span>
                </div>
              </div>
            </div>

            {/* Bottom row: Touch-friendly Copy Buttons */}
            <div className="flex items-center gap-2 flex-col sm:flex-row">
              <button
                onClick={() => handleCopyLink(customShareUrl, "custom")}
                className="w-full sm:flex-1 py-2 sm:py-1.5 px-3 rounded-lg bg-green-50 hover:bg-green-100 border border-green-200 text-green-700 font-semibold transition flex items-center justify-center gap-1.5 text-xs shadow-sm"
              >
                {copied === "custom" ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>
                  {copied === "custom"
                    ? "Copied Exam Link!"
                    : `Copy Exam (${validCustomCount} Qs • ${validCustomTime}m)`}
                </span>
              </button>

              <button
                onClick={() => handleCopyLink(`${baseUrl}?mode=practice`, "practice")}
                className="w-full sm:w-auto py-2 sm:py-1.5 px-3 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 font-semibold transition flex items-center justify-center gap-1.5 text-xs shadow-sm"
              >
                {copied === "practice" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Lightbulb className="w-3.5 h-3.5 text-amber-500" />}
                <span>{copied === "practice" ? "Copied Practice Link!" : "Practice Drill Link"}</span>
              </button>

              <button
                onClick={() => handleCopyLink(baseUrl, "all")}
                className="w-full sm:w-auto py-2 sm:py-1.5 px-3 rounded-lg bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 transition flex items-center justify-center gap-1.5 text-xs"
              >
                {copied === "all" ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied === "all" ? "Copied!" : `Full (${currentQuiz.raw_json.length} Qs)`}</span>
              </button>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 p-3 sm:p-6 pb-3 sm:pb-4 border-b border-gray-200 bg-gray-50/40">
            <div className="p-2 sm:p-3.5 rounded-xl bg-white border border-gray-200 flex flex-col sm:flex-row items-center sm:items-center text-center sm:text-left gap-1 sm:gap-3">
              <div className="p-1.5 sm:p-2.5 rounded-lg bg-blue-50 text-[#0056D2] shrink-0">
                <Users className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-gray-500 font-medium truncate">Submissions</p>
                <p className="text-sm sm:text-xl font-bold text-gray-800">{totalAttendees}</p>
              </div>
            </div>

            <div className="p-2 sm:p-3.5 rounded-xl bg-white border border-gray-200 flex flex-col sm:flex-row items-center sm:items-center text-center sm:text-left gap-1 sm:gap-3">
              <div className="p-1.5 sm:p-2.5 rounded-lg bg-green-50 text-green-700 shrink-0">
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-gray-500 font-medium truncate">Avg Score</p>
                <p className="text-sm sm:text-xl font-bold text-gray-800">
                  {avgScore} <span className="text-[10px] sm:text-xs font-normal text-gray-500">({avgPercentage}%)</span>
                </p>
              </div>
            </div>

            <div className="p-2 sm:p-3.5 rounded-xl bg-white border border-gray-200 flex flex-col sm:flex-row items-center sm:items-center text-center sm:text-left gap-1 sm:gap-3">
              <div className="p-1.5 sm:p-2.5 rounded-lg bg-amber-50 text-amber-600 shrink-0">
                <Award className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-gray-500 font-medium truncate">Top Score</p>
                <p className="text-sm sm:text-xl font-bold text-gray-800">
                  {highestAttempt ? highestAttempt.score : 0}
                  <span className="text-[10px] sm:text-xs font-normal text-gray-500">
                    /{highestAttempt ? (highestAttempt.max_score || sampleMaxScore) : sampleMaxScore}
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* Tab Navigation: Completed Submissions vs. Live Proctoring Monitor */}
          <div className="px-3 sm:px-6 pt-2 sm:pt-4 flex items-center justify-between border-b border-gray-200 bg-white flex-wrap gap-2">
            <div className="flex items-center gap-2 sm:gap-4 flex-1">
              <button
                onClick={() => setActiveTab("completed")}
                className={`pb-2.5 sm:pb-3 font-semibold text-xs sm:text-sm border-b-2 transition flex items-center justify-center gap-1.5 sm:gap-2 ${
                  activeTab === "completed"
                    ? "border-[#0056D2] text-[#0056D2]"
                    : "border-transparent text-gray-500 hover:text-gray-800"
                }`}
              >
                <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="sm:hidden">Submissions ({attempts.length})</span>
                <span className="hidden sm:inline">Completed Submissions ({attempts.length})</span>
              </button>

              <button
                onClick={() => setActiveTab("live_monitor")}
                className={`pb-2.5 sm:pb-3 font-semibold text-xs sm:text-sm border-b-2 transition flex items-center justify-center gap-1.5 sm:gap-2 ${
                  activeTab === "live_monitor"
                    ? "border-emerald-600 text-emerald-700"
                    : "border-transparent text-gray-500 hover:text-gray-800"
                }`}
              >
                <span className="relative flex h-2 w-2 sm:h-2.5 sm:w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 sm:h-2.5 sm:w-2.5 bg-emerald-500" />
                </span>
                <span className="sm:hidden">Live ({activeLiveCount})</span>
                <span className="hidden sm:inline">Live Classroom Monitor ({activeLiveCount} Taking Exam)</span>
              </button>
            </div>

            <Link
              href={`/dashboard/analytics/${currentQuiz.id}`}
              className="pb-2.5 sm:pb-3 text-xs font-bold text-[#0056D2] hover:text-[#0045A8] flex items-center gap-1 shrink-0"
              title="View full-page un-congested details"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Full Page View ↗</span>
            </Link>
          </div>

          {/* Tab 1: Completed Attendees Table */}
          {activeTab === "completed" && (
            <div className="p-4 sm:p-6 overflow-y-auto flex-1">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div>
                  <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Completed Attendees & Marks
                  </h3>
                  <span className="text-xs text-gray-400">
                    Click &quot;View Answers&quot; on any attendee to inspect, or delete individual attempts
                  </span>
                </div>
                {attempts.length > 0 && (
                  <button
                    onClick={() => setIsClearingAll(true)}
                    className="px-2.5 py-1 rounded bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-semibold transition flex items-center gap-1"
                    title="Delete all candidate submissions for this question set"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear All Responses</span>
                  </button>
                )}
              </div>

              {loading && attempts.length === 0 ? (
                <div className="py-12 text-center text-gray-500 flex flex-col items-center justify-center gap-2">
                  <div className="w-6 h-6 border-2 border-[#0056D2]/30 border-t-[#0056D2] rounded-full animate-spin" />
                  <p className="text-xs">Loading attendees...</p>
                </div>
              ) : attempts.length === 0 ? (
                <div className="py-12 text-center bg-gray-50 border border-gray-200 rounded-xl p-6">
                  <Users className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-700">No attendees have completed this exam yet.</p>
                  <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                    Share the exam link with candidates to start gathering submissions.
                  </p>
                  <button
                    onClick={() => handleCopyLink(customShareUrl, "custom")}
                    className="mt-4 px-4 py-2 rounded-lg bg-[#0056D2] hover:bg-[#0045A8] text-white text-xs font-medium inline-flex items-center gap-1.5 transition shadow"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy Exam Link ({validCustomCount} Qs)
                  </button>
                </div>
              ) : (
                <>
                  {/* Mobile Cards List (< md) */}
                  <div className="block md:hidden space-y-3">
                    {attempts.map((attempt) => {
                      const max = attempt.max_score || sampleMaxScore;
                      const pct = max > 0 ? Math.round((attempt.score / max) * 100) : 0;
                      let badgeColor = "bg-red-50 text-red-700 border-red-200";
                      if (pct >= 80) badgeColor = "bg-green-50 text-green-700 border-green-200";
                      else if (pct >= 50) badgeColor = "bg-amber-50 text-amber-700 border-amber-200";

                      return (
                        <div
                          key={attempt.id}
                          className="p-3.5 rounded-xl border border-gray-200 bg-white shadow-sm space-y-2.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-8 h-8 rounded-full bg-blue-50 text-[#0056D2] font-bold text-xs flex items-center justify-center border border-blue-200 shrink-0">
                                {attempt.trainee_name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <h4 className="font-bold text-gray-800 text-sm truncate">{attempt.trainee_name}</h4>
                                  {attempt.mode === "practice" && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-bold shrink-0 flex items-center gap-0.5">
                                      <Lightbulb className="w-3 h-3 text-amber-500" />
                                      Practice
                                    </span>
                                  )}
                                  {attempt.tab_switches && attempt.tab_switches > 0 ? (
                                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-bold shrink-0">
                                      ⚠️ {attempt.tab_switches} switch{attempt.tab_switches > 1 ? "es" : ""}
                                    </span>
                                  ) : null}
                                </div>
                                <p className="text-[10px] text-gray-400 flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {formatDate(attempt.submitted_at)}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="font-bold text-sm text-gray-900">
                                {attempt.score} <span className="text-gray-400 text-xs font-normal">/ {max}</span>
                              </span>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${badgeColor}`}>
                                {pct}%
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                            {attempt.mode === "practice" || !attempt.breakdown || attempt.breakdown.length === 0 ? (
                              <div className="flex-1 text-center py-1 text-[11px] text-gray-400 italic">
                                Practice Drill (Attempt Logged)
                              </div>
                            ) : (
                              <button
                                onClick={() => setInspectedAttempt(attempt)}
                                className="flex-1 py-1.5 px-3 rounded-lg bg-[#0056D2]/10 hover:bg-[#0056D2]/20 text-[#0056D2] font-semibold text-xs transition flex items-center justify-center gap-1.5"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                <span>View Answers</span>
                              </button>
                            )}
                            <button
                              onClick={() => setAttemptToDelete(attempt)}
                              title="Delete response"
                              className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 border border-gray-200 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Desktop Table (md and up) */}
                  <div className="hidden md:block border border-gray-200 rounded-xl overflow-hidden bg-white">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-gray-50 text-[11px] text-gray-500 uppercase tracking-wider border-b border-gray-200">
                        <tr>
                          <th className="py-3 px-4">Trainee Name</th>
                          <th className="py-3 px-4">Auto-Graded Marks</th>
                          <th className="py-3 px-4">Performance</th>
                          <th className="py-3 px-4 text-center">Answer Sheet</th>
                          <th className="py-3 px-4 text-right">Submitted At</th>
                          <th className="py-3 px-4 text-center">Delete</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {attempts.map((attempt) => {
                          const max = attempt.max_score || sampleMaxScore;
                          const pct = max > 0 ? Math.round((attempt.score / max) * 100) : 0;

                          let badgeColor = "bg-red-50 text-red-700 border-red-200";
                          if (pct >= 80) {
                            badgeColor = "bg-green-50 text-green-700 border-green-200";
                          } else if (pct >= 50) {
                            badgeColor = "bg-amber-50 text-amber-700 border-amber-200";
                          }

                          return (
                            <tr
                              key={attempt.id}
                              className="hover:bg-gray-50/70 transition cursor-pointer"
                              onClick={() => {
                                if (attempt.breakdown && attempt.breakdown.length > 0) {
                                  setInspectedAttempt(attempt);
                                }
                              }}
                            >
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-8 h-8 rounded-full bg-blue-50 text-[#0056D2] font-semibold text-xs flex items-center justify-center border border-blue-200">
                                    {attempt.trainee_name.charAt(0).toUpperCase()}
                                  </div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-semibold text-gray-800">{attempt.trainee_name}</span>
                                    {attempt.mode === "practice" && (
                                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-bold flex items-center gap-1">
                                        <Lightbulb className="w-3 h-3 text-amber-500" />
                                        Practice
                                      </span>
                                    )}
                                    {attempt.tab_switches && attempt.tab_switches > 0 ? (
                                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-bold flex items-center gap-1">
                                        ⚠️ {attempt.tab_switches} switch{attempt.tab_switches > 1 ? "es" : ""}
                                      </span>
                                    ) : null}
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <span className="font-semibold text-gray-900">{attempt.score}</span>
                                <span className="text-gray-500 text-xs font-normal"> / {max}</span>
                              </td>
                              <td className="py-3 px-4">
                                <span className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold ${badgeColor}`}>
                                  {pct}%
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                                {attempt.mode === "practice" || !attempt.breakdown || attempt.breakdown.length === 0 ? (
                                  <span className="text-[11px] text-gray-400 italic">Practice Drill (Attempt Logged)</span>
                                ) : (
                                  <button
                                    onClick={() => setInspectedAttempt(attempt)}
                                    className="px-2.5 py-1 rounded bg-[#0056D2]/10 hover:bg-[#0056D2]/20 text-[#0056D2] font-semibold text-xs transition inline-flex items-center gap-1 border border-[#0056D2]/20"
                                  >
                                    <FileText className="w-3.5 h-3.5" />
                                    <span>View Answers</span>
                                  </button>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right text-xs text-gray-500">
                                <div className="flex items-center justify-end gap-1">
                                  <Clock className="w-3 h-3 text-gray-400" />
                                  {formatDate(attempt.submitted_at)}
                                </div>
                              </td>
                              <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={() => setAttemptToDelete(attempt)}
                                  title={`Delete response for ${attempt.trainee_name}`}
                                  className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
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
                </>
              )}
            </div>
          )}

          {/* Tab 2: Live Classroom Proctoring Monitor */}
          {activeTab === "live_monitor" && (
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Live Candidates in Examination
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Streaming live heartbeats every 3.5 seconds.
                  </p>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  {activeLiveCount} Currently Active
                </span>
              </div>

              {liveSessions.length === 0 ? (
                <div className="py-12 text-center bg-gray-50 border border-gray-200 rounded-xl p-6">
                  <Radio className="w-8 h-8 text-gray-400 mx-auto mb-2 animate-pulse" />
                  <p className="text-sm font-semibold text-gray-800">Waiting for candidates to start</p>
                  <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                    When candidates open the exam link and enter their names, their real-time progress will stream here live.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {liveSessions.map((session) => {
                    const isSubmitted = session.status === "submitted";
                    const pct = session.total_questions > 0
                      ? Math.round((session.answered_count / session.total_questions) * 100)
                      : 0;

                    return (
                      <div
                        key={session.id}
                        className={`p-4 rounded-xl border transition bg-white shadow-sm flex flex-col justify-between space-y-3 ${
                          isSubmitted
                            ? "border-green-200 bg-green-50/20"
                            : "border-blue-200"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-full bg-[#0056D2]/10 text-[#0056D2] font-bold text-xs flex items-center justify-center border border-[#0056D2]/20">
                              {session.trainee_name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h4 className="font-bold text-gray-800 text-sm">{session.trainee_name}</h4>
                                {session.tab_switches && session.tab_switches > 0 ? (
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold border flex items-center gap-1 ${
                                    session.tab_switches >= 3
                                      ? "bg-red-50 text-red-700 border-red-200 animate-pulse"
                                      : "bg-amber-50 text-amber-700 border-amber-200"
                                  }`}>
                                    ⚠️ {session.tab_switches} switch{session.tab_switches > 1 ? "es" : ""}
                                  </span>
                                ) : (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-50 text-gray-400 border border-gray-200">
                                    0 switches
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-gray-500">
                                {isSubmitted ? "Exam finished" : "Currently taking exam"}
                              </p>
                            </div>
                          </div>

                          <div>
                            {isSubmitted ? (
                              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-green-100 text-green-800 font-semibold border border-green-200 flex items-center gap-1">
                                <CheckCheck className="w-3 h-3 text-green-700" /> Submitted
                              </span>
                            ) : (
                              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                                In Progress
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Progress bar */}
                        <div>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-gray-600 font-medium">
                              Progress: <strong className="text-gray-800">{session.answered_count}</strong> of {session.total_questions} Answered
                            </span>
                            <span className="font-bold text-[#0056D2]">{pct}%</span>
                          </div>
                          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
                            <div
                              className={`h-full transition-all duration-500 rounded-full ${
                                isSubmitted ? "bg-green-600" : "bg-[#0056D2]"
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>

                        <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400">
                          <span>Live heartbeat</span>
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
      </div>

      {/* Trainee Answer Inspection Modal */}
      {inspectedAttempt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm animate-scale-in">
          <div className="w-full max-w-3xl bg-white border border-gray-200 rounded-2xl sm:rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh] sm:max-h-[92vh]">
            {/* Modal Header */}
            <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  onClick={() => setInspectedAttempt(null)}
                  className="p-1.5 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 transition shrink-0"
                  title="Back to Attendees List"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-bold text-gray-800 truncate">
                      {inspectedAttempt.trainee_name}&apos;s Answers
                    </h3>
                    <span className="text-[11px] sm:text-xs px-2 py-0.5 rounded-full bg-blue-50 text-[#0056D2] font-semibold border border-blue-200 shrink-0">
                      {inspectedAttempt.score}/{inspectedAttempt.max_score || sampleMaxScore} Correct
                    </span>
                    {inspectedAttempt.tab_switches && inspectedAttempt.tab_switches > 0 ? (
                      <span className="text-[11px] sm:text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-bold border border-amber-200 shrink-0 flex items-center gap-1">
                        ⚠️ {inspectedAttempt.tab_switches} Tab Switch{inspectedAttempt.tab_switches > 1 ? "es" : ""}
                      </span>
                    ) : (
                      <span className="text-[11px] sm:text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200 shrink-0">
                        ✓ 0 Tab Switches
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5">
                    {formatDate(inspectedAttempt.submitted_at)}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setInspectedAttempt(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter Tabs Bar */}
            <div className="px-4 sm:px-6 py-2.5 sm:py-3 bg-white border-b border-gray-200 flex items-center justify-between flex-wrap gap-2 text-xs overflow-x-auto no-scrollbar">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <span className="text-gray-500 font-medium hidden sm:flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5" /> Filter:
                </span>

                <button
                  onClick={() => setFilterType("all")}
                  className={`px-2.5 sm:px-3 py-1 rounded-full font-semibold text-xs transition ${
                    filterType === "all"
                      ? "bg-[#0056D2] text-white shadow-sm"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  All ({activeBreakdown.length})
                </button>

                <button
                  onClick={() => setFilterType("wrong")}
                  className={`px-2.5 sm:px-3 py-1 rounded-full font-semibold text-xs transition flex items-center gap-1 ${
                    filterType === "wrong"
                      ? "bg-red-600 text-white shadow-sm"
                      : "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
                  }`}
                >
                  <XCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  <span>Wrong ({wrongCount})</span>
                </button>

                <button
                  onClick={() => setFilterType("correct")}
                  className={`px-2.5 sm:px-3 py-1 rounded-full font-semibold text-xs transition flex items-center gap-1 ${
                    filterType === "correct"
                      ? "bg-green-600 text-white shadow-sm"
                      : "bg-green-50 text-green-700 border border-green-200 hover:bg-green-100"
                  }`}
                >
                  <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  <span>Correct ({correctCount})</span>
                </button>
              </div>

              <div className="text-xs font-semibold text-gray-600 shrink-0">
                Score:{" "}
                <span className="text-[#0056D2]">
                  {inspectedAttempt.max_score
                    ? Math.round((inspectedAttempt.score / inspectedAttempt.max_score) * 100)
                    : 0}
                  %
                </span>
              </div>
            </div>

            {/* Questions List */}
            <div className="p-3.5 sm:p-6 overflow-y-auto flex-1 space-y-3.5 sm:space-y-4 bg-gray-50/50">
              {activeBreakdown.length === 0 ? (
                <div className="py-12 text-center text-gray-500 bg-white border border-gray-200 rounded-xl p-6">
                  <FileText className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-gray-800">No question breakdown available</p>
                  <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                    This attempt was submitted prior to answer tracking.
                  </p>
                </div>
              ) : filteredBreakdown.length === 0 ? (
                <div className="py-12 text-center text-gray-500 bg-white border border-gray-200 rounded-xl p-6">
                  <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-gray-800">No questions in this filter.</p>
                  {filterType === "wrong" && (
                    <p className="text-xs text-green-700 mt-1">This candidate answered 100% correctly!</p>
                  )}
                </div>
              ) : (
                filteredBreakdown.map((item, idx) => (
                  <div
                    key={item.questionIndex ?? idx}
                    className={`p-4 rounded-xl border transition bg-white shadow-sm ${
                      item.isCorrect ? "border-green-200" : "border-red-200"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 flex-1">
                        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                          Question {item.questionIndex + 1}
                        </span>
                        <h4 className="text-sm font-semibold text-gray-800 leading-snug">
                          {item.question}
                        </h4>
                      </div>

                      <div className="shrink-0">
                        {item.isCorrect ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2.5 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Correct
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 px-2.5 py-0.5 rounded-full">
                            <XCircle className="w-3.5 h-3.5" /> Incorrect
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Answer Comparison Box */}
                    <div className="mt-3 pt-3 border-t border-gray-100 text-xs space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 font-medium w-36">Candidate&apos;s Answer:</span>
                        <span
                          className={`font-semibold px-2 py-0.5 rounded ${
                            item.isCorrect
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {item.selectedAnswer || "(Left Blank / No Answer)"}
                        </span>
                      </div>

                      {!item.isCorrect && (
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500 font-medium w-36">Correct Answer:</span>
                          <span className="font-semibold text-green-700 px-2 py-0.5 rounded bg-green-50">
                            {item.correctAnswer}
                          </span>
                        </div>
                      )}

                      {item.explanation && (
                        <div className="mt-2 text-[11px] text-gray-600 bg-gray-50 p-2.5 rounded-lg border border-gray-200">
                          <strong className="text-[#0056D2]">Explanation: </strong>
                          {item.explanation}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
              <span className="text-xs text-gray-500">
                Viewing {filteredBreakdown.length} of {activeBreakdown.length} questions
              </span>
              <button
                onClick={() => setInspectedAttempt(null)}
                className="px-4 py-1.5 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-semibold transition"
              >
                Close Sheet
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
        onQuestionsAdded={handleQuestionsAdded}
      />

      {/* Delete Single Attempt Confirmation Modal */}
      {attemptToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-scale-in">
          <div className="w-full max-w-sm bg-white border border-gray-200 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 border border-red-200 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-base font-bold text-gray-800">Delete Candidate Response?</h3>
              <p className="text-xs text-gray-500 mt-1">
                Are you sure you want to delete the response for <strong className="text-gray-800">&quot;{attemptToDelete.trainee_name}&quot;</strong>?
              </p>
              <p className="text-[11px] text-gray-400 mt-1">
                Score: {attemptToDelete.score} / {attemptToDelete.max_score || sampleMaxScore}
              </p>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => setAttemptToDelete(null)}
                className="flex-1 py-2 px-3 rounded-xl border border-gray-300 text-gray-700 font-semibold text-xs hover:bg-gray-100 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAttempt}
                disabled={deletingAttempt}
                className="flex-1 py-2 px-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-xs shadow transition flex items-center justify-center gap-1"
              >
                {deletingAttempt ? <span>Deleting...</span> : <span>Delete</span>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear All Responses Confirmation Modal */}
      {isClearingAll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-scale-in">
          <div className="w-full max-w-sm bg-white border border-gray-200 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 border border-red-200 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-base font-bold text-gray-800">Clear All Responses?</h3>
              <p className="text-xs text-gray-500 mt-1">
                Are you sure you want to delete all <strong className="text-gray-800">{attempts.length} candidate attempts</strong> for <strong className="text-gray-800">&quot;{currentQuiz.title}&quot;</strong>?
              </p>
              <p className="text-[11px] text-red-600 font-medium mt-1">
                This cannot be undone. All scores and answer sheets will be erased.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => setIsClearingAll(false)}
                className="flex-1 py-2 px-3 rounded-xl border border-gray-300 text-gray-700 font-semibold text-xs hover:bg-gray-100 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearAllAttempts}
                disabled={clearingAll}
                className="flex-1 py-2 px-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-xs shadow transition flex items-center justify-center gap-1"
              >
                {clearingAll ? <span>Clearing...</span> : <span>Clear All</span>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Entire Quiz Confirmation Modal */}
      {isDeletingQuiz && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-scale-in">
          <div className="w-full max-w-sm bg-white border border-gray-200 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 border border-red-200 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-base font-bold text-gray-800">Delete Question Set?</h3>
              <p className="text-xs text-gray-500 mt-1">
                Are you sure you want to delete <strong className="text-gray-800">&quot;{currentQuiz.title}&quot;</strong>?
              </p>
              <p className="text-[11px] text-red-600 font-medium mt-1">
                This will permanently delete this question set and all associated student responses.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => setIsDeletingQuiz(false)}
                className="flex-1 py-2 px-3 rounded-xl border border-gray-300 text-gray-700 font-semibold text-xs hover:bg-gray-100 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteQuizFromModal}
                disabled={deletingQuiz}
                className="flex-1 py-2 px-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-xs shadow transition flex items-center justify-center gap-1"
              >
                {deletingQuiz ? <span>Deleting...</span> : <span>Delete Set</span>}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
