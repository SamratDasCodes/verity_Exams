import { QuestionItem } from "./types";

export interface ValidationResult {
  valid: boolean;
  data?: QuestionItem[];
  suggestedTitle?: string;
  suggestedLimit?: number;
  error?: string;
}

export function validateQuestionJson(jsonString: string): ValidationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString.trim());
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Syntax error";
    return { valid: false, error: `Invalid JSON syntax: ${message}` };
  }

  let questionsArray: unknown[] | null = null;
  let suggestedTitle: string | undefined = undefined;
  let suggestedLimit: number | undefined = undefined;

  // Support wrapper objects: e.g. { "Topic": "Macbeth", "questions": [ ... ] }
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const obj = parsed as Record<string, unknown>;
    suggestedTitle =
      (typeof obj.Topic === "string" && obj.Topic.trim()) ||
      (typeof obj.topic === "string" && obj.topic.trim()) ||
      (typeof obj.title === "string" && obj.title.trim()) ||
      (typeof obj.category === "string" && obj.category.trim()) ||
      undefined;

    if (typeof obj.questions_per_attempt === "number" && obj.questions_per_attempt > 0) {
      suggestedLimit = obj.questions_per_attempt;
    } else if (typeof obj.limit === "number" && obj.limit > 0) {
      suggestedLimit = obj.limit;
    } else if (typeof obj.count === "number" && obj.count > 0) {
      suggestedLimit = obj.count;
    }

    if (Array.isArray(obj.questions)) {
      questionsArray = obj.questions;
    } else if (Array.isArray(obj.quiz)) {
      questionsArray = obj.quiz;
    } else if (Array.isArray(obj.items)) {
      questionsArray = obj.items;
    } else {
      return {
        valid: false,
        error:
          'Expected either a JSON array of questions, or an object containing a "questions" array (e.g. { "Topic": "...", "questions": [...] }).',
      };
    }
  } else if (Array.isArray(parsed)) {
    questionsArray = parsed;
  } else {
    return {
      valid: false,
      error: "Input must be a valid JSON array or an object containing a questions array.",
    };
  }

  if (!questionsArray || questionsArray.length === 0) {
    return {
      valid: false,
      error: "The questions array cannot be empty. Please provide at least 1 question.",
    };
  }

  const normalizedQuestions: QuestionItem[] = [];

  for (let i = 0; i < questionsArray.length; i++) {
    const item = questionsArray[i];
    const qNum = i + 1;

    if (!item || typeof item !== "object") {
      return { valid: false, error: `Question #${qNum} is not a valid object.` };
    }

    const qObj = item as Record<string, unknown>;

    // 1. Resolve question text (supports 'question_text', 'question', 'text', 'prompt')
    const rawQuestionText =
      qObj.question_text || qObj.question || qObj.text || qObj.prompt;

    if (typeof rawQuestionText !== "string" || !rawQuestionText.trim()) {
      return {
        valid: false,
        error: `Question #${qNum} is missing question text (expected "question_text" or "question").`,
      };
    }

    // 2. Resolve options (supports 'options', 'choices')
    const rawOptions = qObj.options || qObj.choices;
    if (!Array.isArray(rawOptions) || rawOptions.length < 2) {
      return {
        valid: false,
        error: `Question #${qNum} ("${rawQuestionText.slice(0, 30)}...") must have an "options" array with at least 2 choices.`,
      };
    }

    const hasInvalidOptions = rawOptions.some(
      (opt: unknown) => typeof opt !== "string" || !opt.trim()
    );
    if (hasInvalidOptions) {
      return {
        valid: false,
        error: `Question #${qNum} has one or more empty or non-string options.`,
      };
    }
    const cleanOptions = rawOptions.map((opt: unknown) => String(opt).trim());

    // 3. Resolve correct answer (supports 'correct_index', 'correct_answer', 'correctIndex', 'correctAnswer', 'answer')
    let resolvedAnswer: string | null = null;

    if (typeof qObj.correct_index === "number" || typeof qObj.correctIndex === "number") {
      const idx = typeof qObj.correct_index === "number" ? qObj.correct_index : (qObj.correctIndex as number);
      if (idx < 0 || idx >= cleanOptions.length) {
        return {
          valid: false,
          error: `Question #${qNum}: "correct_index" (${idx}) is out of range. It must be between 0 and ${cleanOptions.length - 1}.`,
        };
      }
      resolvedAnswer = cleanOptions[idx];
    } else if (typeof qObj.correct_answer === "string" || typeof qObj.correctAnswer === "string") {
      const ans = typeof qObj.correct_answer === "string" ? qObj.correct_answer : (qObj.correctAnswer as string);
      const matched = cleanOptions.find((opt) => opt.toLowerCase() === ans.trim().toLowerCase());
      if (!matched) {
        return {
          valid: false,
          error: `Question #${qNum}: "correct_answer" ("${ans}") does not match any of the provided options: [${cleanOptions.join(", ")}].`,
        };
      }
      resolvedAnswer = matched;
    } else if (typeof qObj.answer === "string") {
      const matched = cleanOptions.find((opt) => opt.toLowerCase() === (qObj.answer as string).trim().toLowerCase());
      if (!matched) {
        return {
          valid: false,
          error: `Question #${qNum}: "answer" ("${qObj.answer}") does not match any of the provided options: [${cleanOptions.join(", ")}].`,
        };
      }
      resolvedAnswer = matched;
    } else {
      return {
        valid: false,
        error: `Question #${qNum} is missing "correct_index" (e.g. 0) or "correct_answer".`,
      };
    }

    // 4. Resolve explanation if available
    const explanation =
      typeof qObj.explanation === "string" ? qObj.explanation.trim() : undefined;

    normalizedQuestions.push({
      id: typeof qObj.id === "string" ? qObj.id : `Q_${qNum}`,
      question: rawQuestionText.trim(),
      options: cleanOptions,
      correct_answer: resolvedAnswer,
      explanation,
    });
  }

  return {
    valid: true,
    data: normalizedQuestions,
    suggestedTitle,
    suggestedLimit,
  };
}
