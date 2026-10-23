"""Regression and retrieval-quality cases for English/Arabic Heritage Guide Q&A."""

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from service import fact_guard, retrieval  # noqa: E402
from service.generator import _retrieve, answer_question  # noqa: E402
from service.models import GuideRequest  # noqa: E402


SUPPORTED_EVAL_CASES = [
    ("muslim-quarter", "en", "Where is the Muslim Quarter?", {"overview"}),
    ("muslim-quarter", "ar", "أين تقع حارة المسلمين؟", {"arabic_overview"}),
    ("muslim-quarter", "en", "When was Souq al-Qattanin completed?", {"timeline"}),
    ("muslim-quarter", "ar", "متى اكتمل سوق القطانين؟", {"arabic_history"}),
    ("muslim-quarter", "en", "Which period endowed madrasas and fountains?", {"timeline"}),
    ("palestinian-museum", "en", "Which town is the Palestinian Museum in?", {"overview"}),
    ("palestinian-museum", "ar", "في أي بلدة يقع المتحف الفلسطيني؟", {"overview"}),
    ("palestinian-museum", "en", "When was the first building phase completed?", {"facts", "timeline"}),
    ("palestinian-museum", "ar", "متى اكتملت المرحلة الأولى من المبنى؟", {"facts", "timeline"}),
    ("yasser-arafat-museum", "en", "Where is Yasser Arafat Museum?", {"overview"}),
    ("yasser-arafat-museum", "ar", "أين يقع متحف ياسر عرفات؟", {"overview"}),
    ("hebron-old-town", "en", "When was Hebron Old Town inscribed?", {"facts", "timeline", "overview"}),
    ("hebron-old-town", "ar", "متى أدرجت اليونسكو البلدة القديمة في الخليل؟", {"overview", "facts", "timeline"}),
    ("ibrahimi-mosque", "en", "What architectural layers are documented?", {"facts", "overview"}),
    ("ibrahimi-mosque", "ar", "ما الطبقات المعمارية التي وثقتها لجنة إعمار الخليل؟", {"facts", "overview"}),
    ("gaza-omari-mosque", "en", "Which periods enlarged the mosque?", {"facts"}),
    ("gaza-omari-mosque", "ar", "من وسّع المسجد العمري الكبير؟", {"facts"}),
    ("gaza-porphyrius-church", "en", "What origins does the Church of Saint Porphyrius have?", {"overview"}),
    ("gaza-porphyrius-church", "ar", "ما أصول كنيسة القديس برفيريوس؟", {"overview"}),
    ("armenian-quarter", "en", "What is the pottery craft tradition?", {"importance", "timeline", "walkthrough"}),
    ("christian-quarter", "ar", "أين تقع حارة النصارى؟", {"arabic_overview"}),
    ("armenian-quarter", "ar", "ما تقليد الخزف الأرمني؟", {"arabic_history"}),
    ("maghariba-quarter", "ar", "كيف ارتبطت الحارة؟", {"arabic_history"}),
    ("sheikh-jarrah", "ar", "أين يقع حي الشيخ جراح؟", {"arabic_overview"}),
    ("silwan", "ar", "أين تقع سلوان؟", {"arabic_overview"}),
    ("at-tur", "ar", "أين يقع حي الطور؟", {"arabic_overview"}),
    ("bab-al-amud", "ar", "أين يقع باب العامود؟", {"arabic_overview"}),
]

UNSUPPORTED_EVAL_CASES = [
    "What is the best falafel shop here?",
    "How many people live in the quarter today?",
    "What time does the market open tomorrow?",
    "How many minutes is the bus ride and is the border open?",
    "Is the route currently safe for visitors?",
    "What is the exact founding date of the quarter?",
    "Which family owns each shop?",
    "What is the current price of spices?",
    "What is the ticket price for a private courtyard?",
    "Is the road open right now?",
    "What is the current weather?",
    "How much is the entrance ticket?",
    "Who is the current shop manager?",
    "What is the exact population of Bab Hutta?",
    "Which hotel has the cheapest room tonight?",
    "What is the current bus schedule?",
    "Where can I park a rental car today?",
    "What is the phone number of the oldest shop?",
    "Who are the descendants of every family in this street?",
    "What is the precise opening condition of each building?",
]


class ArabicRetrievalTests(unittest.TestCase):
    def test_alef_diacritics_yaa_and_taa_marbuta_normalize(self):
        self.assertEqual(
            retrieval.normalize_arabic("أَيْنَ حَارَةُ الْمُسْلِمِينَ؟"),
            retrieval.normalize_arabic("اين حاره المسلمين؟"),
        )

    def test_arabic_question_returns_the_reviewed_location_fact_and_citation(self):
        response = answer_question(GuideRequest(
            location_id="muslim-quarter",
            question="أين تقع حارة المسلمين؟",
            language="ar",
        ))
        self.assertTrue(response.answered_from_source)
        self.assertIn("باب العامود", response.answer)
        self.assertIn("المسجد الأقصى", response.answer)
        self.assertEqual(response.citations[0]["section"], "arabic_overview")
        self.assertEqual(response.citations[0]["content_type"], "fact")

    def test_arabic_fact_guard_flags_unsupported_arabic_names(self):
        warnings = fact_guard.check_narrative(
            "تقع حارة المسلمين قرب نابليون.",
            "تقع حارة المسلمين باتجاه المسجد الأقصى.",
        )
        self.assertTrue(any("unsupported_arabic_term" in warning for warning in warnings))

    def test_arabic_fact_guard_accepts_diacritic_and_alef_variants(self):
        self.assertEqual(
            fact_guard.check_narrative(
                "حَارَةُ الْمُسْلِمِينَ باتجاه المسجد الأقصى.",
                "حارة المسلمين باتجاه المسجد الأقصى.",
            ),
            [],
        )

    def test_arabic_fact_guard_ignores_non_factual_narrative_labels(self):
        self.assertEqual(
            fact_guard.check_narrative(
                "اكتشاف مبسط: ما يوثقه السجل عن المعالم. حقائق موثقة وخلاصة.",
                "المتحف يعرض سجلاً موثقاً عن المكان.",
            ),
            [],
        )

    def test_arabic_religious_traditions_are_attributed(self):
        response = answer_question(GuideRequest(
            location_id="at-tur",
            question="ما التقاليد الدينية؟",
            language="ar",
        ))
        self.assertTrue(response.answered_from_source, response.answer)
        self.assertEqual(response.citations[0]["content_type"], "tradition")
        self.assertTrue(response.answer.startswith("وفق التقليد الديني: "))


class RetrievalEvaluationTests(unittest.TestCase):
    def test_bm25_helper_returns_source_sentences(self):
        from service import content_loader

        content = content_loader.load("muslim-quarter")
        excerpts, _notes = _retrieve(
            "Which period endowed madrasas and fountains?",
            content.factual_text(),
            content.name,
        )
        self.assertTrue(excerpts)
        self.assertIn("madrasas", excerpts[0])

    def test_supported_eval_questions_retrieve_the_expected_sections(self):
        self.assertEqual(len(SUPPORTED_EVAL_CASES), 27)
        for location_id, language, question, expected_sections in SUPPORTED_EVAL_CASES:
            with self.subTest(location=location_id, language=language, question=question):
                response = answer_question(GuideRequest(
                    location_id=location_id,
                    language=language,
                    question=question,
                ))
                self.assertTrue(response.answered_from_source, response.answer)
                self.assertTrue(response.citations)
                actual_sections = {citation["section"] for citation in response.citations}
                self.assertTrue(actual_sections & expected_sections, actual_sections)

    def test_unsupported_eval_questions_are_refused(self):
        self.assertEqual(len(UNSUPPORTED_EVAL_CASES), 20)
        for question in UNSUPPORTED_EVAL_CASES:
            with self.subTest(question=question):
                response = answer_question(GuideRequest(
                    location_id="muslim-quarter",
                    question=question,
                ))
                self.assertFalse(response.answered_from_source)

    def test_unscoped_guide_routes_to_the_cited_location(self):
        response = answer_question(GuideRequest(
            question="Where is the Palestinian Museum?",
        ))
        self.assertTrue(response.answered_from_source)
        self.assertEqual(response.source.location_id, "palestinian-museum")
        self.assertIn("Birzeit", response.answer)
        self.assertEqual(response.citations[0]["section"], "overview")

    def test_location_question_in_a_different_place_is_routed(self):
        response = answer_question(GuideRequest(
            location_id="muslim-quarter",
            question="Where is the Palestinian Museum?",
        ))
        self.assertTrue(response.answered_from_source)
        self.assertEqual(response.source.location_id, "palestinian-museum")
        self.assertIn("Birzeit", response.answer)


if __name__ == "__main__":
    unittest.main()
