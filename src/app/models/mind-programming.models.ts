export type SessionMode = 'manual' | 'scheduled';

export interface Category {
  id: string;
  name: string;
  description: string;
  createdAt: string;
}

export interface StatementSchedule {
  enabled: boolean;
  days: number[];
  times: string[];
}

export interface Statement {
  id: string;
  categoryId: string;
  title: string;
  text: string;
  defaultRepetitions: number;
  schedule: StatementSchedule;
  createdAt: string;
  updatedAt: string;
}

export interface ActiveSession {
  statementId: string;
  scheduleKey?: string;
  mode: SessionMode;
  targetRepetitions: number;
  completedRepetitions: number;
  startedAt: string;
  currentEntry: string;
}

export interface SessionRecord {
  id: string;
  statementId: string;
  statementTitle: string;
  categoryId: string;
  mode: SessionMode;
  repetitions: number;
  startedAt: string;
  completedAt: string;
  durationSeconds: number;
  matchedScheduleKey?: string;
}

export interface AppSettings {
  notificationsEnabled: boolean;
  completedSessions: number;
  repetitionsWritten: number;
  currentStreak: number;
  lastCompletedOn: string | null;
  completedScheduleKeys: string[];
}

export interface AppData {
  categories: Category[];
  statements: Statement[];
  activeSession: ActiveSession | null;
  settings: AppSettings;
}

export interface CategoryInput {
  name: string;
  description: string;
}

export interface StatementInput {
  id?: string | null;
  categoryId: string;
  title: string;
  text: string;
  defaultRepetitions: number;
  schedule: StatementSchedule;
}

export interface DueOccurrence {
  key: string;
  statementId: string;
  categoryId: string;
  title: string;
  text: string;
  dueAt: string;
  time: string;
  label: string;
  defaultRepetitions: number;
  overdueMinutes: number;
}

export interface UpcomingOccurrence {
  key: string;
  statementId: string;
  title: string;
  dueAt: string;
  label: string;
  time: string;
}

export interface DashboardStats {
  completedSessions: number;
  statementCount: number;
  dueNowCount: number;
  repetitionsWritten: number;
  currentStreak: number;
  lastCompletedOn: string | null;
}

export interface SessionAttemptResult {
  accepted: boolean;
  completed: boolean;
  remaining: number;
  error?: string;
  completedTitle?: string;
}
