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
});
