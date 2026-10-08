import re, sys
p = sys.argv[1] if len(sys.argv) > 1 else 'C:/Get4Domain/get4domain-site/docs/v2/CLAIMS_VS_REALITY.md'
s = open(p, encoding='utf-8').read()
rows = [l for l in s.split('\n') if re.match(r'^\| C\d\d ', l)]
safe = sum('**SAFE**' in l for l in rows)
reword = sum('**REWORD**' in l for l in rows)
remove = sum('**REMOVE-UNTIL-BUILT**' in l for l in rows)
print(len(rows), safe, reword, remove)
if safe + reword + remove != len(rows):
    print('WARNING: some rows have no verdict')
if '{{TOTAL}}' in s:
    s = s.replace('{{SAFE}}', str(safe)).replace('{{REWORD}}', str(reword)).replace('{{REMOVE}}', str(remove)).replace('{{TOTAL}}', str(len(rows)))
    open(p, 'w', encoding='utf-8').write(s)
    print('placeholders filled')
