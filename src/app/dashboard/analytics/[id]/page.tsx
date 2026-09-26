import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { fetchQuizById, fetchAttemptsByQuizId } from "@/lib/supabase/db";
import { getServerNetworkIp } from "@/lib/network";
import QuizAnalyticsClient from "./QuizAnalyticsClient";

export const dynamic = "force-dynamic";

interface Props {
  params: {
    id: string;
  };
}

export default async function QuizAnalyticsPage({ params }: Props) {
  const isAuth = await isAuthenticated();
  if (!isAuth) {
    redirect("/");
  }

  const quiz = await fetchQuizById(params.id);
  if (!quiz) {
    redirect("/dashboard");
  }

  const initialAttempts = await fetchAttemptsByQuizId(params.id);
  const serverIp = getServerNetworkIp();

  return (
    <QuizAnalyticsClient
      initialQuiz={quiz}
      initialAttempts={initialAttempts}
      serverIp={serverIp}
    />
  );
}
