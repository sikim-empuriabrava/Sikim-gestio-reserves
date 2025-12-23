WITH table_info AS (
    SELECT
        c.relname AS table_name,
        c.relrowsecurity AS rls_enabled,
        c.oid AS table_oid
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
), column_info AS (
    SELECT
        ti.table_name,
        a.attname AS column_name,
        pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type,
        NOT a.attnotnull AS is_nullable,
        pg_get_expr(ad.adbin, ad.adrelid) AS column_default,
        a.attnum
    FROM table_info ti
    JOIN pg_attribute a ON a.attrelid = ti.table_oid AND a.attnum > 0 AND NOT a.attisdropped
    LEFT JOIN pg_attrdef ad ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
), enums AS (
    SELECT
        t.typname AS name,
        ARRAY_AGG(e.enumlabel ORDER BY e.enumsortorder) AS values
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
    GROUP BY t.typname
), policies AS (
    SELECT
        pol.tablename AS table_name,
        pol.policyname AS name,
        pol.cmd,
        pol.roles,
        pol.qual,
        pol.with_check
    FROM pg_policies pol
    WHERE pol.schemaname = 'public'
), triggers AS (
    SELECT
        c.relname AS table_name,
        t.tgname AS name,
        CASE WHEN (t.tgtype & cast(2 AS int)) <> 0 THEN 'BEFORE'
             WHEN (t.tgtype & cast(64 AS int)) <> 0 THEN 'INSTEAD OF'
             ELSE 'AFTER'
        END AS timing,
        ARRAY_REMOVE(ARRAY[
            CASE WHEN (t.tgtype & cast(4 AS int)) <> 0 THEN 'INSERT' END,
            CASE WHEN (t.tgtype & cast(8 AS int)) <> 0 THEN 'DELETE' END,
            CASE WHEN (t.tgtype & cast(16 AS int)) <> 0 THEN 'UPDATE' END,
            CASE WHEN (t.tgtype & cast(32 AS int)) <> 0 THEN 'TRUNCATE' END
        ], NULL) AS events
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE NOT t.tgisinternal AND n.nspname = 'public'
), functions AS (
    SELECT
        p.proname AS name,
        COALESCE(pg_catalog.pg_get_function_arguments(p.oid), '') AS args,
        pg_catalog.pg_get_function_result(p.oid) AS returns
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
)
SELECT json_build_object(
    'generated_at', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SSZ'),
    'tables', (
        SELECT json_agg(
            json_build_object(
                'name', ti.table_name,
                'rls_enabled', ti.rls_enabled,
                'columns', (
                    SELECT json_agg(
                        json_build_object(
                            'name', ci.column_name,
                            'type', ci.data_type,
                            'nullable', ci.is_nullable,
                            'default', ci.column_default
                        ) ORDER BY ci.attnum
                    )
                    FROM column_info ci
                    WHERE ci.table_name = ti.table_name
                )
            ) ORDER BY ti.table_name
        )
        FROM table_info ti
    ),
    'enums', (
        SELECT COALESCE(json_agg(
            json_build_object(
                'name', e.name,
                'values', e.values
            ) ORDER BY e.name
        ), '[]'::json)
        FROM enums e
    ),
    'policies', (
        SELECT COALESCE(json_agg(
            json_build_object(
                'table', p.table_name,
                'name', p.name,
                'cmd', p.cmd,
                'roles', p.roles,
                'qual', p.qual,
                'with_check', p.with_check
            ) ORDER BY p.table_name, p.name
        ), '[]'::json)
        FROM policies p
    ),
    'triggers', (
        SELECT COALESCE(json_agg(
            json_build_object(
                'table', t.table_name,
                'name', t.name,
                'timing', t.timing,
                'events', t.events
            ) ORDER BY t.table_name, t.name
        ), '[]'::json)
        FROM triggers t
    ),
    'functions', (
        SELECT COALESCE(json_agg(
            json_build_object(
                'name', f.name,
                'args', f.args,
                'returns', f.returns
            ) ORDER BY f.name
        ), '[]'::json)
        FROM functions f
    )
) AS report;
