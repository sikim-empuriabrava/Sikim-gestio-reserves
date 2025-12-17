export type TodayGroupEvent = {
  id: string;
  name: string;
  event_date: string;
  entry_time: string | null;
  adults: number | null;
  children: number | null;
  total_pax: number | null;
  status: string;
  menu_text: string | null;
  second_course_type: string | null;
  seconds_confirmed: boolean | null;
  allergens_and_diets: string | null;
  extras: string | null;
  setup_notes: string | null;
  has_private_dining_room: boolean | null;
  has_private_party: boolean | null;
};
