import re

schema = open('db/schema.sql', encoding='utf-8').read()

GROUPS = {
 'Core': ['users','user_tokens','student_profiles','resumes','companies','recruiter_profiles',
          'company_approvals','jobs','applications','application_status_history'],
 'Supporting': ['academic_years','departments','batches','skills','qualification_levels',
          'student_education','student_projects','student_profile_items','student_skills',
          'student_project_skills','job_skills','job_departments','job_qualifications',
          'notifications','job_notifications','announcements','audit_log','settings'],
 'AI': ['ai_resume_analyses','ai_match_runs','ai_match_results','ai_match_skill_items',
        'ai_skill_gap_runs','ai_skill_gap_items','ai_interview_prep_sessions',
        'ai_interview_questions','ai_resume_improvements'],
}

def parts(body):
    out=[]; depth=0; inq=False; cur=''
    for ch in body:
        if inq:
            cur+=ch
            if ch=="'": inq=False
            continue
        if ch=="'": inq=True; cur+=ch; continue
        if ch=='(': depth+=1
        elif ch==')': depth-=1
        if ch==',' and depth==0:
            out.append(cur); cur=''
        else: cur+=ch
    out.append(cur)
    return [p.strip() for p in out if p.strip()]

def unesc(t):
    return re.sub(r'\s+',' ',t).strip().rstrip(',')

tables={}
for name, body in re.findall(r"CREATE TABLE (\w+) \((.*?)\n\) ENGINE", schema, re.S):
    pk=[]; uqs=[]; fks=[]; idxs=[]; checks=[]
    rows=[]
    for p in parts(body):
        head=p.split('(')[0].upper()
        if p.upper().startswith('PRIMARY KEY'):
            pk=re.findall(r'\w+', p[p.index('(')+1:p.rindex(')')])
        elif p.upper().startswith('UNIQUE KEY'):
            uqs.append(re.findall(r'\w+', p[p.index('(')+1:p.rindex(')')]))
        elif re.match(r'(KEY|INDEX)\s', p):
            idxs.append(re.search(r'(?:KEY|INDEX)\s+(\w+)', p).group(1))
        elif re.search(r'FOREIGN KEY \([^)]*\) REFERENCES', p):
            m=re.search(r"FOREIGN KEY \((.*?)\) REFERENCES (\w+) \((.*?)\)(.*)", p, re.S)
            if not m: continue
            cols=re.findall(r'\w+', m.group(1)); rc=re.findall(r'\w+', m.group(3))
            act=re.search(r'ON DELETE (\w+(?: \w+)?)', m.group(4))
            for c in cols:
                fks.append((c, m.group(2), ','.join(rc), act.group(1) if act else 'NO ACTION'))
        elif p.upper().startswith('CONSTRAINT') and 'CHECK' in p.upper():
            checks.append(re.search(r'CONSTRAINT (\w+)', p).group(1))
        else:
            m=re.match(r'^`?(\w+)`?\s+\w', p)
            if not m: continue
            col=m.group(1)
            rest=p[len(m.group(0))-len(p.split(None,1)[0]):] if False else re.sub(r'^`?\w+`?\s+','',p)
            rest=re.sub(r"COMMENT\s*'(?:[^']|'')*'\s*", ' ', rest, flags=re.S)
            nn = bool(re.search(r'\bNOT\s+NULL\b', rest, re.I))
            gen = 'GENERATED ALWAYS AS' in rest.upper()
            dmm = re.search(r"DEFAULT (CURRENT_TIMESTAMP|NULL|'[^']*'|[-\w.]+)", rest)
            default = dmm.group(1) if dmm else ''
            if default == 'CURRENT_TIMESTAMP': default = 'CURRENT_TIMESTAMP'
            rest = re.sub(r"\s*DEFAULT\s+(CURRENT_TIMESTAMP|NULL|'[^']*'|[-\w.]+)", ' ', rest, flags=re.I)
            typ = rest
            for pat in [r"COMMENT\s*'(?:[^']|'')*'", r"\s*NOT\s+NULL\b", r"\s+NULL\b",
                        r"\s*AUTO_INCREMENT\b", r"\s*STORED\b", r"\s*VIRTUAL\b",
                        r"\s*ON UPDATE CURRENT_TIMESTAMP", r"\s*DEFAULT\s+.*$"]:
                typ = re.sub(pat, ' ', typ, flags=re.I)
            typ = unesc(typ)
            if gen: typ += ' (generated)'
            keys=[]
            if col in pk: keys.append('PK')
            for u in uqs:
                if col in u: keys.append('UQ' if u==[col] else 'UQ('+','.join(u)+')')
            if any(c==col for c,_,_,_ in fks): keys.append('FK')
            desc = re.search(r"COMMENT\s*'((?:[^']|'')*)'", p)
            desc = desc.group(1).replace("''","'") if desc else ''
            desc = unesc(desc).replace('|','/')
            rows.append((col,typ,'NO' if nn else 'YES',','.join(keys) or '-', default or '-', desc))
    tables[name]=dict(pk=pk,uqs=uqs,fks=fks,idxs=idxs,checks=checks,rows=rows)

def block(t):
    d=tables[t]
    L=['| Column | Data Type | Null? | Key | Default | Description |','|---|---|:--:|:--:|:--:|---|']
    for r in d['rows']:
        L.append('| ' + ' | '.join(['`%s`'%r[0]] + list(r[1:4]) + [r[4], r[5] or '-']) + ' |')
    extra=[]
    if d['uqs']: extra.append('**Unique constraints:** '+'; '.join('`('+', '.join(u)+')`' for u in d['uqs'])+'.')
    if d['fks']: extra.append('**Foreign keys:** '+'; '.join('`%s` → `%s`(%s) `%s`'%f for f in d['fks'])+'.')
    if d['checks']: extra.append('**CHECK:** '+', '.join('`%s`'%c for c in d['checks'])+'.')
    if d['idxs']: extra.append('**Indexes:** '+', '.join('`%s`'%i for i in d['idxs'])+'.')
    return '### `%s`\n\n'%t + '\n'.join(L) + ('\n\n'+' '.join(extra) if extra else '') + '\n'

order=[t for g in GROUPS for t in GROUPS[g] if t in tables]
out=['## '+g+'\n\n'+'\n'.join(block(t) for t in GROUPS[g] if t in tables)+'\n' for g in GROUPS]
import sys
sys.stdout.write('\n'.join(out)+'\n')
cols=sum(len(tables[t]['rows']) for t in tables)
print('tables:',len(tables),' columns:',cols,' covered:',len(order), file=sys.stderr)
missing=[t for t in tables if t not in order]
print('ungrouped:',missing, file=sys.stderr)
