"""Command-line access to the AI module, for quick manual checks.

    python3 -m service.cli story muslim-quarter --audience student
    python3 -m service.cli story christian-quarter --audience child --json
    python3 -m service.cli ask bab-al-amud "Which period built the present gate?"
    python3 -m service.cli locations
"""

import argparse
import json
import sys

try:
    from . import content_loader, llm
    from .generator import answer_question, generate_story
    from .models import GuideRequest, StoryRequest
except ImportError:  # pragma: no cover
    import os

    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from service import content_loader, llm
    from service.generator import answer_question, generate_story
    from service.models import GuideRequest, StoryRequest


def _print_story(response):
    if response.error:
        print("ERROR [%s] %s" % (response.error["code"], response.error["message"]))
        return 1
    print("TITLE:    %s" % response.title)
    print("SUMMARY:  %s" % response.summary)
    print("AUDIENCE: %s   WORDS: %d   BACKEND: %s"
          % (response.target_audience, response.word_count, response.model.provider))
    print("SOURCE:   %s" % (response.source.summary_file or "inline text"))
    print()
    print(response.narrative)
    if response.uncertainty_notes:
        print("\nUNCERTAINTY NOTES:")
        for note in response.uncertainty_notes:
            print("  - %s" % note)
    if response.warnings:
        print("\nFACT-GUARD WARNINGS:")
        for warning in response.warnings:
            print("  - %s" % warning)
    return 0


def main(argv=None):
    parser = argparse.ArgumentParser(description="Hikaya AI module CLI.")
    sub = parser.add_subparsers(dest="command")

    story = sub.add_parser("story", help="generate a story for a location")
    story.add_argument("location_id")
    story.add_argument("--audience", default="general",
                       choices=["student", "tourist", "child", "short", "historian",
                                "general"])
    story.add_argument("--tone", default="storytelling",
                       choices=["neutral", "educational", "emotional", "storytelling"])
    story.add_argument("--language", default="en")
    story.add_argument("--max-words", type=int, default=None)
    story.add_argument("--json", action="store_true", help="print the raw contract JSON")

    ask = sub.add_parser("ask", help="ask the heritage guide a question")
    ask.add_argument("location_id")
    ask.add_argument("question")
    ask.add_argument("--json", action="store_true")

    sub.add_parser("locations", help="list locations that have reviewed content")

    args = parser.parse_args(argv)

    if args.command == "locations":
        backend = llm.PROVIDER_NAME if llm.is_configured() else "offline-extractive"
        print("backend: %s" % backend)
        for item in content_loader.available_locations():
            print("  %-12s %-28s reviewed=%s  (%s)"
                  % (item["location_id"], item["name"], item["reviewed"], item["file"]))
        return 0

    if args.command == "story":
        response = generate_story(StoryRequest(
            location_id=args.location_id,
            target_audience=args.audience,
            tone=args.tone,
            language=args.language,
            max_words=args.max_words,
        ))
        if args.json:
            print(json.dumps(response.to_dict(), indent=2, ensure_ascii=False))
            return 0 if not response.error else 1
        return _print_story(response)

    if args.command == "ask":
        response = answer_question(GuideRequest(
            question=args.question, location_id=args.location_id))
        if args.json:
            print(json.dumps(response.to_dict(), indent=2, ensure_ascii=False))
            return 0 if not response.error else 1
        if response.error:
            print("ERROR [%s] %s" % (response.error["code"], response.error["message"]))
            return 1
        print(response.answer)
        for note in response.uncertainty_notes:
            print("\nNOTE: %s" % note)
        return 0

    parser.print_help()
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
