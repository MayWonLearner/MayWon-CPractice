"""Compile original tutorial practice and compare independent small oracles."""
import json, subprocess, tempfile, pathlib, random, itertools, math, shutil, sys
root=pathlib.Path(__file__).resolve().parents[1]
problems=json.loads((root/'Resources/course-exercises.json').read_text())['problems']
rng=random.Random(610)
with tempfile.TemporaryDirectory(prefix='CPracticeCourse-') as tmp:
 for p in problems:
  source=pathlib.Path(tmp)/(p['id']+'.c');binary=source.with_suffix('.exe' if sys.platform=='win32' else '');source.write_text(p['solution'])
  subprocess.run([shutil.which('cc') or shutil.which('gcc') or shutil.which('clang'),'-std=c17','-Wall','-Wextra','-Werror',str(source),'-o',str(binary)],check=True,capture_output=True)
  cases=[(t['input'],t['expected']) for t in p['tests']]
  if p['id']=='X205':
   for _ in range(40):
    a=[rng.randrange(32) for _ in range(rng.randrange(1,9))];possible={0}
    for x in a:possible|={v^x for v in list(possible)}
    cases.append((str(len(a))+'\n'+' '.join(map(str,a)),str(max(possible))))
  if p['id']=='X208':
   for _ in range(40):
    n=rng.randrange(1,6);clauses=[(rng.choice([-1,1])*rng.randint(1,n),rng.choice([-1,1])*rng.randint(1,n)) for _ in range(rng.randrange(12))]
    def valid(bits):return all((bits[abs(a)-1]==(a>0)) or (bits[abs(b)-1]==(b>0)) for a,b in clauses)
    answer=any(valid(bits) for bits in itertools.product([False,True],repeat=n))
    cases.append((f'{n} {len(clauses)}\n'+'\n'.join(f'{a} {b}' for a,b in clauses),'YES' if answer else 'NO'))
  if p['id']=='X207':
   for _ in range(30):
    a=rng.randrange(10**70);b=rng.randrange(10**70);cases.append((f'{a}\n{b}\n',str(a+b)))
  for input,expected in cases:
   r=subprocess.run([str(binary)],input=input,text=True,capture_output=True,timeout=3)
   assert r.returncode==0 and r.stdout.split()==expected.split(),(p['id'],input,r.stdout,expected)
 print(f'{len(problems)} course exercises: samples, boundaries and 110 independent oracle comparisons passed.')
