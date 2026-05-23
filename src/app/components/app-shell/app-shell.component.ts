import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-app-shell',
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss',
})
export class AppShellComponent {
  readonly activeView = input.required<'library' | 'manage' | 'stats'>();
  readonly completionBanner = input<string | null>(null);
  readonly subtitle = input('');

  readonly openPrivatePractice = output<void>();
  readonly switchView = output<'library' | 'manage' | 'stats'>();
  readonly clearBanner = output<void>();
}
