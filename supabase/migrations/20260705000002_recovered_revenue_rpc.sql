-- Incremento atómico de metrics_daily.estimated_revenue_recovered.
-- Evita la race del read-modify-write cuando se llenan varios slots en paralelo.
-- Solo incrementa esa columna; el resto de contadores de la fila queda intacto.

create or replace function public.increment_recovered_revenue(
  p_org    uuid,
  p_branch uuid,
  p_date   date,
  p_amount numeric
) returns void
language sql
as $$
  insert into public.metrics_daily (organization_id, branch_id, date, estimated_revenue_recovered)
  values (p_org, p_branch, p_date, p_amount)
  on conflict (branch_id, date)
  do update set estimated_revenue_recovered =
    public.metrics_daily.estimated_revenue_recovered + excluded.estimated_revenue_recovered;
$$;
