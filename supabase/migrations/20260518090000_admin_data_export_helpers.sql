-- Admin export/import helpers. Two functions, both gated to admins.
-- They give the admin-data-export / admin-data-import edge functions a
-- single source of truth for "what tables exist" and "what primary key
-- should we upsert on" without having to hardcode the schema in TS.

CREATE OR REPLACE FUNCTION public.admin_list_public_tables()
RETURNS TABLE(table_name text, estimated_rows bigint, depends_on text[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  RETURN QUERY
    SELECT
      c.relname::text AS table_name,
      -- reltuples is a planner estimate; cheaper than count(*) on big tables
      -- and good enough for progress bars / sanity checks.
      GREATEST(c.reltuples::bigint, 0) AS estimated_rows,
      -- Names of tables this one has foreign keys into, restricted to
      -- the public schema. Self-references are filtered out so the
      -- client-side topological sort doesn't try to wait for a table
      -- to "exist before itself". Returned even when empty (NULL→[]).
      COALESCE(
        (SELECT array_agg(DISTINCT ref.relname::text ORDER BY ref.relname::text)
           FROM pg_constraint con
           JOIN pg_class ref ON ref.oid = con.confrelid
           JOIN pg_namespace rn ON rn.oid = ref.relnamespace
          WHERE con.contype = 'f'
            AND con.conrelid = c.oid
            AND rn.nspname = 'public'
            AND ref.relname <> c.relname),
        ARRAY[]::text[]
      ) AS depends_on
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
    ORDER BY c.relname;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_public_tables() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_public_tables() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_table_primary_key(p_table text)
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  cols text[];
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  SELECT array_agg(a.attname ORDER BY array_position(i.indkey, a.attnum))
    INTO cols
    FROM pg_index i
    JOIN pg_class c    ON c.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY(i.indkey)
   WHERE n.nspname = 'public'
     AND c.relname = p_table
     AND i.indisprimary;

  RETURN cols;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_table_primary_key(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_table_primary_key(text) TO authenticated;

-- TRUNCATE the named public table. Admin only — used by the import flow
-- in 'replace' mode. CASCADE is intentionally omitted: if FKs would
-- block the truncate, the caller should pick a different mode rather
-- than silently nuking dependent rows in some other table.
CREATE OR REPLACE FUNCTION public.admin_truncate_table(p_table text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  exists_check boolean;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  -- Guard a couple of infrastructure tables; wiping these breaks the
  -- session itself or locks the admin out of the panel.
  IF p_table IN ('admin_users', 'schema_migrations') THEN
    RAISE EXCEPTION 'refusing to truncate protected table: %', p_table;
  END IF;

  -- Only allow truncating tables that actually live in `public`. Using
  -- a parameterised regclass would happily resolve a schema-qualified
  -- name and we don't want that.
  SELECT EXISTS(
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = p_table AND c.relkind = 'r'
  ) INTO exists_check;

  IF NOT exists_check THEN
    RAISE EXCEPTION 'unknown public table: %', p_table;
  END IF;

  EXECUTE format('TRUNCATE TABLE public.%I RESTART IDENTITY', p_table);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_truncate_table(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_truncate_table(text) TO authenticated;
