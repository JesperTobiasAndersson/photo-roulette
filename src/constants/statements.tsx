import type { Language } from "../lib/i18n";

export type StatementCategory = "innocent" | "adult" | "gross";

export type StatementEntry = {
  id: string;
  category: StatementCategory;
  en: string;
  sv: string;
};

export const STATEMENT_CATEGORIES: StatementCategory[] = ["innocent", "adult", "gross"];

export const STATEMENTS: StatementEntry[] = [
{ id: "innocent_alarm_snooze", category: "innocent", en: "When you snooze the alarm one too many times", sv: "När du snoozar alarmet en gång för mycket" },
{ id: "innocent_wifi_not_working", category: "innocent", en: "When the WiFi suddenly stops working", sv: "När WiFi plötsligt slutar fungera" },
{ id: "innocent_typo_send", category: "innocent", en: "When you send the message with a typo", sv: "När du skickar meddelandet med ett stavfel" },
{ id: "innocent_meeting_that_could_email", category: "innocent", en: "When the meeting could have been an email", sv: "När mötet kunde varit ett mejl" },
{ id: "innocent_low_battery_outside", category: "innocent", en: "When your phone battery is at 2% and you're not home", sv: "När mobilen är på 2% och du inte är hemma" },
{ id: "innocent_password_wrong_again", category: "innocent", en: "When your password is wrong again", sv: "När lösenordet är fel igen" },
{ id: "innocent_skip_intro_auto", category: "innocent", en: "When Netflix skips the intro automatically", sv: "När Netflix skippar introt automatiskt" },
{ id: "innocent_food_arrives", category: "innocent", en: "When the food finally arrives", sv: "När maten äntligen kommer" },
{ id: "innocent_package_delivery", category: "innocent", en: "When you get a notification that your package has arrived", sv: "När du får notis om att paketet har kommit" },
{ id: "innocent_teacher_calls_name", category: "innocent", en: "When the teacher says your name", sv: "När läraren säger ditt namn" },
{ id: "innocent_group_project", category: "innocent", en: "When nobody in the group project answers", sv: "När ingen i grupparbetet svarar" },
{ id: "innocent_food_too_hot", category: "innocent", en: "When the food is way too hot but you try anyway", sv: "När maten är alldeles för varm men du försöker ändå" },
{ id: "innocent_typing_fast_delete", category: "innocent", en: "When you type a long message and delete it", sv: "När du skriver ett långt meddelande och raderar det" },
{ id: "innocent_outfit_mirror_check", category: "innocent", en: "When you check your outfit one more time", sv: "När du kollar din outfit en gång till" },
{ id: "innocent_snack_disappears", category: "innocent", en: "When the snack disappears faster than expected", sv: "När snacksen försvinner snabbare än väntat" },
{ id: "innocent_friend_running_late", category: "innocent", en: "When your friend says they're 5 minutes away", sv: "När din kompis säger att de är 5 minuter bort" },
{ id: "innocent_movie_plot_twist", category: "innocent", en: "When the movie plot twist hits", sv: "När filmens plot twist kommer" },
{ id: "innocent_spot_taken", category: "innocent", en: "When someone takes your usual seat", sv: "När någon tar din vanliga plats" },
{ id: "innocent_music_hits_right", category: "innocent", en: "When the song hits exactly right", sv: "När låten sitter helt perfekt" },
{ id: "innocent_late_night_snack", category: "innocent", en: "When you go for a late night snack", sv: "När du går för ett kvällssnack" },
{ id: "innocent_alarm_weekend", category: "innocent", en: "When you wake up early on a weekend for no reason", sv: "När du vaknar tidigt på helgen utan anledning" },
{ id: "innocent_new_episode_available", category: "innocent", en: "When a new episode is available", sv: "När ett nytt avsnitt finns tillgängligt" },
{ id: "innocent_ice_cream_falls", category: "innocent", en: "When the ice cream falls on the ground", sv: "När glassen faller i marken" },
{ id: "innocent_someone_says_free_food", category: "innocent", en: "When someone says there's free food", sv: "När någon säger att det finns gratis mat" },

{ id: "adult_cant_walk_normal", category: "adult", en: "When walking normally suddenly becomes difficult", sv: "När det plötsligt blir svårt att gå normalt" },
{ id: "adult_bite_mark_problem", category: "adult", en: "When the bite mark is way too visible", sv: "När bitmärket är alldeles för synligt" },
{ id: "adult_neighbors_heard_everything", category: "adult", en: "When you realize the neighbors definitely heard everything", sv: "När du inser att grannarna definitivt hörde allt" },
{ id: "adult_clothes_everywhere", category: "adult", en: "When you notice your clothes are spread across the entire room", sv: "När du inser att dina kläder ligger över hela rummet" },
{ id: "adult_that_escalated_fast", category: "adult", en: "When 'just one drink' escalates very quickly", sv: "När 'bara en drink' eskalerar väldigt snabbt" },
{ id: "adult_text_i_shouldnt_send", category: "adult", en: "When you type a message you definitely shouldn't send", sv: "När du skriver ett meddelande du absolut inte borde skicka" },
{ id: "adult_awkward_morning_exit", category: "adult", en: "When the morning exit feels extremely awkward", sv: "När morgonutgången känns extremt awkward" },
{ id: "adult_roommate_knows", category: "adult", en: "When your roommate knows exactly what happened", sv: "När din roommate vet exakt vad som hände" },
{ id: "adult_hard_to_focus", category: "adult", en: "When it's suddenly very hard to focus on the conversation", sv: "När det plötsligt blir väldigt svårt att fokusera på konversationen" },
{ id: "adult_one_thing_leads_to_another", category: "adult", en: "When one thing clearly leads to another", sv: "När en sak helt klart leder till en annan" },
{ id: "adult_unexpected_confidence", category: "adult", en: "When the confidence suddenly goes way up", sv: "När självförtroendet plötsligt skjuter i höjden" },
{ id: "adult_everyone_notices_tension", category: "adult", en: "When everyone in the room notices the tension", sv: "När alla i rummet märker spänningen" },
{ id: "adult_message_sent_heart_race", category: "adult", en: "When you send the message and your heart starts racing", sv: "När du skickar meddelandet och hjärtat börjar rusa" },
{ id: "adult_accidental_noise", category: "adult", en: "When you accidentally make way too much noise", sv: "När du råkar låta alldeles för mycket" },
{ id: "adult_caught_smiling_phone", category: "adult", en: "When someone notices you smiling at your phone", sv: "När någon märker att du ler mot mobilen" },
{ id: "adult_chemistry_obvious", category: "adult", en: "When the chemistry is obvious to everyone", sv: "När kemin är uppenbar för alla" },
{ id: "adult_cant_stop_thinking", category: "adult", en: "When you can't stop thinking about what just happened", sv: "När du inte kan sluta tänka på vad som just hände" },
{ id: "adult_wrong_time_flashback", category: "adult", en: "When a memory pops up at the worst possible time", sv: "När ett minne dyker upp vid absolut fel tillfälle" },
{ id: "adult_friend_asks_details", category: "adult", en: "When your friend immediately asks for details", sv: "När din kompis direkt frågar efter detaljer" },
{ id: "adult_situation_gets_heated", category: "adult", en: "When the situation gets very heated very fast", sv: "När situationen blir väldigt het väldigt snabbt" },
{ id: "adult_eye_contact_says_everything", category: "adult", en: "When the eye contact says everything", sv: "När ögonkontakten säger allt" },
{ id: "adult_too_close_personal_space", category: "adult", en: "When personal space suddenly disappears", sv: "När det personliga utrymmet plötsligt försvinner" },
{ id: "adult_cant_concentrate_anymore", category: "adult", en: "When concentrating is no longer possible", sv: "När koncentration inte längre är möjligt" },
{ id: "adult_tension_could_cut", category: "adult", en: "When the tension could be cut with a knife", sv: "När spänningen går att skära med kniv" },

  { id: "gross_mystery_smell", category: "gross", en: "When you see your friend in the background of the new Bonnie Blue video?'", sv: "När du ser din vän i bakgrunden av den nya Bonnie Blue-videon?" },
  { id: "gross_friend_in_background_of_leak", category: "gross", en: "When you see someone you know in the background of a leak", sv: "När du ser någon du känner i bakgrunden av en leak" },
  { id: "gross_friend_defending_weird_opinion", category: "gross", en: "When your friend is aggressively defending a very weird opinion", sv: "När din kompis aggressivt försvarar en väldigt konstig åsikt" },


  { id: "gross_public_toilet", category: "gross", en: "When you open a public toilet stall and instantly regret it", sv: "När du öppnar ett bås på en offentlig toalett och ångrar det direkt" },
  { id: "gross_leftover_fridge", category: "gross", en: "When you find leftovers in the fridge from a time you can't remember", sv: "När du hittar rester i kylskåpet från en tid du inte minns" },
  { id: "gross_stepped_something", category: "gross", en: "When you step on something wet while wearing socks", sv: "När du trampar i något blött med strumpor på" },
  { id: "gross_hair_drain", category: "gross", en: "When the shower drain starts fighting back", sv: "När duschbrunnen börjar slå tillbaka" },
  { id: "gross_microwave_explosion", category: "gross", en: "When the microwave meal explodes and paints the inside", sv: "När mikromaten exploderar och målar hela insidan" },
  { id: "gross_random_sticky", category: "gross", en: "When you touch a sticky surface and don't know why it's sticky", sv: "När du rör vid något kladdigt och inte vet varför det är kladdigt" },
  { id: "gross_gym_shoe", category: "gross", en: "When someone takes off their shoes after the gym", sv: "När någon tar av sig skorna efter gymmet" },
  { id: "gross_sink_surprise", category: "gross", en: "When the sink spits yesterday's mystery back at you", sv: "När vasken spottar tillbaka gårdagens mysterium på dig" },
  { id: "gross_cough_near_food", category: "gross", en: "When someone coughs way too close to the food", sv: "När någon hostar alldeles för nära maten" },
  { id: "gross_bin_leak", category: "gross", en: "When the trash bag leaks on the floor", sv: "När soppåsen läcker ut på golvet" },
];

const statementsById = new Map(STATEMENTS.map((statement) => [statement.id, statement]));

const legacyTextToId = new Map<string, string>();
for (const statement of STATEMENTS) {
  legacyTextToId.set(statement.id, statement.id);
  legacyTextToId.set(statement.en, statement.id);
  legacyTextToId.set(statement.sv, statement.id);
}

export function getStatementById(id: string | null | undefined): StatementEntry | null {
  if (!id) return null;
  return statementsById.get(id) ?? null;
}

export function resolveStatementId(statementOrId: string | null | undefined): string | null {
  if (!statementOrId) return null;
  if (statementsById.has(statementOrId)) return statementOrId;
  return legacyTextToId.get(statementOrId) ?? null;
}

export function getStatementText(statementOrId: string | null | undefined, language: Language): string {
  const entry = getStatementById(resolveStatementId(statementOrId));
  if (!entry) return statementOrId ?? "";
  return language === "sv" ? entry.sv : entry.en;
}

export function getRandomStatement(options?: {
  exclude?: string[];
  category?: StatementCategory;
}): string {
  const excludeIds = new Set((options?.exclude ?? []).map((value) => resolveStatementId(value)).filter((value): value is string => !!value));
  const matchingCategory = options?.category ?? "innocent";
  const categoryPool = STATEMENTS.filter((statement) => statement.category === matchingCategory);
  const remaining = categoryPool.filter((statement) => !excludeIds.has(statement.id));
  const pool = remaining.length > 0 ? remaining : categoryPool;
  return pool[Math.floor(Math.random() * pool.length)].id;
}
