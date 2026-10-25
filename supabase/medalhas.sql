-- =====================================================================
-- Pocards · Ranking mundial do chefe (medalhas de ouro, prata e bronze)
-- Cole tudo isto no Supabase › SQL Editor › New query e clique em Run.
-- =====================================================================

-- Pódio: só 3 lugares (1 = ouro, 2 = prata, 3 = bronze), um por jogador.
create table if not exists public.boss_medals (
  rank smallint primary key check (rank between 1 and 3),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  nickname text not null check (char_length(trim(nickname)) between 2 and 24),
  boss text not null default 'goblinKing',
  created_at timestamptz not null default now()
);

alter table public.boss_medals enable row level security;

-- Qualquer pessoa pode ver o pódio.
drop policy if exists "pódio é público" on public.boss_medals;
create policy "pódio é público" on public.boss_medals for select using (true);

-- Ninguém insere/edita direto: só pela função abaixo, que garante a ordem.
create or replace function public.claim_boss_medal(p_nickname text)
returns smallint
language plpgsql
security definer
set search_path = public
as $$
declare
  existing smallint;
  next_rank smallint;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  -- Nome sem caracteres invisíveis ou de controle (ex.: os que invertem o texto).
  p_nickname := left(trim(regexp_replace(coalesce(p_nickname, ''),
    '[\u0001-\u001F\u007F-\u009F\u00AD\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]', '', 'g')), 24);
  if char_length(p_nickname) < 2 then
    raise exception 'invalid_nickname';
  end if;

  -- Já tem medalha? Devolve a mesma (não ganha duas).
  select rank into existing from boss_medals where user_id = auth.uid();
  if existing is not null then
    return existing;
  end if;

  -- Trava a tabela para dois jogadores não pegarem o mesmo lugar ao mesmo tempo.
  lock table boss_medals in exclusive mode;

  -- O menor lugar livre (se uma medalha for apagada, a vaga volta a valer).
  select min(r)::smallint into next_rank
  from generate_series(1, 3) as r
  where r not in (select rank from boss_medals);
  if next_rank is null then
    return 0; -- as três medalhas já têm dono
  end if;

  insert into boss_medals (rank, user_id, nickname)
  values (next_rank, auth.uid(), p_nickname);
  return next_rank;
end;
$$;

revoke all on function public.claim_boss_medal(text) from public, anon;
grant execute on function public.claim_boss_medal(text) to authenticated;

-- ---------------------------------------------------------------------
-- Zerar o pódio (ex.: depois de testes). Rode só esta linha no SQL Editor:
--   delete from public.boss_medals;
-- Os apps percebem sozinhos que a medalha saiu do pódio e liberam o
-- registro de novo para quem já venceu o chefe.
-- ---------------------------------------------------------------------
