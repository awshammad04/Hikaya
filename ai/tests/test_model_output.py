"""Tests for how a model reply is parsed and cleaned before it reaches a reader.

No API key or network: the reply text is supplied directly, the way a model
would return it.
"""

import os
import sys
import unittest
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from service import generator, llm, textutils  # noqa: E402
from service.models import StoryRequest  # noqa: E402

LABELS = ["TITLE", "SUMMARY", "NARRATIVE", "UNCERTAINTY"]


class LabelledBlockTests(unittest.TestCase):
    def test_bold_heading_at_the_start_of_a_value_is_kept(self):
        blocks = llm.parse_labelled_blocks("NARRATIVE: **Orientation**\nStart here.", LABELS)
        self.assertEqual(blocks["NARRATIVE"], "**Orientation**\nStart here.")

    def test_bold_labels_are_recognised(self):
        reply = "**TITLE:** A title\n**SUMMARY**: One line\n**NARRATIVE:** Body.\nUNCERTAINTY: NONE"
        blocks = llm.parse_labelled_blocks(reply, LABELS)
        self.assertEqual(blocks["TITLE"], "A title")
        self.assertEqual(blocks["SUMMARY"], "One line")
        self.assertEqual(blocks["NARRATIVE"], "Body.")
        self.assertEqual(blocks["UNCERTAINTY"], "NONE")


class PlainNarrativeTests(unittest.TestCase):
    def test_markdown_marks_are_removed_but_lines_kept(self):
        text = "**الاكتشاف الأول**\nإنه **مؤسسة** ثقافية.\n\n## التاريخ\n* بند"
        self.assertEqual(
            textutils.plain_narrative(text),
            "الاكتشاف الأول\nإنه مؤسسة ثقافية.\n\nالتاريخ\n- بند",
        )

    def test_unfinished_tail_is_cut_to_the_last_sentence(self):
        self.assertEqual(
            textutils.drop_unfinished_tail("جملة كاملة. وجملة ناقصة كما يروي"),
            "جملة كاملة.",
        )
        self.assertEqual(textutils.drop_unfinished_tail("Done?"), "Done?")


class TruncatedReplyTests(unittest.TestCase):
    def test_a_reply_cut_at_the_token_ceiling_ends_on_a_whole_sentence(self):
        reply = (
            "TITLE: **Bab al-Amud**\nSUMMARY: A gate.\n"
            "NARRATIVE: **Orientation**\nThe gate faces north. The Ottoman walls were bui"
        )

        def fake_complete(*_args, **_kwargs):
            llm._last.truncated = True
            return reply

        with mock.patch.object(llm, "complete", side_effect=fake_complete), \
                mock.patch.object(llm, "provider_name", return_value="anthropic"), \
                mock.patch.object(llm, "used_model", return_value="test-model"), \
                mock.patch.object(llm, "is_configured", return_value=True):
            story = generator.generate_story(StoryRequest(location_id="bab-al-amud", language="en"))
        self.assertEqual(story.title, "Bab al-Amud")
        self.assertTrue(story.narrative.endswith("The gate faces north."), story.narrative)
        self.assertNotIn("**", story.narrative)


if __name__ == "__main__":
    unittest.main()
