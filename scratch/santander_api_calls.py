import urllib.request
import re

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
}

url = 'https://www.santanderimoveis.com.br/wp-content/themes/shi/ape11/dist/js/home.bundle.js?ver=6.8.2'
req = urllib.request.Request(url, headers=headers)
with urllib.request.urlopen(req) as resp:
    code = resp.read().decode('utf-8', errors='ignore')

# Procurar onde action=call_api ou domains são passados
calls = re.findall(r'action=call_api[^\n]{0,200}|"call_api"[^\n]{0,200}|domain:[^\n]{0,100}|payload:[^\n]{0,100}', code)
print("Calls:", len(calls))
for c in calls[:10]:
    print(" ->", c)

# Procurar endpoints como /imovel ou /busca ou /api
endpoints = re.findall(r'https?://api\.[^\s"\'`]+|/api/[^\s"\'`]+', code)
print("API endpoints in bundle:", set(endpoints))
