import urllib.request
import re
import json

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'pt-BR,pt;q=0.9',
}

def check_bradesco():
    url = 'https://vitrinebradesco.com.br/auctions?type=realstate&ufs=SP'
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as resp:
            html = resp.read().decode('utf-8', errors='ignore')
            print(f"Bradesco SP: Status {resp.status}, Len: {len(html)}")
            with open('bradesco_sample.html', 'w', encoding='utf-8') as f:
                f.write(html)
            # Find script tags with JSON data (ex: __NEXT_DATA__ ou similar)
            scripts = re.findall(r'<script[^>]*>([\s\S]*?)<\/script>', html)
            for i, s in enumerate(scripts):
                if '__NEXT_DATA__' in s or 'window.__' in s or 'auctions' in s or 'imoveis' in s:
                    print(f"Script {i} match: {s[:300]}...")
    except Exception as e:
        print(f"Bradesco error: {e}")

def check_santander():
    url = 'https://www.santanderimoveis.com.br/?txtsearch=S%C3%A3o+Paulo&uf=SP'
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as resp:
            html = resp.read().decode('utf-8', errors='ignore')
            print(f"Santander SP: Status {resp.status}, Len: {len(html)}")
            with open('santander_sample.html', 'w', encoding='utf-8') as f:
                f.write(html)
            scripts = re.findall(r'<script[^>]*>([\s\S]*?)<\/script>', html)
            for i, s in enumerate(scripts):
                if '__NEXT_DATA__' in s or 'window.__' in s or 'properties' in s or 'imoveis' in s:
                    print(f"Santander Script {i} match: {s[:300]}...")
    except Exception as e:
        print(f"Santander error: {e}")

if __name__ == '__main__':
    check_bradesco()
    check_santander()
