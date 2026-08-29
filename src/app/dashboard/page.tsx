import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { fetchAllQuizzes, fetchAllAttempts } from "@/lib/supabase/db";
import { getServerNetworkIp } from "@/lib/network";
import { QuizWithStats } from "@/lib/types";
import DashboardClient from "./DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const isAuth = await isAuthenticated();
  if (!isAuth) {
    redirect("/");
  }

  const quizzes = await fetchAllQuizzes();
  const attempts = await fetchAllAttempts();
  const serverIp = getServerNetworkIp();

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

  return <DashboardClient initialQuizzes={quizzesWithStats} serverIp={serverIp} />;
}
