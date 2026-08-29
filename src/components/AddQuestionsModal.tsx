"use client";

import { useState } from "react";
import { X, PlusCircle, CheckCircle2, AlertCircle, FileCode } from "lucide-react";
import { appendQuestionsAction } from "@/app/actions/quiz";
import { validateQuestionJson } from "@/lib/validator";
import { Quiz } from "@/lib/types";

interface AddQuestionsModalProps {
  quiz: Quiz | null;
  isOpen: boolean;
  onClose: () => void;
  onQuestionsAdded: (updatedQuiz: Quiz, addedCount: number) => void;
}

const SAMPLE_APPEND_JSON = `[
  {
    "question": "Who was the King of Scotland at the beginning of Macbeth?",
    "options": ["Duncan", "Malcolm", "Macduff", "Donalbain"],
    "correct_answer": "Duncan",
    "explanation": "King Duncan was the ruler of Scotland at the start of the play."
  }
]`;

export default function AddQuestionsModal({
  quiz,
  isOpen,
  onClose,
  onQuestionsAdded,
}: AddQuestionsModalProps) {
  const [jsonText, setJsonText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{ added: number; total: number } | null>(null);

  if (!isOpen || !quiz) return null;

  const currentTotal = quiz.raw_json?.length || 0;

  const handlePasteSample = () => {
    setJsonText(SAMPLE_APPEND_JSON);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jsonText.trim()) {
      setError("Please paste a JSON array or topic object containing questions to append.");
      return;
    }

    const validation = validateQuestionJson(jsonText);
    if (!validation.valid || !validation.data) {
      setError(validation.error || "Invalid JSON structure.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await appendQuestionsAction(quiz.id, jsonText);
      if (res.success && res.quiz && res.addedCount) {
        setSuccessInfo({ added: res.addedCount, total: res.quiz.raw_json.length });
        onQuestionsAdded(res.quiz, res.addedCount);
        setJsonText("");
        setTimeout(() => {
          setSuccessInfo(null);
          onClose();
        }, 2200);
      } else {
        setError(res.error || "Failed to append questions.");
      }
    } catch {
      setError("Network or server error while appending questions.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-scale-in">
      <div className="w-full max-w-2xl bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-50 text-[#0056D2] border border-blue-200">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800">Add More Questions</h2>
              <p className="text-xs text-gray-500">
                Appending to: <strong className="text-gray-800">&quot;{quiz.title}&quot;</strong> ({currentTotal} questions currently)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {successInfo ? (
            <div className="py-8 text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-green-50 text-green-600 border border-green-200 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-gray-800">Questions Appended!</h3>
              <p className="text-sm text-gray-500">
                Added <strong className="text-green-700">{successInfo.added}</strong> new questions.
                Bank now has <strong className="text-gray-800">{successInfo.total}</strong> total questions.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Additional Questions JSON
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
                  placeholder={`[\n  {\n    "question": "Who is Macbeth's best friend?",\n    "options": ["Banquo", "Macduff", "Duncan", "Ross"],\n    "correct_answer": "Banquo"\n  }\n]`}
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg p-3.5 text-xs font-mono text-gray-800 placeholder:text-gray-400 focus:border-[#0056D2] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0056D2] transition resize-y"
                  required
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Supports JSON array format or {`{ "Topic": "...", "questions": [...] }`}.
                </p>
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
                  onClick={onClose}
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
                    <span>Validating & Appending...</span>
                  ) : (
                    <>
                      <PlusCircle className="w-4 h-4" />
                      <span>Append Questions to Set</span>
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
