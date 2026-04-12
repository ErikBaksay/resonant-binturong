import {
  AppData,
  AppSettings,
  DashboardStats,
  DueOccurrence,
  SessionRecord,
  Statement,
  StatementSchedule,
  UpcomingOccurrence,
} from '../models/mind-programming.models';

export interface StatementAttemptEvaluation {
  accepted: boolean;
  distance: number;
  allowedDistance: number;
}

export interface ImportResult {
  success: boolean;
  data?: AppData;
  error?: string;
}

export const STORAGE_KEY = 'resonant-binturong.mind-programming.v1';
export const DEFAULT_REPETITIONS = 12;
export const DEFAULT_SCHEDULE_DAYS = [1, 2, 3, 4, 5];
export const DEFAULT_SCHEDULE_TIMES = ['07:30'];
export const SHORT_DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function createInitialData(): AppData {
  const now = new Date().toISOString();

  return {
    categories: [
      {
        id: crypto.randomUUID(),
        name: 'Core Practice',
        description: 'A grounded place for the statements you want to keep close.',
        createdAt: now,
      },
    ],
    statements: [],
    activeSession: null,
    settings: {
      notificationsEnabled: false,
      completedSessions: 0,
      repetitionsWritten: 0,
      currentStreak: 0,
      lastCompletedOn: null,
      completedScheduleKeys: [],
    },
  };
}

export function clampRepetitions(value: number): number {
  if (Number.isNaN(value)) {
    return DEFAULT_REPETITIONS;
  }

  return Math.min(108, Math.max(1, Math.round(value)));
}

export function normalizeText(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getMeaningfulLength(value: string): number {
  return value.replace(/\s+/g, '').length;
}

function getAllowedTypoDistance(normalizedExpected: string): number {
  const meaningfulLength = getMeaningfulLength(normalizedExpected);

  if (meaningfulLength <= 8) {
    return 0;
  }

  return Math.min(6, Math.max(1, Math.round(meaningfulLength / 20)));
}

function levenshteinDistance(left: string, right: string): number {
  if (left === right) {
    return 0;
  }

  if (!left.length) {
    return right.length;
  }

  if (!right.length) {
    return left.length;
  }

  const previousRow = Array.from({ length: right.length + 1 }, (_, index) => index);
  const currentRow = new Array<number>(right.length + 1);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    currentRow[0] = leftIndex;

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;

      currentRow[rightIndex] = Math.min(
        currentRow[rightIndex - 1] + 1,
        previousRow[rightIndex] + 1,
        previousRow[rightIndex - 1] + substitutionCost,
      );
    }

    for (let rightIndex = 0; rightIndex < previousRow.length; rightIndex += 1) {
      previousRow[rightIndex] = currentRow[rightIndex];
    }
  }

  return previousRow[right.length];
}

export function evaluateStatementAttempt(
  expected: string,
  attempt: string,
): StatementAttemptEvaluation {
  const normalizedExpected = normalizeText(expected);
  const normalizedAttempt = normalizeText(attempt);
  const allowedDistance = getAllowedTypoDistance(normalizedExpected);
  const distance = levenshteinDistance(normalizedExpected, normalizedAttempt);

  return {
    accepted: distance <= allowedDistance,
    distance,
    allowedDistance,
  };
}

export function sanitizeDays(days: number[]): number[] {
  return [...new Set(days.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))].sort(
    (left, right) => left - right,
  );
}

export function sanitizeTimes(times: string[]): string[] {
  return [
    ...new Set(times.map((time) => time.trim()).filter((time) => /^\d{2}:\d{2}$/.test(time))),
  ].sort();
}

export function toLocalDateKey(value: Date): string {
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');

  return `${value.getFullYear()}-${month}-${day}`;
}

export function getRelativeDateKey(baseDate: Date, dayOffset: number): string {
  const target = new Date(baseDate);
  target.setDate(target.getDate() + dayOffset);
  return toLocalDateKey(target);
}

export function createOccurrenceKey(statementId: string, dateKey: string, time: string): string {
  return `${statementId}::${dateKey}::${time}`;
}

export function buildOccurrenceDate(baseDate: Date, time: string): Date {
  const [hours, minutes] = time.split(':').map(Number);
  const occurrence = new Date(baseDate);
  occurrence.setHours(hours, minutes, 0, 0);
  return occurrence;
}

export function normalizeSettings(
  settings: Partial<AppSettings> | null | undefined,
  now = new Date(),
): AppSettings {
  const todayKey = toLocalDateKey(now);
  const lastCompletedOn =
    typeof settings?.lastCompletedOn === 'string' && settings.lastCompletedOn
      ? settings.lastCompletedOn
      : null;
  const currentStreak = Math.max(0, Math.floor(settings?.currentStreak ?? 0));

  return {
    notificationsEnabled: Boolean(settings?.notificationsEnabled),
    completedSessions: Math.max(0, Math.floor(settings?.completedSessions ?? 0)),
    repetitionsWritten: Math.max(0, Math.floor(settings?.repetitionsWritten ?? 0)),
    currentStreak: isStreakActive(lastCompletedOn, now) ? currentStreak : 0,
    lastCompletedOn,
    completedScheduleKeys: [
      ...new Set(
        Array.isArray(settings?.completedScheduleKeys)
          ? settings.completedScheduleKeys.filter(
              (key): key is string => typeof key === 'string' && key.split('::')[1] === todayKey,
            )
          : [],
      ),
    ],
  };
}

function isStreakActive(lastCompletedOn: string | null, now: Date): boolean {
  if (!lastCompletedOn) {
    return false;
  }

  const todayKey = toLocalDateKey(now);
  const yesterdayKey = getRelativeDateKey(now, -1);

  return lastCompletedOn === todayKey || lastCompletedOn === yesterdayKey;
}

export function updateLastCompletedOn(settings: AppSettings, completedAt: Date): AppSettings {
  const completedOn = toLocalDateKey(completedAt);
  const previousDayKey = getRelativeDateKey(completedAt, -1);
  const completedScheduleKeys = settings.completedScheduleKeys.filter(
    (key) => key.split('::')[1] === completedOn,
  );
  let currentStreak = 1;

  if (settings.lastCompletedOn === completedOn) {
    currentStreak = Math.max(1, settings.currentStreak);
  } else if (settings.lastCompletedOn === previousDayKey) {
    currentStreak = Math.max(1, settings.currentStreak) + 1;
  }

  return {
    ...settings,
    completedSessions: settings.completedSessions + 1,
    repetitionsWritten: settings.repetitionsWritten,
    currentStreak,
    lastCompletedOn: completedOn,
    completedScheduleKeys,
  };
}

export function recordCompletedSession(
  settings: AppSettings,
  repetitions: number,
  completedAt: Date,
  scheduleKey?: string,
): AppSettings {
  const updatedSettings = updateLastCompletedOn(settings, completedAt);

  return {
    ...updatedSettings,
    repetitionsWritten: updatedSettings.repetitionsWritten + repetitions,
    completedScheduleKeys: scheduleKey
      ? [...new Set([...updatedSettings.completedScheduleKeys, scheduleKey])]
      : updatedSettings.completedScheduleKeys,
  };
}

function getCurrentStreakFromSessions(
  sessions: SessionRecord[],
  lastCompletedOn: string | null,
  now: Date,
): number {
  if (!isStreakActive(lastCompletedOn, now)) {
    return 0;
  }

  const completionDays = new Set(
    sessions.map((session) => toLocalDateKey(new Date(session.completedAt))),
  );

  if (!lastCompletedOn || !completionDays.has(lastCompletedOn)) {
    return 0;
  }

  const lastCompletedDate = new Date(`${lastCompletedOn}T12:00:00`);
  let streak = 0;
  let offset = 0;

  while (true) {
    const dayKey = getRelativeDateKey(lastCompletedDate, -offset);

    if (!completionDays.has(dayKey)) {
      break;
    }

    streak += 1;
    offset += 1;
  }

  return streak;
}

function migrateLegacySettings(
  settings: AppSettings,
  legacySessions: SessionRecord[],
  now: Date,
): AppSettings {
  if (!legacySessions.length) {
    return normalizeSettings(settings, now);
  }

  const repetitionsWritten = legacySessions.reduce(
    (total, session) => total + session.repetitions,
    0,
  );
  const sortedCompletions = [...legacySessions].sort((left, right) =>
    right.completedAt.localeCompare(left.completedAt),
  );
  const latestCompletedOn =
    settings.lastCompletedOn ?? toLocalDateKey(new Date(sortedCompletions[0].completedAt));
  const completedScheduleKeys = legacySessions
    .map((session) => session.matchedScheduleKey)
    .filter((key): key is string => Boolean(key))
    .filter((key) => key.split('::')[1] === toLocalDateKey(now));

  return normalizeSettings(
    {
      ...settings,
      completedSessions: Math.max(settings.completedSessions, legacySessions.length),
      repetitionsWritten: Math.max(settings.repetitionsWritten, repetitionsWritten),
      currentStreak: Math.max(
        settings.currentStreak,
        getCurrentStreakFromSessions(legacySessions, latestCompletedOn, now),
      ),
      lastCompletedOn: latestCompletedOn,
      completedScheduleKeys: [...settings.completedScheduleKeys, ...completedScheduleKeys],
    },
    now,
  );
}

function isCategoryRecord(value: unknown): boolean {
  const candidate = value as Record<string, unknown>;

  return Boolean(
    value &&
    typeof value === 'object' &&
    typeof candidate['id'] === 'string' &&
    typeof candidate['name'] === 'string' &&
    typeof candidate['description'] === 'string' &&
    typeof candidate['createdAt'] === 'string',
  );
}

function isStatementRecord(value: unknown): boolean {
  const candidate = value as Record<string, unknown>;
  const schedule = candidate['schedule'] as Record<string, unknown> | undefined;

  return Boolean(
    value &&
    typeof value === 'object' &&
    typeof candidate['id'] === 'string' &&
    typeof candidate['categoryId'] === 'string' &&
    typeof candidate['title'] === 'string' &&
    typeof candidate['text'] === 'string' &&
    typeof candidate['defaultRepetitions'] === 'number' &&
    typeof candidate['createdAt'] === 'string' &&
    typeof candidate['updatedAt'] === 'string' &&
    schedule &&
    typeof schedule['enabled'] === 'boolean' &&
    Array.isArray(schedule['days']) &&
    Array.isArray(schedule['times']),
  );
}

function isSessionRecord(value: unknown): boolean {
  const candidate = value as Record<string, unknown>;

  return Boolean(
    value &&
    typeof value === 'object' &&
    typeof candidate['id'] === 'string' &&
    typeof candidate['statementId'] === 'string' &&
    typeof candidate['statementTitle'] === 'string' &&
    typeof candidate['categoryId'] === 'string' &&
    (candidate['mode'] === 'manual' || candidate['mode'] === 'scheduled') &&
    typeof candidate['repetitions'] === 'number' &&
    typeof candidate['startedAt'] === 'string' &&
    typeof candidate['completedAt'] === 'string' &&
    typeof candidate['durationSeconds'] === 'number',
  );
}

export function parseImportedAppData(raw: unknown, now = new Date()): ImportResult {
  const rawRecord = raw as Record<string, unknown> | null;
  const payload =
    raw &&
    typeof raw === 'object' &&
    rawRecord &&
    'data' in rawRecord &&
    rawRecord['data'] &&
    typeof rawRecord['data'] === 'object'
      ? (rawRecord['data'] as Record<string, unknown>)
      : rawRecord;

  if (!payload) {
    return {
      success: false,
      error: 'The selected file does not contain importable app data.',
    };
  }

  const categories = payload['categories'];
  const statements = payload['statements'];
  const sessions = payload['sessions'];

  if (!Array.isArray(categories) || !Array.isArray(statements)) {
    return {
      success: false,
      error: 'The JSON file is missing categories or statements.',
    };
  }

  if (
    !categories.every(isCategoryRecord) ||
    !statements.every(isStatementRecord) ||
    (Array.isArray(sessions) && !sessions.every(isSessionRecord))
  ) {
    return {
      success: false,
      error: 'The JSON file structure is not valid for this app.',
    };
  }

  const normalizedSettings = normalizeSettings(
    (payload['settings'] as Partial<AppSettings> | undefined) ?? null,
    now,
  );
  const legacySessions = Array.isArray(sessions) ? (sessions as SessionRecord[]) : [];

  return {
    success: true,
    data: {
      categories: categories as AppData['categories'],
      statements: statements as AppData['statements'],
      activeSession: null,
      settings: migrateLegacySettings(normalizedSettings, legacySessions, now),
    },
  };
}

export function describeDays(days: number[]): string {
  const safeDays = sanitizeDays(days);

  if (safeDays.length === 7) {
    return 'Every day';
  }

  if (safeDays.join(',') === DEFAULT_SCHEDULE_DAYS.join(',')) {
    return 'Weekdays';
  }

  if (safeDays.join(',') === '0,6') {
    return 'Weekends';
  }

  return safeDays.map((day) => SHORT_DAY_LABELS[day]).join(' · ');
}

export function formatTimeLabel(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const stamp = new Date(2000, 0, 1, hours, minutes, 0, 0);
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(stamp);
}

export function describeSchedule(schedule: StatementSchedule): string {
  if (
    !schedule.enabled ||
    !sanitizeTimes(schedule.times).length ||
    !sanitizeDays(schedule.days).length
  ) {
    return 'No reminder times scheduled yet.';
  }

  const timesLabel = sanitizeTimes(schedule.times).map(formatTimeLabel).join(' · ');
  return `${describeDays(schedule.days)} at ${timesLabel}`;
}

function isSameDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function formatOccurrenceLabel(occurrence: Date, now: Date): string {
  const timeLabel = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(occurrence);
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);

  if (isSameDay(occurrence, now)) {
    return `Today · ${timeLabel}`;
  }

  if (isSameDay(occurrence, tomorrow)) {
    return `Tomorrow · ${timeLabel}`;
  }

  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(occurrence);
}

export function getDueOccurrences(
  statements: Statement[],
  completedScheduleKeys: string[],
  now: Date,
): DueOccurrence[] {
  const dateKey = toLocalDateKey(now);
  const matchedKeys = new Set(
    completedScheduleKeys.filter((key) => key.split('::')[1] === dateKey),
  );
  const due: DueOccurrence[] = [];

  for (const statement of statements) {
    const days = sanitizeDays(statement.schedule.days);
    const times = sanitizeTimes(statement.schedule.times);

    if (
      !statement.schedule.enabled ||
      !days.length ||
      !times.length ||
      !days.includes(now.getDay())
    ) {
      continue;
    }

    for (const time of times) {
      const occurrenceDate = buildOccurrenceDate(now, time);

      if (occurrenceDate > now) {
        continue;
      }

      const key = createOccurrenceKey(statement.id, dateKey, time);

      if (matchedKeys.has(key)) {
        continue;
      }

      due.push({
        key,
        statementId: statement.id,
        categoryId: statement.categoryId,
        title: statement.title,
        text: statement.text,
        dueAt: occurrenceDate.toISOString(),
        time,
        label: formatOccurrenceLabel(occurrenceDate, now),
        defaultRepetitions: statement.defaultRepetitions,
        overdueMinutes: Math.max(0, Math.floor((now.getTime() - occurrenceDate.getTime()) / 60000)),
      });
    }
  }

  return due.sort((left, right) => left.dueAt.localeCompare(right.dueAt));
}

export function getUpcomingOccurrences(
  statements: Statement[],
  now: Date,
  limit = 5,
): UpcomingOccurrence[] {
  const upcoming: UpcomingOccurrence[] = [];

  for (const statement of statements) {
    const days = sanitizeDays(statement.schedule.days);
    const times = sanitizeTimes(statement.schedule.times);

    if (!statement.schedule.enabled || !days.length || !times.length) {
      continue;
    }

    for (let offset = 0; offset < 8; offset += 1) {
      const candidateDay = new Date(now);
      candidateDay.setDate(now.getDate() + offset);
      candidateDay.setHours(0, 0, 0, 0);

      if (!days.includes(candidateDay.getDay())) {
        continue;
      }

      for (const time of times) {
        const occurrenceDate = buildOccurrenceDate(candidateDay, time);

        if (occurrenceDate <= now) {
          continue;
        }

        upcoming.push({
          key: createOccurrenceKey(statement.id, toLocalDateKey(candidateDay), time),
          statementId: statement.id,
          title: statement.title,
          dueAt: occurrenceDate.toISOString(),
          label: formatOccurrenceLabel(occurrenceDate, now),
          time,
        });
      }
    }
  }

  return upcoming.sort((left, right) => left.dueAt.localeCompare(right.dueAt)).slice(0, limit);
}

export function buildDashboardStats(
  statements: Statement[],
  dueNowCount: number,
  settings: AppSettings,
  now: Date,
): DashboardStats {
  const normalizedSettings = normalizeSettings(
    {
      ...settings,
      completedScheduleKeys: settings.completedScheduleKeys.filter(
        (key) => key.split('::')[1] === toLocalDateKey(now),
      ),
    },
    now,
  );

  return {
    completedSessions: normalizedSettings.completedSessions,
    statementCount: statements.length,
    dueNowCount,
    repetitionsWritten: normalizedSettings.repetitionsWritten,
    currentStreak: normalizedSettings.currentStreak,
    lastCompletedOn: normalizedSettings.lastCompletedOn,
  };
}
