import { Injectable, computed, effect, signal } from '@angular/core';
import {
  ActiveSession,
  AppData,
  CategoryInput,
  SessionAttemptResult,
  Statement,
  StatementInput,
} from '../models/mind-programming.models';
import {
  STORAGE_KEY,
  buildDashboardStats,
  clampRepetitions,
  createInitialData,
  evaluateStatementAttempt,
  getDueOccurrences,
  getUpcomingOccurrences,
  normalizeSettings,
  parseImportedAppData,
  recordCompletedSession,
  sanitizeDays,
  sanitizeTimes,
} from './mind-programming.logic';

function isActiveSessionRecord(value: unknown): value is ActiveSession {
  const candidate = value as Record<string, unknown> | null;

  return Boolean(
    candidate &&
    typeof candidate === 'object' &&
    typeof candidate['statementId'] === 'string' &&
    (candidate['mode'] === 'manual' || candidate['mode'] === 'scheduled') &&
    typeof candidate['targetRepetitions'] === 'number' &&
    typeof candidate['completedRepetitions'] === 'number' &&
    typeof candidate['startedAt'] === 'string' &&
    typeof candidate['currentEntry'] === 'string' &&
    (candidate['scheduleKey'] === undefined || typeof candidate['scheduleKey'] === 'string'),
  );
}

function loadStoredState(): AppData {
  const fallback = createInitialData();

  if (typeof localStorage === 'undefined') {
    return fallback;
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw) as Record<string, unknown> | null;
    const activeSession = parsed?.['activeSession'];
    const result = parseImportedAppData(parsed);

    if (!result.success || !result.data) {
      return fallback;
    }

    return {
      ...result.data,
      activeSession: isActiveSessionRecord(activeSession) ? activeSession : null,
      settings: normalizeSettings(result.data.settings),
    };
  } catch {
    return fallback;
  }
}

@Injectable({ providedIn: 'root' })
export class MindProgrammingStore {
  private readonly state = signal<AppData>(loadStoredState());
  private readonly now = signal(new Date());

  readonly categories = computed(() =>
    [...this.state().categories].sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt),
    ),
  );

  readonly categoryMap = computed(
    () => new Map(this.categories().map((category) => [category.id, category])),
  );

  readonly statements = computed(() =>
    [...this.state().statements].sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt),
    ),
  );

  readonly statementMap = computed(
    () => new Map(this.state().statements.map((statement) => [statement.id, statement])),
  );
  readonly activeSession = computed(() => this.state().activeSession);
  readonly settings = computed(() => this.state().settings);

  readonly dueOccurrences = computed(() =>
    getDueOccurrences(
      this.state().statements,
      this.state().settings.completedScheduleKeys,
      this.now(),
    ),
  );

  readonly upcomingOccurrences = computed(() =>
    getUpcomingOccurrences(this.state().statements, this.now()),
  );

  readonly stats = computed(() =>
    buildDashboardStats(
      this.state().statements,
      this.dueOccurrences().length,
      this.state().settings,
      this.now(),
    ),
  );

  constructor() {
    effect(() => {
      const state = this.state();

      if (typeof localStorage === 'undefined') {
        return;
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    });
  }

  tick(): void {
    const now = new Date();
    this.now.set(now);
    this.state.update((state) => ({
      ...state,
      settings: normalizeSettings(state.settings, now),
    }));
  }

  addCategory(input: CategoryInput): void {
    const now = new Date().toISOString();
    const name = input.name.trim();

    if (!name) {
      return;
    }

    this.state.update((state) => ({
      ...state,
      categories: [
        ...state.categories,
        {
          id: crypto.randomUUID(),
          name,
          description: input.description.trim(),
          createdAt: now,
        },
      ],
    }));
  }

  deleteCategory(categoryId: string): void {
    const removedStatementIds = new Set(
      this.state()
        .statements.filter((statement) => statement.categoryId === categoryId)
        .map((statement) => statement.id),
    );

    this.state.update((state) => ({
      ...state,
      categories: state.categories.filter((category) => category.id !== categoryId),
      statements: state.statements.filter((statement) => statement.categoryId !== categoryId),
      activeSession:
        state.activeSession && removedStatementIds.has(state.activeSession.statementId)
          ? null
          : state.activeSession,
    }));

    this.tick();
  }

  saveStatement(input: StatementInput): void {
    const now = new Date().toISOString();
    const title = input.title.trim();
    const text = input.text.trim();

    if (!title || !text) {
      return;
    }

    const payload: Statement = {
      id: input.id ?? crypto.randomUUID(),
      categoryId: input.categoryId,
      title,
      text,
      defaultRepetitions: clampRepetitions(input.defaultRepetitions),
      schedule: {
        enabled: input.schedule.enabled,
        days: sanitizeDays(input.schedule.days),
        times: sanitizeTimes(input.schedule.times),
      },
      createdAt: now,
      updatedAt: now,
    };

    this.state.update((state) => {
      const existing = state.statements.find((statement) => statement.id === payload.id);

      if (!existing) {
        return {
          ...state,
          statements: [...state.statements, payload],
        };
      }

      return {
        ...state,
        statements: state.statements.map((statement) =>
          statement.id === payload.id
            ? {
                ...existing,
                ...payload,
                createdAt: existing.createdAt,
              }
            : statement,
        ),
      };
    });

    this.tick();
  }

  deleteStatement(statementId: string): void {
    this.state.update((state) => ({
      ...state,
      statements: state.statements.filter((statement) => statement.id !== statementId),
      activeSession: state.activeSession?.statementId === statementId ? null : state.activeSession,
    }));

    this.tick();
  }

  setNotificationsEnabled(enabled: boolean): void {
    this.state.update((state) => ({
      ...state,
      settings: {
        ...state.settings,
        notificationsEnabled: enabled,
      },
    }));
  }

  exportData(): {
    app: 'resonant-binturong';
    version: 1;
    exportedAt: string;
    data: AppData;
  } {
    return {
      app: 'resonant-binturong',
      version: 1,
      exportedAt: new Date().toISOString(),
      data: {
        ...this.state(),
        activeSession: null,
      },
    };
  }

  importData(raw: unknown): { success: boolean; error?: string } {
    const result = parseImportedAppData(raw);

    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error ?? 'Import failed.',
      };
    }

    this.state.set(result.data);
    this.tick();

    return { success: true };
  }

  startSession(statementId: string, repetitionOverride?: number, scheduleKey?: string): void {
    const statement = this.statementMap().get(statementId);

    if (!statement) {
      return;
    }

    const dueScheduleKey =
      scheduleKey ??
      this.dueOccurrences().find((occurrence) => occurrence.statementId === statementId)?.key;

    this.state.update((state) => ({
      ...state,
      activeSession: {
        statementId,
        scheduleKey: dueScheduleKey,
        mode: dueScheduleKey ? 'scheduled' : 'manual',
        targetRepetitions: clampRepetitions(repetitionOverride ?? statement.defaultRepetitions),
        completedRepetitions: 0,
        startedAt: new Date().toISOString(),
        currentEntry: '',
      },
    }));
  }

  updateActiveSessionEntry(entry: string): void {
    this.state.update((state) => {
      if (!state.activeSession) {
        return state;
      }

      return {
        ...state,
        activeSession: {
          ...state.activeSession,
          currentEntry: entry,
        },
      };
    });
  }

  restartActiveSession(): void {
    this.state.update((state) => {
      if (!state.activeSession) {
        return state;
      }

      return {
        ...state,
        activeSession: {
          ...state.activeSession,
          completedRepetitions: 0,
          currentEntry: '',
          startedAt: new Date().toISOString(),
        },
      };
    });
  }

  dismissActiveSession(): void {
    this.state.update((state) => ({
      ...state,
      activeSession: null,
    }));
  }

  submitActiveSessionEntry(): SessionAttemptResult {
    const activeSession = this.state().activeSession;

    if (!activeSession) {
      return {
        accepted: false,
        completed: false,
        remaining: 0,
        error: 'No active session is open right now.',
      };
    }

    const statement = this.statementMap().get(activeSession.statementId);

    if (!statement) {
      return {
        accepted: false,
        completed: false,
        remaining: 0,
        error: 'That statement could not be found anymore.',
      };
    }

    const evaluation = evaluateStatementAttempt(statement.text, activeSession.currentEntry);

    if (!evaluation.accepted) {
      return {
        accepted: false,
        completed: false,
        remaining: activeSession.targetRepetitions - activeSession.completedRepetitions,
        error: 'Small typos are okay, but this entry was still too different from the statement.',
      };
    }

    const nextCompleted = activeSession.completedRepetitions + 1;

    if (nextCompleted >= activeSession.targetRepetitions) {
      const finishedAt = new Date();
      this.state.update((state) => ({
        ...state,
        settings: recordCompletedSession(
          state.settings,
          activeSession.targetRepetitions,
          finishedAt,
          activeSession.scheduleKey,
        ),
        activeSession: null,
      }));
      this.tick();

      return {
        accepted: true,
        completed: true,
        remaining: 0,
        completedTitle: statement.title,
      };
    }

    this.state.update((state) => ({
      ...state,
      activeSession: state.activeSession
        ? {
            ...state.activeSession,
            completedRepetitions: nextCompleted,
            currentEntry: '',
          }
        : null,
    }));

    return {
      accepted: true,
      completed: false,
      remaining: activeSession.targetRepetitions - nextCompleted,
    };
  }
}
