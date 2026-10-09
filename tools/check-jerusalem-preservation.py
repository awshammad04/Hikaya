"""Compare original assets/content and legacy API values with the before-expansion snapshot."""
import argparse
import hashlib
import json
from datetime import datetime
from pathlib import Path
from urllib.request import urlopen

ROOT=Path(__file__).resolve().parents[1]

def compare(expected,actual,path,ignore_seed_dates=False):
    # Additional response metadata is backwards compatible; every old value must remain identical.
    if isinstance(expected,dict):
        for key,value in expected.items():
            assert key in actual,f'Missing {path}.{key}'
            # The original in-memory story repository stamps its seed at each startup.
            # PostgreSQL timestamps and all static heritage values remain exact comparisons.
            if ignore_seed_dates and key in {'createdAt','updatedAt'}:
                datetime.fromisoformat(actual[key])
                continue
            compare(value,actual[key],f'{path}.{key}',ignore_seed_dates)
    elif isinstance(expected,list):
        assert len(expected)==len(actual),f'Changed collection {path}'
        for index,(a,b) in enumerate(zip(expected,actual)):compare(a,b,f'{path}[{index}]',ignore_seed_dates)
    else: assert expected==actual,f'Changed value {path}: {expected!r} -> {actual!r}'

def check(api=None):
    baseline=json.loads((ROOT/'tests/jerusalem-baseline.json').read_text(encoding='utf8'))
    for file,digest in baseline['files'].items():
        assert hashlib.sha256((ROOT/file).read_bytes()).hexdigest()==digest,f'Jerusalem file changed: {file}'
    if api:
        with urlopen(api.rstrip('/')+'/health') as response: in_memory=json.load(response)['dataSource']=='in-memory-seed'
        for location,resources in baseline['api'].items():
            for path,expected in resources.items():
                with urlopen(api.rstrip('/')+'/'+path) as response:actual=json.load(response)
                compare(expected,actual,path,in_memory and path.startswith('stories/'))
    print(f"Preserved {len(baseline['files'])} original content/asset files"+(f" and {sum(len(resources) for resources in baseline['api'].values())} legacy API responses." if api else '.'))

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--api');check(parser.parse_args().api)
