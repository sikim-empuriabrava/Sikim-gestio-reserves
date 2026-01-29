-- Columns (sí permite IF NOT EXISTS)
ALTER TABLE public.cheffing_ingredients
  ADD COLUMN IF NOT EXISTS categories text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS reference text,
  ADD COLUMN IF NOT EXISTS stock_unit_code text,
  ADD COLUMN IF NOT EXISTS stock_qty numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_stock_qty numeric,
  ADD COLUMN IF NOT EXISTS max_stock_qty numeric,
  ADD COLUMN IF NOT EXISTS allergen_codes text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS indicator_codes text[] NOT NULL DEFAULT '{}'::text[];

-- Constraints (NO existe IF NOT EXISTS -> usar DO + pg_constraint)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cheffing_ingredients_stock_qty_check'
      AND conrelid = 'public.cheffing_ingredients'::regclass
  ) THEN
    ALTER TABLE public.cheffing_ingredients
      ADD CONSTRAINT cheffing_ingredients_stock_qty_check
      CHECK (stock_qty >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cheffing_ingredients_stock_unit_fk'
      AND conrelid = 'public.cheffing_ingredients'::regclass
  ) THEN
    ALTER TABLE public.cheffing_ingredients
      ADD CONSTRAINT cheffing_ingredients_stock_unit_fk
      FOREIGN KEY (stock_unit_code) REFERENCES public.cheffing_units(code);
  END IF;
END $$;

-- Indexes (sí permite IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS cheffing_ingredients_categories_gin_idx
  ON public.cheffing_ingredients USING GIN (categories);

CREATE INDEX IF NOT EXISTS cheffing_ingredients_allergen_codes_gin_idx
  ON public.cheffing_ingredients USING GIN (allergen_codes);

CREATE INDEX IF NOT EXISTS cheffing_ingredients_indicator_codes_gin_idx
  ON public.cheffing_ingredients USING GIN (indicator_codes);
