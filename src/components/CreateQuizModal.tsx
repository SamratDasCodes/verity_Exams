"use client";

import { useState } from "react";
import { X, Plus, Sparkles, Copy, Check, ExternalLink, AlertCircle, FileCode, Folder, Tag } from "lucide-react";
import { createQuizAction } from "@/app/actions/quiz";
import { validateQuestionJson } from "@/lib/validator";
import { Quiz } from "@/lib/types";

interface CreateQuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  onQuizCreated: (quiz: Quiz) => void;
  serverIp?: string;
  existingCategories?: string[];
  existingTags?: string[];
}

const SAMPLE_JSON = `[
  {
    "question": "What is the capital of France?",
    "options": ["London", "Paris", "Berlin", "Madrid"],
    "correct_answer": "Paris"
  },
  {
    "question": "Which planet is known as the Red Planet?",
    "options": ["Venus", "Mars", "Jupiter", "Saturn"],
    "correct_answer": "Mars"
  },
  {
    "question": "What is 7 multiplied by 8?",
    "options": ["48", "54", "56", "64"],
    "correct_answer": "56"
  }
]`;

export default function CreateQuizModal({
  isOpen,
  onClose,
  onQuizCreated,
  serverIp,
  existingCategories = [],
  existingTags = [],
}: CreateQuizModalProps) {
  const [title, setTitle] = useState("");
  const [headerImageUrl, setHeaderImageUrl] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [jsonText, setJsonText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdQuiz, setCreatedQuiz] = useState<Quiz | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handlePasteSample = () => {
    setTitle("General Knowledge & Logic Sprint");
    setHeaderImageUrl("");
    setCategory("General Knowledge");
    setTags(["Sample", "Trivia"]);
    setJsonText(SAMPLE_JSON);
    setError(null);
  };

  const handleAddTag = (tagToAdd: string) => {
    const cleaned = tagToAdd.trim().replace(/^#/, "");
    if (cleaned && !tags.includes(cleaned)) {
      setTags([...tags, cleaned]);
    }
    setTagInput("");
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleKeyDownTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      handleAddTag(tagInput);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Client-side quick check
    const validation = validateQuestionJson(jsonText);
    if (!validation.valid) {
      setError(validation.error || "Invalid JSON question format.");
      return;
    }

    const effectiveTitle = title.trim() || validation.suggestedTitle || "Untitled Question Set";

    setLoading(true);
    try {
      const res = await createQuizAction(
        effectiveTitle,
        jsonText,
        headerImageUrl.trim() || undefined,
        category.trim() || undefined,
        tags
      );
      if (res.success && res.quiz) {
        setCreatedQuiz(res.quiz);
        onQuizCreated(res.quiz);
      } else {
        setError(res.error || "Failed to create quiz.");
      }
    } catch {
      setError("An unexpected error occurred while saving the quiz.");
    } finally {
      setLoading(false);
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

  const shareOrigin = getShareOrigin();
  const shareUrl = createdQuiz ? `${shareOrigin}/quiz/${createdQuiz.id}` : "";

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleResetAndClose = () => {
    setTitle("");
    setHeaderImageUrl("");
    setCategory("");
    setTags([]);
    setTagInput("");
    setJsonText("");
    setError(null);
    setCreatedQuiz(null);
    setCopied(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-scale-in">
      <div className="w-full max-w-2xl bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-50 text-[#0056D2] border border-blue-200">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800">Create New Question Set</h2>
              <p className="text-xs text-gray-500">
                Paste structured JSON questions to generate an instant live exam
              </p>
            </div>
          </div>
          <button
            onClick={handleResetAndClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {createdQuiz ? (
            /* Success View */
            <div className="space-y-6 text-center py-4">
              <div className="w-16 h-16 rounded-full bg-green-50 border border-green-200 text-green-600 flex items-center justify-center mx-auto">
                <Sparkles className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-xl font-bold text-gray-800">Question Set Created!</h3>
                <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
                  <strong className="text-gray-800">&quot;{createdQuiz.title}&quot;</strong> is ready.
                  Share the link below with candidates.
                </p>
              </div>

              <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl text-left space-y-2">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider block">
                  Candidate Exam URL
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={shareUrl}
                    className="flex-1 bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono text-gray-800 select-all"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="px-3.5 py-2 rounded-lg bg-[#0056D2] hover:bg-[#0045A8] text-white text-xs font-semibold flex items-center gap-1.5 shadow transition"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-white" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" /> Copy Link
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                <a
                  href={shareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Open Exam
                </a>
                <button
                  onClick={handleResetAndClose}
                  className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold transition"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            /* Creation Form */
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                  Question Set Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Macbeth English Literature Assessment"
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-[#0056D2] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0056D2] transition"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Optional: If left blank, it will automatically detect the Topic (e.g. &quot;Macbeth&quot;) from your JSON.
                </p>
              </div>

              {/* Category & Tags Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-3.5 bg-gray-50 border border-gray-200 rounded-xl">
                {/* Category Selection / Input */}
                <div>
                  <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                    <Folder className="w-3.5 h-3.5 text-[#0056D2]" />
                    Category / Subject
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      list="existing-categories"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      placeholder="e.g. Mathematics, Physics"
                      className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-800 placeholder:text-gray-400 focus:border-[#0056D2] focus:outline-none"
                    />
                    <datalist id="existing-categories">
                      {Array.from(new Set([...existingCategories, "Mathematics", "Physics", "Chemistry", "Biology", "English Literature", "History", "Computer Science"])).map((cat) => (
                        <option key={cat} value={cat} />
                      ))}
                    </datalist>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">
                    Groups question sets under a subject tab.
                  </p>
                </div>

                {/* Tags Chip Input */}
                <div>
                  <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                    <Tag className="w-3.5 h-3.5 text-amber-600" />
                    Tags
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={handleKeyDownTag}
                      placeholder="Type tag & press Enter"
                      className="flex-1 bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-800 placeholder:text-gray-400 focus:border-[#0056D2] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddTag(tagInput)}
                      disabled={!tagInput.trim()}
                      className="px-2.5 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-xs font-semibold disabled:opacity-40 transition"
                    >
                      Add
                    </button>
                  </div>

                  {/* Active Tag Chips */}
                  {tags.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap mt-2">
                      {tags.map((t) => (
                        <span
                          key={t}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-[#0056D2] border border-blue-200 text-[11px] font-semibold"
                        >
                          #{t}
                          <button
                            type="button"
                            onClick={() => handleRemoveTag(t)}
                            className="hover:text-red-600 focus:outline-none ml-0.5"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Quick Preset Tag Suggestions */}
                  <div className="flex items-center gap-1 flex-wrap mt-2">
                    {["Grade-9", "Grade-10", "Grade-11", "Grade-12", "Term-1", "Revision"]
                      .filter((preset) => !tags.includes(preset))
                      .map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => handleAddTag(preset)}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-white hover:bg-gray-200 text-gray-600 border border-gray-300 transition"
                        >
                          +{preset}
                        </button>
                      ))}
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Header Logo / Image URL (Optional)
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setHeaderImageUrl("/images/generation-logo.png")}
                      className="text-[11px] text-[#0056D2] hover:underline"
                    >
                      Use &quot;Generation&quot; Logo
                    </button>
                    {headerImageUrl && (
                      <button
                        type="button"
                        onClick={() => setHeaderImageUrl("")}
                        className="text-[11px] text-gray-500 hover:text-red-600"
                      >
                        Clear (Use Title)
                      </button>
                    )}
                  </div>
                </div>
                <input
                  type="text"
                  value={headerImageUrl}
                  onChange={(e) => setHeaderImageUrl(e.target.value)}
                  placeholder="e.g. /images/generation-logo.png or https://example.com/logo.png"
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-[#0056D2] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0056D2] transition"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Leave blank to display the <strong>Question Set Name</strong> as the exam heading.
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Questions JSON Array
                  </label>
                  <button
                    type="button"
                    onClick={handlePasteSample}
                    className="text-xs text-[#0056D2] hover:underline flex items-center gap-1 font-medium"
                  >
                    <FileCode className="w-3.5 h-3.5" /> Load Sample JSON
                  </button>
                </div>

                <textarea
                  value={jsonText}
                  onChange={(e) => {
                    setJsonText(e.target.value);
                    if (error) setError(null);
                  }}
                  rows={9}
                  placeholder={`[\n  {\n    "question": "What is the capital of France?",\n    "options": ["London", "Paris", "Berlin", "Madrid"],\n    "correct_answer": "Paris"\n  }\n]`}
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg p-3.5 text-xs font-mono text-gray-800 placeholder:text-gray-400 focus:border-[#0056D2] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0056D2] transition resize-y"
                  required
                />
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={handleResetAndClose}
                  className="px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100 text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !jsonText.trim()}
                  className="px-5 py-2.5 rounded-lg bg-[#0056D2] hover:bg-[#0045A8] disabled:opacity-50 text-white text-xs font-semibold shadow transition flex items-center gap-1.5"
                >
                  {loading ? (
                    <span>Validating & Saving...</span>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>Generate Question Set</span>
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
