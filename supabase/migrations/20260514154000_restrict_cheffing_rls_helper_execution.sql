REVOKE EXECUTE ON FUNCTION public.cheffing_is_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cheffing_is_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.cheffing_is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cheffing_is_admin() TO service_role;

REVOKE EXECUTE ON FUNCTION public.cheffing_is_allowed() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cheffing_is_allowed() FROM anon;
GRANT EXECUTE ON FUNCTION public.cheffing_is_allowed() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cheffing_is_allowed() TO service_role;
