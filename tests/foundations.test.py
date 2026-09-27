#!/usr/bin/env python3
"""Validate only synthetic C17 tutorial samples; never opens user state."""
import concurrent.futures
import json
from pathlib import Path
import re
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
data = json.loads((ROOT / 'Resources/foundations-v5.json').read_text())
points = [p for module in data['modules'] for p in module['points']]
assert len(points) == 66
assert len({p['id'] for p in points}) == 66
assert {m['moduleId'] for m in data['modules']} == set(range(1, 16))
for module in data['modules']:
    assert len(module['points']) >= (10 if module['moduleId'] in (1, 5, 6) else 3)
for point in points:
    assert len(point['questions']) == 3
    assert all(q['question'] and q['answer'] for q in point['questions'])
    assert point['beginner']['analogy'] and point['professional']['mechanism']
    for line in point['code'].splitlines():
        if line.strip():
            assert '//' in line and re.search('[\u4e00-\u9fff]', line.split('//', 1)[1]), point['id']

with tempfile.TemporaryDirectory(prefix='CPracticeFoundationTests-') as temporary:
    def verify(point):
        source = Path(temporary) / (point['id'] + '.c')
        binary = source.with_suffix('')
        source.write_text(point['code'])
        subprocess.run(['xcrun', 'clang', '-std=c17', '-Wall', '-Wextra', '-Werror', str(source), '-o', str(binary)], check=True, capture_output=True, text=True)
        result = subprocess.run([str(binary)], input=point['sampleInput'], capture_output=True, text=True, timeout=30)
        assert result.returncode == 0, point['id']
        assert result.stdout == point['expectedOutput'], (point['id'], result.stdout, point['expectedOutput'])
        return point['id']
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        verified = list(pool.map(verify, points))
print(f'{len(verified)}/66 C17 examples compile without warnings and match expected output.')
