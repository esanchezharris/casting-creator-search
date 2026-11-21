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

# Used for the gender filter and for the generated photos (scripts/media_prompts.py uses the same list).
MEN = {"Marcus", "Theo", "Julian", "Kai", "Mateo", "Andre", "Leo", "Omar", "Felix", "Devon"}

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

    creators = [creator(rnd, i, *names[i], stages[i]) for i in range(n)]
    creators += glam_wave(names[n:], n, seed)
    used = {c["name"] for c in creators}
    creators += headliners([x for x in names if f"{x[0]} {x[1]}" not in used], len(creators), seed)
    add_extra_posts(creators)
    add_reactions(creators)
    return creators


# The second wave. An agency like this one is mostly beauty, glam and fashion, and mostly
# women, and the first 120 leaned towards fitness. These 50 are drawn from their own random
# stream after the first 120, so nobody already in the data changes.
WAVE_PRIMARY = ["beauty"] * 26 + ["skincare"] * 7 + ["fashion"] * 7 + ["hair"] * 6  # the women, exactly
WAVE_PAIRS = {"beauty": ["skincare", "hair", "fashion"], "skincare": ["beauty"], "hair": ["beauty", "fashion"],
              "fashion": ["beauty", "hair", "lifestyle"]}
WAVE_STAGES = ["roster"] * 35 + ["applicant"] * 10 + ["prospect"] * 5
WAVE_MEN = 4
# Posts a man in this data would not plausibly have made; his captions are drawn from the rest.
MALE_AVOID = ("dress", "makeup", "glam", "bronzer", "blush", "lip", "foundation", "protective styles", "heatless", "shapewear",
              "blowout", "curly hair", "copper", "lash", "liner", "nails", "bridal", "bangs", "ballet", "handbag", "skin tint", "claw clip")
CAPTIONS_MORE = {
    "beauty": [
        "Soft glam for a wedding: the exact products and the order I use them.",
        "Red lip, nothing else. How to make it last through dinner.",
        "Winged liner on hooded eyes, the tape trick that finally worked.",
        "Trying the viral skin tint in four shades so you can find yours.",
        "My everyday makeup bag, emptied out. What earns its place.",
        "Lash extensions versus a good mascara: three weeks of each.",
        "Glam at 6am for a shoot. What long-wear actually means.",
        "Fresh set: almond nails in a milky pink, and how I make them last.",
    ],
    "skincare": [
        "Slugging for a week: what it did to my dry patches.",
        "Niacinamide and vitamin C together? What my skin did.",
        "Double cleansing after a full face of makeup, step by step.",
        "Empties: eight skincare products I finished and three I'd repurchase.",
        "LED mask, four weeks in. Honest before and after.",
        "Lip care routine for when matte lipstick has ruined everything.",
    ],
    "hair": [
        "Sleek blowout at home with one round brush.",
        "Bridal hair trial: three updos, one winner.",
        "Curtain bangs, cut at home. Brave or stupid, you decide.",
        "Gloss treatment at home: shine without the salon bill.",
        "Claw clip styles for second-day hair.",
        "Hair perfume and a satin pillowcase: small things that made a difference.",
    ],
    "fashion": [
        "Date night outfits, three budgets.",
        "The little black dress, styled four ways.",
        "Gold jewellery stack I wear every day, and what it cost.",
        "Trying the ballet flat trend with jeans, a skirt and tailoring.",
        "What I wore to fashion week, day by day.",
        "Handbag collection, ranked by how often I actually carry them.",
    ],
}
WAVE_CAPTIONS = {niche: caps + CAPTIONS_MORE.get(niche, []) for niche, caps in CAPTIONS.items()}


def glam_wave(names: list[tuple[str, str]], start: int, seed: int) -> list[dict]:
    rnd = random.Random(f"wave2-{seed}")
    women = [n for n in names if n[0] not in MEN][:len(WAVE_STAGES) - WAVE_MEN]
    men = [n for n in names if n[0] in MEN][:WAVE_MEN]
    people = women + men
    rnd.shuffle(people)
    stages = list(WAVE_STAGES)
    rnd.shuffle(stages)
    primaries = list(WAVE_PRIMARY)
    rnd.shuffle(primaries)
    out = []
    for k, (first, last) in enumerate(people):
        man = first in MEN
        out.append(creator(
            rnd, start + k, first, last, stages[k],
            primary_pool=["skincare", "fashion", "hair"] if man else [primaries.pop()],
            pairs={"skincare": ["fashion"], "fashion": ["lifestyle"], "hair": ["fashion"]} if man else WAVE_PAIRS,
            captions=WAVE_CAPTIONS, avoid=MALE_AVOID if man else ()))
    return out


# A third, small group: the roster's biggest glam names. High reach, all signed, and only the
# posts that show a finished look (scripts/media_prompts.py gives them a more polished style).
HEADLINER_PRIMARY = ["beauty"] * 5 + ["fashion"] * 2 + ["hair"]
HEADLINER_PAIRS = {"beauty": ["fashion", "hair"], "fashion": ["beauty"], "hair": ["beauty"]}
HEADLINER_CAPTIONS = {
    "beauty": [
        "Get ready with me for a rooftop dinner. Soft glam, glossy lip.",
        "Soft glam for a wedding: the exact products and the order I use them.",
        "Red lip, nothing else. How to make it last through dinner.",
        "Glam at 6am for a shoot. What long-wear actually means.",
        "Lash extensions versus a good mascara: three weeks of each.",
        "Fresh set: almond nails in a milky pink, and how I make them last.",
        "Foundation wear test: twelve hours, no touch-ups.",
        "Bronzer placement that changed my whole face shape.",
    ],
    "fashion": [
        "The little black dress, styled four ways.",
        "Date night outfits, three budgets.",
        "What I wore to fashion week, day by day.",
        "Gold jewellery stack I wear every day, and what it cost.",
        "Wedding guest dress try-on, all under a hundred dollars.",
        "Outfit of the day for a gallery opening.",
    ],
    "hair": [
        "Sleek blowout at home with one round brush.",
        "Gloss treatment at home: shine without the salon bill.",
        "Bridal hair trial: three updos, one winner.",
        "Claw clip styles for second-day hair.",
        "Hair perfume and a satin pillowcase: small things that made a difference.",
        "Going from box dye brunette to copper: the whole process.",
    ],
}


def headliners(names: list[tuple[str, str]], start: int, seed: int) -> list[dict]:
    rnd = random.Random(f"wave3-{seed}")
    women = [n for n in names if n[0] not in MEN][:len(HEADLINER_PRIMARY)]
    primaries = list(HEADLINER_PRIMARY)
    rnd.shuffle(primaries)
    return [creator(rnd, start + k, first, last, "roster", primary_pool=[primaries[k]], pairs=HEADLINER_PAIRS,
                    captions=HEADLINER_CAPTIONS, followers=(350_000, 900_000), reach=(0.9, 1.6))
            for k, (first, last) in enumerate(women)]


def creator(rnd: random.Random, i: int, first: str, last: str, stage: str, primary_pool: list[str] = PRIMARY,
            pairs: dict[str, list[str]] = PAIRS, captions: dict[str, list[str]] = CAPTIONS, avoid: tuple[str, ...] = (),
            followers: tuple[int, int] = (8_000, 900_000), reach: tuple[float, float] = (0.25, 1.6)) -> dict:
    """One creator. The order of the random draws here is what keeps a reseed identical."""
    if True:
        primary = rnd.choice(primary_pool)
        niches = [primary]
        if rnd.random() < 0.6:
            niches.append(rnd.choice(pairs[primary]))
        city, region, country = rnd.choice(CITIES)

        # Log-uniform followers between 8K and 900K.
        f_lo, f_hi = followers
        r_lo, r_hi = reach
        followers = int(math.exp(rnd.uniform(math.log(f_lo), math.log(f_hi))))
        followers = round(followers, -2)
        # Smaller accounts tend to have higher engagement.
        base = 7.5 - 1.1 * math.log10(followers / 8_000) * 2.2
        engagement = round(max(1.2, base + rnd.uniform(-1.0, 1.0)), 1)
        # Reach is only loosely tied to followers: some small accounts out-reach big ones.
        reach = round(followers * math.exp(rnd.uniform(math.log(r_lo), math.log(r_hi))), -2)

        # Audience location is drawn on its own, not from where the creator lives.
        band = rnd.random()
        us = rnd.randint(55, 92) if band < 0.55 else rnd.randint(30, 54) if band < 0.85 else rnd.randint(6, 29)
        top = "United States" if us >= 45 else rnd.choice(OTHER_MARKETS)

        pool = [c for c in captions[primary] if not any(a in c.lower() for a in avoid)]
        rnd.shuffle(pool)
        caps = pool[:4]
        if len(niches) > 1:
            second = [c for c in captions[niches[1]] if not any(a in c.lower() for a in avoid)]
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
        return {
            "id": cid,
            "name": f"{first} {last}",
            "handle": handle,
            "gender": "man" if first in MEN else "woman",
            # The same draw scripts/media_prompts.py makes first for this creator's look, so the
            # age on file is the age the photos were prompted with.
            "age": random.Random(f"media-{cid}").randint(22, 36),
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
            # Filled by scripts/apply_media.py. Empty means the UI draws placeholders.
            "images": [],
        }


# The two profiles the demo opens to show a longer history. Their extra posts are
# appended after everything else is drawn, so no other creator changes.
EXTRA_POSTS = {
    "Sofia Santos": ("wellness", [
        "Sunrise ocean swim, then coffee. The only alarm I don't snooze.",
        "Sunday meal prep: five lunches, one tray, forty minutes.",
        "Breathwork before a big meeting. Four counts in, six out.",
        "New reformer studio opened down the road. First class verdict.",
        "Balcony herb garden update: the basil survived.",
        "Coastal walk with my sister, twelve kilometres and one very good pastry.",
    ]),
    "Valentina Vargas": ("food", [
        "Sheet-pan chicken fajitas, 42 grams of protein a plate.",
        "Farmers market run for the week. Peaches are finally in.",
        "Cottage cheese pancakes. Stay with me on this one.",
        "Hot chicken at home, baked not fried, still crunchy.",
        "Sunday batch cook: turkey chili for the freezer.",
        "Testing the air fryer salmon bites everyone keeps sending me.",
    ]),
}


def add_extra_posts(creators: list[dict]) -> None:
    for c in creators:
        if c["name"] in EXTRA_POSTS:
            c["captions"] += EXTRA_POSTS[c["name"]][1]


# Top comments under each post, as a talent partner would see them on the
# profile. Fictional commenters; written per niche so they read like replies
# to that kind of post.
COMMENTS = {
    "fitness": ["ok this is the push I needed to go tonight", "form check please, do your knees track like that on purpose?",
                "saving this for monday", "the honesty about what didn't work >>>", "what's the rep range on these?",
                "you make 5am look reasonable and it is not", "tried this split for a month, can confirm", "link for the leggings??"],
    "running": ["week nine club, my legs feel this", "which loop is this? looks flat and I need flat", "the pacing tip changed my long runs",
                "needed to hear the no fancy watch part", "how are your knees holding up?", "signing up for my first 10K because of you",
                "that jacket in rain is a bold claim, reporting back", "what gels are you using now?"],
    "beauty": ["the placement tip, I've been doing it wrong for years", "shade name please!", "finally someone showing it after twelve hours",
               "this is the realistic version I needed", "did it crease under the eyes at all?", "adding to cart against my better judgement",
               "works on oily skin?", "the before and after is not even the same person"],
    "skincare": ["my barrier thanks you", "how long before you saw a difference?", "is this ok for sensitive skin?", "the white cast test is all I ever wanted",
                 "starting slow like you said, week two", "do you use it morning or night?", "this saved me from buying the expensive one",
                 "can you do one for combination skin?"],
    "hair": ["how long does it last on day two?", "the ribbon trick actually worked on my hair", "what size barrel is that?",
             "my split ends are listening", "colour formula please, taking this to my stylist", "does it work on fine hair too?",
             "wash day solidarity", "the shine!!"],
    "fashion": ["the third outfit is the one", "where are the trousers from?", "twelve pieces and I still can't do this", "wearing this to the office tomorrow",
                "need the sizing on the dress, I'm between two", "you make thrift finds look tailored", "the proportions are so good here",
                "saving for my Europe packing list"],
    "streetwear": ["the jersey with tailored trousers, noted", "what size are the cargos?", "retiring that pair is a crime", "the second jacket was robbed",
                   "did you queue or get lucky online?", "cap number three is the one", "how do you get them that white again?", "fit is clean"],
    "food": ["made this last night, zero leftovers", "what can I swap the salmon for?", "four times in a week is the only review I need",
             "the receipt jump scare", "how long does it keep in the fridge?", "protein count per portion?", "my flatmates thank you",
             "doing this for meal prep sunday"],
    "wellness": ["the no phone part is the hard part", "which magnesium do you take?", "thirty days and you can see it in your shoulders",
                 "did the cold ever get easier?", "trying the ten minute flow before work", "needed this on a sunday night",
                 "honest review of the greens, thank you", "this is so calming to watch"],
    "lifestyle": ["the windows!!", "how do you fit eight people in there?", "carry-on only is a personality at this point", "the weekly spend made me feel better about mine",
                  "desk link? my back needs it", "sunday reset is my favourite genre", "what book is it?", "the chair, where is it from?"],
}
COMMENTER_A = ["sun", "late", "salt", "north", "tiny", "plain", "slow", "citrus", "paper", "velvet", "ginger", "quiet", "lucky", "rain", "olive", "maple"]
COMMENTER_B = ["runs", "notes", "kitchen", "diaries", "studio", "lifts", "club", "edit", "daily", "house", "wears", "glow", "miles", "table", "files", "fits"]


def add_reactions(creators: list[dict]) -> None:
    """Likes and three top comments per post. Uses its own random stream per
    creator, so adding this did not change any other generated field."""
    niche_of = {cap: niche for niche, caps in CAPTIONS.items() for cap in caps}
    niche_of.update({cap: niche for niche, caps in EXTRA_POSTS.values() for cap in caps})
    niche_of.update({cap: niche for niche, caps in CAPTIONS_MORE.items() for cap in caps})
    for c in creators:
        # How many days ago each post went up. Its own stream too, and drawn first so the
        # order of a profile's posts has nothing to do with the order they were written in.
        days = random.Random(f"posted-{c['id']}")
        c["postDays"] = days.sample(range(1, 6 * len(c["captions"])), len(c["captions"]))
        rnd = random.Random(f"reactions-{c['id']}")
        c["reactions"] = []
        for cap in c["captions"]:
            likes = int(c["recentReach"] * c["engagement"] / 100 * rnd.uniform(0.6, 1.5))
            texts = rnd.sample(COMMENTS[niche_of[cap]], 3)
            c["reactions"].append({
                "likes": max(likes, 12),
                "comments": [
                    {"user": f"{rnd.choice(COMMENTER_A)}{rnd.choice(['', '.', '_'])}{rnd.choice(COMMENTER_B)}{rnd.choice(['', '', str(rnd.randint(2, 98))])}", "text": t}
                    for t in texts
                ],
            })


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
