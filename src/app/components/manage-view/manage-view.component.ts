import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Category, Statement } from '../../models/mind-programming.models';

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

@Component({
  selector: 'app-manage-view',
  imports: [FormsModule],
  templateUrl: './manage-view.component.html',
  styleUrl: './manage-view.component.scss',
})
export class ManageViewComponent {
  readonly categories = input.required<Category[]>();
  readonly statements = input.required<Statement[]>();
  readonly categoryForm = input.required<CategoryFormModel>();
  readonly statementForm = input.required<StatementFormModel>();
  readonly isEditingStatement = input.required<boolean>();
  readonly dayOptions = input.required<Array<{ value: number; label: string }>>();
  readonly categoryName = input.required<(statement: Statement) => string>();
  readonly statementSummary = input.required<(statement: Statement) => string>();

  readonly addCategory = output<void>();
  readonly deleteCategory = output<Category>();
  readonly saveStatement = output<void>();
  readonly cancelStatementEdit = output<void>();
  readonly setScheduleEnabled = output<boolean>();
  readonly toggleScheduleDay = output<{ day: number; checked: boolean }>();
  readonly addScheduleTime = output<void>();
  readonly updateScheduleTime = output<{ index: number; value: string }>();
  readonly removeScheduleTime = output<number>();
  readonly editStatement = output<Statement>();
  readonly deleteStatement = output<Statement>();
}
