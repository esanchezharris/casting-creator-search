"""Generate data/creators.json: fictional creators for the search demo.

Everything here is synthetic. Names, handles, stats and captions are invented;
images are placeholders until you run fetch_images.py.

    python3 scripts/seed.py            # 120 creators, deterministic
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


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=120)
    ap.add_argument("--seed", type=int, default=7)
    args = ap.parse_args()
    rnd = random.Random(args.seed)

    names = [(f, l) for f in FIRST for l in LAST]
    rnd.shuffle(names)
    creators = []
    for i in range(args.n):
        first, last = names[i]
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
        avg_views = round(followers * rnd.uniform(0.15, 0.6), -2)
        rate = max(150, round(followers * rnd.uniform(0.008, 0.02), -1))

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

        style = rnd.choice(["{f}{l}", "{f}.{l}", "with{f}", "{f}_{l}", "its{f}{l}"])
        handle = "@" + style.format(f=first.lower(), l=last.lower())
        cid = f"c{i + 1:03d}"
        creators.append({
            "id": cid,
            "name": f"{first} {last}",
            "handle": handle,
            "niches": niches,
            "city": city,
            "region": region,
            "country": country,
            "followers": int(followers),
            "engagement": engagement,
            "avgViews": int(avg_views),
            "rate": int(rate),
            "bio": f"{primary.capitalize()} creator in {city}. {TAGLINES[primary]}",
            "captions": caps,
            # Placeholder photos. Replace with scripts/fetch_images.py.
            "images": [f"https://picsum.photos/seed/{cid}-{k}/600/800" for k in range(5)],
        })

    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps(creators, indent=2))
    print(f"wrote {len(creators)} creators to {OUT}")


if __name__ == "__main__":
    main()
