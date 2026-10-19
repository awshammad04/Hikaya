/**
 * A comprehension question shown after a story, mirroring the `quiz_questions`
 * table in database/schema.sql.
 *
 * `sourceNote` names where in the reviewed content the answer comes from, so a
 * reader who disagrees can go and check rather than take the app's word for it.
 */
export class QuizQuestion {
  id: string;
  locationId: string;
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
  sourceNote: string;
  sortOrder: number;
}
