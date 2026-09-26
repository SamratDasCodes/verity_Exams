"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Plus,
  BarChart3,
  Users,
  Copy,
  Check,
  ExternalLink,
  Calendar,
  LogOut,
  HelpCircle,
  Sparkles,
  PlusCircle,
  Trash2,
  AlertTriangle,
  LayoutList,
  LayoutGrid,
  FileText,
  Layers,
  Lightbulb,
  Search,
  Folder,
  Tag,
  Filter,
} from "lucide-react";
import { logoutAdmin } from "@/app/actions/auth";
import { deleteQuizAction } from "@/app/actions/quiz";
import { QuizWithStats, Quiz } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import CreateQuizModal from "@/components/CreateQuizModal";
import AnalyticsModal from "@/components/AnalyticsModal";
import AddQuestionsModal from "@/components/AddQuestionsModal";
import CombineSetsModal from "@/components/CombineSetsModal";

interface DashboardClientProps {
  initialQuizzes: QuizWithStats[];
  serverIp?: string;
}

export default function DashboardClient({ initialQuizzes, serverIp }: DashboardClientProps) {
  const [quizzes, setQuizzes] = useState<QuizWithStats[]>(initialQuizzes);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCombineOpen, setIsCombineOpen] = useState(false);
  const [selectedQuizForAnalytics, setSelectedQuizForAnalytics] = useState<Quiz | null>(null);
  const [quizForAddingQuestions, setQuizForAddingQuestions] = useState<Quiz | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [customCounts, setCustomCounts] = useState<Record<string, number>>({});
  const [quizToDelete, setQuizToDelete] = useState<QuizWithStats | Quiz | null>(null);
  const [deletingQuiz, setDeletingQuiz] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const allCategories = useMemo(() => {
    const cats = new Set<string>();
    quizzes.forEach((q) => {
      if (q.category && q.category.trim()) cats.add(q.category.trim());
    });
    return Array.from(cats).sort();
  }, [quizzes]);

  const allTags = useMemo(() => {
    const tgs = new Set<string>();
    quizzes.forEach((q) => {
      q.tags?.forEach((t) => {
        if (t && t.trim()) tgs.add(t.trim());
      });
    });
    return Array.from(tgs).sort();
  }, [quizzes]);

  const uncategorizedCount = useMemo(() => {
    return quizzes.filter((q) => !q.category || !q.category.trim()).length;
  }, [quizzes]);

  const filteredQuizzes = useMemo(() => {
    return quizzes.filter((q) => {
      // Category filter
      if (selectedCategory !== "ALL") {
        if (selectedCategory === "UNCATEGORIZED") {
          if (q.category && q.category.trim()) return false;
        } else {
          if (q.category !== selectedCategory) return false;
        }
      }

      // Tag filter
      if (selectedTag) {
        if (!q.tags || !q.tags.includes(selectedTag)) return false;
      }

      // Search query (Title, Category, Tags)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchTitle = q.title.toLowerCase().includes(query);
        const matchCat = Boolean(q.category && q.category.toLowerCase().includes(query));
        const matchTag = Boolean(q.tags && q.tags.some((t) => t.toLowerCase().includes(query)));
        if (!matchTitle && !matchCat && !matchTag) return false;
      }

      return true;
    });
  }, [quizzes, selectedCategory, selectedTag, searchQuery]);

  const handleQuizDeleted = (deletedQuizId: string) => {
    setQuizzes((prev) => prev.filter((q) => q.id !== deletedQuizId));
    if (selectedQuizForAnalytics && selectedQuizForAnalytics.id === deletedQuizId) {
      setSelectedQuizForAnalytics(null);
    }
  };

  const handleConfirmDeleteQuiz = async () => {
    if (!quizToDelete) return;
    setDeletingQuiz(true);
    try {
      const res = await deleteQuizAction(quizToDelete.id);
      if (res.success) {
        handleQuizDeleted(quizToDelete.id);
        setQuizToDelete(null);
      }
    } catch (err) {
      console.error("Failed to delete quiz:", err);
    } finally {
      setDeletingQuiz(false);
    }
  };

  const handleQuizCreated = (newQuiz: Quiz) => {
    const newQuizWithStats: QuizWithStats = {
      ...newQuiz,
      total_attempts: 0,
      average_score: 0,
    };
    setQuizzes((prev) => [newQuizWithStats, ...prev]);
  };

  const handleQuizUpdated = (updatedQuiz: Quiz) => {
    setQuizzes((prev) =>
      prev.map((q) =>
        q.id === updatedQuiz.id
          ? {
              ...q,
              title: updatedQuiz.title,
              raw_json: updatedQuiz.raw_json,
              header_image_url: updatedQuiz.header_image_url,
              category: updatedQuiz.category,
              tags: updatedQuiz.tags,
            }
          : q
      )
    );
    if (selectedQuizForAnalytics && selectedQuizForAnalytics.id === updatedQuiz.id) {
      setSelectedQuizForAnalytics(updatedQuiz);
    }
  };

  const getShareOrigin = () => {
    if (typeof window === "undefined") return "";
    const curr = window.location.origin;
    if (serverIp && serverIp !== "localhost" && (curr.includes("localhost") || curr.includes("127.0.0.1"))) {
      return `http://${serverIp}:3000`;
    }
    return curr;
  };

  const handleCopyShareLink = async (e: React.MouseEvent, quizId: string, count?: number, time?: number) => {
    e.stopPropagation();
    const origin = getShareOrigin();
    const params = new URLSearchParams();
    if (count) params.set("count", count.toString());
    if (time) params.set("time", time.toString());
    const query = params.toString() ? `?${params.toString()}` : "";
    const url = `${origin}/quiz/${quizId}${query}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(count ? `${quizId}_${count}` : quizId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyPracticeLink = async (e: React.MouseEvent, quizId: string) => {
    e.stopPropagation();
    const origin = getShareOrigin();
    const url = `${origin}/quiz/${quizId}?mode=practice`;
    await navigator.clipboard.writeText(url);
    setCopiedId(`practice_${quizId}`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCustomCountChange = (quizId: string, val: number) => {
    setCustomCounts((prev) => ({
      ...prev,
      [quizId]: val,
    }));
  };

  const totalAttendeesAll = quizzes.reduce((acc, q) => acc + q.total_attempts, 0);

  return (
    <div className="min-h-screen flex flex-col bg-[#f3f4f6] text-gray-800">
      {/* Header matching Generation template */}
      <header className="header-bg text-white shadow-md relative z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-2xl font-bold italic tracking-wide font-serif">
              Verity
            </div>
            <span className="text-xs bg-white/15 px-3 py-1 rounded-full font-medium hidden sm:inline">
              Exam Administration Portal
            </span>
          </div>

          <div className="flex items-center gap-3">
            {serverIp && serverIp !== "localhost" && (
              <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-white text-xs font-mono">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Hotspot / LAN: http://{serverIp}:3000</span>
              </div>
            )}

            {/* Logout */}
            <form action={logoutAdmin}>
              <button
                type="submit"
                title="Log Out"
                className="p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Sub-header Bar */}
      <div className="nav-back-bg text-white px-4 sm:px-6 lg:px-8 py-2.5 flex items-center text-sm font-medium z-10 shadow-inner">
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
          <span>Question Sets Overview</span>
          <span className="text-xs text-blue-100 font-normal">
            {quizzes.length} Question Sets • {totalAttendeesAll} Total Submissions
          </span>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* Section Header with View Toggle */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Your Question Sets</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Click any question set to view candidate performance, append questions, or copy customized links.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* View Mode Toggle: List vs Cards */}
            <div className="flex items-center bg-gray-200/70 p-0.5 rounded-lg border border-gray-300">
              <button
                type="button"
                onClick={() => setViewMode("list")}
                title="List View"
                className={`p-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition ${
                  viewMode === "list"
                    ? "bg-white text-[#0056D2] shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <LayoutList className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">List View</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                title="Card View"
                className={`p-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition ${
                  viewMode === "grid"
                    ? "bg-white text-[#0056D2] shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Cards</span>
              </button>
            </div>

            {quizzes.length >= 2 && (
              <button
                onClick={() => setIsCombineOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 text-[#0056D2] text-xs font-semibold shadow-sm transition flex items-center gap-1.5"
                title="Combine 2 or more question sets into one"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Combine Sets</span>
              </button>
            )}

            <button
              onClick={() => setIsCreateOpen(true)}
              className="px-3.5 py-1.5 rounded-lg bg-[#0056D2] hover:bg-[#0045A8] text-white text-xs font-semibold shadow transition flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> New Question Set
            </button>
          </div>
        </div>

        {/* Category Tabs & Omni-Search Panel (Only if quizzes exist) */}
        {quizzes.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm space-y-3">
            {/* Top Row: Search Input & Active Filters Summary */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Omni-Search Input */}
              <div className="relative flex-1 max-w-md">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by title, subject, or tag (#Grade-10)..."
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl pl-9 pr-8 py-2 text-xs text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-[#0056D2] focus:bg-white transition"
                />
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-bold"
                  >
                    ×
                  </button>
                )}
              </div>

              {/* Filter Status */}
              <div className="text-xs text-gray-500 flex items-center gap-2">
                <span>
                  Showing <strong>{filteredQuizzes.length}</strong> of {quizzes.length} sets
                </span>
                {(selectedCategory !== "ALL" || selectedTag || searchQuery) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategory("ALL");
                      setSelectedTag(null);
                      setSearchQuery("");
                    }}
                    className="text-[11px] text-[#0056D2] font-semibold hover:underline"
                  >
                    Reset filters
                  </button>
                )}
              </div>
            </div>

            {/* Category Tabs (Primary Filter) */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
              <button
                type="button"
                onClick={() => setSelectedCategory("ALL")}
                className={`px-3 py-1.5 rounded-xl font-semibold transition whitespace-nowrap flex items-center gap-1.5 ${
                  selectedCategory === "ALL"
                    ? "bg-[#0056D2] text-white shadow-sm"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                <span>All Sets</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${selectedCategory === "ALL" ? "bg-white/20 text-white" : "bg-gray-200 text-gray-700"}`}>
                  {quizzes.length}
                </span>
              </button>

              {allCategories.map((cat) => {
                const count = quizzes.filter((q) => q.category === cat).length;
                const isSelected = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(isSelected ? "ALL" : cat)}
                    className={`px-3 py-1.5 rounded-xl font-semibold transition whitespace-nowrap flex items-center gap-1.5 ${
                      isSelected
                        ? "bg-[#0056D2] text-white shadow-sm"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    <Folder className="w-3 h-3" />
                    <span>{cat}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? "bg-white/20 text-white" : "bg-gray-200 text-gray-700"}`}>
                      {count}
                    </span>
                  </button>
                );
              })}

              {uncategorizedCount > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedCategory(selectedCategory === "UNCATEGORIZED" ? "ALL" : "UNCATEGORIZED")}
                  className={`px-3 py-1.5 rounded-xl font-semibold transition whitespace-nowrap flex items-center gap-1.5 ${
                    selectedCategory === "UNCATEGORIZED"
                      ? "bg-[#0056D2] text-white shadow-sm"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  <span>Uncategorized</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${selectedCategory === "UNCATEGORIZED" ? "bg-white/20 text-white" : "bg-gray-200 text-gray-700"}`}>
                    {uncategorizedCount}
                  </span>
                </button>
              )}
            </div>

            {/* Tag Filter Sub-bar (Secondary Filter) */}
            {allTags.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pt-2 border-t border-gray-100 text-xs">
                <span className="text-[11px] font-semibold text-gray-400 flex items-center gap-1 shrink-0">
                  <Tag className="w-3 h-3 text-amber-500" />
                  Filter by Tag:
                </span>

                {allTags.map((t) => {
                  const isSelected = selectedTag === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setSelectedTag(isSelected ? null : t)}
                      className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition whitespace-nowrap border ${
                        isSelected
                          ? "bg-amber-500 text-white border-amber-500 font-bold shadow-sm"
                          : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      #{t}
                    </button>
                  );
                })}

                {selectedTag && (
                  <button
                    type="button"
                    onClick={() => setSelectedTag(null)}
                    className="text-[10px] text-red-500 hover:underline font-semibold ml-1 shrink-0"
                  >
                    Clear tag
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Question Sets List or Grid */}
        {quizzes.length === 0 ? (
          <div className="border border-dashed border-gray-300 rounded-xl p-12 text-center bg-white shadow-sm">
            <div className="w-12 h-12 rounded-xl bg-[#0056D2]/10 text-[#0056D2] flex items-center justify-center mx-auto mb-3">
              <Plus className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-gray-800">No question sets yet</h3>
            <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
              Paste your question JSON array to generate your first live exam in seconds.
            </p>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="mt-4 px-4 py-2 rounded-lg bg-[#0056D2] hover:bg-[#0045A8] text-white text-xs font-semibold shadow transition inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Create First Question Set
            </button>
          </div>
        ) : filteredQuizzes.length === 0 ? (
          <div className="border border-dashed border-gray-300 rounded-xl p-10 text-center bg-white shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-2.5">
              <Filter className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-gray-800">No question sets match your filters</h3>
            <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
              Try searching for something else or clearing your category and tag filters.
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedCategory("ALL");
                setSelectedTag(null);
                setSearchQuery("");
              }}
              className="mt-3 px-3.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold transition"
            >
              Reset all filters
            </button>
          </div>
        ) : viewMode === "list" ? (
          /* ========================================================= */
          /* LIST VIEW (Desktop Table + Mobile Cards with Spacing)     */
          /* ========================================================= */
          <div>
            {/* Desktop / Tablet Table: hidden on mobile (< md) */}
            <div className="hidden md:block bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-[11px] text-gray-500 uppercase tracking-wider border-b border-gray-200">
                    <tr>
                      <th className="py-3 px-4 min-w-[220px]">Question Set</th>
                      <th className="py-3 px-4 whitespace-nowrap">Question Pool</th>
                      <th className="py-3 px-4 whitespace-nowrap">Submissions</th>
                      <th className="py-3 px-4 min-w-[200px]">Quick Share Link</th>
                      <th className="py-3 px-4 text-right whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredQuizzes.map((quiz) => {
                      const questionCount = quiz.raw_json?.length || 0;
                      const currentCustomCount = customCounts[quiz.id] || Math.min(20, questionCount);
                      const isCustomCopied = copiedId === `${quiz.id}_${currentCustomCount}`;
                      const isFullCopied = copiedId === quiz.id;

                      return (
                        <tr
                          key={quiz.id}
                          onClick={() => setSelectedQuizForAnalytics(quiz)}
                          className="hover:bg-blue-50/40 transition cursor-pointer group"
                        >
                          {/* Question Set Title, Category, Tags & Date */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-lg bg-blue-50 text-[#0056D2] flex items-center justify-center border border-blue-200 shrink-0 font-bold text-sm">
                                <FileText className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="font-bold text-gray-800 group-hover:text-[#0056D2] transition truncate text-sm">
                                    {quiz.title}
                                  </h4>
                                  {quiz.category && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#0056D2] bg-blue-50 border border-blue-200 px-1.5 py-0.2 rounded-md shrink-0">
                                      <Folder className="w-2.5 h-2.5" />
                                      {quiz.category}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                  <p className="text-[11px] text-gray-400 flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    Created {formatDate(quiz.created_at)}
                                  </p>
                                  {quiz.tags && quiz.tags.length > 0 && (
                                    <div className="flex items-center gap-1 flex-wrap">
                                      {quiz.tags.map((t) => (
                                        <span key={t} className="text-[10px] text-gray-600 bg-gray-100 border border-gray-200 px-1.5 py-0.2 rounded-full font-medium">
                                          #{t}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Question Pool + Add Qs */}
                          <td className="py-3.5 px-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-50 text-[#0056D2] font-semibold border border-blue-200">
                                {questionCount} {questionCount === 1 ? "Question" : "Questions"}
                              </span>
                              <button
                                onClick={() => setQuizForAddingQuestions(quiz)}
                                title="Add more questions to this bank"
                                className="px-2 py-0.5 rounded-full bg-gray-100 hover:bg-blue-50 text-gray-600 hover:text-[#0056D2] text-[10px] font-medium flex items-center gap-1 transition border border-gray-200"
                              >
                                <PlusCircle className="w-3 h-3" />
                                <span>+ Add Qs</span>
                              </button>
                            </div>
                          </td>

                          {/* Submissions */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 text-xs text-gray-600">
                              <Users className="w-3.5 h-3.5 text-gray-400" />
                              <span className="font-semibold text-gray-800">{quiz.total_attempts}</span>
                              <span className="text-gray-400">
                                {quiz.total_attempts === 1 ? "attempt" : "attempts"}
                              </span>
                            </div>
                          </td>

                          {/* Quick Share Link */}
                          <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-2 flex-wrap">
                              {questionCount > 5 ? (
                                <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 px-2 py-1 rounded-lg">
                                  <span className="text-[11px] text-gray-500">Test on:</span>
                                  <input
                                    type="number"
                                    min={1}
                                    max={questionCount}
                                    value={currentCustomCount}
                                    onChange={(e) =>
                                      handleCustomCountChange(quiz.id, parseInt(e.target.value, 10) || 1)
                                    }
                                    className="w-12 bg-white border border-gray-300 rounded px-1 text-center font-bold text-[#0056D2] text-xs focus:outline-none focus:border-[#0056D2]"
                                  />
                                  <span className="text-[11px] text-gray-500 mr-1">Qs</span>
                                  <button
                                    onClick={(e) => handleCopyShareLink(e, quiz.id, currentCustomCount)}
                                    className="px-2 py-0.5 rounded bg-green-50 hover:bg-green-100 border border-green-200 text-green-700 font-semibold text-[11px] flex items-center gap-1 transition"
                                  >
                                    {isCustomCopied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                                    <span>{isCustomCopied ? "Copied!" : "Copy"}</span>
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={(e) => handleCopyShareLink(e, quiz.id)}
                                  className="px-2.5 py-1 rounded bg-green-50 hover:bg-green-100 border border-green-200 text-green-700 font-semibold text-xs flex items-center gap-1 transition"
                                >
                                  {isFullCopied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                                  <span>{isFullCopied ? "Copied!" : "Copy Link"}</span>
                                </button>
                              )}
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={(e) => handleCopyPracticeLink(e, quiz.id)}
                                title="Copy Student Practice Drill Link"
                                className="px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold transition inline-flex items-center gap-1 border border-amber-200"
                              >
                                {copiedId === `practice_${quiz.id}` ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                                )}
                                <span className="hidden lg:inline">{copiedId === `practice_${quiz.id}` ? "Copied!" : "Practice Link"}</span>
                              </button>

                              <Link
                                href={`/dashboard/analytics/${quiz.id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="px-2.5 py-1.5 rounded-lg bg-[#0056D2]/10 hover:bg-[#0056D2]/20 text-[#0056D2] text-xs font-semibold transition inline-flex items-center gap-1 border border-[#0056D2]/20"
                                title="View Submissions, Answer Sheets & Live Monitor on Separate Page"
                              >
                                <BarChart3 className="w-3.5 h-3.5" />
                                <span className="hidden md:inline">Analytics</span>
                              </Link>

                              <a
                                href={`/quiz/${quiz.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Open Public Exam Link"
                                className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>

                              <button
                                onClick={() => setQuizToDelete(quiz)}
                                title="Delete this Question Set"
                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Cards: Visible ONLY on mobile (< md) with proper spacing */}
            <div className="block md:hidden space-y-4">
              {filteredQuizzes.map((quiz) => {
                const questionCount = quiz.raw_json?.length || 0;
                const currentCustomCount = customCounts[quiz.id] || Math.min(20, questionCount);
                const isCustomCopied = copiedId === `${quiz.id}_${currentCustomCount}`;
                const isFullCopied = copiedId === quiz.id;

                return (
                  <div
                    key={quiz.id}
                    onClick={() => setSelectedQuizForAnalytics(quiz)}
                    className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm hover:shadow transition active:scale-[0.99] cursor-pointer flex flex-col justify-between space-y-3.5"
                  >
                    {/* Top Row: Title, Category, Tags, Date, and Delete Button */}
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#0056D2] flex items-center justify-center border border-blue-200 shrink-0 font-bold mt-0.5">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h3 className="text-base font-bold text-gray-800 leading-snug break-words">
                              {quiz.title}
                            </h3>
                            {quiz.category && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#0056D2] bg-blue-50 border border-blue-200 px-1.5 py-0.2 rounded-md shrink-0">
                                <Folder className="w-2.5 h-2.5" />
                                {quiz.category}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <p className="text-[11px] text-gray-400 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              Created {formatDate(quiz.created_at)}
                            </p>
                            {quiz.tags && quiz.tags.length > 0 && (
                              <div className="flex items-center gap-1 flex-wrap">
                                {quiz.tags.map((t) => (
                                  <span key={t} className="text-[10px] text-gray-600 bg-gray-100 border border-gray-200 px-1.5 py-0.2 rounded-full font-medium">
                                    #{t}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setQuizToDelete(quiz);
                        }}
                        title="Delete Question Set"
                        className="p-1.5 -mr-1 -mt-1 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Middle Row: Badges (Question Count, Add Qs, Submissions) */}
                    <div
                      className="flex items-center justify-between gap-2 pt-2 border-t border-gray-100 flex-wrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-50 text-[#0056D2] font-semibold border border-blue-200">
                          {questionCount} Questions
                        </span>
                        <button
                          onClick={() => setQuizForAddingQuestions(quiz)}
                          className="px-2 py-0.5 rounded-full bg-gray-100 hover:bg-blue-50 text-gray-600 hover:text-[#0056D2] text-[11px] font-medium flex items-center gap-1 transition border border-gray-200"
                        >
                          <PlusCircle className="w-3 h-3" />
                          <span>+ Add Qs</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-1 text-xs text-gray-500 font-medium">
                        <Users className="w-3.5 h-3.5 text-gray-400" />
                        <span>{quiz.total_attempts} {quiz.total_attempts === 1 ? "submission" : "submissions"}</span>
                      </div>
                    </div>

                    {/* Quick Link Share Bar */}
                    <div
                      className="p-2 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between gap-2 text-xs"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-1.5 text-gray-600 text-xs">
                        <span>Test on:</span>
                        <input
                          type="number"
                          min={1}
                          max={questionCount}
                          value={currentCustomCount}
                          onChange={(e) => handleCustomCountChange(quiz.id, parseInt(e.target.value, 10) || 1)}
                          className="w-12 bg-white border border-gray-300 rounded px-1.5 py-0.5 text-center font-bold text-[#0056D2] text-xs focus:outline-none focus:border-[#0056D2]"
                        />
                        <span>Qs</span>
                      </div>

                      <button
                        onClick={(e) => handleCopyShareLink(e, quiz.id, currentCustomCount)}
                        className="px-3 py-1 rounded-lg bg-green-50 hover:bg-green-100 border border-green-200 text-green-700 font-semibold text-xs flex items-center gap-1 transition"
                      >
                        {isCustomCopied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{isCustomCopied ? "Copied!" : `Copy (${currentCustomCount} Qs)`}</span>
                      </button>
                    </div>

                    {/* Bottom Action Buttons */}
                    <div className="flex items-center gap-2 pt-1 flex-wrap" onClick={(e) => e.stopPropagation()}>
                      <Link
                        href={`/dashboard/analytics/${quiz.id}`}
                        className="flex-1 py-2 px-3 rounded-xl bg-[#0056D2] hover:bg-[#0045A8] text-white text-xs font-semibold shadow transition flex items-center justify-center gap-1.5 min-w-[130px]"
                      >
                        <BarChart3 className="w-3.5 h-3.5" />
                        <span>Analytics & Monitor</span>
                      </Link>

                      <button
                        onClick={(e) => handleCopyPracticeLink(e, quiz.id)}
                        className="py-2 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-semibold transition flex items-center justify-center gap-1"
                        title="Copy Practice Mode Link"
                      >
                        {copiedId === `practice_${quiz.id}` ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Lightbulb className="w-3.5 h-3.5 text-amber-500" />}
                        <span>{copiedId === `practice_${quiz.id}` ? "Copied!" : "Practice"}</span>
                      </button>

                      <a
                        href={`/quiz/${quiz.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open Exam"
                        className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition flex items-center justify-center"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* ========================================================= */
          /* CARDS / GRID VIEW                                         */
          /* ========================================================= */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredQuizzes.map((quiz) => {
              const questionCount = quiz.raw_json?.length || 0;
              const isCopied = copiedId === quiz.id;
              const currentCustomCount = customCounts[quiz.id] || Math.min(20, questionCount);

              return (
                <div
                  key={quiz.id}
                  onClick={() => setSelectedQuizForAnalytics(quiz)}
                  className="group bg-white hover:border-[#0056D2] border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow transition cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    {/* Top Badges */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-blue-50 text-[#0056D2] font-semibold flex items-center gap-1">
                          <HelpCircle className="w-3 h-3" />
                          {questionCount} {questionCount === 1 ? "Question" : "Questions"}
                        </span>
                        {/* Append questions button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setQuizForAddingQuestions(quiz);
                          }}
                          title="Append more questions to this bank"
                          className="px-2 py-0.5 rounded-full bg-gray-100 hover:bg-blue-50 text-gray-600 hover:text-[#0056D2] text-[10px] font-medium flex items-center gap-1 transition border border-gray-200"
                        >
                          <PlusCircle className="w-3 h-3" />
                          <span>+ Add Qs</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-gray-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(quiz.created_at)}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setQuizToDelete(quiz);
                          }}
                          title="Delete this Question Set"
                          className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Title, Category & Tags */}
                    <div className="mb-2">
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        {quiz.category && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#0056D2] bg-blue-50 border border-blue-200 px-1.5 py-0.2 rounded-md shrink-0">
                            <Folder className="w-2.5 h-2.5" />
                            {quiz.category}
                          </span>
                        )}
                        {quiz.tags && quiz.tags.length > 0 && (
                          <div className="flex items-center gap-1 flex-wrap">
                            {quiz.tags.map((t) => (
                              <span key={t} className="text-[10px] text-gray-600 bg-gray-100 border border-gray-200 px-1.5 py-0.2 rounded-full font-medium">
                                #{t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <h3 className="text-base font-bold text-gray-800 group-hover:text-[#0056D2] transition line-clamp-2">
                        {quiz.title}
                      </h3>
                    </div>
                  </div>

                  {/* Flexible Count Control Bar */}
                  {questionCount > 5 && (
                    <div
                      className="my-3 p-2 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-between gap-2 text-xs"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-1.5 text-gray-600 text-[11px]">
                        <span>Test on:</span>
                        <input
                          type="number"
                          min={1}
                          max={questionCount}
                          value={currentCustomCount}
                          onChange={(e) => handleCustomCountChange(quiz.id, parseInt(e.target.value, 10) || 1)}
                          className="w-12 bg-white border border-gray-300 rounded px-1.5 py-0.5 text-center font-bold text-[#0056D2] text-xs focus:outline-none focus:border-[#0056D2]"
                        />
                        <span>Qs</span>
                      </div>

                      <button
                        onClick={(e) => handleCopyShareLink(e, quiz.id, currentCustomCount)}
                        className="px-2 py-1 rounded bg-green-50 hover:bg-green-100 border border-green-200 text-green-700 font-semibold text-[11px] flex items-center gap-1 transition"
                      >
                        {copiedId === `${quiz.id}_${currentCustomCount}` ? (
                          <>
                            <Check className="w-3 h-3 text-green-600" /> Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" /> Copy ({currentCustomCount} Qs)
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Footer & Actions */}
                  <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-gray-500">
                      <Users className="w-3.5 h-3.5" />
                      <span className="font-semibold text-gray-700">{quiz.total_attempts}</span>
                      <span>{quiz.total_attempts === 1 ? "submission" : "submissions"}</span>
                    </div>

                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <Link
                        href={`/dashboard/analytics/${quiz.id}`}
                        title="View Submissions, Answer Sheets & Live Monitor"
                        className="p-1.5 rounded-lg bg-[#0056D2]/10 hover:bg-[#0056D2]/20 text-[#0056D2] border border-[#0056D2]/20 transition flex items-center gap-1"
                      >
                        <BarChart3 className="w-3.5 h-3.5" />
                        <span className="text-[11px] font-semibold hidden sm:inline">Analytics</span>
                      </Link>

                      <button
                        onClick={(e) => handleCopyPracticeLink(e, quiz.id)}
                        title="Copy Student Practice Mode Link"
                        className="px-2 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition flex items-center gap-1"
                      >
                        {copiedId === `practice_${quiz.id}` ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Lightbulb className="w-3.5 h-3.5 text-amber-500" />}
                        <span className="text-[11px] font-semibold">{copiedId === `practice_${quiz.id}` ? "Copied" : "Practice"}</span>
                      </button>

                      <button
                        onClick={(e) => handleCopyShareLink(e, quiz.id)}
                        title="Copy Public Exam Link"
                        className="px-2 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition flex items-center gap-1"
                      >
                        {isCopied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                        <span className="text-[11px]">{isCopied ? "Copied" : "Exam"}</span>
                      </button>

                      <a
                        href={`/quiz/${quiz.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open Exam"
                        className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#0056D2] transition"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Modals */}
      <CreateQuizModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onQuizCreated={handleQuizCreated}
        serverIp={serverIp}
        existingCategories={allCategories}
        existingTags={allTags}
      />

      <AnalyticsModal
        quiz={selectedQuizForAnalytics}
        isOpen={Boolean(selectedQuizForAnalytics)}
        onClose={() => setSelectedQuizForAnalytics(null)}
        onQuizUpdated={handleQuizUpdated}
        onQuizDeleted={handleQuizDeleted}
        serverIp={serverIp}
      />

      <AddQuestionsModal
        quiz={quizForAddingQuestions}
        isOpen={Boolean(quizForAddingQuestions)}
        onClose={() => setQuizForAddingQuestions(null)}
        onQuestionsAdded={handleQuizUpdated}
      />

      <CombineSetsModal
        isOpen={isCombineOpen}
        onClose={() => setIsCombineOpen(false)}
        quizzes={quizzes}
        onQuizCreated={handleQuizCreated}
        serverIp={serverIp}
      />

      {/* Delete Question Set Confirmation Modal */}
      {quizToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-scale-in">
          <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 border border-red-200 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-lg font-bold text-gray-800">Delete Question Set?</h3>
              <p className="text-xs text-gray-500 mt-1">
                Are you sure you want to delete <strong className="text-gray-800">&quot;{quizToDelete.title}&quot;</strong>?
              </p>
              <p className="text-[11px] text-red-600 font-medium mt-1">
                This will permanently delete this question set and all associated student responses.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setQuizToDelete(null)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-gray-300 text-gray-700 font-semibold text-xs hover:bg-gray-100 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteQuiz}
                disabled={deletingQuiz}
                className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-xs shadow transition flex items-center justify-center gap-1.5"
              >
                {deletingQuiz ? <span>Deleting...</span> : <span>Delete Permanently</span>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
