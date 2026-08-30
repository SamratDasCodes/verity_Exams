import { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { getPublicQuizAction } from "@/app/actions/quiz";
import QuizRunner from "@/components/QuizRunner";

export const dynamic = "force-dynamic";

interface QuizPageProps {
  params: {
    id: string;
  };
  searchParams?: {
    count?: string;
    time?: string;
    mode?: string;
  };
}

export async function generateMetadata({ params, searchParams }: QuizPageProps): Promise<Metadata> {
  const countParam = searchParams?.count ? parseInt(searchParams.count, 10) : undefined;
  const timeParam = searchParams?.time ? parseInt(searchParams.time, 10) : undefined;
  const modeParam = searchParams?.mode;
  const res = await getPublicQuizAction(params.id, countParam, timeParam, modeParam);
  if (res.success && res.quiz) {
    const isPractice = res.quiz.mode === "practice";
    return {
      title: `${res.quiz.title} | ${isPractice ? "Practice Drill" : "Live Quiz"}`,
      description: isPractice
        ? `Interactive practice session for ${res.quiz.title}.`
        : `Take the ${res.quiz.title} live assessment.`,
    };
  }
  return {
    title: "Quiz Not Found | QuizMaster",
  };
}

export default async function PublicQuizPage({ params, searchParams }: QuizPageProps) {
  const countParam = searchParams?.count ? parseInt(searchParams.count, 10) : undefined;
  const timeParam = searchParams?.time ? parseInt(searchParams.time, 10) : undefined;
  const modeParam = searchParams?.mode;
  const res = await getPublicQuizAction(params.id, countParam, timeParam, modeParam);

  if (!res.success || !res.quiz) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-950 text-slate-100">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center shadow-2xl space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8" />
          </div>

          <h1 className="text-xl font-bold text-white">Quiz Not Found</h1>
          <p className="text-xs text-slate-400">
            {res.error || "The requested question set could not be found. It may have expired or been moved."}
          </p>

          <div className="pt-2">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return to Portal</span>
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return <QuizRunner quiz={res.quiz} />;
}
