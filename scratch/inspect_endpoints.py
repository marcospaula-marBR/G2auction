import re

def inspect_bradesco_js():
    with open('bradesco_sample.html', 'r', encoding='utf-8') as f:
        html = f.read()
    # extrair nomes dos arquivos JS chunks
    js_files = re.findall(r'src="([^"]+\.js)"', html)
    print("Bradesco JS chunks:", js_files)

def inspect_santander_content():
    with open('santander_sample.html', 'r', encoding='utf-8') as f:
        html = f.read()
    # Buscar palavras-chave
    for kw in ['imovel', 'leilao', 'apartamento', 'casa', 'card', 'ajax', 'busca', 'search', 'api']:
        count = len(re.findall(kw, html, re.I))
        print(f"Santander keyword '{kw}': {count} occurrences")

    # Procurar formulários ou chamadas de busca
    forms = re.findall(r'<form[\s\S]*?<\/form>', html, re.I)
    print(f"Santander Forms: {len(forms)}")
    for form in forms[:2]:
        print("Form preview:", form[:300])

if __name__ == '__main__':
    inspect_bradesco_js()
    print("="*50)
    inspect_santander_content()
