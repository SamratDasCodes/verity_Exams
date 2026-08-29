# Verity | Online Examination & Assessment Platform

A high-performance, frictionless quiz generation and live assessment application built with **Next.js (App Router)**, **Tailwind CSS**, and **Supabase**.

---

## ✨ Features

- **Frictionless PIN Admin Access**: No traditional registration, username, or password forms. The administrator accesses the dashboard by simply entering a secure server-verified PIN on the landing page.
- **Instant JSON Question Set Generation**: Click the prominent `+` button, paste a JSON array of questions, and instantly generate a live, shareable URL for attendees.
- **Anti-Cheat Public Interface**: Question answer keys (`correct_answer`) are **never exposed to the client or network tab**. All submissions are auto-graded securely on the server.
- **Live Attendee Analytics**: Clicking any Question Set opens an Analytics view showing each attendee's name, auto-graded marks, performance percentage, and submission timestamp.
- **Gamified Modern UI**: Clean, responsive layout with progress indicators, smooth option selection states, confetti animations, and performance achievement badges.
- **Dual-Mode Database**: Directly integrates with Supabase PostgreSQL, and features an integrated local JSON fallback store so the application runs completely out-of-the-box for local testing!

---

## 🗄️ Supabase Database Setup

1. Open your [Supabase Dashboard](https://app.supabase.com) and create a new project.
2. Go to the **SQL Editor** and paste the contents of `supabase/schema.sql`:

```sql
-- 1. Ensure UUID extension is available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Quizzes Table
CREATE TABLE IF NOT EXISTS quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  title TEXT NOT NULL,
  raw_json JSONB NOT NULL
);

-- 3. Attempts Table
CREATE TABLE IF NOT EXISTS attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  trainee_name TEXT NOT NULL,
  score INT NOT NULL,
  max_score INT NOT NULL DEFAULT 0,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Fast Query Indexes
CREATE INDEX IF NOT EXISTS idx_attempts_quiz_id ON attempts(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_created_at ON quizzes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_attempts_submitted_at ON attempts(submitted_at DESC);

-- 5. Row Level Security (RLS)
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to quizzes" ON quizzes FOR SELECT USING (true);
CREATE POLICY "Allow public insert to attempts" ON attempts FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public read to attempts" ON attempts FOR SELECT USING (true);
CREATE POLICY "Allow anon insert to quizzes" ON quizzes FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anon delete to quizzes" ON quizzes FOR DELETE USING (true);
```

---

## 🔑 Environment Configuration

Create or update `.env.local`:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Single Admin Access PIN (Used on the landing page)
ADMIN_PIN=2026

# Session Security Secret
ADMIN_SESSION_SECRET=super-secure-admin-token-signing-key
```

---

## 📋 Required JSON Format for Creating Quizzes

When creating a quiz in the admin dashboard, paste an array of question objects following this structure:

```json
[
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
]
```

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Run the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Log In as Admin
- Open [http://localhost:3000](http://localhost:3000)
- Enter PIN: `2026` (or the PIN configured in your `.env.local`)
- Click **Enter Dashboard**

### 4. Create a Quiz & Share
- Click the **+ Create Quiz** button.
- Type a Quiz Title and paste your JSON questions (or click **Load Sample JSON**).
- Click **Parse & Generate Quiz**.
- Copy the generated URL (e.g., `http://localhost:3000/quiz/<id>`) and send it to attendees!

### 5. Take Quiz & View Analytics
- Open the quiz URL in an incognito or separate window.
- Enter your name and take the quiz.
- Submit to view the celebratory results and breakdown.
- Switch back to the admin dashboard and click the quiz card to see the updated attendee marks in the Analytics table!
