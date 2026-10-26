"""Smoke-test the integrated local services without changing saved heritage records."""
import json
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
API = 'http://localhost:3000/api/v1'
AI = 'http://localhost:8001'
WEB = 'http://localhost:5173'


def fetch(url, body=None, expected=200):
    request = Request(url, data=json.dumps(body).encode('utf8') if body is not None else None,
                      headers={'Content-Type': 'application/json'})
    try:
        with urlopen(request, timeout=60) as response:
            assert response.status == expected, (url, response.status)
            text = response.read().decode('utf8')
            return json.loads(text) if 'json' in response.headers.get('Content-Type', '') else text
    except HTTPError as error:
        assert error.code == expected, (url, error.code, error.read().decode('utf8'))
        return json.load(error)


def check():
    data = json.loads((ROOT / 'content/palestine/catalog.json').read_text(encoding='utf8'))
    governors = fetch(API + '/governorates')
    assert {item['id'] for item in governors} == {item['id'] for item in data['governorates']}
    assert len(fetch(API + '/locations')) == 8
    assert len(fetch(API + '/locations?scope=all')) == len(data['locations']) + 8
    assert fetch(WEB + '/api/v1/health')['status'] == 'ok'
    for path in ['/', '/jerusalem', '/palestine-map', '/create-story', '/my-story'] + [
        '/governorates/' + item['id'] for item in governors
    ]:
        assert '<title>Hikaya' in fetch(WEB + path)
    for record in data['locations']:
        id = record['id']
        location = fetch(API + '/locations/' + id)
        assert location['governorateId'] == record['governorateId']
        assert location['reviewStatus'] == 'source_checked'
        assert len(fetch(API + '/stories/' + id)) == 1
        assert fetch(API + '/locations/' + id + '/media') == []
        assert fetch(API + '/locations/' + id + '/before-after')['pair'] is None
        assert len(fetch(API + '/locations/' + id + '/timeline')) == len(record['timeline'])
        assert len(fetch(API + '/locations/' + id + '/quiz')) == 1
        assert all(item['governorateId'] == record['governorateId'] for item in fetch(API + '/locations/' + id + '/related'))
        for language in ['ar', 'en']:
            story = fetch(API + '/ai/generate-story', {'locationId': id, 'governorateId': record['governorateId'],
                          'language': language, 'targetAudience': 'student', 'tone': 'neutral', 'persist': False})
            assert story['source']['locationId'] == id
            assert story['generatedBy'] == 'offline-extractive'
            assert story['narrative'] and story['language'] == language
            if language == 'ar':
                assert any('\u0600' <= char <= '\u06ff' for char in story['narrative'])
    for language in ['ar', 'en']:
        for selection in [[item['id']] for item in governors] + [['jerusalem', 'hebron'], [item['id'] for item in governors]]:
            journey = fetch(API + '/journeys', {'governorateIds': selection, 'language': language,
                            'duration': 'express', 'interests': ['history', 'architecture'],
                            'targetAudience': 'student', 'tone': 'educational'})
            assert journey['mode'] == 'cultural'
            assert journey['reviewStatus'] == 'generated_not_editorially_approved'
            assert {stop['location']['governorateId'] for stop in journey['stops']} == set(selection)
            assert all(stop['narrative']['narrative'] in journey['narrative'] for stop in journey['stops'])
            assert not any('Walking' in key or 'Distance' in key for key in journey)
            for stop in journey['stops']:
                assert stop['narrative']['source']['locationId'] == stop['location']['id']
                assert all(path.startswith(('/locations/', '/contribute?')) for path in stop['resources'].values())
    guide = fetch(API + '/ai/ask-guide', {'governorateIds': ['ramallah'], 'locationIds': ['palestinian-museum'],
                  'question': 'What year was the museum building completed?', 'language': 'en'})
    assert guide['answer'] and guide['sources'][0]['location_id'] == 'palestinian-museum'
    fetch(API + '/ai/generate-story', {'locationId': 'palestinian-museum', 'governorateId': 'gaza'}, 400)
    fetch(API + '/ai/ask-guide', {'locationIds': ['palestinian-museum'], 'governorateIds': ['gaza'], 'question': 'History?'}, 400)
    fetch(API + '/journeys', {'governorateIds': ['unknown'], 'duration': 'express', 'language': 'en', 'interests': ['history']}, 400)
    national = fetch(AI + '/generate-journey', {'governorate_ids': ['ramallah', 'hebron'], 'language': 'en'})
    assert national['mode'] == 'cultural'
    assert {source['governorate_id'] for source in national['sources']} == {'ramallah', 'hebron'}
    legacy = fetch(API + '/ai/generate-story', {'locationId': 'muslim-quarter', 'language': 'en', 'persist': False})
    assert legacy['generatedBy'] == 'offline-extractive' and legacy['source']['locationId'] == 'muslim-quarter'
    print('Local integration passed: 7 governorates, 26 places, bilingual single/multi/all journeys, scoped guide, legacy AI, source gaps and route responses.')


if __name__ == '__main__':
    check()
