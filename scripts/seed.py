"""Generate data/creators.json: fictional creators for the search demo.

Everything here is synthetic. Names, handles, stats and captions are invented;
photos are empty until you run fetch_images.py (the UI draws placeholders).

Each record mirrors how a creator agency keeps talent: a pipeline stage
(roster, applicant, prospect), a talent partner and agreed rate for roster
creators only, audience location separate from where the creator lives, and
short CRM notes.

    python3 scripts/seed.py            # 120 creators, deterministic (seed 11)
    python3 scripts/seed.py --n 300
"""
import argparse
import json
import math
import random
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "data" / "creators.json"

FIRST = ["Maya", "Lena", "Sofia", "Jade", "Nora", "Camila", "Tessa", "Imani", "Riley", "Aria",
         "Elena", "Priya", "Chloe", "Zoe", "Naomi", "Valentina", "Harper", "Lucia", "Kira", "Dani",
         "Marcus", "Theo", "Julian", "Kai", "Mateo", "Andre", "Leo", "Omar", "Felix", "Devon"]
LAST = ["Alvarez", "Brooks", "Castillo", "Duarte", "Ellis", "Fontaine", "Greer", "Hayashi", "Ibarra",
        "Jensen", "Kovac", "Laurent", "Moreno", "Nakamura", "Okafor", "Pereira", "Quinn", "Rossi",
        "Santos", "Thorne", "Ueda", "Vargas", "Whitlock", "Yilmaz", "Zamora", "Bennett", "Cho",
        "Delgado", "Eriksen", "Farrow"]

# (city, region, country)
CITIES = [
    ("Miami", "FL", "USA"), ("Miami", "FL", "USA"), ("Orlando", "FL", "USA"), ("Tampa", "FL", "USA"),
    ("Fort Lauderdale", "FL", "USA"), ("Los Angeles", "CA", "USA"), ("Los Angeles", "CA", "USA"),
    ("San Diego", "CA", "USA"), ("New York", "NY", "USA"), ("New York", "NY", "USA"),
    ("Austin", "TX", "USA"), ("Dallas", "TX", "USA"), ("Chicago", "IL", "USA"),
    ("Charleston", "SC", "USA"), ("Nashville", "TN", "USA"), ("Atlanta", "GA", "USA"),
    ("Toronto", "ON", "CAN"), ("London", "", "GBR"), ("Amsterdam", "", "NLD"), ("Sydney", "", "AUS"),
]

CAPTIONS = {
    "fitness": [
        "Leg day fuelled by a cold energy drink and zero excuses. Full split in my stories.",
        "Tried three pre-workout powders this month so you don't have to. The caffeine in the second one was unreal.",
        "Protein shake taste test: vanilla, chocolate, and one I regret.",
        "Activewear try-on haul. These leggings passed the squat test.",
        "Six weeks of creatine: what changed and what didn't.",
        "Home gym tour. Everything fits in a spare bedroom.",
        "My 5am lifting routine and the sugar-free energy drink that gets me there.",
        "Mobility work nobody wants to do but everybody needs.",
        "Push pull legs explained for beginners in sixty seconds.",
    ],
    "running": [
        "Marathon training week nine. Long run done, legs gone.",
        "Tested four pairs of running shoes on the same 10K loop. Here's the ranking.",
        "Race day fuelling: gels, electrolytes and what I'd skip next time.",
        "Beginner 5K plan, three runs a week, no fancy watch needed.",
        "Rainy tempo run and the jacket that actually kept me dry.",
        "How I use a training app to stop running every run too fast.",
        "Carbon plate racing shoes: worth it for a first half marathon?",
        "Post-run recovery routine with a foam roller and a cold plunge.",
    ],
    "beauty": [
        "Full face using only drugstore makeup under twenty dollars.",
        "Get ready with me for a rooftop dinner. Soft glam, glossy lip.",
        "This cream blush is the only one that survives Miami humidity.",
        "Foundation wear test: twelve hours, no touch-ups.",
        "Lip oil versus lip gloss. I finally picked a side.",
        "Five-minute makeup for days you overslept.",
        "Bronzer placement that changed my whole face shape.",
        "Clean girl makeup but make it realistic.",
    ],
    "skincare": [
        "My morning skincare routine: vitamin C serum, moisturiser, SPF 50, done.",
        "Retinol for beginners. Start slow, thank me in three months.",
        "Watermelon glow toner review after a full bottle.",
        "Sunscreen that doesn't leave a white cast, tested on camera.",
        "Barrier repair routine after I overdid the exfoliating acids.",
        "Dermatologist-approved products I'd buy again.",
        "Night routine for dry skin when the heating is on.",
        "Is an expensive hyaluronic acid serum better than the cheap one? Blind test.",
    ],
    "hair": [
        "Heatless curls overnight with a silk ribbon. Results in the morning.",
        "Curly hair wash day from start to finish.",
        "Hair oil routine that fixed my split ends.",
        "Slick-back bun tutorial that stays put through a workout.",
        "I tried the viral blowout brush on thick hair.",
        "Going from box dye brunette to copper: the whole process.",
        "Three protective styles for a beach holiday.",
        "Scalp care is skincare. My weekly reset.",
    ],
    "fashion": [
        "Capsule wardrobe for autumn: twelve pieces, thirty outfits.",
        "Wedding guest dress try-on, all under a hundred dollars.",
        "How to style wide-leg denim three ways.",
        "Shapewear try-on under a fitted dress, honest review.",
        "Thrift haul. Everything here cost less than lunch.",
        "Outfit of the day for a gallery opening.",
        "Linen sets I'm packing for Europe.",
        "Office outfits that don't feel like a costume.",
    ],
    "streetwear": [
        "Sneaker rotation for the month. One pair is getting retired.",
        "Baggy cargos and a cropped hoodie, the only fit I need.",
        "Unboxing the collab drop everyone queued for.",
        "How to style a vintage football jersey without looking like a kid.",
        "Thrifted workwear jackets, ranked.",
        "Fit check before the show. Layers on layers.",
        "Cleaning white sneakers so they look new again.",
        "My top five caps and how they fit different head shapes.",
    ],
    "lifestyle": [
        "Sunday reset: laundry, meal prep, fresh sheets.",
        "Apartment tour, one year in. Small space, big windows.",
        "A slow morning with matcha and a book I can't put down.",
        "What I spend in a week living downtown.",
        "Weekend trip packing list for carry-on only.",
        "Hosting a dinner party for eight in a studio flat.",
        "Desk setup for working from home without back pain.",
        "Farmers market haul and what I cooked with it.",
    ],
    "wellness": [
        "Thirty days of reformer pilates. Before and after posture check.",
        "Morning yoga flow for stiff hips, ten minutes.",
        "My greens powder review after three months of daily use.",
        "Sleep routine: magnesium, no phone, lights out by ten.",
        "Cold plunge every morning for a month. Honest thoughts.",
        "Supplements I actually take, and the ones I stopped.",
        "Journaling prompts for anxious Sunday nights.",
        "Hot girl walk essentials and my electrolyte drink of choice.",
    ],
    "food": [
        "High-protein meal prep for the week in under an hour.",
        "The crispy rice salad I've made four times this week.",
        "Protein oats three ways, all under five minutes.",
        "Ranking every flavour of the sparkling energy drink in my fridge.",
        "One-pan salmon dinner with basically no washing up.",
        "Iced matcha at home that tastes like the cafe one.",
        "What I eat in a day while training for a half marathon.",
        "Budget grocery haul for two people.",
    ],
}

PAIRS = {  # plausible second niches
    "fitness": ["wellness", "food", "running", "streetwear", "lifestyle"],
    "running": ["fitness", "wellness", "food", "lifestyle"],
    "beauty": ["skincare", "hair", "fashion", "lifestyle"],
    "skincare": ["beauty", "wellness", "lifestyle"],
    "hair": ["beauty", "fashion", "lifestyle"],
    "fashion": ["beauty", "streetwear", "lifestyle", "hair"],
    "streetwear": ["fashion", "fitness", "lifestyle"],
    "lifestyle": ["fashion", "food", "wellness", "beauty"],
    "wellness": ["fitness", "food", "skincare", "lifestyle"],
    "food": ["lifestyle", "wellness", "fitness"],
}

TAGLINES = {
    "fitness": "Strength training, honest supplement reviews.",
    "running": "Road miles, race recaps and shoe tests.",
    "beauty": "Everyday makeup that survives real life.",
    "skincare": "Simple routines, no ten-step nonsense.",
    "hair": "Wash days, colour and heat-free styling.",
    "fashion": "Outfits you'll actually rewear.",
    "streetwear": "Sneakers, thrift finds and fit checks.",
    "lifestyle": "City living, small spaces, slow mornings.",
    "wellness": "Pilates, sleep and habits that stick.",
    "food": "High-protein cooking without the fuss.",
}

# Primary-niche weights lean toward the verticals the demo is about.
PRIMARY = (["fitness"] * 10 + ["beauty"] * 8 + ["fashion"] * 8 + ["skincare"] * 6 + ["running"] * 6 +
           ["hair"] * 5 + ["streetwear"] * 5 + ["wellness"] * 5 + ["lifestyle"] * 4 + ["food"] * 3)

PARTNERS = ["Marisol", "Jonah", "Bea", "Tariq", "Wren"]  # fictional talent partners

OTHER_MARKETS = ["United Kingdom", "Brazil", "India", "Canada", "Mexico", "Germany", "Australia", "Philippines"]

RELIABILITY = [
    "Delivered two days early on the last campaign.",
    "Hit every deadline so far.",
    "Needed one reminder on drafts; the final cut was on brief.",
    "Turns revisions around within 24 hours.",
    "Missed a posting date once in the spring, flagged it early and made it up.",
    "The brand asked to rebook after the last campaign.",
    "Slow to reply on weekends; plan approvals for weekdays.",
]
TERMS = [
    "Declines gifting-only offers.",
    "Open to 30-day paid usage.",
    "Open to whitelisting for a usage fee.",
    "Prefers 14 days' notice before a shoot.",
    "Happy to bundle stories with a reel.",
    "Will not take alcohol or gambling briefs.",
]
# (note, what it is about, caption text that makes the conflict plausible)
CONFLICTS = [
    ("Exclusive with an energy drink brand until March.", "energy drink", ["energy drink"]),
    ("Exclusive with a protein powder brand until February.", "protein powder", ["protein shake", "protein oats", "high-protein"]),
    ("Exclusive with a sunscreen brand until June.", "sunscreen spf", ["sunscreen", "spf"]),
    ("Non-compete with a running shoe brand through April.", "running shoe", ["running shoes", "racing shoes"]),
    ("Exclusive with a haircare brand until May.", "haircare hair oil", ["hair oil", "blowout brush", "curls"]),
    ("Exclusive with an activewear brand until January.", "activewear leggings", ["activewear", "leggings"]),
    ("Exclusive with a greens powder brand until April.", "greens powder supplement", ["greens powder", "supplements"]),
    ("Exclusive with a sneaker retailer until July.", "sneaker", ["sneaker"]),
    ("Exclusive with a makeup brand until March.", "makeup foundation blush", ["foundation", "blush", "makeup"]),
]
APPLICANT_STATUS = [
    "Applied through the form in October; profile reviewed, no call yet.",
    "Application reviewed: strong saves on tutorials, audience looks real.",
    "Second application; the first was below the reach bar.",
    "Applied last week; waiting on a profile review.",
]
PROSPECT_STATUS = [
    "Found while casting a {niche} brief; intro message sent.",
    "Replied to outreach and asked for a rate card.",
    "Intro call booked for next week.",
    "Spotted in a brand's tagged posts; not contacted yet.",
]


def build(n: int, seed: int) -> list[dict]:
    rnd = random.Random(seed)

    names = [(f, l) for f in FIRST for l in LAST]
    rnd.shuffle(names)
    # Exact shares rather than a coin flip per creator: 60% roster, 25% applicants, 15% prospects.
    n_roster, n_app = round(n * 0.60), round(n * 0.25)
    stages = ["roster"] * n_roster + ["applicant"] * n_app + ["prospect"] * (n - n_roster - n_app)
    rnd.shuffle(stages)

    creators = []
    for i in range(n):
        first, last = names[i]
        stage = stages[i]
        primary = rnd.choice(PRIMARY)
        niches = [primary]
        if rnd.random() < 0.6:
            niches.append(rnd.choice(PAIRS[primary]))
        city, region, country = rnd.choice(CITIES)

        # Log-uniform followers between 8K and 900K.
        followers = int(math.exp(rnd.uniform(math.log(8_000), math.log(900_000))))
        followers = round(followers, -2)
        # Smaller accounts tend to have higher engagement.
        base = 7.5 - 1.1 * math.log10(followers / 8_000) * 2.2
        engagement = round(max(1.2, base + rnd.uniform(-1.0, 1.0)), 1)
        # Reach is only loosely tied to followers: some small accounts out-reach big ones.
        reach = round(followers * math.exp(rnd.uniform(math.log(0.25), math.log(1.6))), -2)

        # Audience location is drawn on its own, not from where the creator lives.
        band = rnd.random()
        us = rnd.randint(55, 92) if band < 0.55 else rnd.randint(30, 54) if band < 0.85 else rnd.randint(6, 29)
        top = "United States" if us >= 45 else rnd.choice(OTHER_MARKETS)

        pool = list(CAPTIONS[primary])
        rnd.shuffle(pool)
        caps = pool[:4]
        if len(niches) > 1:
            second = list(CAPTIONS[niches[1]])
            rnd.shuffle(second)
            caps += second[:2]
        else:
            caps += pool[4:6]
        rnd.shuffle(caps)

        if stage == "roster":
            notes = [{"kind": "reliability", "text": rnd.choice(RELIABILITY)}]
        elif stage == "applicant":
            notes = [{"kind": "status", "text": rnd.choice(APPLICANT_STATUS)}]
        else:
            notes = [{"kind": "status", "text": rnd.choice(PROSPECT_STATUS).format(niche=primary)}]
        text = " ".join(caps).lower()
        possible = [c for c in CONFLICTS if any(t in text for t in c[2])]
        if possible and rnd.random() < 0.25:
            note, about, _ = rnd.choice(possible)
            notes.append({"kind": "conflict", "text": note, "about": about})
        elif rnd.random() < 0.6:
            notes.append({"kind": "terms", "text": rnd.choice(TERMS)})

        style = rnd.choice(["{f}{l}", "{f}.{l}", "with{f}", "{f}_{l}", "its{f}{l}"])
        handle = "@" + style.format(f=first.lower(), l=last.lower())
        cid = f"c{i + 1:03d}"
        on_roster = stage == "roster"
        creators.append({
            "id": cid,
            "name": f"{first} {last}",
            "handle": handle,
            "stage": stage,
            "partner": rnd.choice(PARTNERS) if on_roster else None,
            "campaigns": rnd.randint(1, 14) if on_roster else None,
            "niches": niches,
            "city": city,
            "region": region,
            "country": country,
            "followers": int(followers),
            "engagement": engagement,
            "recentReach": int(reach),
            "audience": {"us": us, "top": top},
            # Only roster creators have an agreed rate.
            "rate": int(max(150, round(reach * rnd.uniform(0.012, 0.03), -1))) if on_roster else None,
            "bio": f"{primary.capitalize()} creator in {city}. {TAGLINES[primary]}",
            "captions": caps,
            "notes": notes,
            # Filled by scripts/fetch_images.py. Empty means the UI draws placeholders.
            "images": [],
        })

    return creators


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=120)
    # The default seed was picked (out of the first few hundred) so the two demo briefs behave
    # differently: "fitness, energy drinks" fills from the roster with one conflict, and adding
    # "in Florida" leaves the roster thin enough that applicants and prospects appear.
    ap.add_argument("--seed", type=int, default=11)
    args = ap.parse_args()
    creators = build(args.n, args.seed)
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps(creators, indent=2))
    print(f"wrote {len(creators)} creators to {OUT}")


if __name__ == "__main__":
    main()
