// Scenario 6 — abuse checks. Everything here must be refused cleanly by the database
// (RLS / RPC checks), whatever a modified client sends.
//
//   node tests/stress/abuse.mjs
import { PNG } from "pngjs";
import { createClient } from "@supabase/supabase-js";
import { loadEnv, reporter } from "../lib.mjs";
import { asPlayer, clients, loadApi, runStandalone, errText } from "./_common.mjs";

const png = () => PNG.sync.write(Object.assign(new PNG({ width: 2, height: 2 }), { data: Buffer.alloc(16, 200) }));
const rows = (r) => (r.data ?? []).length;
/** A write "went through" if there's no error and at least one row came back. */
const wentThrough = (r) => !r.error && rows(r) > 0;

export async function run() {
  const { ok, done } = reporter("abuse");
  const [host, a, b, c, outsider] = await clients(5);
  const mm = await loadApi("memematch");
  const mafia = await loadApi("mafia");
  const imposter = await loadApi("imposter");
  const chicago = await loadApi("chicago");

  // --- MemeMatch room with a round in voting ------------------------------------
  const room = await asPlayer(host, () => mm.createMemeMatchRoom("STRESS AB Host"));
  const { data: rr } = await host.from("rooms").select("code").eq("id", room.roomId).single();
  const pa = await asPlayer(a, () => mm.joinMemeMatchRoom(rr.code, "STRESS AB A"));
  const pb = await asPlayer(b, () => mm.joinMemeMatchRoom(rr.code, "STRESS AB B"));
  const { data: round } = await host
    .from("rounds")
    .insert({ room_id: room.roomId, round_number: 1, statement: "STRESS", status: "collecting", ends_at: new Date(Date.now() + 60000).toISOString() })
    .select("id")
    .single();
  const sub = async (cl, pid) => (await cl.from("submissions").insert({ round_id: round.id, player_id: pid, image_path: `${room.roomId}/hand/x-${pid}.png` }).select("id").single()).data;
  const sHost = await sub(host, room.playerId);
  const sA = await sub(a, pa.playerId);
  const sB = await sub(b, pb.playerId);
  await host.rpc("advance_round_if_ready", { p_round_id: round.id });

  // Non-member: update / delete someone else's room and players.
  ok(!wentThrough(await outsider.from("rooms").update({ phase: "finished" }).eq("id", room.roomId).select("id")), "outsider can't update another room");
  ok(!wentThrough(await outsider.from("rooms").delete().eq("id", room.roomId).select("id")), "outsider can't delete another room");
  ok(!wentThrough(await outsider.from("players").delete().eq("room_id", room.roomId).select("id")), "outsider can't delete another room's players");
  ok(!wentThrough(await outsider.from("rounds").update({ status: "done" }).eq("id", round.id).select("id")), "outsider can't change another room's round");
  ok(!wentThrough(await a.from("rooms").delete().eq("id", room.roomId).select("id")), "even a member can't delete the room");

  // RPCs as a non-member.
  const adv = await outsider.rpc("advance_round_if_ready", { p_round_id: round.id });
  ok(/NOT_A_MEMBER/.test(adv.error?.message ?? ""), "outsider: advance_round_if_ready → NOT_A_MEMBER", errText(adv.error));
  const fin = await outsider.rpc("finalize_round", { p_round_id: round.id });
  ok(/NOT_A_MEMBER/.test(fin.error?.message ?? ""), "outsider: finalize_round → NOT_A_MEMBER", errText(fin.error));

  // Voting as someone else / for yourself / as outsider.
  const vAsB = await a.from("votes").insert({ round_id: round.id, voter_player_id: pb.playerId, submission_id: sHost.id }).select("id");
  ok(!wentThrough(vAsB), "a member can't vote as another player", errText(vAsB.error));
  const vSelf = await a.from("votes").insert({ round_id: round.id, voter_player_id: pa.playerId, submission_id: sA.id }).select("id");
  ok(!wentThrough(vSelf), "a player can't vote for their own photo", errText(vSelf.error));
  const vOut = await outsider.from("votes").insert({ round_id: round.id, voter_player_id: pb.playerId, submission_id: sHost.id }).select("id");
  ok(!wentThrough(vOut), "an outsider can't vote", errText(vOut.error));
  const sAsB = await a.from("submissions").insert({ round_id: round.id, player_id: pb.playerId, image_path: "x" }).select("id");
  ok(!wentThrough(sAsB), "a member can't submit a photo as another player", errText(sAsB.error));
  const score = await a.from("room_scores").insert({ room_id: room.roomId, player_id: pa.playerId, points: 99 }).select("player_id");
  ok(!wentThrough(score), "a member can't write their own score", errText(score.error));

  // Legit votes, then try to tamper with another player's vote / submission.
  await b.from("votes").insert({ round_id: round.id, voter_player_id: pb.playerId, submission_id: sHost.id });
  await host.from("votes").insert({ round_id: round.id, voter_player_id: room.playerId, submission_id: sB.id });
  const delVote = await a.from("votes").delete().eq("round_id", round.id).eq("voter_player_id", pb.playerId).select("id");
  ok(!wentThrough(delVote), "a member can't delete another player's vote", wentThrough(delVote) ? "DELETED B's vote (policy \"members delete\" on votes)" : "");
  const delSub = await a.from("submissions").delete().eq("id", sB.id).select("id");
  ok(!wentThrough(delSub), "a member can't delete another player's submitted photo", wentThrough(delSub) ? "DELETED B's submission (policy \"members delete\" on submissions)" : "");

  // player_images: steal / rewrite another player's photo.
  const { data: imgB } = await b.from("player_images").insert({ room_id: room.roomId, player_id: pb.playerId, image_path: `${room.roomId}/hand/b.png` }).select("id").single();
  const steal = await a.from("player_images").update({ player_id: pa.playerId }).eq("id", imgB.id).select("id");
  ok(!wentThrough(steal), "a member can't take over another player's photo", wentThrough(steal) ? "player_images row re-assigned (policy \"members update\" on player_images)" : "");

  // Host hijack: any member can make themselves host, then "play again".
  const pa1 = await a.rpc("memematch_play_again", { p_room_id: room.roomId });
  ok(/ONLY_HOST/.test(pa1.error?.message ?? ""), "memematch_play_again as a non-host member → ONLY_HOST", errText(pa1.error));
  const pa2 = await outsider.rpc("memematch_play_again", { p_room_id: room.roomId });
  ok(/ONLY_HOST/.test(pa2.error?.message ?? ""), "memematch_play_again as an outsider → ONLY_HOST", errText(pa2.error));
  const hijack = await a.from("rooms").update({ host_player_id: pa.playerId }).eq("id", room.roomId).select("id");
  ok(!wentThrough(hijack), "a non-host member can't make themselves host", wentThrough(hijack) ? "rooms.host_player_id changed by a regular member" : "");
  if (wentThrough(hijack)) {
    const pa3 = await a.rpc("memematch_play_again", { p_room_id: room.roomId });
    console.log(`  (info) after the hijack, memematch_play_again by that member: ${pa3.error ? errText(pa3.error) : "SUCCEEDED (wiped rounds + scores)"}`);
    await a.from("rooms").update({ host_player_id: room.playerId }).eq("id", room.roomId);
  }

  // Storage.
  const up1 = await outsider.storage.from("game-images").upload(`${room.roomId}/hand/evil-${Date.now()}.png`, png(), { contentType: "image/png" });
  ok(!!up1.error, "outsider can't upload into another room's folder", errText(up1.error));
  const up2 = await a.storage.from("game-images").upload(`not-a-room/evil-${Date.now()}.png`, png(), { contentType: "image/png" });
  ok(!!up2.error, "can't upload outside a room folder", errText(up2.error));
  const legitPath = `${room.roomId}/hand/${pb.playerId}-${Date.now()}.png`;
  const up3 = await b.storage.from("game-images").upload(legitPath, png(), { contentType: "image/png" });
  ok(!up3.error, "a member can upload into their own room (control)", errText(up3.error));
  const over = await a.storage.from("game-images").upload(legitPath, png(), { contentType: "image/png", upsert: true });
  ok(!!over.error, "a member can't overwrite another member's photo", errText(over.error));
  const rm = await a.storage.from("game-images").remove([legitPath]);
  const stillThere = await fetch(b.storage.from("game-images").getPublicUrl(legitPath).data.publicUrl);
  ok(stillThere.ok, "a member can't delete another member's photo", rm.error ? errText(rm.error) : `(remove returned ${JSON.stringify(rm.data)})`);
  const exe = await a.storage.from("game-images").upload(`${room.roomId}/hand/x-${Date.now()}.html`, "<script>alert(1)</script>", { contentType: "text/html" });
  ok(!!exe.error, "can't upload non-image content (e.g. HTML) to the public bucket", errText(exe.error));

  // --- join_room input validation ----------------------------------------------------
  const mafiaRoom = await asPlayer(host, () => mafia.createMafiaRoom("STRESS AB Host"));
  const long = "X".repeat(200);
  const j200 = await c.rpc("join_room", { p_game: "mafia", p_code: mafiaRoom.code, p_name: long });
  const { data: stored } = j200.data ? await c.from("mafia_room_players").select("display_name").eq("id", j200.data.player_id).single() : { data: null };
  ok(!!j200.error || (stored?.display_name?.length ?? 999) <= 40, "join with a 200-char name is refused or cut to ≤ 40 chars", j200.error ? errText(j200.error) : `stored ${stored?.display_name?.length} chars`);
  for (const [label, name] of [["empty", ""], ["spaces only", "    "], ["null", null]]) {
    const r = await outsider.rpc("join_room", { p_game: "mafia", p_code: mafiaRoom.code, p_name: name });
    ok(/NAME_REQUIRED/.test(r.error?.message ?? ""), `join with ${label} name → NAME_REQUIRED`, r.error ? errText(r.error) : "JOINED");
  }
  const nf = await outsider.rpc("join_room", { p_game: "mafia", p_code: "ZZZZ9", p_name: "STRESS X" });
  ok(/ROOM_NOT_FOUND/.test(nf.error?.message ?? ""), "join a non-existent code → ROOM_NOT_FOUND", errText(nf.error));
  const ug = await outsider.rpc("join_room", { p_game: "poker", p_code: mafiaRoom.code, p_name: "STRESS X" });
  ok(/UNKNOWN_GAME/.test(ug.error?.message ?? ""), "join an unknown game → UNKNOWN_GAME", errText(ug.error));
  const lower = await c.rpc("join_room", { p_game: "mafia", p_code: `  ${mafiaRoom.code.toLowerCase()} `, p_name: "STRESS C" });
  ok(!lower.error, "a lowercase code with spaces still finds the room", errText(lower.error));

  // Long names through the app's own create functions (no join_room trimming there).
  for (const [g, api, fn, table, col] of [
    ["mafia", mafia, "createMafiaRoom", "mafia_room_players", "display_name"],
    ["imposter", imposter, "createImposterRoom", "imposter_room_players", "display_name"],
    ["chicago", chicago, "createChicagoRoom", "chicago_room_players", "display_name"],
    ["memematch", mm, "createMemeMatchRoom", "players", "name"],
  ]) {
    let res;
    try {
      const r = await asPlayer(outsider, () => api[fn](long));
      const { data } = await outsider.from(table).select(col).eq("id", r.playerId).single();
      res = { stored: data?.[col]?.length };
    } catch (e) {
      res = { error: errText(e) };
    }
    ok(res.stored !== undefined && res.stored <= 40, `${g}: creating a room with a 200-char name stores ≤ 40 chars`, res.error ? `create failed: "${res.error}"` : `stored ${res.stored} chars`);
  }

  // --- Not signed in at all (anon key only) ------------------------------------------
  const env = loadEnv();
  const anon = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const ar = await anon.from("mafia_rooms").select("id").limit(5);
  ok(rows(ar) === 0, "without sign-in nothing can be read", errText(ar.error));
  const aj = await anon.rpc("join_room", { p_game: "mafia", p_code: mafiaRoom.code, p_name: "anon" });
  ok(!!aj.error, "without sign-in join_room is refused", errText(aj.error));
  const ai = await anon.from("mafia_rooms").insert({ code: "ZZZZ", state: "lobby" }).select("id");
  ok(!wentThrough(ai), "without sign-in a room can't be created", errText(ai.error));

  // --- Secrets visible to other members (reading the database directly) -----------------
  // Mafia: 4 players, host starts; can a villager read everyone's role?
  const m = await asPlayer(host, () => mafia.createMafiaRoom("STRESS AB M0"));
  const mp = [m.playerId];
  for (const [i, cl] of [a, b, c].entries()) mp.push((await asPlayer(cl, () => mafia.joinMafiaRoom(m.code, `STRESS AB M${i + 1}`))).playerId);
  await asPlayer(host, () => mafia.startMafiaGame(m.roomId, m.playerId));
  const { data: roles } = await b.from("mafia_player_roles").select("player_id,role").eq("room_id", m.roomId);
  ok((roles ?? []).length <= 1, "Mafia: a player can only read their OWN role", `player B can read ${(roles ?? []).length} roles: ${(roles ?? []).map((r) => r.role).join(",")}`);

  // Imposter: can the imposter read the secret word?
  const im = await asPlayer(host, () => imposter.createImposterRoom("STRESS AB I0"));
  const ip = [im.playerId];
  for (const [i, cl] of [a, b, c].entries()) ip.push((await asPlayer(cl, () => imposter.joinImposterRoom(im.code, `STRESS AB I${i + 1}`))).playerId);
  await asPlayer(host, () => imposter.updateImposterCategory(im.roomId, im.playerId, "celebrities"));
  await asPlayer(host, () => imposter.startImposterGame(im.roomId, im.playerId));
  const phones = [host, a, b, c];
  const { data: impRoles } = await host.from("imposter_player_roles").select("player_id,role").eq("room_id", im.roomId);
  const impIdx = ip.indexOf((impRoles ?? []).find((r) => r.role === "imposter")?.player_id);
  const impPhone = phones[impIdx];
  const { data: impRoom } = await impPhone.from("imposter_rooms").select("secret_prompt").eq("id", im.roomId).single();
  const { data: impSeen } = await impPhone.from("imposter_player_roles").select("prompt").eq("room_id", im.roomId);
  const leaked = impRoom?.secret_prompt || (impSeen ?? []).find((r) => r.prompt)?.prompt;
  ok(!leaked, "Imposter: the imposter can't read the secret word from the database", leaked ? `imposter reads "${leaked}" (imposter_rooms.secret_prompt / imposter_player_roles.prompt)` : "");

  // Chicago: can a player read the others' cards?
  const ch = await asPlayer(host, () => chicago.createChicagoRoom("STRESS AB C0"));
  const chp = [ch.playerId, (await asPlayer(a, () => chicago.joinChicagoRoom(ch.code, "STRESS AB C1"))).playerId];
  await asPlayer(host, () => chicago.startChicagoRound(ch.roomId, ch.playerId));
  const { data: handsSeen } = await a.from("chicago_player_hands").select("player_id,cards").eq("room_id", ch.roomId);
  ok((handsSeen ?? []).length <= 1, "Chicago: a player can only read their OWN hand", `player A can read ${(handsSeen ?? []).length} hands`);
  // …and change their own score directly?
  const cheat = await a.from("chicago_room_players").update({ score: 51 }).eq("id", chp[1]).select("id");
  ok(!wentThrough(cheat), "Chicago: a player can't set their own score directly", wentThrough(cheat) ? "score set to 51 via a direct UPDATE" : "");

  // Kicking: can a regular member delete the host's player row?
  const kick = await c.from("mafia_room_players").delete().eq("id", mp[0]).select("id");
  ok(!wentThrough(kick), "Mafia: a regular member can't remove the host from the room", wentThrough(kick) ? "host's player row DELETED by a regular member (host_player_id → null)" : "");

  return done();
}

runStandalone(import.meta.url, run);
