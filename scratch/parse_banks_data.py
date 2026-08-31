import re
import json

def parse_santander():
    with open('santander_sample.html', 'r', encoding='utf-8') as f:
        html = f.read()
    
    print(f"Total HTML Santander: {len(html)} bytes")
    # Buscar cards de imóveis na estrutura do WordPress/Custom theme do Santander
    items = re.findall(r'<div[^>]*class="[^"]*(?:card-imovel|imovel-item|item-imovel|box-imovel|property-card|col-)[^"]*"[\s\S]*?</div>\s*</div>', html, re.I)
    print(f"Items found: {len(items)}")

    # Buscar links de imóveis
    prop_links = list(set(re.findall(r'href="(https://www\.santanderimoveis\.com\.br/(?:imovel|detalhe-imovel)/[^"]+)"', html)))
    print(f"Property links: {len(prop_links)}")
    for l in prop_links[:5]:
        print(f" - {l}")

    # Buscar blocos com imagens, títulos e preços
    blocks = re.findall(r'<div[^>]*class="[^"]*imovel[^"]*"[\s\S]*?</a>', html, re.I)
    print(f"Imovel blocks: {len(blocks)}")
    if blocks:
        print("Sample block:", blocks[0][:500])

    # Buscar JSONs inline
    json_matches = re.findall(r'(\{"id"[^<]+|\{"imoveis"[^<]+|var imoveis\s*=\s*(\[[^\]]+\]))', html)
    print(f"JSON matches: {len(json_matches)}")

def parse_bradesco():
    with open('bradesco_sample.html', 'r', encoding='utf-8') as f:
        html = f.read()
    print(f"Total HTML Bradesco: {len(html)} bytes")
    print(html[:1000])

if __name__ == '__main__':
    parse_santander()
    print("="*50)
    parse_bradesco()
