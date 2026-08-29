"use client";

import { useState, useMemo, useEffect } from "react";
import {
  X,
  Layers,
  Sparkles,
  Check,
  Calendar,
  AlertCircle,
  HelpCircle,
  Copy,
  Sliders,
  CheckSquare,
  Square,
  Image as ImageIcon,
} from "lucide-react";
import { createCombinedQuizAction } from "@/app/actions/quiz";
import { QuizWithStats, Quiz } from "@/lib/types";

interface CombineSetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  quizzes: QuizWithStats[];
  onQuizCreated: (newQuiz: Quiz) => void;
  serverIp?: string;
}

export default function CombineSetsModal({
  isOpen,
  onClose,
  quizzes,
  onQuizCreated,
  serverIp,
}: CombineSetsModalProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [headerImageUrl, setHeaderImageUrl] = useState("");
  const [deduplicate, setDeduplicate] = useState(true);
  const [isStratified, setIsStratified] = useState(false);
  const [topicQuotas, setTopicQuotas] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdQuiz, setCreatedQuiz] = useState<Quiz | null>(null);
  const [copied, setCopied] = useState(false);

  // Initialize selection when opened
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setCreatedQuiz(null);
      setCopied(false);
      // Pre-select first 2 quizzes if available
      if (quizzes.length >= 2) {
        const initial = [quizzes[0].id, quizzes[1].id];
        setSelectedIds(initial);
        generateAutoTitle(initial);
        initQuotas(initial);
      } else {
        setSelectedIds(quizzes.map((q) => q.id));
        generateAutoTitle(quizzes.map((q) => q.id));
      }
    }
  }, [isOpen, quizzes]);

  const initQuotas = (ids: string[]) => {
    const nextQuotas: Record<string, number> = {};
    ids.forEach((id) => {
      const q = quizzes.find((item) => item.id === id);
      if (q) {
        const count = q.raw_json?.length || 0;
        nextQuotas[q.title] = Math.min(10, count);
      }
    });
    setTopicQuotas(nextQuotas);
  };

  const generateAutoTitle = (ids: string[]) => {
    const selected = quizzes.filter((q) => ids.includes(q.id));
    if (selected.length === 0) {
      setTitle("");
    } else if (selected.length <= 2) {
      setTitle(`Combined: ${selected.map((s) => s.title).join(" & ")}`);
    } else {
      setTitle(`Grand Combined Assessment (${selected.length} Topics)`);
    }
  };

  const handleToggleSelect = (quizId: string) => {
    let nextIds: string[];
    if (selectedIds.includes(quizId)) {
      nextIds = selectedIds.filter((id) => id !== quizId);
    } else {
      nextIds = [...selectedIds, quizId];
    }
    setSelectedIds(nextIds);
    generateAutoTitle(nextIds);

    // Update quotas
    const nextQuotas = { ...topicQuotas };
    const toggledQuiz = quizzes.find((q) => q.id === quizId);
    if (toggledQuiz) {
      if (nextIds.includes(quizId)) {
        nextQuotas[toggledQuiz.title] = Math.min(10, toggledQuiz.raw_json?.length || 0);
      } else {
        delete nextQuotas[toggledQuiz.title];
      }
    }
    setTopicQuotas(nextQuotas);
  };

  const handleSelectAll = () => {
    const allIds = quizzes.map((q) => q.id);
    setSelectedIds(allIds);
    generateAutoTitle(allIds);
    initQuotas(allIds);
  };

  const handleDeselectAll = () => {
    setSelectedIds([]);
    setTitle("");
    setTopicQuotas({});
  };

  // Calculations for live pool
  const { totalRawPool, totalUniquePool, duplicateEstimate } = useMemo(() => {
    const selected = quizzes.filter((q) => selectedIds.includes(q.id));
    let raw = 0;
    const seen = new Set<string>();
    let duplicates = 0;

    selected.forEach((q) => {
      (q.raw_json || []).forEach((item) => {
        raw++;
        const norm = item.question?.trim().toLowerCase();
        if (norm) {
          if (seen.has(norm)) {
            duplicates++;
          } else {
            seen.add(norm);
          }
        }
      });
    });

    return {
      totalRawPool: raw,
      totalUniquePool: seen.size,
      duplicateEstimate: duplicates,
    };
  }, [selectedIds, quizzes]);

  const totalStratifiedExamQuestions = useMemo(() => {
    if (!isStratified) return 0;
    return Object.values(topicQuotas).reduce((sum, val) => sum + (val || 0), 0);
  }, [isStratified, topicQuotas]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (selectedIds.length < 2) {
      setError("Please select at least 2 question sets to combine.");
      return;
    }

    if (!title.trim()) {
      setError("Please provide a title for the combined question set.");
      return;
    }

    setLoading(true);
    try {
      const res = await createCombinedQuizAction({
        title: title.trim(),
        sourceQuizIds: selectedIds,
        deduplicate,
        topicQuotas: isStratified ? topicQuotas : undefined,
        headerImageUrl: headerImageUrl.trim() || undefined,
      });

      if (res.success && res.quiz) {
        setCreatedQuiz(res.quiz);
        onQuizCreated(res.quiz);
      } else {
        setError(res.error || "Failed to create combined question set.");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const origin =
    typeof window !== "undefined"
      ? serverIp && serverIp !== "localhost" && (window.location.origin.includes("localhost") || window.location.origin.includes("127.0.0.1"))
        ? `http://${serverIp}:3000`
        : window.location.origin
      : "";

  const publicUrl = createdQuiz ? `${origin}/quiz/${createdQuiz.id}` : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="w-full max-w-2xl bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-[#0056D2] to-[#003B99] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-white/10">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">1-Click Combine Question Sets</h2>
              <p className="text-xs text-blue-100">
                Merge multiple question banks into a single grand examination
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {createdQuiz ? (
            /* Success View */
            <div className="space-y-6 text-center py-4">
              <div className="w-14 h-14 bg-green-100 text-green-600 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                <Check className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-lg font-bold text-gray-900">Combined Set Created!</h3>
                <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
                  <strong>&quot;{createdQuiz.title}&quot;</strong> has been generated with{" "}
                  <strong>{createdQuiz.raw_json.length} questions</strong> from {selectedIds.length} sets.
                </p>
              </div>

              {/* Share Box */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-left max-w-md mx-auto space-y-3">
                <label className="text-xs font-semibold text-gray-700 block">
                  Public Combined Exam Link
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={publicUrl}
                    className="flex-1 bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono text-gray-700 select-all focus:outline-none"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(publicUrl);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="px-3.5 py-2 rounded-lg bg-[#0056D2] hover:bg-[#0045A8] text-white text-xs font-semibold shadow transition flex items-center gap-1 shrink-0"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? "Copied" : "Copy"}</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-semibold text-xs hover:bg-gray-100 transition"
                >
                  Done & Close
                </button>
                <a
                  href={`/quiz/${createdQuiz.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-2.5 rounded-xl bg-[#0056D2] hover:bg-[#0045A8] text-white font-semibold text-xs shadow transition inline-flex items-center gap-1.5"
                >
                  <span>Preview Exam</span>
                </a>
              </div>
            </div>
          ) : (
            /* Creation Form */
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-semibold">Error: </strong>
                    {error}
                  </div>
                </div>
              )}

              {/* Step 1: Select Sets */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                    <span>1. Select Question Sets to Combine</span>
                    <span className="text-gray-400 font-normal">
                      (Select 2 or more)
                    </span>
                  </label>
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="text-[#0056D2] hover:underline font-medium text-[11px]"
                    >
                      Select All
                    </button>
                    <span className="text-gray-300">•</span>
                    <button
                      type="button"
                      onClick={handleDeselectAll}
                      className="text-gray-500 hover:underline font-medium text-[11px]"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="border border-gray-200 rounded-xl divide-y divide-gray-100 max-h-48 overflow-y-auto bg-gray-50/50">
                  {quizzes.map((quiz) => {
                    const isSelected = selectedIds.includes(quiz.id);
                    const qCount = quiz.raw_json?.length || 0;

                    return (
                      <div
                        key={quiz.id}
                        onClick={() => handleToggleSelect(quiz.id)}
                        className={`p-3 flex items-center justify-between gap-3 cursor-pointer transition ${
                          isSelected
                            ? "bg-blue-50/70 hover:bg-blue-50"
                            : "hover:bg-gray-100/70 bg-white"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="shrink-0 text-[#0056D2]">
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-[#0056D2]" />
                            ) : (
                              <Square className="w-4 h-4 text-gray-300" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-semibold text-gray-800 text-xs truncate">
                              {quiz.title}
                            </h4>
                            <p className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
                              <Calendar className="w-3 h-3" />
                              {new Date(quiz.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>

                        <span className="shrink-0 text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-[#0056D2] font-semibold border border-blue-200">
                          {qCount} Qs
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Live Pool Counter Bar */}
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs flex items-center justify-between flex-wrap gap-2 text-[#0056D2]">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 shrink-0" />
                    <span className="font-semibold">
                      {selectedIds.length} Sets Selected
                    </span>
                    <span className="text-blue-300">•</span>
                    <span>
                      Total Combined Pool:{" "}
                      <strong>
                        {deduplicate ? totalUniquePool : totalRawPool} Questions
                      </strong>
                    </span>
                  </div>
                  {deduplicate && duplicateEstimate > 0 && (
                    <span className="text-[11px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-medium">
                      {duplicateEstimate} duplicate questions filtered
                    </span>
                  )}
                </div>
              </div>

              {/* Step 2: Smart Options (Deduplication & Stratified Sampling) */}
              <div className="space-y-3 pt-2 border-t border-gray-100">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block">
                  2. Pooling & Sampling Rules
                </label>

                {/* Deduplication Toggle */}
                <label className="flex items-start gap-3 p-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50/70 transition cursor-pointer">
                  <input
                    type="checkbox"
                    checked={deduplicate}
                    onChange={(e) => setDeduplicate(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded text-[#0056D2] focus:ring-[#0056D2]"
                  />
                  <div>
                    <span className="text-xs font-bold text-gray-800 block">
                      Smart De-duplication
                    </span>
                    <span className="text-[11px] text-gray-500">
                      Detects and merges identical questions across sets so candidates never see repeated questions.
                    </span>
                  </div>
                </label>

                {/* Stratified Topic Sampling Toggle */}
                <label className="flex items-start gap-3 p-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50/70 transition cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isStratified}
                    onChange={(e) => setIsStratified(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded text-[#0056D2] focus:ring-[#0056D2]"
                  />
                  <div>
                    <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                      <span>Weighted / Stratified Topic Sampling</span>
                      <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.2 rounded font-semibold">
                        Quotas
                      </span>
                    </span>
                    <span className="text-[11px] text-gray-500">
                      Specify exact question quotas per topic (e.g. 10 from Macbeth + 5 from Science).
                    </span>
                  </div>
                </label>

                {/* Quota Inputs when Stratified Sampling is active */}
                {isStratified && selectedIds.length > 0 && (
                  <div className="p-3.5 bg-amber-50/60 border border-amber-200 rounded-xl space-y-3 animate-fade-in">
                    <div className="flex items-center justify-between text-xs font-semibold text-amber-900">
                      <span>Set Quota for Each Selected Topic</span>
                      <span>Total Exam: {totalStratifiedExamQuestions} Qs</span>
                    </div>

                    <div className="space-y-2">
                      {selectedIds.map((id) => {
                        const q = quizzes.find((item) => item.id === id);
                        if (!q) return null;
                        const available = q.raw_json?.length || 0;
                        const currentQuota = topicQuotas[q.title] ?? Math.min(10, available);

                        return (
                          <div
                            key={id}
                            className="bg-white p-2.5 rounded-lg border border-amber-200/80 flex items-center justify-between gap-3 text-xs"
                          >
                            <div className="min-w-0">
                              <p className="font-semibold text-gray-800 truncate">{q.title}</p>
                              <p className="text-[10px] text-gray-400">Available Pool: {available} Qs</p>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-gray-500 text-[11px]">Take:</span>
                              <input
                                type="number"
                                min={1}
                                max={available}
                                value={currentQuota}
                                onChange={(e) => {
                                  const val = Math.max(1, Math.min(available, parseInt(e.target.value, 10) || 1));
                                  setTopicQuotas((prev) => ({
                                    ...prev,
                                    [q.title]: val,
                                  }));
                                }}
                                className="w-14 bg-amber-50/30 border border-amber-300 rounded px-1.5 py-0.5 text-center font-bold text-amber-900 text-xs focus:outline-none focus:border-[#0056D2]"
                              />
                              <span className="text-gray-500 text-[11px]">Qs</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Step 3: New Set Metadata */}
              <div className="space-y-3 pt-2 border-t border-gray-100">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block">
                  3. New Exam Set Details
                </label>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">Combined Exam Title</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Grand Midterm Combined Assessment"
                    className="w-full bg-white border border-gray-300 rounded-xl px-3.5 py-2 text-xs text-gray-800 focus:outline-none focus:border-[#0056D2] font-semibold"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-gray-600 flex items-center gap-1">
                      <ImageIcon className="w-3.5 h-3.5 text-[#0056D2]" />
                      <span>Exam Header Logo (Optional)</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setHeaderImageUrl("/images/generation-logo.png")}
                      className="text-[11px] text-[#0056D2] hover:underline font-medium"
                    >
                      Use Generation Logo
                    </button>
                  </div>
                  <input
                    type="text"
                    value={headerImageUrl}
                    onChange={(e) => setHeaderImageUrl(e.target.value)}
                    placeholder="/images/generation-logo.png or public URL"
                    className="w-full bg-white border border-gray-300 rounded-xl px-3.5 py-2 text-xs text-gray-800 focus:outline-none focus:border-[#0056D2]"
                  />
                </div>
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-between gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-semibold text-xs hover:bg-gray-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || selectedIds.length < 2 || !title.trim()}
                  className="px-5 py-2.5 rounded-xl bg-[#0056D2] hover:bg-[#0045A8] disabled:opacity-50 text-white font-semibold text-xs shadow transition flex items-center gap-1.5"
                >
                  {loading ? (
                    <span>Generating Combined Pool...</span>
                  ) : (
                    <>
                      <Layers className="w-4 h-4" />
                      <span>Create Combined Set ({deduplicate ? totalUniquePool : totalRawPool} Qs)</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
