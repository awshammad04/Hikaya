/**
 * One entry on a location's historical timeline, mirroring the
 * `timeline_events` table in database/schema.sql.
 *
 * Generated from the reviewed summaries in content/ai-ready/, so the timeline
 * shown to a reader says exactly what the content files say.
 */
export class TimelineEvent {
  id: string;
  locationId: string;
  /** e.g. '586 BCE' or 'Umayyad era (661-750 CE)'. */
  periodLabel: string;
  description: string;
  /** Approximate year used for ordering only; negative is BCE. Not displayed. */
  sortYear: number;
  sortOrder: number;
  /**
   * True when the entry rests on religious or oral tradition rather than
   * documented history. The UI labels these differently.
   */
  isTradition: boolean;
  sourceFile?: string;
}
