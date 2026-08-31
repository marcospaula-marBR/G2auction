import re

with open('scratch/deep_analyze.py', 'r') as f:
    pass

import urllib.request

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
}

url = 'https://www.santanderimoveis.com.br/wp-content/themes/shi/ape11/dist/js/home.bundle.js?ver=6.8.2'
req = urllib.request.Request(url, headers=headers)
with urllib.request.urlopen(req) as resp:
    code = resp.read().decode('utf-8', errors='ignore')

# Buscar ocorrências de admin-ajax.php e o contexto ao redor
matches = [m.start() for m in re.finditer('admin-ajax', code)]
for idx in matches:
    print("Match around admin-ajax:")
    print(code[max(0, idx-200):min(len(code), idx+400)])
    print("-" * 50)
