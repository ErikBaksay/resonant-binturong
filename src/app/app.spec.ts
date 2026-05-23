import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { App } from './app';
import { MindProgrammingStore } from './services/mind-programming.store';

describe('App', () => {
  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the main heading', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Mind programming');
  });

  it('should auto-submit a matching entry after typing pauses', () => {
    vi.useFakeTimers();

    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance as unknown as {
      store: MindProgrammingStore;
      startStatement: (statement: unknown) => void;
      updateActiveEntry: (value: string) => void;
    };
    const categoryId = app.store.categories()[0]?.id ?? '';

    app.store.saveStatement({
      categoryId,
      title: 'Focused calm',
      text: 'I move through the day with focused calm',
      defaultRepetitions: 1,
      schedule: {
        enabled: false,
        days: [],
        times: [],
      },
    });

    const statement = app.store.statements()[0];

    app.startStatement(statement);
    app.updateActiveEntry('I move through the day with focused calm');

    vi.advanceTimersByTime(699);
    expect(app.store.stats().completedSessions).toBe(0);

    vi.advanceTimersByTime(1);
    expect(app.store.stats().completedSessions).toBe(1);
    expect(app.store.stats().repetitionsWritten).toBe(1);
    expect(app.store.activeSession()).toBeNull();
  });

  it('should switch between library, stats, and manage views', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.detectChanges();

    const app = fixture.componentInstance as unknown as {
      activeView: () => 'library' | 'manage' | 'stats';
    };
    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('.view-switch .switch'),
    ) as HTMLButtonElement[];
    const statsButton = buttons.find((button) => button.textContent?.trim() === 'Stats') as
      | HTMLButtonElement
      | undefined;
    const manageButton = buttons.find((button) => button.textContent?.trim() === 'Manage') as
      | HTMLButtonElement
      | undefined;

    expect(app.activeView()).toBe('library');

    statsButton?.click();
    fixture.detectChanges();
    expect(app.activeView()).toBe('stats');

    manageButton?.click();
    fixture.detectChanges();
    expect(app.activeView()).toBe('manage');
  });

  it('should hide blocking reminder while private practice is open', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance as unknown as {
      store: MindProgrammingStore;
      openPrivatePractice: () => void;
      blockingReminder: () => unknown;
    };
    const categoryId = app.store.categories()[0]?.id ?? '';
    const now = new Date();
    const time = `${`${now.getHours()}`.padStart(2, '0')}:${`${now.getMinutes()}`.padStart(2, '0')}`;

    app.store.saveStatement({
      categoryId,
      title: 'Due right now',
      text: 'I write what matters most right now',
      defaultRepetitions: 2,
      schedule: {
        enabled: true,
        days: [now.getDay()],
        times: [time],
      },
    });

    expect(app.blockingReminder()).not.toBeNull();
    app.openPrivatePractice();
    expect(app.blockingReminder()).toBeNull();
  });

  it('should keep schedule day selections sorted and unique', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance as unknown as {
      statementForm: { scheduleDays: number[] };
      toggleScheduleDay: (day: number, checked: boolean) => void;
    };

    app.statementForm.scheduleDays = [1, 3];
    app.toggleScheduleDay(0, true);
    app.toggleScheduleDay(3, true);
    app.toggleScheduleDay(1, false);

    expect(app.statementForm.scheduleDays).toEqual([0, 3]);
  });
});
