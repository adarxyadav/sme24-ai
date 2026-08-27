-- Stage 5 (pipeline-rules.md, Stage 5; t-019-spec.md): the EHS Vault, the
-- proposals table and the private bucket the PDFs live in.

-- EHS Vault ------------------------------------------------------------------
-- pgvector document store grounding the proposal. Seeded by admins through the
-- service role; the pipeline only reads it. No client grant of any kind — the
-- reference material is ours, and the proposal carries what was used.

create extension if not exists vector with schema extensions;

create table public.ehs_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  source text,
  content text not null,
  -- openai/text-embedding-3-small via the Gateway (lib/vault/embedding.ts).
  embedding extensions.vector(1536) not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index ehs_documents_embedding_idx
  on public.ehs_documents using hnsw (embedding extensions.vector_cosine_ops);

alter table public.ehs_documents enable row level security;
revoke all on public.ehs_documents from public, anon, authenticated;
grant select, insert, update, delete on public.ehs_documents to service_role;

create function public.match_ehs_documents(
  query_embedding extensions.vector(1536),
  match_count integer default 5
)
returns table (id uuid, title text, source text, content text, similarity double precision)
language sql
stable
set search_path = ''
as $$
  select d.id, d.title, d.source, d.content,
         1 - (d.embedding operator(extensions.<=>) query_embedding) as similarity
  from public.ehs_documents d
  order by d.embedding operator(extensions.<=>) query_embedding
  limit match_count
$$;
revoke execute on function public.match_ehs_documents(extensions.vector, integer) from public, anon, authenticated;
grant execute on function public.match_ehs_documents(extensions.vector, integer) to service_role;

-- Proposals ------------------------------------------------------------------

create table public.proposals (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null unique references public.analysis_runs (id) on delete cascade,
  content jsonb not null,
  -- Object path inside the `proposals` bucket: <run_id>/proposal.pdf.
  pdf_path text not null,
  -- The vault documents the draft was grounded on: [{ id, title, source, similarity }].
  sources jsonb not null default '[]'::jsonb,
  model text,
  created_at timestamptz not null default now()
);

alter table public.proposals enable row level security;
revoke all on public.proposals from public, anon, authenticated;
grant select on public.proposals to authenticated;
grant select, insert, update, delete on public.proposals to service_role;

create policy "owner reads proposal of own runs"
  on public.proposals for select
  to authenticated
  using (
    exists (
      select 1 from public.analysis_runs r
      where r.id = proposals.run_id and r.user_id = (select auth.uid())
    )
  );

-- Storage --------------------------------------------------------------------
-- Private bucket; the pipeline uploads through the service role, the owner
-- mints a short signed URL through the session client. The object path's
-- first folder is the run id, so the read policy keys on run ownership.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('proposals', 'proposals', false, 10485760, array['application/pdf']);

create policy "owner reads proposal objects of own runs"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'proposals'
    and exists (
      select 1 from public.analysis_runs r
      where r.id::text = (storage.foldername(objects.name))[1]
        and r.user_id = (select auth.uid())
    )
  );
