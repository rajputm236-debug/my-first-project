#!/usr/bin/env python3
"""Import one Notes MCQ subject from a local, approved batch export.

Usage: python3 scripts/import_notes_mcq.py /path/to/export.json --subject accounting
Supported subjects: accounting, costing, income-tax, gst, auditing.
The export stays local. This script does not deploy or change any repository remotely.
Existing IDs and answer order are retained; source text is refreshed from the export.
Run the UI checks and review the diff before committing the generated files.
"""
import argparse, collections, hashlib, html, json, pathlib, re
ROOT = pathlib.Path(__file__).resolve().parents[1]
DOCS = ROOT / 'docs'
MAP = {'costing': ('cost-accounting-practice', 'Cost Accounting Concepts (Practice)'),
       'income-tax': ('income-tax', 'Income Tax'), 'gst': ('gst-taxation', 'GST & Taxation'),
       'auditing': ('auditing', 'Auditing')}
def subject_of(batch, q):
    chapter = q.get('chapter', '')
    if re.match(r'Chapter IT\d', chapter): return 'income-tax'
    subject = batch['subject'].lower()
    if subject == 'accounting': return 'accounting'
    if subject.startswith('costing'): return 'costing'
    if 'income tax' in subject: return 'income-tax'
    if subject == 'gst': return 'gst'
    if 'audit' in subject: return 'auditing'
    raise ValueError('Unmapped subject: '+batch['subject'])
def normalize(text): return re.sub(r'[^a-z0-9]', '', text.lower())
def fingerprint(q, values): return (normalize(q), tuple(sorted(normalize(v) for v in values)))
def replace_json(text, marker, data):
    prefix, rest = text.split(marker, 1)
    _, end = json.JSONDecoder().raw_decode(rest.lstrip())
    # The inline Accounting array must not allow text to close its script tag.
    encoded = json.dumps(data, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c')
    return prefix+marker+encoded+rest.lstrip()[end:]
def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('export',type=pathlib.Path);ap.add_argument('--subject',choices=['accounting',*MAP],required=True)
    args=ap.parse_args(); source=json.loads(args.export.read_text())
    rows=[];batch_counts=collections.Counter()
    for b in source['batches']:
        assert len(b['questions'])==b['question_count'], ('source count',b['batch'])
        for q in b['questions']:
            assert q['batch']==b['batch'] and set(q['options'])==set('ABCD')
            assert q['correct'] in 'ABCD' and all(str(v).strip() for v in q['options'].values())
            assert q['question'].strip() and q['explanation'].strip()
            if subject_of(b,q)==args.subject:
                rows.append((b,q));batch_counts[b['batch']]+=1
    assert rows, 'No source questions for selected subject'
    assert len({(q['batch'],q['q_no']) for _,q in rows})==len(rows), 'Duplicate batch/question IDs'
    assert len({fingerprint(q['question'],q['options'].values()) for _,q in rows})==len(rows), 'Duplicate source records'
    home=(DOCS/'index.html').read_text()
    if args.subject=='accounting':
        path=DOCS/'accounting-mcq-practice.html';text=path.read_text()
        old,_=json.JSONDecoder().raw_decode(text.split('const questions=',1)[1].lstrip());byid={q['id']:q for q in old};new=[]
        for b,q in rows:
            ident=f"b{q['batch']}-q{q['q_no']}"
            row={'id':ident,'batch':f"b{q['batch']}",'number':q['q_no'],'chapter':q['tag'],
                 'question':q['question'],'options':q['options'],'answer':q['correct'],'explanation':q['explanation']}
            if ident in byid:
                previous=byid[ident]
                assert previous['answer']==row['answer'], ('Existing key changed',ident)
                assert [normalize(v) for v in previous['options'].values()]==[normalize(v) for v in row['options'].values()], ('Existing options changed',ident)
            new.append(row)
        # Do not remove an older imported batch when a later export is partial.
        newids={q['id'] for q in new};new= [q for q in old if q['id'] not in newids]+new
        text=replace_json(text,'const questions=',new)
        counts=collections.Counter(q['batch'] for q in new)
        opts='<option value="all">All batches</option>'+''.join(f'<option value="{key}">Batch {key[1:]} · {counts[key]} questions</option>' for key in sorted(counts,key=lambda k:int(k[1:])))
        text=re.sub(r'(<select id="batch"[^>]*>).*?(</select>)',lambda m:m[1]+opts+m[2],text,flags=re.S)
        text=re.sub(r'const batchOf=q=>.*?;',"const batchOf=q=>q.batch;",text)
        text=re.sub(r'Accounting batches [^<]*',f'Accounting batches 1-{max(int(k[1:]) for k in counts)} · answers and explanations retained from the supplied PDFs',text,count=1)
        text=re.sub(r'(id="totalChip">)\d+ source questions',lambda m:m[1]+str(len(new))+' source questions',text)
        text=text.replace('from the three supplied PDFs','from the supplied PDFs')
        path.write_text(text)
        def accounting_card(m):
            card=m[0]
            if '<h3>Accounting MCQ Practice</h3>' not in card:return card
            card=re.sub(r'\d+ questions',f'{len(new)} questions',card)
            card=re.sub(r'\d+ batches',f'{len(counts)} batches',card)
            card=card.replace('data-category="accounting"','data-category="commerce"')
            card=card.replace('Three uploaded Accounting MCQ batches',f'Accounting MCQ batches 1-{max(int(k[1:]) for k in counts)}')
            return card
        home=re.sub(r'<article\b.*?</article>',accounting_card,home,flags=re.S)
        summary={'subject':args.subject,'total':len(new),'source_rows':len(rows),'added':len(new)-len(old),'batch_counts':dict(batch_counts)}
    else:
        path=DOCS/'question-bank.js';text=path.read_text();bank,_=json.JSONDecoder().raw_decode(text.split('=',1)[1].lstrip())
        slug,name=MAP[args.subject];old=bank['questions'];byid={q['id']:q for q in old};new=[]
        oldprints={fingerprint(q['question'],q['options']):q['id'] for q in old}
        for b,q in rows:
            ident=f"notes-b{q['batch']:03d}-q{q['q_no']:03d}"
            if ident in byid:
                assert byid[ident]['answer']==ord(q['correct'])-65, ('Existing key changed',ident)
                assert [normalize(v) for v in byid[ident]['options']]==[normalize(v) for v in q['options'].values()], ('Existing options changed',ident)
            collision=oldprints.get(fingerprint(q['question'],q['options'].values()))
            assert not collision or collision==ident, ('Duplicate existing record',ident,collision)
            row={'id':ident,'sourceNumber':q['q_no'],'subject':slug,'subjectName':name,'topic':q['tag'],
                 'question':q['question'],'options':[q['options'][letter] for letter in 'ABCD'],'answer':ord(q['correct'])-65,
                 'explanation':q['explanation'],'source':f"Original practice from JVVNL JA Notes MCQ - {b['subject']} Batch {q['batch']}",
                 'sourceVersion':f"Notes MCQ Batch {q['batch']}",'batchNumber':q['batch'],'chapter':q['chapter'],
                 'answerVerification':'Source answer retained; not independently verified'}
            new.append(row)
        replacements={q['id']:q for q in new};merged=[replacements.pop(q['id'],q) for q in old]+list(replacements.values());bank['questions']=merged
        assert len({q['id'] for q in merged})==len(merged)
        for sec in bank['sections']:
            sec['count']=sum(q['subject']==sec['slug'] for q in merged)
            note_count=sum(q['subject']==sec['slug'] and 'batchNumber' in q for q in merged)
            if note_count:sec['notesPracticeCount']=note_count
        total=len(merged);bank['totalCount']=bank['totalValid']=total
        bank['notesPracticeCount']=sum('batchNumber' in q for q in merged)
        path.write_text('window.JVVNL_BANK = '+json.dumps(bank,ensure_ascii=False,separators=(',',':'))+';\n')
        # Derive all public counts from actual records, never from raw source totals.
        counts=collections.Counter(q['subject'] for q in merged);notes=collections.Counter(q['subject'] for q in merged if 'batchNumber' in q)
        home=re.sub(r'\d[\d,]* practice questions',f'{total:,} practice questions',home)
        def update_card(m):
            card=m[0]
            if '<h3>Auditing &amp; Cost Audit</h3>' in card or '<h3>Auditing & Cost Audit</h3>' in card:
                card=re.sub(r'<p>Auditing questions.*?</p>',f'<p>Auditing questions in one place, with answers and explanations. 476 existing unique questions plus {notes["auditing"]} chapter-wise original practice MCQs from the notes batches.</p>',card)
                card=re.sub(r'\d+ Auditing MCQs · \d+ new notes practice',f'{counts["auditing"]} Auditing MCQs · {notes["auditing"]} new notes practice',card)
            if '<h3>Income Tax &amp; GST</h3>' in card or '<h3>Income Tax & GST</h3>' in card:
                card=re.sub(r'\d+ unique GST MCQs',f'{counts["gst-taxation"]} unique GST MCQs',card)
                card=re.sub(r'\d+ unique Income Tax MCQs',f'{counts["income-tax"]} unique Income Tax MCQs',card)
                card=re.sub(r'\s*<a class="cardlink" data-notes-tax="true"[^>]*>.*?</a>','',card)
                additions=''
                for taxslug,label in [('gst-taxation','GST'),('income-tax','Income Tax')]:
                    if notes[taxslug]:additions+=f' <a class="cardlink" data-notes-tax="true" href="./practice.html?subject={taxslug}">{label} practice ({counts[taxslug]}) →</a>'
                card=card.replace('</div></article>',additions+'</div></article>')
            if '<h3>Cost Accounting</h3>' in card and notes['cost-accounting-practice']:
                card=re.sub(r'<p>.*?</p>',f'<p>700-MCQ deep bank plus {counts["cost-accounting-practice"]} original practice questions, including {notes["cost-accounting-practice"]} notes-based MCQs. Existing cost-accounting PYQs remain separate.</p>',card,count=1)
                card=re.sub(r'\s*<a class="cardlink" data-notes-cost="true"[^>]*>.*?</a>','',card)
                card=card.replace('</div></article>',f' <a class="cardlink" data-notes-cost="true" href="./practice.html?subject=cost-accounting-practice&amp;type=core">Notes MCQ ({counts["cost-accounting-practice"]}) →</a></div></article>')
            return card
        home=re.sub(r'<article\b.*?</article>',update_card,home,flags=re.S)
        practice=DOCS/'practice.html';s=practice.read_text()
        s=re.sub(r'The practice bank contains .*?source labels distinguish original practice from exam questions\.',f'The practice bank contains {total:,} questions, including {bank["notesPracticeCount"]} chapter-wise original practice MCQs from the notes batches. Repeated questions from earlier imports are consolidated; source labels distinguish original practice from exam questions.',s)
        s=re.sub(r'(id="totalCount">)[\d,]+',lambda m:m[1]+f'{total:,}',s)
        s=re.sub(r'(id="sideAnswered">0 / )[\d,]+',lambda m:m[1]+f'{total:,}',s)
        version=hashlib.sha256(path.read_bytes()).hexdigest()[:12]
        s=re.sub(r'src="\./question-bank\.js(?:\?v=[^"]*)?"',f'src="./question-bank.js?v={version}"',s);practice.write_text(s)
        summary={'subject':args.subject,'source_rows':len(rows),'added':len(merged)-len(old),'shared_total':total,'subject_total':counts[slug],'batch_counts':dict(batch_counts)}
    (DOCS/'index.html').write_text(home)
    print(json.dumps(summary,indent=2))
if __name__=='__main__':main()
