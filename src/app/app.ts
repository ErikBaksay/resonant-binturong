import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DueOccurrence, Statement } from './models/mind-programming.models';
import {
  DEFAULT_REPETITIONS,
  DEFAULT_SCHEDULE_DAYS,
  DEFAULT_SCHEDULE_TIMES,
  SHORT_DAY_LABELS,
  clampRepetitions,
  describeSchedule,
  evaluateStatementAttempt,
  formatTimeLabel,
} from './services/mind-programming.logic';
import { ReminderEngineService } from './services/reminder-engine.service';
import { MindProgrammingStore } from './services/mind-programming.store';

interface CategoryFormModel {
  name: string;
  description: string;
}

interface StatementFormModel {
  id: string | null;
  categoryId: string;
  title: string;
  text: string;
  defaultRepetitions: number;
  scheduleEnabled: boolean;
  scheduleDays: number[];
  scheduleTimes: string[];
}

interface PrivatePracticeDraft {
  text: string;
  repetitions: number;
}

interface PrivateSessionState {
  text: string;
  targetRepetitions: number;
  completedRepetitions: number;
  currentEntry: string;
}

@Component({
  selector: 'app-root',
  imports: [FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly store = inject(MindProgrammingStore);
  private readonly reminderEngine = inject(ReminderEngineService);
  private readonly autoSubmitDelayMs = 700;
  private activeAutoSubmitTimeout: ReturnType<typeof window.setTimeout> | null = null;
  private privateAutoSubmitTimeout: ReturnType<typeof window.setTimeout> | null = null;

  protected readonly activeView = signal<'library' | 'manage' | 'stats'>('library');
  protected readonly selectedCategoryId = signal('all');
  protected readonly customSessionCounts = signal<Record<string, number>>({});
  protected readonly sessionFeedback = signal<string | null>(null);
  protected readonly privatePracticeOpen = signal(false);
  protected readonly privateSession = signal<PrivateSessionState | null>(null);
  protected readonly privateSessionFeedback = signal<string | null>(null);
  protected readonly completionBanner = signal<string | null>(null);

  protected categoryForm: CategoryFormModel = this.createCategoryForm();
  protected statementForm: StatementFormModel = this.createStatementForm();
  protected privatePracticeDraft: PrivatePracticeDraft = this.createPrivatePracticeDraft();

  protected readonly dayOptions = SHORT_DAY_LABELS.map((label, value) => ({ value, label }));

  protected readonly dueByStatement = computed(() => {
    const counts = new Map<string, number>();

    for (const occurrence of this.store.dueOccurrences()) {
      counts.set(occurrence.statementId, (counts.get(occurrence.statementId) ?? 0) + 1);
    }

    return counts;
  });

  protected readonly filteredStatements = computed(() => {
    const selectedCategoryId = this.selectedCategoryId();
    const dueMap = this.dueByStatement();

    return this.store
      .statements()
      .filter(
        (statement) => selectedCategoryId === 'all' || statement.categoryId === selectedCategoryId,
      )
      .sort((left, right) => {
        const dueDelta = (dueMap.get(right.id) ?? 0) - (dueMap.get(left.id) ?? 0);

        if (dueDelta !== 0) {
          return dueDelta;
        }

        return right.updatedAt.localeCompare(left.updatedAt);
      });
  });

  protected readonly blockingReminder = computed(() =>
    this.store.activeSession() || this.privatePracticeOpen() || this.privateSession()
      ? null
      : (this.store.dueOccurrences()[0] ?? null),
  );

  protected readonly activeStatement = computed(() => {
    const activeSession = this.store.activeSession();
    return activeSession
      ? (this.store.statementMap().get(activeSession.statementId) ?? null)
      : null;
  });

  protected readonly selectedCategory = computed(() => {
    const selectedCategoryId = this.selectedCategoryId();
    return selectedCategoryId === 'all'
      ? null
      : (this.store.categoryMap().get(selectedCategoryId) ?? null);
  });

  constructor() {
    void this.reminderEngine;

    effect(() => {
      const categories = this.store.categories();

      if (!categories.length) {
        return;
      }

      if (!categories.some((category) => category.id === this.statementForm.categoryId)) {
        this.statementForm = {
          ...this.statementForm,
          categoryId: categories[0].id,
        };
      }

      if (
        this.selectedCategoryId() !== 'all' &&
        !categories.some((category) => category.id === this.selectedCategoryId())
      ) {
        this.selectedCategoryId.set('all');
      }
    });

    effect(() => {
      if (!this.store.activeSession()) {
        this.clearActiveAutoSubmitTimeout();
      }
    });

    effect(() => {
      if (!this.privateSession()) {
        this.clearPrivateAutoSubmitTimeout();
      }
    });
  }

  protected get isEditingStatement(): boolean {
    return Boolean(this.statementForm.id);
  }

  protected get notificationStatus(): NotificationPermission | 'unsupported' {
    if (typeof Notification === 'undefined') {
      return 'unsupported';
    }

    return Notification.permission;
  }

  protected get notificationCopy(): string {
    if (this.notificationStatus === 'unsupported') {
      return 'Notifications are not available in this browser. Reminders still appear inside the app.';
    }

    if (this.notificationStatus === 'granted' && this.store.settings().notificationsEnabled) {
      return 'Notifications are enabled while the app is open or installed.';
    }

    if (this.notificationStatus === 'denied') {
      return 'Notifications are blocked in the browser. The in-app reminder overlay still works.';
    }

    return 'Enable notifications if you want an extra reminder outside the visible app screen.';
  }

  protected get selectedCategoryLabel(): string {
    return this.selectedCategory()?.name ?? 'All categories';
  }

  protected createCategoryForm(): CategoryFormModel {
    return {
      name: '',
      description: '',
    };
  }

  protected createStatementForm(): StatementFormModel {
    return {
      id: null,
      categoryId: this.store.categories()[0]?.id ?? '',
      title: '',
      text: '',
      defaultRepetitions: DEFAULT_REPETITIONS,
      scheduleEnabled: false,
      scheduleDays: [...DEFAULT_SCHEDULE_DAYS],
      scheduleTimes: [...DEFAULT_SCHEDULE_TIMES],
    };
  }

  protected createPrivatePracticeDraft(): PrivatePracticeDraft {
    return {
      text: '',
      repetitions: DEFAULT_REPETITIONS,
    };
  }

  protected openManage(): void {
    this.activeView.set('manage');
  }

  protected openLibrary(): void {
    this.activeView.set('library');
  }

  protected openStats(): void {
    this.activeView.set('stats');
  }

  protected openPrivatePractice(): void {
    this.privateSessionFeedback.set(null);
    this.privatePracticeDraft = this.createPrivatePracticeDraft();
    this.privatePracticeOpen.set(true);
  }

  protected closePrivatePractice(): void {
    this.privateSessionFeedback.set(null);
    this.privatePracticeDraft = this.createPrivatePracticeDraft();
    this.privatePracticeOpen.set(false);
  }

  protected startPrivatePractice(): void {
    const text = this.privatePracticeDraft.text.trim();

    if (!text) {
      return;
    }

    this.privateSessionFeedback.set(null);
    this.privatePracticeOpen.set(false);
    this.privateSession.set({
      text,
      targetRepetitions: clampRepetitions(this.privatePracticeDraft.repetitions),
      completedRepetitions: 0,
      currentEntry: '',
    });
  }

  protected addCategory(): void {
    this.store.addCategory(this.categoryForm);
    this.categoryForm = this.createCategoryForm();
  }

  protected deleteCategory(categoryId: string, categoryName: string): void {
    const confirmed = window.confirm(
      `Delete "${categoryName}" and all of its saved statements? Completed history will stay.`,
    );

    if (!confirmed) {
      return;
    }

    this.store.deleteCategory(categoryId);

    if (this.statementForm.categoryId === categoryId) {
      this.statementForm = this.createStatementForm();
    }
  }

  protected saveStatement(): void {
    this.store.saveStatement({
      id: this.statementForm.id,
      categoryId: this.statementForm.categoryId,
      title: this.statementForm.title,
      text: this.statementForm.text,
      defaultRepetitions: this.statementForm.defaultRepetitions,
      schedule: {
        enabled: this.statementForm.scheduleEnabled,
        days: this.statementForm.scheduleDays,
        times: this.statementForm.scheduleTimes,
      },
    });

    this.statementForm = this.createStatementForm();
  }

  protected editStatement(statement: Statement): void {
    this.activeView.set('manage');
    this.statementForm = {
      id: statement.id,
      categoryId: statement.categoryId,
      title: statement.title,
      text: statement.text,
      defaultRepetitions: statement.defaultRepetitions,
      scheduleEnabled: statement.schedule.enabled,
      scheduleDays: [...statement.schedule.days],
      scheduleTimes: statement.schedule.times.length
        ? [...statement.schedule.times]
        : [...DEFAULT_SCHEDULE_TIMES],
    };
  }

  protected cancelStatementEdit(): void {
    this.statementForm = this.createStatementForm();
  }

  protected addScheduleTime(): void {
    this.statementForm = {
      ...this.statementForm,
      scheduleTimes: [...this.statementForm.scheduleTimes, '20:00'],
    };
  }

  protected removeScheduleTime(index: number): void {
    if (this.statementForm.scheduleTimes.length === 1) {
      this.statementForm = {
        ...this.statementForm,
        scheduleTimes: ['20:00'],
      };
      return;
    }

    this.statementForm = {
      ...this.statementForm,
      scheduleTimes: this.statementForm.scheduleTimes.filter(
        (_, candidateIndex) => candidateIndex !== index,
      ),
    };
  }

  protected updateScheduleTime(index: number, value: string): void {
    this.statementForm = {
      ...this.statementForm,
      scheduleTimes: this.statementForm.scheduleTimes.map((time, candidateIndex) =>
        candidateIndex === index ? value : time,
      ),
    };
  }

  protected toggleScheduleDay(day: number, checked: boolean): void {
    const days = new Set(this.statementForm.scheduleDays);

    if (checked) {
      days.add(day);
    } else {
      days.delete(day);
    }

    this.statementForm = {
      ...this.statementForm,
      scheduleDays: [...days].sort((left, right) => left - right),
    };
  }

  protected setScheduleEnabled(enabled: boolean): void {
    this.statementForm = {
      ...this.statementForm,
      scheduleEnabled: enabled,
    };
  }

  protected updateCustomCount(statementId: string, value: string): void {
    const parsed = Number(value);

    this.customSessionCounts.update((counts) => ({
      ...counts,
      [statementId]: clampRepetitions(parsed || DEFAULT_REPETITIONS),
    }));
  }

  protected getCustomCount(statement: Statement): number {
    return this.customSessionCounts()[statement.id] ?? statement.defaultRepetitions;
  }

  protected startStatement(statement: Statement): void {
    this.clearActiveAutoSubmitTimeout();
    this.sessionFeedback.set(null);
    this.completionBanner.set(null);
    this.store.startSession(statement.id, this.getCustomCount(statement));
  }

  protected startCustomStatement(statement: Statement): void {
    const response = window.prompt(
      'How many repetitions do you want for this session?',
      `${this.getCustomCount(statement)}`,
    );

    if (response === null || !response.trim()) {
      return;
    }

    const parsed = Number(response);

    if (Number.isNaN(parsed)) {
      return;
    }

    const count = clampRepetitions(parsed);

    this.customSessionCounts.update((counts) => ({
      ...counts,
      [statement.id]: count,
    }));

    this.clearActiveAutoSubmitTimeout();
    this.sessionFeedback.set(null);
    this.completionBanner.set(null);
    this.store.startSession(statement.id, count);
  }

  protected startScheduledStatement(reminder: DueOccurrence): void {
    this.clearActiveAutoSubmitTimeout();
    this.sessionFeedback.set(null);
    this.completionBanner.set(null);
    this.store.startSession(reminder.statementId, reminder.defaultRepetitions, reminder.key);
  }

  protected updateActiveEntry(value: string): void {
    this.sessionFeedback.set(null);
    this.store.updateActiveSessionEntry(value);
    this.scheduleActiveAutoSubmit();
  }

  protected submitActiveEntry(): void {
    this.clearActiveAutoSubmitTimeout();
    const result = this.store.submitActiveSessionEntry();

    if (!result.accepted) {
      this.sessionFeedback.set(result.error ?? 'That repetition did not match.');
      return;
    }

    if (result.completed) {
      this.sessionFeedback.set(null);
      this.completionBanner.set(`${result.completedTitle ?? 'Session'} completed.`);
      return;
    }

    this.sessionFeedback.set(`${result.remaining} repetitions left.`);
  }

  protected restartSession(): void {
    this.clearActiveAutoSubmitTimeout();
    this.sessionFeedback.set('Progress restarted.');
    this.store.restartActiveSession();
  }

  protected dismissActiveSession(): void {
    this.clearActiveAutoSubmitTimeout();
    this.sessionFeedback.set(null);
    this.store.dismissActiveSession();
  }

  protected updatePrivateEntry(value: string): void {
    this.privateSessionFeedback.set(null);
    this.privateSession.update((session) =>
      session
        ? {
            ...session,
            currentEntry: value,
          }
        : null,
    );
    this.schedulePrivateAutoSubmit();
  }

  protected submitPrivateEntry(): void {
    this.clearPrivateAutoSubmitTimeout();
    const session = this.privateSession();

    if (!session) {
      return;
    }

    const evaluation = evaluateStatementAttempt(session.text, session.currentEntry);

    if (!evaluation.accepted) {
      this.privateSessionFeedback.set(
        'Small typos are okay, but this entry was still too different from the statement.',
      );
      return;
    }

    const nextCompleted = session.completedRepetitions + 1;

    if (nextCompleted >= session.targetRepetitions) {
      this.privateSession.set(null);
      this.privatePracticeDraft = this.createPrivatePracticeDraft();
      this.privateSessionFeedback.set(null);
      this.completionBanner.set('Private session completed. Nothing was saved.');
      return;
    }

    this.privateSession.set({
      ...session,
      completedRepetitions: nextCompleted,
      currentEntry: '',
    });
    this.privateSessionFeedback.set(
      `${session.targetRepetitions - nextCompleted} repetitions left.`,
    );
  }

  protected discardPrivateSession(): void {
    this.clearPrivateAutoSubmitTimeout();
    this.privateSession.set(null);
    this.privatePracticeDraft = this.createPrivatePracticeDraft();
    this.privateSessionFeedback.set(null);
  }

  protected deleteStatement(statement: Statement): void {
    if (!window.confirm(`Delete "${statement.title}" from your library?`)) {
      return;
    }

    this.store.deleteStatement(statement.id);

    if (this.statementForm.id === statement.id) {
      this.statementForm = this.createStatementForm();
    }
  }

  protected async enableNotifications(): Promise<void> {
    if (typeof Notification === 'undefined') {
      return;
    }

    const permission = await Notification.requestPermission();
    this.store.setNotificationsEnabled(permission === 'granted');
  }

  protected exportData(): void {
    const payload = this.store.exportData();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const downloadLink = document.createElement('a');

    downloadLink.href = url;
    downloadLink.download = `resonant-binturong-backup-${new Date().toISOString().slice(0, 10)}.json`;
    downloadLink.click();
    URL.revokeObjectURL(url);

    this.completionBanner.set('Data exported.');
  }

  protected async importDataFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];

    if (!file) {
      return;
    }

    try {
      const raw = JSON.parse(await file.text()) as unknown;
      const result = this.store.importData(raw);

      if (!result.success) {
        window.alert(result.error ?? 'Import failed.');
        return;
      }

      this.clearActiveAutoSubmitTimeout();
      this.clearPrivateAutoSubmitTimeout();
      this.selectedCategoryId.set('all');
      this.categoryForm = this.createCategoryForm();
      this.statementForm = this.createStatementForm();
      this.completionBanner.set('Data imported.');
    } catch {
      window.alert('The selected file could not be read as valid JSON.');
    } finally {
      if (input) {
        input.value = '';
      }
    }
  }

  protected formatSchedule(statement: Statement): string {
    return describeSchedule(statement.schedule);
  }

  protected formatRelativeReminder(reminder: DueOccurrence): string {
    if (reminder.overdueMinutes < 1) {
      return 'Due now';
    }

    if (reminder.overdueMinutes < 60) {
      return `${reminder.overdueMinutes} min overdue`;
    }

    const hours = Math.floor(reminder.overdueMinutes / 60);
    const minutes = reminder.overdueMinutes % 60;
    return `${hours}h ${minutes}m overdue`;
  }

  protected formatCompletedDate(value: string | null): string {
    if (!value) {
      return 'Never';
    }

    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(`${value}T00:00:00`));
  }

  protected categoryName(statement: Statement): string {
    return this.store.categoryMap().get(statement.categoryId)?.name ?? 'Unknown category';
  }

  protected statementSummary(statement: Statement): string {
    const parts = [`${statement.defaultRepetitions} reps`];

    if (statement.schedule.enabled) {
      parts.push(describeSchedule(statement.schedule));
    }

    return parts.join(' · ');
  }

  protected timeLabel(time: string): string {
    return formatTimeLabel(time);
  }

  private clearActiveAutoSubmitTimeout(): void {
    if (this.activeAutoSubmitTimeout === null) {
      return;
    }

    window.clearTimeout(this.activeAutoSubmitTimeout);
    this.activeAutoSubmitTimeout = null;
  }

  private clearPrivateAutoSubmitTimeout(): void {
    if (this.privateAutoSubmitTimeout === null) {
      return;
    }

    window.clearTimeout(this.privateAutoSubmitTimeout);
    this.privateAutoSubmitTimeout = null;
  }

  private scheduleActiveAutoSubmit(): void {
    this.clearActiveAutoSubmitTimeout();

    const activeSession = this.store.activeSession();
    const statement = this.activeStatement();

    if (!activeSession || !statement || !activeSession.currentEntry.trim()) {
      return;
    }

    this.activeAutoSubmitTimeout = window.setTimeout(() => {
      this.activeAutoSubmitTimeout = null;

      const currentSession = this.store.activeSession();
      const currentStatement = this.activeStatement();

      if (!currentSession || !currentStatement) {
        return;
      }

      const evaluation = evaluateStatementAttempt(
        currentStatement.text,
        currentSession.currentEntry,
      );

      if (evaluation.accepted) {
        this.submitActiveEntry();
      }
    }, this.autoSubmitDelayMs);
  }

  private schedulePrivateAutoSubmit(): void {
    this.clearPrivateAutoSubmitTimeout();

    const session = this.privateSession();

    if (!session || !session.currentEntry.trim()) {
      return;
    }

    this.privateAutoSubmitTimeout = window.setTimeout(() => {
      this.privateAutoSubmitTimeout = null;

      const currentSession = this.privateSession();

      if (!currentSession) {
        return;
      }

      const evaluation = evaluateStatementAttempt(currentSession.text, currentSession.currentEntry);

      if (evaluation.accepted) {
        this.submitPrivateEntry();
      }
    }, this.autoSubmitDelayMs);
  }
}
