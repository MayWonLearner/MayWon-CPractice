"""Compile each introductory lesson and exercise meaningful input/format boundaries."""
import json, pathlib, subprocess, tempfile, shutil, sys
root = pathlib.Path(__file__).resolve().parents[1]
lessons = json.loads((root / 'Resources/intro-lessons.json').read_text(encoding='utf-8'))
catalog = json.loads((root / 'Resources/curriculum.json').read_text(encoding='utf-8'))
assert catalog['tutorials'][0]['lessons'][:7] == lessons
assert [l['id'] for l in lessons] == ['L01-' + str(i) for i in range(6, 13)]
compiler = shutil.which('cc') or shutil.which('gcc') or shutil.which('clang')
assert compiler, 'A C17 compiler is required'
cases = 0
with tempfile.TemporaryDirectory(prefix='CPracticeIntro-') as tmp:
    for lesson in lessons:
        assert len(lesson['teaching']['questions']) == 3  # Three hidden-answer checks, plus the existing quiz.
        for line in lesson['code'].splitlines():
            assert not line.strip() or '//' in line, lesson['id']
        source = pathlib.Path(tmp) / (lesson['id'] + '.c')
        executable = source.with_suffix('.exe' if sys.platform == 'win32' else '')
        source.write_text(lesson['code'], encoding='utf-8')
        result = subprocess.run([compiler, '-std=c17', '-Wall', '-Wextra', '-Werror', str(source), '-o', str(executable), '-lm'], capture_output=True)
        assert result.returncode == 0, (lesson['id'], result.stderr.decode('utf-8', errors='replace'))
        inputs = [(lesson['input'], lesson['expected'], 0)]
        if lesson['id'] == 'L01-9':
            inputs += [('4\n', '80\n', 0), ('0\n', '0\n', 0), ('x\n', 'INVALID\n', 1), ('', 'INVALID\n', 1)]
        for stdin, expected, exitcode in inputs:
            result = subprocess.run([str(executable)], input=stdin, text=True, encoding='utf-8', capture_output=True, timeout=3)
            assert result.returncode == exitcode and result.stdout == expected, (lesson['id'], stdin, result.returncode, result.stdout)
            cases += 1
print(f'{len(lessons)} introductory C17 lessons: {cases} execution checks passed, including failed input and EOF.')
