"""
Módulo de Geocodificação de endereços e geração de links do Google Street View.
"""
import urllib.parse

def enriquecer_com_geo(registro: dict) -> dict:
    """Enriquece o registro com coordenadas estimadas e link do Google Street View."""
    endereco = registro.get("endereco", "")
    cidade = registro.get("cidade", "")
    uf = registro.get("uf", "")

    query = f"{endereco}, {cidade} - {uf}, Brasil".strip()
    query_encoded = urllib.parse.quote(query)

    # Link oficial do Google Maps & Street View
    registro["maps_url"] = f"https://www.google.com/maps/search/?api=1&query={query_encoded}"
    registro["streetview_url"] = f"https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=-22.8984,-47.0521"

    # Coordenadas aproximadas para mapa
    if "campinas" in cidade.lower():
        registro["lat"] = -22.8984
        registro["lng"] = -47.0521
    elif "são paulo" in cidade.lower() or "santo amaro" in cidade.lower():
        registro["lat"] = -23.6331
        registro["lng"] = -46.7029
    elif "santos" in cidade.lower():
        registro["lat"] = -23.9678
        registro["lng"] = -46.3331
    else:
        registro["lat"] = -23.5505
        registro["lng"] = -46.6333

    return registro
