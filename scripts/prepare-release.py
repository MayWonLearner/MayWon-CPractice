#!/usr/bin/env python3
"""Audit/export Git-tracked public source, never local app data or credentials."""
import argparse, subprocess, pathlib, re, zipfile, json, hashlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--audit-only',action='store_true');parser.add_argument('--output');args=parser.parse_args()
files=[p for p in subprocess.check_output(['git','ls-files','-z'],cwd=ROOT).decode().split('\0') if p]
if not files: raise SystemExit('Stage the reviewed public source first; no tracked files found.')
blocked={'node_modules','.git','.codex','dist','.build','reports','work','private','qa-data','代码复盘'}
secret=re.compile(rb'(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)')
manifest=[]
for name in files:
 p=ROOT/name
 if p.is_symlink() or any(x in blocked for x in p.relative_to(ROOT).parts) or p.name in {'state.json','auth.json','qa-config.json','selftest.js','.env'}: raise SystemExit('Private/generated path: '+name)
 data=p.read_bytes()
 if secret.search(data): raise SystemExit('Credential-like content: '+name)
 if name!='RELEASE-MANIFEST.json':manifest.append({'path':name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
(ROOT/'RELEASE-MANIFEST.json').write_text(json.dumps({'version':json.loads((ROOT/'package.json').read_text())['version'],'scope':'Public tracked source only','files':manifest},ensure_ascii=False,indent=2)+'\n')
if args.output:
 with zipfile.ZipFile(pathlib.Path(args.output).resolve(),'w',zipfile.ZIP_DEFLATED) as z:
  for name in sorted(set(files)|{'RELEASE-MANIFEST.json'}):z.write(ROOT/name,'MayWon-CPractice/'+name)
print('Public source audit passed:',len(files),'tracked files. No upload performed.')
