"""FootScout on real data: builds assets/data/scout.json from StatsBomb Open Data events.
Usage: python3 tools/build_scout.py <dir with events/ lineups/> <output json>

Every number comes from logged match events. Player names never enter the model.
Only aggregates are published (per-90 percentiles and binned heatmaps), never raw events.
Data: StatsBomb Open Data, https://github.com/statsbomb/open-data
"""
import json
import sys
from collections import defaultdict
from pathlib import Path

import numpy as np
from sklearn.decomposition import PCA
from sklearn.manifold import TSNE

src, out = Path(sys.argv[1]), Path(sys.argv[2])
MIN_MINUTES = 270
COLS, ROWS = 12, 8  # heatmap bins on a 120 x 80 pitch

RATES = ["goals", "xg", "shots", "xa", "key_passes", "box_touches", "prog_passes", "prog_carries", "dribbles",
         "crosses", "long_passes", "passes", "tackles", "interceptions", "pressures", "recoveries", "clearances",
         "blocks", "aerials"]
WELL_KNOWN = {"Lionel Messi", "Kylian Mbappé", "Lamine Yamal", "Jude Bellingham", "Harry Kane", "Luka Modrić", "Rodri",
              "Antoine Griezmann", "Virgil van Dijk", "Bukayo Saka", "Jamal Musiala", "Neymar", "Cristiano Ronaldo",
              "Kevin De Bruyne", "Vinícius Júnior", "Federico Valverde", "Florian Wirtz", "Pedri", "Toni Kroos",
              "Declan Rice", "Phil Foden", "Ángel Di María", "Julián Álvarez", "Achraf Hakimi", "Sadio Mané",
              "Mohamed Salah", "Son Heung-Min", "Robert Lewandowski", "Dani Olmo", "Nico Williams", "Enzo Fernández",
              "Alexis Mac Allister", "Ousmane Dembélé", "Bernardo Silva", "James Rodríguez", "Lautaro Martínez",
              "Richarlison", "Raphinha", "João Cancelo", "Rúben Dias", "Joshua Kimmich", "İlkay Gündoğan", "Granit Xhaka",
              "Victor Osimhen", "Ademola Lookman", "Marquinhos", "Theo Hernández", "Aurélien Tchouaméni", "N'Golo Kanté",
              "Luis Díaz", "Darwin Núñez", "Giovanni Di Lorenzo", "Alessandro Bastoni", "Federico Chiesa", "Sergio Busquets"}


def clock(s):
    m, sec = s.split(":")
    return int(m) + int(sec) / 60


def group(position):
    if "Goalkeeper" in position:
        return "Goalkeeper"
    if "Back" in position:
        return "Defender"
    if "Wing" in position or "Forward" in position or "Striker" in position:
        return "Forward"
    return "Midfielder"


def new_player():
    return {"name": "", "team": "", "minutes": 0.0, "by_pos": defaultdict(float), "matches": defaultdict(dict),
            "heat": defaultdict(lambda: np.zeros(COLS * ROWS))}


def bin_of(loc):
    return min(int(loc[0] // 10), COLS - 1) + COLS * min(int(loc[1] // 10), ROWS - 1)


players = defaultdict(new_player)
for path in sorted((src / "events").glob("*.json")):
    if not path.stat().st_size:
        continue
    mid = path.stem
    events = json.loads(path.read_text())
    end = max(e["minute"] + e["second"] / 60 for e in events)
    lineup_path = src / "lineups" / path.name
    if not lineup_path.exists() or not lineup_path.stat().st_size:
        continue
    for team in json.loads(lineup_path.read_text()):
        for pl in team["lineup"]:
            p = players[pl["player_id"]]
            p["name"] = pl.get("player_nickname") or pl["player_name"]
            p["team"] = team["team_name"]
            for ps in pl["positions"]:
                frm = clock(ps["from"])
                to = clock(ps["to"]) if ps["to"] else end
                mins = max(0.0, to - frm)
                p["by_pos"][group(ps["position"])] += mins
                p["matches"][mid]["minutes"] = p["matches"][mid].get("minutes", 0) + mins

    shot_xg = {e["shot"]["key_pass_id"]: e["shot"].get("statsbomb_xg", 0) for e in events
               if e["type"]["name"] == "Shot" and "key_pass_id" in e["shot"]}

    def add(pid, key, v=1.0):
        stats = players[pid]["matches"][mid]
        stats[key] = stats.get(key, 0) + v

    for e in events:
        if "player" not in e:
            continue
        pid, kind, loc = e["player"]["id"], e["type"]["name"], e.get("location")
        if loc and kind in ("Pass", "Carry", "Shot", "Ball Receipt*", "Dribble", "Duel", "Interception", "Ball Recovery",
                            "Pressure", "Clearance", "Block"):
            players[pid]["heat"][mid][bin_of(loc)] += 1
        if kind == "Shot":
            s = e["shot"]
            if s["type"]["name"] == "Penalty":
                continue
            add(pid, "shots")
            add(pid, "xg", s.get("statsbomb_xg", 0))
            if s["outcome"]["name"] == "Goal":
                add(pid, "goals")
        elif kind == "Pass":
            ps = e["pass"]
            done = "outcome" not in ps
            if done:
                add(pid, "passes")
            if e["id"] in shot_xg:
                add(pid, "xa", shot_xg[e["id"]])
                add(pid, "key_passes")
            if ps.get("cross"):
                add(pid, "crosses")
            if done and ps.get("length", 0) >= 32:
                add(pid, "long_passes")
            if done and loc and ps["end_location"][0] - loc[0] >= 10 and ps["end_location"][0] >= 60:
                add(pid, "prog_passes")
        elif kind == "Carry":
            if loc and e["carry"]["end_location"][0] - loc[0] >= 5 and e["carry"]["end_location"][0] >= 60:
                add(pid, "prog_carries")
        elif kind == "Ball Receipt*":
            if loc and loc[0] >= 102 and 18 <= loc[1] <= 62 and "ball_receipt" not in e:
                add(pid, "box_touches")
        elif kind == "Dribble":
            if e["dribble"]["outcome"]["name"] == "Complete":
                add(pid, "dribbles")
        elif kind == "Duel":
            if e["duel"]["type"]["name"] == "Tackle":
                add(pid, "tackles")
        elif kind == "Interception":
            add(pid, "interceptions")
        elif kind == "Pressure":
            add(pid, "pressures")
        elif kind == "Ball Recovery":
            add(pid, "recoveries")
        elif kind == "Clearance":
            add(pid, "clearances")
            if e["clearance"].get("aerial_won"):
                add(pid, "aerials")
        elif kind == "Block":
            add(pid, "blocks")
        elif kind == "Miscontrol":
            pass


def vector(p, match_ids):
    """Per-90 rates and a share-of-touches heatmap over the given matches."""
    mins = sum(p["matches"][m].get("minutes", 0) for m in match_ids)
    if mins <= 0:
        return None, None, 0
    rates = np.array([sum(p["matches"][m].get(k, 0) for m in match_ids) / mins * 90 for k in RATES])
    heat = sum((p["heat"][m] for m in match_ids), np.zeros(COLS * ROWS))
    return rates, heat / max(heat.sum(), 1), mins


ids = [pid for pid, p in players.items() if p["by_pos"] and max(p["by_pos"], key=p["by_pos"].get) != "Goalkeeper"
       and sum(p["by_pos"].values()) >= MIN_MINUTES]
vecs = [vector(players[pid], list(players[pid]["matches"])) for pid in ids]
R = np.array([v[0] for v in vecs])
H = np.array([v[1] for v in vecs])
mu, sd = R.mean(0), R.std(0) + 1e-9
pca_h = PCA(n_components=10, random_state=0).fit(H)
hscale = pca_h.transform(H).std(0).mean()
WHERE = 0.75  # how much "where on the pitch" counts against "what they do"


def embed(rates, heat):
    a = np.clip((rates - mu) / sd, -4, 4)
    b = pca_h.transform(heat) / hscale * WHERE
    return np.hstack([a, b])


Z = embed(R, H)
pca_z = PCA(n_components=0.9, svd_solver="full", random_state=0).fit(Z)
E = pca_z.transform(Z)
N = E / np.linalg.norm(E, axis=1, keepdims=True)
S = N @ N.T


# ---------- Test: can it recognise a player from a different set of his matches? ----------
def split_test(embedder):
    A, B, keep = [], [], []
    for pid in ids:
        ms = sorted(m for m in players[pid]["matches"] if players[pid]["matches"][m].get("minutes", 0) > 0)
        a, b = ms[::2], ms[1::2]
        ra, ha, ma = vector(players[pid], a) if a else (None, None, 0)
        rb, hb, mb = vector(players[pid], b) if b else (None, None, 0)
        if ma >= 135 and mb >= 135:
            A.append(embedder(ra[None], ha[None])[0])
            B.append(embedder(rb[None], hb[None])[0])
            keep.append(pid)
    A, B = np.array(A), np.array(B)
    A /= np.linalg.norm(A, axis=1, keepdims=True)
    B /= np.linalg.norm(B, axis=1, keepdims=True)
    order = np.argsort(-(A @ B.T), axis=1)
    ranks = np.array([np.where(order[i] == i)[0][0] + 1 for i in range(len(A))])
    return {"n": len(A), "top1": round(float((ranks == 1).mean()), 3), "top5": round(float((ranks <= 5).mean()), 3),
            "top10": round(float((ranks <= 10).mean()), 3), "median_rank": int(np.median(ranks)),
            "chance_top5": round(5 / len(A), 3)}


full = split_test(lambda r, h: pca_z.transform(embed(r, h)))
rates_only = split_test(lambda r, h: np.clip((r - mu) / sd, -4, 4))
where_only = split_test(lambda r, h: pca_h.transform(h))

# ---------- Map: 2D layout for the visual ----------
xy = TSNE(n_components=2, perplexity=30, init="pca", learning_rate="auto", random_state=7).fit_transform(E)
xy = (xy - xy.min(0)) / (xy.max(0) - xy.min(0))

# ---------- Radar axes: percentile within the player's position group ----------
idx = {k: i for i, k in enumerate(RATES)}
AXES = [lambda r: r[idx["goals"]], lambda r: r[idx["xa"]], lambda r: r[idx["shots"]], lambda r: r[idx["prog_carries"]],
        lambda r: r[idx["prog_passes"]], lambda r: r[idx["tackles"]] + r[idx["interceptions"]] + r[idx["recoveries"]]]
groups = [max(players[pid]["by_pos"], key=players[pid]["by_pos"].get) for pid in ids]
pct = np.zeros((len(ids), len(AXES)), dtype=int)
for g in set(groups):
    who = [i for i, x in enumerate(groups) if x == g]
    for a, fn in enumerate(AXES):
        vals = np.array([fn(R[i]) for i in who])
        pct[who, a] = np.round(100 * (vals[:, None] > vals[None, :]).sum(1) / max(len(who) - 1, 1))

result = []
for i, pid in enumerate(ids):
    p = players[pid]
    heat = H[i] / max(H[i].max(), 1e-9)
    top = [int(j) for j in np.argsort(-S[i]) if j != i][:5]
    result.append({
        "n": p["name"], "t": p["team"], "p": groups[i], "m": int(sum(p["by_pos"].values())),
        "f": int(p["name"] in WELL_KNOWN), "r": pct[i].tolist(),
        "x": round(float(xy[i, 0]), 3), "y": round(float(xy[i, 1]), 3),
        "h": "".join(str(min(9, int(v * 10))) for v in heat),
        "s": [[j, round(float(S[i, j]), 2)] for j in top],
    })

meta = {"players": len(ids), "matches": len(list((src / "events").glob("*.json"))), "dims": int(E.shape[1]),
        "test": {"full": full, "rates_only": rates_only, "where_only": where_only}}
out.write_text(json.dumps({"meta": meta, "players": result}, ensure_ascii=False, separators=(",", ":")))
print(json.dumps(meta, indent=1))
print(out.stat().st_size // 1024, "KB")
missing = WELL_KNOWN - {r["n"] for r in result}
print("not found:", sorted(missing))
