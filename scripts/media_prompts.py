"""Write the image and clip prompts for every creator's photo set.

The photos and clips in public/creators/ are AI-generated stand-ins for the
fictional roster. This script is the record of how they were asked for:

  - each creator gets a look (age, heritage, hair, one distinguishing feature,
    build) drawn from pools with a per-creator seed, so no two are alike
  - five of their six post captions are illustrated; each caption has one
    hand-written scene below, so the photo beside a post matches its text
  - the first photo is a clear, well-lit portrait in the first scene; the
    other four reuse it as a face reference

What the batch taught, and what was done about it (20 Nov 2026):

  - The portrait prompts below went to Soul 2.0 and mostly failed. The words
    "Instagram post", "phone", "selfie" and "tripod" made it draw app chrome
    (username bars, borders, collages) onto the image, and any held product
    came out with garbled lettering. The four scene prompts, sent to Nano
    Banana Pro with a face reference, did not have these problems.
  - So every first photo was regenerated on Nano Banana Pro from the same
    scene and the same face, with wording that asks for one full-frame
    photograph, a relaxed expression, an ordinary plain top and blank
    packaging. Those are the 1.jpg files in public/creators/.
  - Scenes that were flagged on review (a second person in frame, a logo,
    a face that drifted, blotchy skin) were regenerated one by one with the
    prompt reworded for that flaw. The prompts in data/media_prompts.json are
    therefore the starting point, not a byte-exact record of every image.

    python3 scripts/media_prompts.py            # writes data/media_prompts.json
    python3 scripts/media_prompts.py --groups 6 OUTDIR   # also split into work files

Standard library only. Nothing here calls an API; the prompts were submitted
to Higgsfield by hand through its connector.
"""
import json
import random
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "creators.json"
OUT = ROOT / "data" / "media_prompts.json"

MEN = {"Marcus", "Theo", "Julian", "Kai", "Mateo", "Andre", "Leo", "Omar", "Felix", "Devon"}

# Heritage is only a prompt ingredient that keeps the roster varied and each
# face plausible next to its name. First names override surnames where given.
HERITAGE_LAST = {
    "Alvarez": "Mexican-American", "Brooks": "Black American", "Castillo": "Dominican-American",
    "Duarte": "Portuguese", "Ellis": "white British", "Fontaine": "French", "Greer": "white American",
    "Hayashi": "Japanese-American", "Ibarra": "Basque-Mexican", "Jensen": "Danish", "Kovac": "Croatian",
    "Laurent": "French-Caribbean", "Moreno": "Colombian", "Nakamura": "Japanese", "Okafor": "Nigerian-American",
    "Pereira": "Brazilian", "Quinn": "Irish-American", "Rossi": "Italian", "Santos": "Filipino",
    "Thorne": "white American", "Ueda": "Japanese-American", "Vargas": "Peruvian-American",
    "Whitlock": "white American", "Yilmaz": "Turkish", "Zamora": "Mexican", "Bennett": "Black British",
    "Cho": "Korean-American", "Delgado": "Puerto Rican", "Eriksen": "Norwegian", "Farrow": "white Australian",
}
HERITAGE_FIRST = {
    "Priya": "Indian", "Imani": "Black", "Andre": "Black", "Omar": "Lebanese", "Naomi": "Black",
    "Kai": "Hawaiian", "Devon": "Black", "Marcus": "Black", "Zoe": "Greek", "Kira": "Ukrainian",
    "Aria": "Persian", "Maya": "Indian", "Lena": "German", "Elena": "Spanish",
}

HAIR_DARK_F = ["long straight black hair with a middle part", "shoulder-length dark brown waves", "a sleek low bun with face-framing strands",
               "a blunt black bob", "long dark hair in a claw clip", "dark curtain bangs and a ponytail", "a dark wavy lob tucked behind one ear",
               "waist-length dark hair in a loose braid", "a short dark pixie cut", "dark hair with soft caramel highlights"]
HAIR_COILY_F = ["a rounded natural afro", "long box braids", "a tapered curly cut", "shoulder-length twists", "a high curly puff",
                "a slick bun with laid edges", "copper-tinted coils", "short bleached-blonde curls", "chunky cornrows into a low bun", "loose defined curls with a side part"]
HAIR_LIGHT_F = ["shoulder-length strawberry blonde hair", "a messy dark-blonde bun", "long light brown hair with a fringe", "a honey-blonde bob",
                "wavy auburn hair", "a copper red lob", "long ash-blonde hair in a low ponytail", "chestnut hair in a half-up clip",
                "a short platinum crop", "mousy brown shoulder-length hair with grown-out highlights"]
HAIR_DARK_M = ["short black hair with a low fade", "a dark textured crop", "wavy dark hair pushed back", "a buzz cut", "medium-length dark curls",
               "a dark mullet-ish shag", "slicked-back dark hair", "dark hair in a short ponytail"]
HAIR_COILY_M = ["a low fade with short coils", "short twists", "a clean bald fade", "a high-top fade", "shoulder-length locs tied back", "a short afro"]
HAIR_LIGHT_M = ["short sandy hair", "a light brown side part", "messy dirty-blonde hair", "a ginger crew cut", "wavy chestnut hair to the ears", "a shaved blonde buzz cut"]

COILY = {"Black", "Black American", "Black British", "Nigerian-American", "French-Caribbean", "Dominican-American"}
LIGHT = {"white British", "white American", "white Australian", "Danish", "Norwegian", "Irish-American", "German", "Ukrainian", "French", "Croatian"}

FEATURES_F = ["light freckles across the nose", "a small gold nose stud", "thin gold hoop earrings", "a beauty mark above the lip", "round wire glasses",
              "a slight gap between the front teeth", "deep dimples", "strong dark eyebrows", "a tiny septum ring", "a stack of ear piercings",
              "a faint scar through one eyebrow", "tortoiseshell glasses", "a dainty chain necklace she never takes off", "rosy cheeks and no makeup",
              "sharp winged eyeliner", "a small tattoo on the collarbone", "sun-kissed skin and peeling nose", "big expressive eyes and laugh lines"]
FEATURES_M = ["light stubble", "a full short beard", "a neat moustache", "a small silver hoop in one ear", "black-rimmed glasses", "a scar through one eyebrow",
              "deep dimples", "a thin gold chain", "a sunburnt nose", "a tattoo sleeve on one forearm", "a crooked easy grin", "clean-shaven with strong brows"]
BUILDS = {
    "fitness": ["athletic with defined shoulders", "strong and muscular", "lean and wiry", "solid and powerfully built"],
    "running": ["lean runner's build", "slim and long-limbed", "compact and wiry", "lean with strong calves"],
    "default": ["slim", "average build", "curvy", "petite", "tall and slender", "soft, full-figured", "medium athletic build", "broad-shouldered"],
}
PALETTES = ["black, grey and white", "earth tones: olive, rust and tan", "soft neutrals: cream, oat and beige", "navy and denim blue",
            "bright colour pops: cobalt and red", "pastels: lilac and butter yellow", "all-black with silver jewellery", "forest green and chocolate brown",
            "white and light blue", "burgundy and charcoal", "sage green and off-white", "washed vintage tones: faded red and mustard"]
HOMES = ["a small apartment with white walls and lots of plants", "a rented flat with wooden floors and mismatched vintage furniture",
         "a bright modern condo with big windows", "a cosy older apartment with warm lamps and a radiator", "a tidy minimalist studio with a low bed",
         "a lived-in house share with a cluttered kitchen", "a sunny ground-floor place with a tiled floor and a ceiling fan",
         "a loft with exposed brick and a clothing rail", "a suburban house with beige carpet and a big mirror", "a compact city studio with a pull-out desk"]
LIGHTS = ["soft overcast daylight", "warm golden-hour light", "bright midday sun with hard shadows", "cool early-morning light",
          "warm indoor lamp light at night", "flat window light on a grey day", "late-afternoon sun through blinds", "blue-hour dusk light"]

# One scene per caption. {home}, {city}, {palette} and {light} are filled per creator.
# Scenes say who is holding the camera, because that is most of what makes a
# phone photo look like a phone photo.
SCENES = {
    # Second-wave posts (CAPTIONS_MORE in scripts/seed.py).
    "Soft glam for a wedding: the exact products and the order I use them.": "sitting at a dressing table in {home} in a satin robe, soft glam makeup finished on one eye only, holding a fluffy blending brush near the other eye and glancing at the camera in the mirror's direction, an open unbranded eyeshadow palette and brushes laid in a row. Photo by a friend standing beside the table, {light}",
    "Red lip, nothing else. How to make it last through dinner.": "close portrait at a restaurant table by a window, bare skin, a precise matte red lip, hair tucked behind the ears, a plain black top, pressing a tissue lightly to the lips with a half-smile. Photo by a friend across the table, {light}",
    "Winged liner on hooded eyes, the tape trick that finally worked.": "close-up at a bathroom mirror in {home}, one eye with a sharp black winged liner and a small strip of clear tape still angled at the outer corner of the other eye, liquid liner pen held like a pencil, concentrating expression, hair clipped back. Bright vanity light",
    "Trying the viral skin tint in four shades so you can find yours.": "sitting by a window with four swatches of skin tint in slightly different shades striped along the jawline, holding four small plain unlabelled tubes fanned out in one hand, eyebrows raised at the camera. Photo by a flatmate, soft window light",
    "My everyday makeup bag, emptied out. What earns its place.": "sitting cross-legged on a bed in {home} with a small makeup bag tipped out in front: a compact, mascara, a lip pencil, a cream blush stick, all unbranded, holding the empty bag upside down and laughing, a plain jumper in {palette}. Photo by a friend from the end of the bed, {light}",
    "Lash extensions versus a good mascara: three weeks of each.": "tight portrait looking up and to one side so the eyelashes catch the light, long fluttery lashes, otherwise minimal makeup, holding a plain black mascara wand beside one eye, a plain white t-shirt. Photo by a friend, soft daylight from a window",
    "Glam at 6am for a shoot. What long-wear actually means.": "in a make-up chair in a dim studio corridor before dawn with full polished glam makeup already done, a hair clip still holding one section up, holding a paper coffee cup with no print and yawning into the back of one hand, a plain grey hoodie. Photo by a colleague, warm indoor lamp light",
    "Fresh set: almond nails in a milky pink, and how I make them last.": "holding both hands up beside the face to show a fresh set of almond-shaped milky pink nails, fingers relaxed, smiling at the camera, a simple ribbed top in {palette}, a cafe table and window out of focus behind. Photo by a friend across the table, {light}",
    "Slugging for a week: what it did to my dry patches.": "in a bathroom in {home} at night with a very shiny, dewy face from a thick layer of balm, hair in a towelling headband, holding a plain unlabelled tub of clear balm and scooping a little with one finger, an amused look. Mirror-side photo by a partner, warm bathroom light",
    "Niacinamide and vitamin C together? What my skin did.": "sitting at a desk by a window holding two small plain dropper bottles, one clear and one amber, one in each hand like scales, bare clean skin, a questioning half-smile, a plain cotton shirt in {palette}. Photo by a flatmate, {light}",
    "Double cleansing after a full face of makeup, step by step.": "at a bathroom sink in {home} with half the face covered in white cleanser foam and the other half still showing smudged mascara, hair tied up, sleeves pushed back, one eye open and grinning at the camera. Photo by a flatmate in the doorway, bright bathroom light",
    "Empties: eight skincare products I finished and three I'd repurchase.": "sitting on a living room floor in {home} behind a neat row of eight empty plain bottles, tubes and jars with no labels, holding three of them up against the chest, pleased expression, a soft jumper in {palette}. Photo by a friend sitting opposite, {light}",
    "LED mask, four weeks in. Honest before and after.": "sitting on a sofa in {home} holding a white LED face mask just lowered from the face in one hand, clean bare skin, hair pushed back with a soft headband, a relaxed look at the camera, a plain cotton pyjama shirt. Photo by a partner from the armchair, warm indoor lamp light at night",
    "Lip care routine for when matte lipstick has ruined everything.": "close portrait by a window applying a clear balm from a plain unlabelled tube to the lower lip with a fingertip, bare face, hair loosely tied, a plain cream t-shirt, a small smile. Photo by a friend, soft window light",
    "Sleek blowout at home with one round brush.": "in a bedroom in {home} mid blow-dry, a large round brush rolled under a smooth glossy section of hair, a plain hairdryer with no logo in the other hand, the rest of the hair sectioned with clips, a plain t-shirt, focused look at the camera. Photo by a flatmate, {light}",
    "Bridal hair trial: three updos, one winner.": "sitting in a salon chair with a soft low updo and a few loose face-framing strands, a hand touching the back of the hair, turning three-quarters to the camera with a hopeful smile, a plain button-up shirt, salon mirrors blurred behind. Photo by a friend, bright salon light",
    "Curtain bangs, cut at home. Brave or stupid, you decide.": "at a bathroom mirror in {home} with freshly cut curtain bangs, small hairdressing scissors held up in one hand and a few snipped strands on the sink edge, a nervous wide-eyed grin, a plain t-shirt. Photo by a flatmate in the doorway, bright bathroom light",
    "Gloss treatment at home: shine without the salon bill.": "standing by a bright window with very shiny freshly treated hair worn down, running one hand through the lengths so they catch the light, a plain fitted top in {palette}, looking at the camera over one shoulder. Photo by a friend, {light}",
    "Claw clip styles for second-day hair.": "in a hallway in {home} twisting the hair up at the back and fastening a large tortoiseshell claw clip, elbows up, looking sideways at the camera with a relaxed smile, a plain oversized shirt in {palette}. Photo by a flatmate, {light}",
    "Hair perfume and a satin pillowcase: small things that made a difference.": "sitting on a bed in {home} against a satin pillowcase in a soft colour, hair loose and smooth, holding a small plain glass spray bottle with no label near the ends of the hair, a plain cotton pyjama set, sleepy smile. Photo by a partner, warm indoor lamp light",
    "Date night outfits, three budgets.": "in a bedroom in {home} in a satin slip skirt, a fine knit top and low heels in {palette}, holding two more outfits on hangers out to one side, one eyebrow raised at the camera. Photo by a flatmate from the doorway, framed from the knees up, {light}",
    "The little black dress, styled four ways.": "on a city street in {city} at dusk in a simple knee-length black dress with a tailored blazer over the shoulders and small gold earrings, one hand adjusting the blazer, mid-laugh. Photo by a friend, framed from the waist up, {light}",
    "Gold jewellery stack I wear every day, and what it cost.": "close portrait with one hand raised to the collarbone showing stacked thin gold rings and a layered pair of fine gold necklaces, small gold hoops, a plain white shirt open at the collar, a calm direct look. Photo by a friend, soft window light",
    "Trying the ballet flat trend with jeans, a skirt and tailoring.": "sitting on a front step in {city} in straight jeans, a plain knit in {palette} and simple black ballet flats, one foot stretched out towards the camera, chin resting on one hand and smiling. Photo by a friend crouching on the pavement, framed from the knees up, {light}",
    "What I wore to fashion week, day by day.": "walking along a busy pavement in {city} in a long tailored coat over wide trousers in {palette}, sunglasses pushed up into the hair, a plain leather bag on the shoulder, glancing at the camera mid-stride, other people blurred behind. Photo by a friend walking backwards, framed from the waist up, {light}",
    "Handbag collection, ranked by how often I actually carry them.": "sitting on a bedroom floor in {home} with six plain leather handbags with no logos in different sizes lined up on a shelf behind, hugging the most worn-in one to the chest with a fond smile, a plain shirt in {palette}. Photo by a flatmate, {light}",
    "A slow morning with matcha and a book I can't put down.": "curled up on a sofa in {home}, holding a ceramic cup of matcha with both hands, a paperback open face-down on a blanket, oversized knit jumper, sleepy contented smile. Photo taken by a partner from the other end of the sofa, {light}",
    "Activewear try-on haul. These leggings passed the squat test.": "full-length mirror selfie in a bedroom in {home}, trying on a matching activewear set in {palette}, phone held at chest height, more folded sets and tissue paper on the bed behind",
    "Apartment tour, one year in. Small space, big windows.": "standing in the middle of {home} with arms slightly out as if presenting the room, barefoot, relaxed jeans and a tee, big window behind. Wide shot from a phone propped on a shelf, {light}",
    "Baggy cargos and a cropped hoodie, the only fit I need.": "on a city sidewalk in {city}, baggy cargo trousers and a cropped hoodie in {palette}, chunky sneakers, hands in pockets, mid-stride. Full-length photo taken by a friend crouching low, {light}",
    "Barrier repair routine after I overdid the exfoliating acids.": "close selfie in a bathroom mirror with slightly red, irritated cheeks, hair pulled back with a towelling headband, patting a thick plain white cream onto one cheek, unlabelled tubs on the sink edge. Harsh bathroom vanity light",
    "Beginner 5K plan, three runs a week, no fancy watch needed.": "jogging easily along a park path in {city}, plain cotton t-shirt and basic shorts, no watch, breathing hard and smiling. Shot from the side by a friend on a bike, slight motion blur, {light}",
    "Bronzer placement that changed my whole face shape.": "close-up at a vanity mirror sweeping bronzer under one cheekbone with a big fluffy brush, the other side of the face still bare for comparison, hair clipped back. Ring-light catchlights in the eyes but no ring light visible in frame",
    "Budget grocery haul for two people.": "standing at a kitchen counter in {home} with canvas bags of groceries tipped out: vegetables, eggs, rice, tins with blank labels, holding up a long paper receipt and pulling a mock-shocked face. Photo by a flatmate across the counter, flat overhead kitchen light",
    "Capsule wardrobe for autumn: twelve pieces, thirty outfits.": "standing beside a clothing rail holding twelve neatly spaced autumn pieces in {palette}: a trench, knitwear, denim, holding one hanger out towards the camera. Phone on a tripod, {light} from a bedroom window",
    "Carbon plate racing shoes: worth it for a first half marathon?": "sitting on a front step lacing up a pair of bright plain racing shoes with thick soles and no logos, race bib number pinned to a singlet, nervous half-smile up at the camera. Photo by a friend standing over them, cool early-morning light",
    "Clean girl makeup but make it realistic.": "bare-faced-looking selfie by a window, slicked-back hair, brushed-up brows, a visible blemish on the chin left uncovered, dabbing concealer with a fingertip, white tank top. Front-camera look, soft window light",
    "Cleaning white sneakers so they look new again.": "sitting cross-legged on a bathroom floor scrubbing a white sneaker with a toothbrush over a bowl of soapy water, the cleaned shoe gleaming beside the dirty one, sleeves pushed up. Top-down photo from a phone held overhead in the other hand",
    "Cold plunge every morning for a month. Honest thoughts.": "shoulders-deep in a galvanised steel tub of water with floating ice in a small backyard, gasping with wide eyes and gripping the rim, hair wet. Photo by a friend standing close, steam off the breath, cool early-morning light",
    "Curly hair wash day from start to finish.": "in a bathroom with soaking wet curls, scrunching product in with both hands, head tilted, an old t-shirt over the shoulders as a towel, plain unlabelled bottles lined on the bath edge. Mirror selfie with the phone propped on the sink",
    "Dermatologist-approved products I'd buy again.": "holding four plain white and amber skincare bottles with blank labels fanned out in both hands next to the face, slightly raised eyebrows, clean bare skin, sitting on the edge of a bed in {home}. Tripod phone shot, {light}",
    "Desk setup for working from home without back pain.": "sitting very upright at a home desk in {home} with a laptop on a riser, separate keyboard, a lumbar cushion on the chair, turning to grin at the camera over one shoulder. Photo from a phone propped on a bookshelf behind, {light}",
    "Farmers market haul and what I cooked with it.": "at an outdoor farmers market in {city} holding a paper bag overflowing with tomatoes and herbs, tote bag on the shoulder, laughing with a stallholder out of focus behind. Candid photo by a friend, bright midday sun",
    "Fit check before the show. Layers on layers.": "outside a music venue at night in {city}, layered outfit in {palette}: jacket over hoodie over long tee, wide trousers, lit by hard on-camera flash, queue blurred behind, deadpan look into the lens. Flash photo with grain",
    "Five-minute makeup for days you overslept.": "doing mascara in the rear-view mirror of a parked car, hair still damp, coffee cup in the holder, one eye done, mouth slightly open in concentration. Photo taken from the passenger seat by a friend, flat grey daylight",
    "Foundation wear test: twelve hours, no touch-ups.": "tired end-of-day close selfie in a hallway, pointing at the nose and chin where foundation has worn patchy, slight shine on the forehead, work clothes, bag still on the shoulder. Front-camera look under warm hallway light",
    "Full face using only drugstore makeup under twenty dollars.": "sitting on a bedroom floor in front of a propped mirror with a small pile of cheap plain makeup compacts and tubes with no logos on a towel, applying lipstick, half-finished face. Phone on a low tripod, {light}",
    "Get ready with me for a rooftop dinner. Soft glam, glossy lip.": "final look on a rooftop terrace at dusk in {city}, soft glam makeup and a glossy lip, satin slip dress or a sharp open-collar shirt in {palette}, string lights and skyline blurred behind, glancing off camera. Photo by a friend, blue-hour light with warm bulbs",
    "Going from box dye brunette to copper: the whole process.": "in a salon chair with a black cape on, half the head in foils and the uncovered half a fresh bright copper, pulling an excited nervous face at the mirror. Photo taken over the shoulder into the salon mirror, bright salon lighting",
    "Hair oil routine that fixed my split ends.": "warming a few drops of hair oil between the palms with the ends of the hair pulled forward over one shoulder, small amber dropper bottle with a blank label on the dresser, towel robe. Mirror photo in a bedroom, {light}",
    "Heatless curls overnight with a silk ribbon. Results in the morning.": "just woken up in bed, unwinding a silk ribbon from the hair with one bouncy finished curl already released, sleepy squint, pyjama top, rumpled white bedding. Front-camera selfie in soft morning light",
    "High-protein meal prep for the week in under an hour.": "at a kitchen counter in {home} with ten glass meal-prep containers lined up filled with chicken, rice and greens, spooning into the last one, tea towel over the shoulder. Photo from a phone propped on the windowsill, {light}",
    "Home gym tour. Everything fits in a spare bedroom.": "standing in a spare-bedroom home gym with a squat stand, adjustable dumbbells and rubber floor tiles, one hand on the rack, proud grin, gym shorts and a worn tee. Wide phone shot from the doorway, late-afternoon sun through blinds",
    "Hosting a dinner party for eight in a studio flat.": "squeezing past a long improvised table in a tiny studio carrying a big serving dish, mismatched chairs, candles, friends' hands and glasses at the frame edges, laughing. Candid photo by a guest, warm candle and lamp light",
    "Hot girl walk essentials and my electrolyte drink of choice.": "power-walking on a sunny path in {city} in bike shorts, an oversized tee and a cap, wired earphones in, holding a clear bottle of pale pink drink. Selfie at arm's length mid-stride, bright sun, slight motion blur",
    "How I use a training app to stop running every run too fast.": "stopped mid-run on a quiet street, hands on hips, sweaty, looking down at a phone in an armband with a rueful smile, simple running kit. Photo by a running partner a few steps ahead, {light}",
    "How to style a vintage football jersey without looking like a kid.": "full-length mirror selfie in a hallway wearing an oversized vintage striped football jersey with no crest, tailored trousers and loafers, a chain, phone held low at the hip, shoes lined along the wall. Warm lamp light",
    "How to style wide-leg denim three ways.": "standing in a bedroom in wide-leg jeans with a tucked white shirt, two alternative tops laid out on the bed behind, turning sideways to show the leg shape. Phone on a tripod, full length, {light}",
    "I tried the viral blowout brush on thick hair.": "in a bathroom with half the hair smooth and voluminous and the other half still frizzy and clipped up, holding a plain round hot-air brush with no logo, sceptical sideways look at the mirror. Mirror selfie, steamy mirror edges",
    "Iced matcha at home that tastes like the cafe one.": "close selfie in a kitchen holding a tall glass of iced matcha with a swirl of milk near the cheek, eyebrows raised, pleased, whisk and bowl out of focus on the counter. Front-camera look, soft afternoon window light",
    "Is an expensive hyaluronic acid serum better than the cheap one? Blind test.": "sitting at a table with eyes closed and a sleep mask pushed up on the forehead, a friend's hand holding out two unlabelled dropper bottles, one drop of serum on each cheek. Photo across the table, {light}",
    "Journaling prompts for anxious Sunday nights.": "sitting cross-legged on a bed in {home} in a big sweatshirt writing in a notebook, mug of tea on the bedside table, lamp on, hair in a loose bun, looking down. Photo from the foot of the bed by a phone propped on a chair, warm lamp light at night",
    "Leg day fuelled by a cold energy drink and zero excuses. Full split in my stories.": "sitting on the end of a leg-press machine in a commercial gym between sets, drenched, holding a plain matte slim can with no branding against one knee, exhausted grin. Photo by a training partner, overhead gym lighting",
    "Linen sets I'm packing for Europe.": "kneeling on the floor beside an open suitcase folding a linen shirt, three linen sets in {palette} laid flat on the bed above, passport and sunglasses on top. Photo from above by a phone held up high, {light}",
    "Lip oil versus lip gloss. I finally picked a side.": "extreme close selfie of the lower face and one eye, applying a clear plain lip oil wand to one half of the lips while the other half has a pink gloss, slight smirk. Front-camera look, bright window light, visible skin texture",
    "Marathon training week nine. Long run done, legs gone.": "lying flat on the back on a living-room floor in running kit after a long run, legs up on the sofa, salt marks on the cap, empty bottle beside the head, eyes shut and laughing. Photo from above by a partner, {light}",
    "Mobility work nobody wants to do but everybody needs.": "on a yoga mat in a park in {city} holding a deep hip-opening lunge stretch, long-sleeve tee and joggers, concentrating with eyes down, joggers blurred on the path behind. Full-body photo by a friend, hazy morning light",
    "Morning yoga flow for stiff hips, ten minutes.": "in a low lunge with arms overhead on a mat in the living room of {home}, loose top and leggings in {palette}, eyes closed, a plant and a floor lamp behind. Side-on photo from a phone propped on the floor, cool early-morning light",
    "My 5am lifting routine and the sugar-free energy drink that gets me there.": "in a dim kitchen before dawn in a hoodie with hair still messy, holding a plain unbranded matte white slim can beside the face with one eyebrow up, gym bag on the counter, dark window behind. Front-camera selfie, warm under-cabinet light",
    "My greens powder review after three months of daily use.": "at a kitchen counter stirring a glass of murky green drink with a long spoon, an unlabelled matte pouch beside it, pulling a not-quite-convinced face at the glass. Photo by a flatmate across the counter, {light}",
    "My morning skincare routine: vitamin C serum, moisturiser, SPF 50, done.": "fresh-faced in a bathroom with a headband on, pressing a dropper of orange-tinted serum to one cheek, three plain bottles lined up in order on the shelf. Mirror selfie with phone partly in frame, bright morning bathroom light",
    "My top five caps and how they fit different head shapes.": "sitting cross-legged on a bedroom floor surrounded by five plain baseball caps in different colours with no logos, wearing one backwards and holding another up, grinning. Photo from slightly above by a friend, soft window daylight",
    "Night routine for dry skin when the heating is on.": "in pyjamas beside a radiator at night, face shiny with a thick layer of balm, a small humidifier puffing mist on the bedside table, patting the cheeks with both hands. Mirror selfie in dim warm lamp light",
    "Office outfits that don't feel like a costume.": "full-length mirror selfie in an office lift lobby wearing relaxed tailoring in {palette}: wide trousers, a knit polo, clean sneakers, lanyard tucked in a pocket, coffee in one hand. Cool overhead office lighting",
    "One-pan salmon dinner with basically no washing up.": "in the kitchen of {home} holding a cast-iron pan of roasted salmon and greens with a tea towel, apron on, sleeves pushed up, warm smile at the camera, lemon halves on the board. Photo by a friend at arm's length, soft side light from a window",
    "Outfit of the day for a gallery opening.": "standing in a white-walled gallery in {city} beside a large abstract canvas, a sharp monochrome outfit in {palette} with one statement accessory, plastic cup of wine in hand, other guests blurred behind. Photo by a friend, even gallery spotlights",
    "Post-run recovery routine with a foam roller and a cold plunge.": "on a living-room floor in running shorts rolling one calf on a foam roller, wincing and laughing, running shoes kicked off beside, hair damp. Photo by a partner from the sofa, {light}",
    "Protein oats three ways, all under five minutes.": "leaning over a kitchen counter assembling three jars of oats topped with berries, banana and peanut butter, spoon in hand, looking up mid-laugh, crumbs on the counter. Photo from slightly above by a friend, bright morning window light",
    "Protein shake taste test: vanilla, chocolate, and one I regret.": "sitting on a gym floor with three plain unlabelled shaker bottles lined up, grimacing after a sip from the third, oversized tee over shorts. Photo from slightly above by a friend, daylight from big gym windows",
    "Push pull legs explained for beginners in sixty seconds.": "standing in a gym free-weights area talking straight to the camera, counting off three on the fingers, towel over one shoulder, dumbbell rack behind. Tripod phone shot at chest height, waist-up, overhead gym lighting",
    "Race day fuelling: gels, electrolytes and what I'd skip next time.": "just past a race finish line wrapped in a foil blanket with a finisher medal on, holding up two torn plain gel sachets, salt-streaked and elated, crowd barriers blurred behind. Photo by a friend, flat overcast daylight",
    "Rainy tempo run and the jacket that actually kept me dry.": "running towards the camera on a wet city street in {city} in a lightweight running jacket beaded with rain, hood down, hair plastered, grinning, puddle splash at the feet. Photo by a friend under an awning, grey rainy light",
    "Ranking every flavour of the sparkling energy drink in my fridge.": "crouching in front of an open fridge with a row of plain slim cans in different solid colours and no branding on the shelf, holding two up and weighing them, lit by the fridge light. Photo by a flatmate from the side in a dim kitchen",
    "Retinol for beginners. Start slow, thank me in three months.": "sitting on a bed in a robe holding up a pea-sized dot of cream on one fingertip towards the camera, the fingertip sharp and the face slightly soft behind, small plain tube in the other hand. Front-camera look, warm lamp light",
    "Scalp care is skincare. My weekly reset.": "leaning over a bathroom sink with hair sectioned by clips, applying an oil along the parting with a nozzle bottle, a silicone scalp brush on the sink edge. Mirror selfie from the side, bright bathroom light",
    "Shapewear try-on under a fitted dress, honest review.": "full-length mirror selfie in a bedroom in a fitted knee-length knit dress in {palette}, one hand smoothing the fabric at the waist, turned three-quarters, an open delivery box and tissue paper on the bed behind. {light}",
    "Six weeks of creatine: what changed and what didn't.": "flexing one arm half-jokingly in a gym changing-room mirror, phone in the other hand, sweaty post-workout, gym bag and a plain white supplement tub on the bench behind. Mirror selfie under cool fluorescent light",
    "Sleep routine: magnesium, no phone, lights out by ten.": "sitting up in bed in {home} in soft pyjamas, a glass of water and a small plain supplement jar on the nightstand, phone face-down, reaching to switch off a bedside lamp, sleepy half-smile. Photo from the doorway, dim warm lamp light",
    "Slick-back bun tutorial that stays put through a workout.": "mid-jump-rope in a gym with a perfectly smooth slick-back bun, shot from behind and to the side so the bun is the focus, face in profile, sports top. Photo by a friend, slight motion blur on the rope, overhead gym lighting",
    "Sneaker rotation for the month. One pair is getting retired.": "sitting on a hallway floor with six pairs of sneakers with no logos lined up against the wall, holding the most battered pair up by the laces with a sad face. Photo from standing height by a flatmate, {light}",
    "Sunday reset: laundry, meal prep, fresh sheets.": "shaking a fresh white duvet cover out over a bed in {home}, mid-air billow, laundry basket on the floor, hair tied up, old t-shirt and shorts. Photo from the doorway by a phone propped on a dresser, bright midday light",
    "Sunscreen that doesn't leave a white cast, tested on camera.": "outdoors in direct sun with two stripes of sunscreen on one cheek half rubbed in, holding a plain white tube with no label, squinting one eye. Close front-camera selfie, bright midday sun, visible skin texture",
    "Supplements I actually take, and the ones I stopped.": "at a kitchen table with a weekly pill organiser open and five plain amber jars with blank labels, pushing two of the jars away with the back of the hand, wry look at the camera. Tripod phone shot across the table, {light}",
    "Tested four pairs of running shoes on the same 10K loop. Here's the ranking.": "sitting on a kerb beside a running path with four pairs of muddy running shoes with no logos lined up in ranked order, sweaty, pointing at the winner. Photo by a friend from standing height, {light}",
    "The crispy rice salad I've made four times this week.": "holding a big bowl of crispy rice salad with herbs and chilli up towards the camera with both hands, fork stuck in, mouth full and laughing, kitchen of {home} behind. Photo by a friend, close and slightly wide-angle, {light}",
    "Thirty days of reformer pilates. Before and after posture check.": "mid-movement on a reformer pilates machine in a bright studio, long lines, grippy socks, set in {palette}, concentrating, other reformers in a row behind. Photo by an instructor from the side, soft daylight from tall windows",
    "This cream blush is the only one that survives Miami humidity.": "outdoors on a humid sunny street with palm trees, dabbing cream blush high on one cheek with two fingers, dewy slightly sweaty skin, baby hairs curling, small plain compact in the other hand. Close front-camera selfie, hot midday sun",
    "Three protective styles for a beach holiday.": "on a beach in a swimsuit cover-up with hair in fresh neat braids gathered into a high bun, turning the head to show the back and side, sea and sand behind. Photo by a friend, bright sun, wind in the fabric",
    "Thrift haul. Everything here cost less than lunch.": "sitting on a bedroom floor in {home} surrounded by thrifted clothes spilling out of plastic bags, holding a patterned shirt up against the chest and beaming. Photo from above by a phone on a tripod, {light}",
    "Thrifted workwear jackets, ranked.": "inside a crowded thrift store holding up two worn canvas workwear jackets on hangers, one in each hand, weighing them up with a sceptical face, packed racks behind. Candid photo by a friend, fluorescent shop lighting",
    "Tried three pre-workout powders this month so you don't have to. The caffeine in the second one was unreal.": "at a small kitchen counter with three plain unlabelled tubs of powder and a scoop, holding a shaker and staring wide-eyed and jittery at the camera, hoodie on. Front-camera selfie, flat overhead kitchen light, cluttered fridge behind",
    "Unboxing the collab drop everyone queued for.": "sitting on a bed tearing open a plain matte black shoebox with tissue paper flying, mouth open mid-shout, one unbranded sneaker in {palette} half lifted out. Photo by a friend from the foot of the bed, on-camera flash",
    "Watermelon glow toner review after a full bottle.": "holding an empty clear bottle with a pale pink tint and no label upside down next to a glowing bare cheek, shaking out the last drop, towel turban on. Mirror selfie in a bathroom, soft morning light",
    "Wedding guest dress try-on, all under a hundred dollars.": "full-length mirror selfie in a bedroom in a midi wedding-guest dress in {palette}, three more dresses on hangers on the wardrobe door behind, barefoot, tags still attached. {light}",
    "Weekend trip packing list for carry-on only.": "sitting on a closed overstuffed carry-on suitcase trying to zip it, laughing, rolled clothes and a toiletry bag still on the bed, hallway of {home}. Photo by a partner from the doorway, {light}",
    "What I eat in a day while training for a half marathon.": "sitting on front-porch steps in running clothes after a long run, flushed, eating from a bowl of rice, eggs and avocado, shoes unlaced, water bottle beside. Candid photo by a friend, warm golden-hour light",
    "What I spend in a week living downtown.": "walking out of a corner shop in downtown {city} with a paper bag in one arm, checking a banking app on the phone with a wince, coat in {palette}, traffic and shopfronts blurred behind. Candid photo by a friend across the pavement, {light}",
}

# What should move in a five-second clip, by the creator's first niche.
CLIP_MOTION = {
    "fitness": "They shake out their arms, laugh, say a few words to the camera and nod towards the weights.",
    "running": "They catch their breath, wipe their forehead, laugh and say a few words to the camera.",
    "food": "They tilt the dish towards the camera, steam rising, grin and say a few words.",
    "beauty": "They turn their face side to side to show the makeup, then smile and say a few words to the camera.",
    "skincare": "They pat their cheek gently, lean in towards the camera and say a few words, smiling.",
    "hair": "They run a hand through their hair, shake it out, and say a few words to the camera.",
    "fashion": "They do a small turn to show the outfit, adjust a sleeve and smile at the camera.",
    "streetwear": "They shift their weight, tug the jacket straight, nod at the camera and smirk.",
    "wellness": "They take a slow breath, relax their shoulders, smile and say a few quiet words to the camera.",
    "lifestyle": "They look around the room, laugh, and say a few words to the camera.",
}

MALE_SKIP = ("dress", "makeup", "glam", "bronzer", "blush", "lip", "foundation", "protective styles", "heatless", "shapewear", "blowout", "curly hair", "copper",
             "lash", "liner", "nails", "bridal", "bangs", "ballet", "handbag", "skin tint", "claw clip")


def look(c: dict, rng: random.Random) -> dict:
    first, last = c["name"].split(" ")
    man = first in MEN
    heritage_last = HERITAGE_LAST[last]
    heritage = HERITAGE_FIRST.get(first)
    if heritage and heritage.split("-")[0] not in heritage_last:
        heritage = f"mixed {heritage} and {heritage_last}"
    else:
        heritage = heritage_last
    coily = any(h in heritage for h in ("Black", "Nigerian", "Caribbean", "Dominican"))
    light = heritage in LIGHT
    pool = (HAIR_COILY_M if coily else HAIR_LIGHT_M if light else HAIR_DARK_M) if man else \
           (HAIR_COILY_F if coily else HAIR_LIGHT_F if light else HAIR_DARK_F)
    niche = c["niches"][0]
    return {
        "man": man,
        "age": rng.randint(22, 36),
        "heritage": heritage,
        "hair": rng.choice(pool),
        "feature": rng.choice(FEATURES_M if man else FEATURES_F),
        "build": rng.choice(BUILDS.get(niche, BUILDS["default"])),
        "palette": rng.choice(PALETTES),
        "home": rng.choice(HOMES),
    }


def polish(c: dict) -> str:
    """Small accounts look like phone snapshots; big ones are still candid but better lit."""
    if c["followers"] < 50_000:
        return "Amateur phone photo, slightly off-centre framing, a little grain, nothing styled."
    if c["followers"] < 300_000:
        return "Casual phone photo that looks like a real Instagram post, natural and unposed."
    return "Well-composed but still candid creator photo, looks like a real Instagram post and not an advert."


def build(c: dict) -> dict:
    rng = random.Random(f"media-{c['id']}")
    who = look(c, rng)
    noun, pron = ("man", "his") if who["man"] else ("woman", "her")
    person = (f"a {who['age']}-year-old {who['heritage']} {noun}, {who['hair']}, {who['feature']}, {who['build']}")

    # Illustrate five of the six posts. For men, pass over the posts whose scene would not fit, when there is a choice.
    # Only the six seeded posts. The extra posts two profiles carry (EXTRA_POSTS in seed.py)
    # were prompted by hand with the same wording, as photos 6 to 11.
    order = list(range(min(6, len(c["captions"]))))
    rng.shuffle(order)
    if who["man"]:
        order.sort(key=lambda i: any(k in c["captions"][i].lower() for k in MALE_SKIP))
    chosen = order[:5]
    # Lead with a scene where the face is easy to see: not a mirror, back or top-down shot.
    hard = ("mirror", "from behind", "top-down", "from above", "close-up", "extreme close", "eyes closed", "lying flat")
    chosen.sort(key=lambda i: any(k in SCENES[c["captions"][i]].lower() for k in hard))

    def scene(i: int) -> str:
        return SCENES[c["captions"][i]].format(
            home=who["home"], city=c["city"], palette=who["palette"], light=rng.choice(LIGHTS))

    tail = (f"{polish(c)} Natural skin texture with visible pores, no retouching, no beauty filter. "
            "Ordinary rectangular frame. No brand logos, no readable text, no watermark.")
    # The second wave (c121 on) was generated after the first batch's lessons, so its prompts say them outright.
    if int(c["id"][1:]) > 120:
        tail += (" One single full-frame photograph, not a screenshot, no border, no collage. Clothing is plain with no lettering. "
                 "All packaging and bottles are completely blank. Fully and modestly dressed.")
    hero = (f"Photo of {person}: {scene(chosen[0])}. The face is clearly visible, evenly lit, turned towards the camera "
            f"and not hidden by a hat brim, hands, hair or shadow. Frame this one from the waist up, whatever the "
            f"framing described above. {tail}")
    scenes = [
        (f"The same {noun} as in the reference image: identical face, skin tone, hair colour and {who['feature']}. "
         f"New photo, different outfit: {scene(i)}. {tail}")
        for i in chosen[1:]
    ]
    clip = (f"Handheld phone video, real-time speed, slight camera sway, no cuts. {CLIP_MOTION[c['niches'][0]]} "
            "Natural small movements. Ambient room sound and a few indistinct words, no music.")
    return {"id": c["id"], "name": c["name"], "posts": chosen, "hero": hero, "scenes": scenes, "clip": clip, "look": person}


def main() -> None:
    creators = json.loads(DATA.read_text())
    missing = sorted({cap for c in creators for cap in c["captions"][:6]} - set(SCENES))
    if missing:
        sys.exit("No scene written for: " + "; ".join(missing))
    plans = [build(c) for c in creators]
    OUT.write_text(json.dumps(plans, indent=1, ensure_ascii=False) + "\n")
    print(f"wrote {len(plans)} prompt plans to {OUT.relative_to(ROOT)}")
    if "--groups" in sys.argv:
        n = int(sys.argv[sys.argv.index("--groups") + 1])
        out = Path(sys.argv[sys.argv.index("--groups") + 2])
        skip = set(sys.argv[sys.argv.index("--skip") + 1].split(",")) if "--skip" in sys.argv else set()
        clips = set(sys.argv[sys.argv.index("--clips") + 1].split(",")) if "--clips" in sys.argv else set()
        todo = [dict(p, want_clip=p["id"] in clips) for p in plans if p["id"] not in skip]
        out.mkdir(parents=True, exist_ok=True)
        for g in range(n):
            (out / f"group{g + 1}.json").write_text(json.dumps(todo[g::n], indent=1, ensure_ascii=False))
        print(f"split {len(todo)} creators into {n} groups in {out}")


if __name__ == "__main__":
    main()
