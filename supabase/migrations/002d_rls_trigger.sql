-- =====================================================================
-- PARTE 4/4 — RLS + Trigger de updated_at
-- Rode APÓS confirmar sucesso das Partes 1, 2 e 3.
-- IMPORTANTE: no Supabase, cole este bloco inteiro de uma vez.
-- =====================================================================

-- Row Level Security (RLS)
-- Habilita RLS em todas as tabelas.
-- O service_role da API bypassa RLS automaticamente no Supabase.
ALTER TABLE public.api_keys  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotistas  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imoveis   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.despesas  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contratos ENABLE ROW LEVEL SECURITY;

-- Função para atualizar data_atualizacao automaticamente
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.data_atualizacao = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger na tabela imoveis
DROP TRIGGER IF EXISTS trigger_imoveis_updated_at ON public.imoveis;

CREATE TRIGGER trigger_imoveis_updated_at
    BEFORE UPDATE ON public.imoveis
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
