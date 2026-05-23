import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

interface PrivatePracticeDraft {
  text: string;
  repetitions: number;
}

@Component({
  selector: 'app-private-practice-modal',
  imports: [FormsModule],
  templateUrl: './private-practice-modal.component.html',
  styleUrl: './private-practice-modal.component.scss',
})
export class PrivatePracticeModalComponent {
  readonly draft = input.required<PrivatePracticeDraft>();

  readonly start = output<void>();
  readonly cancel = output<void>();
}
