export interface QuestionItem {
  question: string;
  options: string[];
  correct_answer: string;
  explanation?: string;
  id?: string;
  topic?: string;
}

export interface PublicQuestionItem {
  id?: string;
  originalIndex: number;
  question: string;
  options: string[];
  topic?: string;
  correct_answer?: string;
  explanation?: string;
}

export interface Quiz {
  id: string;
  created_at: string;
  title: string;
  raw_json: QuestionItem[];
  questions_per_attempt?: number;
  time_limit_minutes?: number;
  header_image_url?: string;
  topic_quotas?: Record<string, number>;
  category?: string;
  tags?: string[];
}

export interface QuizPublic {
  id: string;
  created_at: string;
  title: string;
  questions: PublicQuestionItem[];
  total_questions: number;
  total_pool_size?: number;
  time_limit_minutes?: number;
  header_image_url?: string;
  topic_quotas?: Record<string, number>;
  mode?: "exam" | "practice";
}

export interface ActiveStudentSession {
  id: string;
  trainee_name: string;
  quiz_id: string;
  answered_count: number;
  total_questions: number;
  status: "in_progress" | "submitted";
  tab_switches?: number;
  last_active: string;
}

export interface Attempt {
  id: string;
  quiz_id: string;
  trainee_name: string;
  score: number;
  max_score: number;
  tab_switches?: number;
  mode?: "exam" | "practice";
  breakdown?: QuestionBreakdown[];
  answers?: Record<number, string>;
  submitted_at: string;
}

export interface QuizWithStats extends Quiz {
  total_attempts: number;
  average_score: number;
}

export interface QuestionBreakdown {
  questionIndex: number;
  originalIndex?: number;
  question: string;
  selectedAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  explanation?: string;
}

export interface SubmissionResult {
  attemptId: string;
  traineeName: string;
  score: number;
  maxScore: number;
  percentage: number;
  tab_switches?: number;
  mode?: "exam" | "practice";
  breakdown: QuestionBreakdown[];
}
