"""Approved retrieval scopes for governorate and national journeys."""
import json
import os
from . import content_loader
from .models import ValidationError

CATALOG_PATH = os.path.join(content_loader._REPO_ROOT, 'content', 'palestine', 'catalog.json')

def catalog():
    with open(CATALOG_PATH, encoding='utf8') as handle:
        return json.load(handle)

def resolve_ids(governorate_ids=None, location_ids=None, content_dir=None):
    data = catalog()
    known = {item['id'] for item in data['governorates']}
    governorates = governorate_ids or []
    if not isinstance(governorates, list) or len(governorates) > 20 or any(not isinstance(id, str) or id not in known for id in governorates):
        raise ValidationError('invalid_scope', 'Unknown or invalid governorate scope.')
    if location_ids is not None and (not isinstance(location_ids, list) or not location_ids or len(location_ids) > 20 or any(not isinstance(id, str) for id in location_ids)):
        raise ValidationError('invalid_scope', 'Choose between one and twenty location IDs.')
    ids = list(dict.fromkeys(location_ids or [item['location_id'] for item in content_loader.available_locations(content_dir) if item.get('governorate_id', 'jerusalem') in governorates]))
    if not ids:
        raise ValidationError('missing_content', 'No reviewed content in the selected scope.')
    for id in ids:
        content = content_loader.load(id, content_dir)
        if not content or not content.is_reviewed:
            raise ValidationError('content_not_reviewed', 'No reviewed content for %s.' % id)
        if governorates and content.governorate_id not in governorates:
            raise ValidationError('invalid_scope', 'Location %s is outside the selected governorates.' % id)
    return ids

def localized(content, language):
    """Use source-checked Arabic snippets for new records without changing legacy content."""
    if language != 'ar':
        return content
    item = next((item for item in catalog()['locations'] if item['id'] == content.location_id), None)
    if not item:
        return content
    sections = dict(content.sections)
    sections.update(
                    overview=item['arabicDescription'],
                    importance=item.get('arabicImportance', ''),
                    landmarks='\n'.join('- '+value for value in item.get('arabicLandmarks', [])),
                    walkthrough=item.get('arabicWalkthrough', ''),
                    facts='- '+item['arabicFacts'],
                    timeline=('| الفترة | الحدث |\n| --- | --- |\n'+'\n'.join('| '+event['label']+' | '+event['arabicDescription']+' |' for event in item['timeline']) if item['timeline'] else ''),
                    traditions=('- '+item['arabicTraditions'] if item['arabicTraditions'] else ''))
    meta = dict(content.meta, name=item['arabicName'])
    return content_loader.ReviewedContent(meta, sections, content.raw, content.path)
