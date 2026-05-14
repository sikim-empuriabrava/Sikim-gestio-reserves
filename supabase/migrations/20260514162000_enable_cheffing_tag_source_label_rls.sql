ALTER TABLE public.cheffing_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY cheffing_tags_select
ON public.cheffing_tags
FOR SELECT
TO authenticated
USING (public.cheffing_is_allowed());

CREATE POLICY cheffing_tags_write
ON public.cheffing_tags
FOR ALL
TO authenticated
USING (public.cheffing_is_admin())
WITH CHECK (public.cheffing_is_admin());

ALTER TABLE public.cheffing_dish_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY cheffing_dish_tags_select
ON public.cheffing_dish_tags
FOR SELECT
TO authenticated
USING (public.cheffing_is_allowed());

CREATE POLICY cheffing_dish_tags_write
ON public.cheffing_dish_tags
FOR ALL
TO authenticated
USING (public.cheffing_is_admin())
WITH CHECK (public.cheffing_is_admin());

ALTER TABLE public.cheffing_ingredient_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY cheffing_ingredient_tags_select
ON public.cheffing_ingredient_tags
FOR SELECT
TO authenticated
USING (public.cheffing_is_allowed());

CREATE POLICY cheffing_ingredient_tags_write
ON public.cheffing_ingredient_tags
FOR ALL
TO authenticated
USING (public.cheffing_is_admin())
WITH CHECK (public.cheffing_is_admin());

ALTER TABLE public.cheffing_subrecipe_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY cheffing_subrecipe_tags_select
ON public.cheffing_subrecipe_tags
FOR SELECT
TO authenticated
USING (public.cheffing_is_allowed());

CREATE POLICY cheffing_subrecipe_tags_write
ON public.cheffing_subrecipe_tags
FOR ALL
TO authenticated
USING (public.cheffing_is_admin())
WITH CHECK (public.cheffing_is_admin());

ALTER TABLE public.cheffing_source_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY cheffing_source_labels_select
ON public.cheffing_source_labels
FOR SELECT
TO authenticated
USING (public.cheffing_is_allowed());

CREATE POLICY cheffing_source_labels_write
ON public.cheffing_source_labels
FOR ALL
TO authenticated
USING (public.cheffing_is_admin())
WITH CHECK (public.cheffing_is_admin());

ALTER TABLE public.cheffing_dish_source_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY cheffing_dish_source_labels_select
ON public.cheffing_dish_source_labels
FOR SELECT
TO authenticated
USING (public.cheffing_is_allowed());

CREATE POLICY cheffing_dish_source_labels_write
ON public.cheffing_dish_source_labels
FOR ALL
TO authenticated
USING (public.cheffing_is_admin())
WITH CHECK (public.cheffing_is_admin());
