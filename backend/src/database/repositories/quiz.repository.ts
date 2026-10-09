import { PALESTINE_QUIZ } from '../seed/palestine-data';
import { QuizQuestion } from '../entities/quiz-question.entity';
import { DatabaseService } from '../database.service';
import { SEED_QUIZ } from '../seed/generated-data';

export interface QuizRepository {
  findByLocation(locationId: string): Promise<QuizQuestion[]>;
}

interface QuizRow {
  id: string;
  location_id: string;
  question: string;
  options: string[];
  answer_index: number;
  explanation: string;
  source_note: string;
  sort_order: number;
}

function toQuestion(row: QuizRow): QuizQuestion {
  return {
    id: row.id,
    locationId: row.location_id,
    question: row.question,
    options: row.options,
    answerIndex: row.answer_index,
    explanation: row.explanation,
    sourceNote: row.source_note,
    sortOrder: row.sort_order,
  };
}

export class PostgresQuizRepository implements QuizRepository {
  constructor(private readonly db: DatabaseService) {}

  async findByLocation(locationId: string): Promise<QuizQuestion[]> {
    const result = await this.db.query<QuizRow>(
      'SELECT * FROM quiz_questions WHERE location_id = $1 ORDER BY sort_order',
      [locationId],
    );
    return result.rows.map(toQuestion);
  }
}

/** Serves database/seed-generated.sql from memory when PostgreSQL is absent. */
export class InMemoryQuizRepository implements QuizRepository {
  private readonly questions: QuizQuestion[] = [
    ...SEED_QUIZ,
    ...PALESTINE_QUIZ,
  ].map((question) => ({
    ...question,
    options: [...question.options],
  }));

  findByLocation(locationId: string): Promise<QuizQuestion[]> {
    return Promise.resolve(
      this.questions
        .filter((question) => question.locationId === locationId)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    );
  }
}
