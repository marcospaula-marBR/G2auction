import urllib.request
import re

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
}

def analyze_bradesco_chunk6():
    try:
        url = 'https://vitrinebradesco.com.br/static/js/6.f75efaa1.chunk.js'
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as resp:
            js = resp.read().decode('utf-8', errors='ignore')
            print(f"Bradesco chunk6 JS len: {len(js)}")
            # Procurar baseURL ou chamadas axios/fetch
            urls = re.findall(r'https?://[a-zA-Z0-9.-]+(?:/[a-zA-Z0-9_.-]+)*', js)
            print("Bradesco URLs in chunk6:")
            for u in set(urls):
                if not any(x in u for x in ['w3.org', 'schema.org', 'google', 'gtag']):
                    print(" ->", u)
    except Exception as e:
        print("Bradesco chunk6 err:", e)

def analyze_santander_bundle():
    try:
        url = 'https://www.santanderimoveis.com.br/wp-content/themes/shi/ape11/dist/js/home.bundle.js?ver=6.8.2'
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as resp:
            js = resp.read().decode('utf-8', errors='ignore')
            print(f"\nSantander home.bundle JS len: {len(js)}")
            # Procurar chamadas ajax / endpoints
            matches = re.findall(r'https?://[^\s"\'`]+|/wp-json/[^\s"\'`]+|/wp-admin/[^\s"\'`]+', js)
            print("Santander API matches:")
            for m in set(matches):
                if 'santander' in m or 'wp-' in m or 'api' in m:
                    print(" ->", m)
    except Exception as e:
        print("Santander bundle err:", e)

if __name__ == '__main__':
    analyze_bradesco_chunk6()
    analyze_santander_bundle()
