import json

with open(r'd:\Opportunity\Jaydeep_work\backend\prisma\rate-cards-data.json') as f:
    raw = json.load(f)

result = []
for r in raw:
    skill = r['skill']
    band = r['experienceBand']
    code_skill = skill.replace(' ', '-').replace('/', '-').replace('(', '').replace(')', '').replace('.', '').replace(',', '')
    code = f'{code_skill}_{band}'
    
    master_ctc = round(r.get('masterCtc', 0) or 0, 2)
    mercer_ctc = round(r.get('mercerCtc', 0) or 0, 2)
    copilot = round(r.get('copilot', 0) or 0, 2)
    existing_ctc = round(r.get('existingCtc', 0) or 0, 2)
    max_ctc = round(r.get('maxCtc', 0) or 0, 2)
    ctc = max_ctc

    result.append({
        'code': code,
        'role': skill,
        'skill': skill,
        'experienceBand': band,
        'masterCtc': master_ctc,
        'mercerCtc': mercer_ctc,
        'copilot': copilot,
        'existingCtc': existing_ctc,
        'maxCtc': max_ctc,
        'ctc': ctc,
        'category': 'Technology',
    })

# Deduplicate codes
codes = [r['code'] for r in result]
dupes = set([c for c in codes if codes.count(c) > 1])
if dupes:
    print(f'WARNING: {len(dupes)} duplicate codes found, deduplicating...')
    seen = {}
    for r in result:
        if r['code'] in dupes:
            if r['code'] not in seen:
                seen[r['code']] = 0
            seen[r['code']] += 1
            if seen[r['code']] > 1:
                r['code'] = f"{r['code']}_{seen[r['code']]}"

codes2 = [r['code'] for r in result]
assert len(codes2) == len(set(codes2)), 'Still have duplicates!'

with open(r'd:\Opportunity\Jaydeep_work\backend\prisma\rate-cards-data.json', 'w') as f:
    json.dump(result, f, indent=2)

print(f'Generated {len(result)} rate cards')
print('Sample:', json.dumps(result[0], indent=2))
print('Sample APO:', json.dumps(result[14], indent=2))
