revoke execute on function public.adjust_discotheque_capacity(text, integer, text, text) from public;
revoke execute on function public.adjust_discotheque_capacity(text, integer, text, text) from anon;
revoke execute on function public.adjust_discotheque_capacity(text, integer, text, text) from authenticated;
grant execute on function public.adjust_discotheque_capacity(text, integer, text, text) to service_role;

revoke execute on function public.open_discotheque_capacity_session(text, text) from public;
revoke execute on function public.open_discotheque_capacity_session(text, text) from anon;
revoke execute on function public.open_discotheque_capacity_session(text, text) from authenticated;
grant execute on function public.open_discotheque_capacity_session(text, text) to service_role;

revoke execute on function public.close_discotheque_capacity_session(text, text) from public;
revoke execute on function public.close_discotheque_capacity_session(text, text) from anon;
revoke execute on function public.close_discotheque_capacity_session(text, text) from authenticated;
grant execute on function public.close_discotheque_capacity_session(text, text) to service_role;

revoke execute on function public.create_group_event_with_cheffing_offerings(jsonb) from public;
revoke execute on function public.create_group_event_with_cheffing_offerings(jsonb) from anon;
revoke execute on function public.create_group_event_with_cheffing_offerings(jsonb) from authenticated;
grant execute on function public.create_group_event_with_cheffing_offerings(jsonb) to service_role;

revoke execute on function public.update_group_event_with_cheffing_offerings(jsonb) from public;
revoke execute on function public.update_group_event_with_cheffing_offerings(jsonb) from anon;
revoke execute on function public.update_group_event_with_cheffing_offerings(jsonb) from authenticated;
grant execute on function public.update_group_event_with_cheffing_offerings(jsonb) to service_role;
