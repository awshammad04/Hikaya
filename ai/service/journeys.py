"""Compose one multi-governorate story from individually fact-guarded narratives."""
from concurrent.futures import ThreadPoolExecutor

from .generator import generate_story
from .models import StoryRequest, ValidationError
from .scope import resolve_ids

def generate_journey(payload, content_dir=None):
    try:
        ids = resolve_ids(payload.get('governorate_ids'), payload.get('location_ids'), content_dir)
        def story_for(location_id):
            return generate_story(StoryRequest(location_id=location_id, language=payload.get('language', 'en'),
                                  target_audience=payload.get('target_audience', 'general'),
                                  tone=payload.get('tone', 'storytelling')), content_dir)
        # Each stop is an independent model call; running them side by side keeps a
        # seven-stop journey within the backend's timeout.
        with ThreadPoolExecutor(max_workers=min(4, len(ids))) as pool:
            stories = list(pool.map(story_for, ids))
        failed = next((story for story in stories if story.status == 'error'), None)
        if failed:
            return failed.to_dict()
        return {'status':'partial' if any(story.warnings for story in stories) else 'ok', 'mode':'cultural',
                'narrative':'\n\n'.join(story.title+'\n'+story.narrative for story in stories),
                'stories':[story.to_dict() for story in stories],
                'sources':[story.source.__dict__ for story in stories],
                'warnings':[warning for story in stories for warning in story.warnings],
                'uncertainty_notes':['Cultural reading journey only; no travel times, access or physical route are established.']}
    except ValidationError as exc:
        return {'status':'error', 'error':{'code':exc.code, 'message':exc.message}}
