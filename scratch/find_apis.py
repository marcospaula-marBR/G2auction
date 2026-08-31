import urllib.request
import re

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
}

def analyze_bradesco_api():
    try:
        url = 'https://vitrinebradesco.com.br/static/js/main.5f1ba722.chunk.js'
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as resp:
            js = resp.read().decode('utf-8', errors='ignore')
            print(f"Bradesco main JS len: {len(js)}")
            # Procurar endpoints de API
            api_urls = re.findall(r'https?://[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}[^\s"\'`]*|/api/[^\s"\'`]+|/auctions[^\s"\'`]+', js)
            print("Bradesco API urls/paths found:")
            for u in set(api_urls):
                if any(x in u for x in ['api', 'auction', 'hallo', 'backend', 'graphql', 'v1', 'v2', 'imovel', 'leilao']):
                    print(" ->", u)
    except Exception as e:
        print("Bradesco JS err:", e)

def analyze_santander_api():
    with open('santander_sample.html', 'r', encoding='utf-8') as f:
        html = f.read()
    # Procurar links de scripts JS no HTML do Santander
    js_srcs = re.findall(r'src="([^"]+\.js[^"]*)"', html)
    print("\nSantander JS files:", len(js_srcs))
    for s in js_srcs:
        if 'theme' in s or 'app' in s or 'custom' in s or 'search' in s or 'main' in s:
            print(" ->", s)

if __name__ == '__main__':
    analyze_bradesco_api()
    analyze_santander_api()
