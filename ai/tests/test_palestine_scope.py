import unittest
from unittest.mock import patch
from service.models import StoryRequest, GuideRequest
from service.generator import generate_story, answer_question
from service.journeys import generate_journey
from service.scope import resolve_ids

class PalestineScopeTests(unittest.TestCase):
    def test_governorate_retrieval_is_isolated(self):
        self.assertEqual(set(resolve_ids(['ramallah'])), {'palestinian-museum','yasser-arafat-museum'})
        self.assertEqual(set(resolve_ids(['gaza'])), {'gaza-omari-mosque','gaza-porphyrius-church'})

    def test_wrong_governorate_is_refused(self):
        story = generate_story(StoryRequest(location_id='muslim-quarter',governorate_id='gaza'))
        self.assertEqual(story.error['code'], 'invalid_scope')
        answer = answer_question(GuideRequest(question='What is its history?',governorate_ids=['gaza'],location_ids=['muslim-quarter']))
        self.assertEqual(answer.error['code'], 'invalid_scope')

    def test_scoped_inline_content_cannot_bypass_sources(self):
        story = generate_story(StoryRequest(location_id='palestinian-museum',governorate_id='ramallah',historical_text='An invented palace built in 9999.'))
        self.assertEqual(story.error['code'], 'invalid_scope')

    def test_new_places_generate_in_both_languages_and_keep_provenance(self):
        for id in resolve_ids(['ramallah','hebron','gaza']):
            for language in ['ar','en']:
                with self.subTest(id=id,language=language), patch('service.llm.is_configured',return_value=False):
                    story = generate_story(StoryRequest(location_id=id,language=language))
                    self.assertFalse(story.error)
                    self.assertTrue(story.narrative)
                    self.assertTrue(story.source.references)
                    self.assertIn(story.source.governorate_id,['ramallah','hebron','gaza'])
                    if language=='ar': self.assertTrue(any('\u0600'<=c<='\u06ff' for c in story.narrative))

    def test_yasser_arafat_museum_story_uses_documented_design_and_archive_details(self):
        expected_by_language = {
            'en': ['four ramps', 'bridge', '34-month siege', 'bilingual Arabic-English electronic archive'],
            'ar': ['أربعة مماشٍ', 'جسر', '٣٤ شهراً', 'أرشيفاً إلكترونياً بالعربية والإنجليزية'],
        }
        for language, expected_phrases in expected_by_language.items():
            with self.subTest(language=language), patch('service.llm.is_configured',return_value=False):
                story = generate_story(StoryRequest(
                    location_id='yasser-arafat-museum',
                    language=language,
                    target_audience='general',
                ))
                self.assertFalse(story.error)
                self.assertGreater(story.word_count, 100)
                self.assertTrue(story.source.references)
                self.assertEqual(story.warnings, [])
                for phrase in expected_phrases:
                    self.assertIn(phrase, story.narrative)
                self.assertTrue(any('مداخل' in note or 'access' in note.lower()
                                    for note in story.uncertainty_notes))

    def test_yasser_arafat_museum_fact_guard_accepts_all_audience_modes(self):
        for language in ('ar', 'en'):
            for audience in ('short', 'child', 'student', 'tourist', 'historian', 'general'):
                with self.subTest(language=language, audience=audience), patch(
                    'service.llm.is_configured', return_value=False
                ):
                    story = generate_story(StoryRequest(
                        location_id='yasser-arafat-museum',
                        language=language,
                        target_audience=audience,
                    ))
                    self.assertEqual(story.warnings, [])

    def test_multi_governorate_journey_has_one_integrated_narrative(self):
        with patch('service.llm.is_configured',return_value=False):
            result = generate_journey({'governorate_ids':['jerusalem','hebron'],'location_ids':['bab-al-amud','hebron-old-town'],'language':'en'})
        self.assertNotEqual(result['status'],'error')
        self.assertIn('Bab al-Amud',result['narrative'])
        self.assertIn('Hebron',result['narrative'])
        self.assertEqual({source['governorate_id'] for source in result['sources']},{'jerusalem','hebron'})
        self.assertEqual(result['mode'],'cultural')

    def test_journey_guide_uses_only_selected_chapters(self):
        with patch('service.llm.is_configured',return_value=False):
            result = answer_question(GuideRequest(question='When was the first building phase completed?',governorate_ids=['ramallah'],location_ids=['palestinian-museum']))
        self.assertTrue(result.answered_from_source)
        self.assertIn('2016',result.answer)
        self.assertEqual([source.location_id for source in result.sources],['palestinian-museum'])

    def test_unreviewed_or_unknown_scopes_are_refused(self):
        self.assertEqual(generate_journey({'governorate_ids':['gaza'],'location_ids':['atlantis']})['error']['code'],'content_not_reviewed')
        self.assertEqual(generate_journey({'governorate_ids':['unknown']})['error']['code'],'invalid_scope')

    def test_access_question_does_not_invent_travel(self):
        with patch('service.llm.is_configured',return_value=False):
            result = answer_question(GuideRequest(question='How many minutes is the bus ride and is the border open?',governorate_ids=['ramallah','gaza']))
        self.assertFalse(result.answered_from_source)

if __name__=='__main__': unittest.main()
