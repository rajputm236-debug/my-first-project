#!/usr/bin/env python3
"""Prepare consolidated Costing/Auditing data without touching source banks."""
import copy,json,pathlib
ROOT=pathlib.Path(__file__).resolve().parents[1];DOCS=ROOT/'docs'
def inline(path,marker):return json.JSONDecoder().raw_decode(path.read_text().split(marker,1)[1].lstrip())[0]
def build():
 original=inline(DOCS/'question-bank.js','=');bank=copy.deepcopy(original)
 cost_slugs={'cost-accounting-pyq','advanced-cost-accounting','cost-accounting-practice'};audit_slugs={'auditing','cost-management-audit'}
 for q in bank['questions']:
  old_subject=q['subject'];members={old_subject,*q.get('secondarySubjects',[])};q['legacySubject']=old_subject
  if old_subject in cost_slugs:q['subject']='cost-accounting';q['subjectName']='Cost Accounting'
  if members&audit_slugs:q['subject']='auditing';q['subjectName']='Auditing';q['legacySubjects']=list(members);q['secondarySubjects']=[s for s in q.get('secondarySubjects',[]) if s not in audit_slugs]
  q['sourceBank']='notes' if 'batchNumber' in q else 'shared'
 cost=inline(DOCS/'cost-accounting.html','const QUESTIONS=')
 for q in cost:
  bank['questions'].append({'id':f"cost-deep-{q['id']:04d}",'sourceNumber':q['id'],'subject':'cost-accounting','subjectName':'Cost Accounting','topic':q['chapterId']+' · '+q['chapterName'],'question':q['questionText'],'options':[o['text'] for o in q['options']],'answer':ord(q['correctAnswer'])-65,'explanation':q['explanation'],'source':str(q.get('sourceTag',''))+' · Cost Accounting 700-question bank','sourceBank':'deep-cost','sourcePage':q.get('sourcePage'),'warnings':q.get('warnings',[]),'answerVerification':'Source answer retained; see source review warnings','legacyProgress':{'storageKey':'jvvnl_cost_quiz_v1','questionId':str(q['id']),'optionFormat':'letter'}})
 sections=[];seen=set()
 for section in bank['sections']:
  section=copy.deepcopy(section);slug=section['slug'];slug='cost-accounting' if slug in cost_slugs else 'auditing' if slug in audit_slugs else slug
  if slug in seen:continue
  seen.add(slug);section['slug']=slug
  if slug=='cost-accounting':section['name']='Cost Accounting'
  if slug=='auditing':section['name']='Auditing'
  section['count']=sum(q['subject']==slug or slug in q.get('secondarySubjects',[]) for q in bank['questions']);sections.append(section)
 bank['sections']=sections;bank['totalCount']=bank['totalValid']=len(bank['questions']);bank['consolidationVersion']=1
 assert len({q['id'] for q in bank['questions']})==len(bank['questions'])
 original_by_id={q['id']:q for q in original['questions']}
 for q in bank['questions']:
  if q['id'] not in original_by_id:continue
  old=original_by_id[q['id']]
  for k in ['question','options','answer','explanation']:assert old[k]==q[k],(q['id'],k)
 # Keep the single consolidated subject entry/count current after partial imports.
 home=(DOCS/'index.html').read_text()
 import re
 for slug,title,label in [('cost-accounting','Cost Accounting','Costing'),('auditing','Auditing &amp; Cost Audit','Auditing')]:
  count=sum(q['subject']==slug for q in bank['questions'])
  def card(m):
   c=m[0]
   if '<h3>'+title+'</h3>' not in c:return c
   start=c.index('<div class="cardfoot">')
   return c[:start]+f'<div class="cardfoot"><span>{count:,} question records · all sources</span><a class="cardlink" href="./subject-practice.html?subject={slug}">Open {label} →</a></div></article>'
  home=re.sub(r'<article\b.*?</article>',card,home,flags=re.S)
 (DOCS/'index.html').write_text(home)
 (DOCS/'consolidated-bank.js').write_text('window.JVVNL_CONSOLIDATED_BANK = '+json.dumps(bank,ensure_ascii=False,separators=(',',':'))+';\n')
 summary={'total':len(bank['questions']),'costing':sum(q['subject']=='cost-accounting' for q in bank['questions']),'auditing':sum(q['subject']=='auditing' for q in bank['questions']),'sourceRecordsUnchanged':len(original['questions']),'costDeepAdded':len(cost)}
 print(json.dumps(summary,indent=2));return bank
if __name__=='__main__':build()
