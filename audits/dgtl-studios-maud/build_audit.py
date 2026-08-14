#!/usr/bin/env python3
"""Build the DGTL Partner-Fit Audit HTML for the 20 Maud studio venture."""
import html as H
import os

BASE = os.path.dirname(os.path.abspath(__file__))
CSS = open(os.path.join(BASE, 'audit-base.css'), encoding='utf-8').read()
LOGO = open(os.path.join(BASE, 'logo_dgtl.txt'), encoding='utf-8').read().strip()
SPARK = open(os.path.join(BASE, 'logo_spark.txt'), encoding='utf-8').read().strip()

CSS = CSS.replace(
    'content: "DGTL Group · Digital Presence Audit · CLIENT NAME";',
    'content: "DGTL Group · Partner-Fit Audit · 20 Maud Studio Venture";')

EXTRA_CSS = """
  /* ---------- partner-fit additions ---------- */
  .tree { margin: 0 0 14px 0; }
  .tree-row { display: flex; margin-bottom: 8px; }
  .node {
    flex: 1; border: 1px solid #2a2a2a; border-radius: 12px;
    background: #0a0a0a; padding: 9px 11px; margin-right: 7px;
  }
  .node:last-child { margin-right: 0; }
  .node.money { border-color: #F0CF50; }
  .node.empty { border-style: dashed; border-color: #4a4a4a; background: #060606; }
  .node .nt {
    font-size: 7pt; text-transform: uppercase; letter-spacing: .13em;
    color: #b3a06a; font-weight: 800; margin-bottom: 4px;
  }
  .node.empty .nt { color: #6f6f6f; }
  .node .nb { font-size: 8pt; color: #D0D0D0; line-height: 1.4; }
  .node .nb strong { color: #F0F0F0; }
  .legend { font-size: 7.2pt; color: #6f6f6f; letter-spacing: .04em; margin: 0 0 14px 0; }
  .legend .sw { color: #F0CF50; font-weight: 700; }
  .fit {
    border: 1px solid #2a2a2a; border-radius: 16px; background: #0a0a0a;
    padding: 12px 15px; margin: 0 0 10px 0; page-break-inside: avoid;
  }
  .fit .fh { margin-bottom: 6px; }
  .fit .fn { font-size: 10pt; font-weight: 700; color: #F0F0F0; }
  .rate {
    display: inline-block; font-size: 6.5pt; font-weight: 800;
    text-transform: uppercase; letter-spacing: .13em;
    padding: 2.5px 9px; border-radius: 9999px; margin-left: 8px; vertical-align: 1.5px;
  }
  .r-strong { background: #F0CF50; color: #000; border: 1px solid #F0CF50; }
  .r-gated  { background: rgba(240,207,80,0.08); color: #F0CF50; border: 1px solid #F0CF50; }
  .r-no     { background: transparent; color: #8a8a8a; border: 1px solid #2a2a2a; }
  .fit p { font-size: 8.3pt; margin-bottom: 5px; }
  .fit p:last-child { margin-bottom: 0; }
  .fit .ev { font-size: 7.4pt; color: #8a8a8a; }
  .fit .ev b { color: #b3a06a; font-weight: 700; letter-spacing: .06em;
               text-transform: uppercase; font-size: 6.8pt; }
"""

SEV = {'crit': ('Critical', 'b-crit'), 'high': ('High', 'b-high'),
       'med': ('Medium', 'b-med'), 'low': ('Low', 'b-low')}


def finding(fid, sev, title, obs, ev, impact, rec, effort, owner, note=None):
    label, cls = SEV[sev]
    n = (f'<div class="f-note italic"><span class="k">Note</span> &nbsp;{note}</div>'
         if note else '')
    return f"""<div class="finding">
  <div class="f-head"><span class="f-id">{fid}</span><span class="badge {cls}">{label}</span>
    <span class="f-title">{title}</span></div>
  <table class="f-body">
    <tr><td class="lab">Observation</td><td class="val">{obs}</td></tr>
    <tr><td class="lab">Evidence</td><td class="val"><span class="ev">{ev}</span></td></tr>
    <tr><td class="lab">Impact</td><td class="val">{impact}</td></tr>
    <tr><td class="lab">Recommendation</td><td class="val">{rec}</td></tr>
  </table>
  <div class="f-foot">Effort <span class="v">{effort}</span><span class="sep">|</span>Owner <span class="v">{owner}</span></div>
  {n}
</div>"""


# ----------------------------------------------------------------- findings
F = []

F.append(('A', 'Category A · The Operator',
          'The individual who would hold the lease, own the gear and perform the work. '
          'Three findings.', [
    finding('A-01', 'crit',
            'No assessment of the proposed operator has been possible.',
            'DGTL has been asked to attach its brand, its client pipeline and a label imprint to '
            'a venture whose principal has not been named to this review. No legal name, operating '
            'entity, trading history, credit list, client roster, website or social footprint was '
            'supplied. Every other finding in this document concerns the room, the market or the '
            'rights; this one concerns the person, and it is the only one that cannot be resolved '
            'by research.',
            'Intake gap — no operator identifiers provided at commissioning, 2026-08-10.',
            'Partner fit cannot be rated. DGTL would be underwriting delivery risk on an unassessed '
            'counterparty. This finding gates every other recommendation in Section 06.',
            'Supply legal name, operating entity (or confirmation that none exists), five years of '
            'credits, three referenceable clients, and any public profile. Re-run Category A before '
            'any DGTL-branded asset is produced.',
            'Low — one conversation', 'Partner',
            'This is rated Critical on exposure, not on suspicion. The absence of the record is the '
            'finding; nothing adverse has been observed because nothing has been observable.'),
    finding('A-02', 'high',
            'Equipment ownership is asserted but not inventoried or unencumbered.',
            'The premise of the venture is that the operator already owns a full recording, mixing '
            'and mastering complement, so capital expenditure falls on the room rather than the '
            'signal chain. No schedule of equipment, no purchase records and no financing or lien '
            'position have been produced.',
            'Intake gap — no equipment schedule provided, 2026-08-10.',
            'The single largest asset contribution to the partnership is unverified. Financed or '
            'leased equipment carries repossession risk that would strand a lease already signed.',
            'Request a dated equipment schedule with serial numbers for anything above $2,000, and '
            'a written statement that the listed items are owned outright and unencumbered. Attach '
            'it as a schedule to any partnership memo.',
            'Low', 'Partner'),
    finding('A-03', 'high',
            'No verified credit list, and referral is the only acquisition channel operators report works.',
            'Commercial studio operators interviewed on the record are close to unanimous that '
            'bookings come from word of mouth and prior work, not from location, signage or '
            'advertising. One operator states plainly that outside a handful of destination rooms, '
            'clients book an engineer rather than a facility. The operator’s reputation is '
            'therefore the demand model — and it has not been examined.',
            'soundonsound.com/music-business/running-commercial-studio (June 2023); '
            'gearspace.com/threads/how-to-attract-new-clients-to-your-studio.1251890/ (2019-02-25).',
            'Without a credit list there is no basis for the utilization assumption in D-01, and no '
            'basis for pricing DGTL’s share of originated work.',
            'Obtain a discography or credit list and identify how many of the last twenty sessions '
            'came from repeat clients. That ratio, not the room, is the business.',
            'Low', 'Partner'),
]))

F.append(('B', 'Category B · The Room and the Lease',
          'The physical unit, its availability, its cost and its fitness for purpose. Five findings.', [
    finding('B-01', 'crit',
            'Unit B3 is recorded as occupied, and no lower-level vacancy at 20 Maud is publicly listed.',
            'The target unit for this venture is B3, a lower-level unit at 20 Maud Street. The '
            'landlord’s own tenant record lists B3 as held by an individual leaseholder in the '
            'makers group, in the building since 2024. Independently, the only vacancies advertised '
            'at 20 Maud are Suite 100 on the main floor (4,541 SF) and Suite 302 on the third floor '
            '(1,329 SF). No below-grade unit appears on any listing platform, at any rate.',
            'Strashin tenant roll, unit B3 (lower level); loopnet.com/Listing/20-Maud-St-Toronto-ON/33753707/ '
            '(on market 2026-03-30); spacelist.ca listings 965740 and 975000 (updated 2026-07-16 and 2026-08-10).',
            'The pitch is anchored on a unit that may not be available. If B3 cannot be released, '
            'the adjacency argument — which is the whole reason for this building — '
            'weakens materially, because Suite 302 is three floors above Archive Threads and shares '
            'nothing but an address.',
            'Confirm B3’s status directly with Strashin (Daniel Glick, property management, '
            'Suite 500 in the same building) before the pitch is sent. If B3 is committed, ask '
            'specifically what lower-level inventory exists and on what notice. Treat Suite 302 as a '
            'different proposition, not a fallback.',
            'Low — one call', 'DGTL',
            'The pitch page ships with the unit number as a data-slot for exactly this reason. It '
            'can be changed in one edit.'),
    finding('B-02', 'crit',
            'Lease term is the dominant risk in the venture, and it is the one nobody negotiates hard enough.',
            'The best-evidenced pattern in the commercial-studio record is that rooms close because '
            'of rent and land value, not because of demand. A Toronto precedent sits two years back: '
            'Josh Korody’s Candle closed in 2022 over rising rent, and he rebuilt in the west '
            'end in 2025 as a smaller room with no large live space. Fifty buildings were demolished '
            'on Nashville’s Music Row between 2013 and 2019, thirty-eight of them music-related. '
            'A studio that makes a building desirable is structurally the party most likely to be '
            'priced out of the value it creates.',
            'exclaim.ca/music/article/torontos_candle_recording_studio_closes_due_to_rising_rent (2022-10-25); '
            'exclaim.ca/music/article/josh-korody-opens-new-studio-in-toronto-s-west-end (2025-10-14); '
            'savingplaces.org/places/nashvilles-music-row/updates/the-way-forward-for-music-row (2019-05-31).',
            'A three-year term on a below-grade unit that has absorbed six figures of isolation and '
            'treatment is a wasting asset. The improvement is immovable and accrues to the landlord.',
            'Negotiate term before rate. Target five years with a renewal option at a capped '
            'escalation, and treat any fixturing or free-rent period as a term concession rather '
            'than a discount. Comparable creative tenants transact on three to five years; 20 Maud '
            'Suite 302 is advertised at one to ten.',
            'Medium — negotiation', 'Partner, DGTL advises'),
    finding('B-03', 'high',
            'No rate is published for any lower-level unit at 20 Maud; the only anchors are above-grade.',
            'Strashin publishes $26.00 per square foot net plus $19.00 TMI — $45.00 gross — '
            'for Suite 100 on the main floor, and the same $26.00 net for Suite 302. Nothing is '
            'published for the lower level, and no below-grade rent discount for Toronto’s '
            'downtown west submarket appears in any accessible source.',
            'gitalis.com/listing/20-maud-street-toronto/ (brochure 2026-04-02); '
            'loopnet.com Listing 33753707. Context: CBRE Toronto Downtown Office Figures Q2 2026, '
            'Downtown West net asking $33.49, vacancy 25.2%.',
            'Every rent figure in the model is an inference from an above-grade comparable. The '
            'occupancy cost of the venture is not yet known to within a usable margin.',
            'Ask for the lower-level rate in writing. A 25.2% vacancy rate in Downtown West is the '
            'negotiating position; use it.',
            'Low', 'DGTL'),
    finding('B-04', 'high',
            'The unit’s physical fitness for recording has not been measured, and the ceiling is the binding constraint.',
            'The building is Class C brick-and-beam, built between 1910 and 1935, with published '
            'ceilings of twelve feet unfinished and ten feet finished. Floated floors and isolated '
            'ceilings typically consume eight to fourteen inches of that. Dolby’s published '
            'minimum finished floor-to-overhead height for an Atmos room is 2.4 metres. Mechanical '
            'noise is the other constraint: ASHRAE specifies NC 15–20 for a recording studio, '
            'which is a critical monitoring environment, and no noise survey of the unit exists.',
            'loopnet.com Listing 33753707 (building spec); professionalsupport.dolby.com — '
            'Dolby Atmos Home Entertainment Studio Technical Guidelines (updated 2026-02-17); '
            'ASHRAE Handbook Ch. 48 Table 1.',
            'If the finished ceiling lands below 2.4 metres after isolation, the Atmos line of the '
            'business is closed before it opens — and Atmos is the only part of the offer with '
            'a documented royalty premium attached to it (E-04).',
            'Before signing: measure slab-to-deck clearance, identify the structure above, and '
            'commission a two-hour acoustic and mechanical walk-through. Budget the survey, not the '
            'remediation — remediation cost is the answer the survey produces.',
            'Medium', 'Partner, DGTL advises'),
    finding('B-05', 'med',
            'Build-out is uncosted, and the published Toronto benchmarks span a factor of four.',
            'Turner & Townsend’s Canadian cost guide puts a Toronto commercial fit-out at CA$235 '
            'to $395 per square foot for medium quality and $475 to $865 for high quality, hard cost, '
            'excluding tax, consultants, permits, FF&E and contingency. Soundproofing labour alone in '
            'the GTA runs $2.90 to $5.20 per square foot at market rate. Toronto construction '
            'escalation ran above five percent year over year through 2025.',
            'marketintelligence.turnerandtownsend.com — Canada Annual Cost Guide (Jan 2025); '
            'renovationprice.ca/soundproofing-costs-in-toronto-gta/ (2026-02-27); '
            'rlb.com Canada construction cost reports Q2–Q4 2025.',
            'The spread between the low and high benchmark is larger than the likely first-year '
            'revenue of the room. A build priced off the wrong end of it decides the venture.',
            'Price the build from a drawing, not a benchmark. Get two fixed-price quotes against a '
            'measured unit before the lease is signed, and make the lease conditional on them where '
            'the landlord will allow it.',
            'Medium', 'Partner'),
]))

F.append(('C', 'Category C · The Adjacency Thesis',
          'Whether proximity to 20 Maud / Archive Threads actually produces business. '
          'Three findings, one of them supportive.', [
    finding('C-01', 'crit',
            'The footfall version of the adjacency thesis is unsupported by anything in the public record.',
            'Two independent research passes found no case, anywhere, of a commercial recording studio '
            'attributing new business to a neighbouring retail destination, and no brand has ever '
            'published a sales, footfall or revenue figure attributable to an in-store recording '
            'studio. The brand-studio record is a graveyard: Converse Rubber Tracks (opened 2011, '
            'Boston site closed to local bands 2017, Brooklyn permanently closed), Red Bull’s '
            'eleven-studio network (shuttered July 2020), House of Vans London (closed December 2022). '
            'All were marketing-funded and none sold hours. Meanwhile every Toronto studio that has to '
            'bill hours — Noble Street, Revolution, Union Sound, Dream House — sits in a '
            'cheap industrial conversion, and all of them are still open.',
            'digiday.com/marketing/inside-rubber-tracks-converses-contribution-music-community/ (2015-08-31); '
            'musicbusinessworldwide.com — Red Bull studio network closure (July 2020); '
            'nme.com/news/music/london-house-of-vans-venue-to-close-after-eight-years-3354555 (2022).',
            'If the pitch is sold on walk-in trade or borrowed footfall, it is being sold on a claim '
            'with no supporting evidence and a visible pattern of failure behind it. That is a '
            'reputational exposure for DGTL, not merely a weak argument.',
            'Remove every footfall claim from all client-facing material. The pitch page already '
            'carries a "What We’re Not Claiming" section stating this in plain terms — keep '
            'it, and do not let it be edited out.',
            'Low — editorial', 'DGTL',
            'High-end studios market the opposite: Westlake advertises covert private entrances and '
            'reserved parking, and sells discretion. A below-grade room beside an appointment-only '
            'showroom satisfies that requirement well — but the reason it works is privacy, '
            'which is an argument against selling it on visibility.'),
    finding('C-02', 'med',
            'The referral version of the thesis is supported, and it is the version worth pitching.',
            'Two mechanisms survive scrutiny. First, peer proximity: the one operator on record who '
            'credits location credits being surrounded by other music-makers, and pairs it '
            'immediately with networking. Second, the acquisition path 20 Maud has actually '
            'demonstrated — the costume designer for Crave’s Heated Rivalry found them by '
            'searching online, discovered their Instagram, and booked an appointment. That is a '
            'referral network with a curated inbound flow of working artists, stylists and '
            'production departments, and referral is the only channel studio operators say works.',
            'theglobeandmail.com — Heated Rivalry costume feature (2026-01-04); '
            'soundonsound.com/music-business/running-commercial-studio (June 2023).',
            'This is the honest, defensible case for the building, and it is a better case than the '
            'one being replaced: shared audience and joint programming rather than borrowed footfall.',
            'Build the pitch on shared audience and joint programming. Studio-hosted events are '
            'separately documented as converting to bookings — that is a programme the two '
            'tenants can run together, and it is the concrete thing to propose.',
            'Low — positioning', 'DGTL'),
    finding('C-03', 'high',
            'The neighbour’s services layer — including a photography studio and twelve hours of studio time — was announced in 2024 and is now absent from both of their websites.',
            'At launch in April 2024, 20 Maud advertised tiered monthly memberships at $350 to $700 '
            'including rentals, styling, access to a photography studio and twelve hours of studio '
            'time at the top tier, plus monthly community events. As of 10 August 2026 neither '
            'maudst.ca nor archivethreads.ca carries a memberships page, a photography-studio offer, '
            'a styling-services page, or an events calendar. Navigation is four items: Home, Shop, '
            'Book an Appointment, Rental.',
            'streetsoftoronto.com/toronto-culture/20-maud-archive-fashion-shop-toronto/ (2024-04-26); '
            'maudst.ca and archivethreads.ca observed 2026-08-10.',
            'Read pessimistically, they tried a studio and services layer and it did not stick. Read '
            'opportunistically, they identified real demand — stylists needing pulls and a shoot '
            'space in one place — and have vacated the delivery of it. Both readings change the '
            'pitch, and no partnership conversation with them is on record.',
            'Ask them directly before the pitch is sent. This is a fifteen-minute conversation that '
            'determines whether the adjacency is a partnership or a coincidence.',
            'Low — one conversation', 'Partner or DGTL'),
]))

F.append(('D', 'Category D · Market, Demand and Break-Even',
          'Whether the room can fill, at what rate, in what market. Four findings, including a healthy one.', [
    finding('D-01', 'high',
            'Break-even is a utilization problem, and no booking evidence has been produced.',
            'The published benchmark for a commercial room is that the rate must cover personal and '
            'business costs at fifty percent utilization — roughly 140 to 150 billable hours a '
            'month, or three and a half days a week. A conservative floor is 100 billable hours a '
            'month. The same source advises against opening at all unless the operator can start at '
            'approximately fifty percent of capacity. No forward booking evidence, pipeline or '
            'letter of intent exists for this venture.',
            'sonicscoop.com/should-recording-studios-advertise-their-rates-and-how-much-should-they-charge/ '
            '(Justin Colletti, 2017-02-05).',
            'The venture would open with a fixed occupancy cost, an amortising build and an empty '
            'calendar. That is the documented failure mode, and it is the one that closes rooms even '
            'when the work is good.',
            'Before the lease is signed, convert the operator’s existing client list into '
            'committed hours — even soft commitments. If the answer is below fifty hours a '
            'month, the honest recommendation is to defer, not to build cheaper.',
            'Medium', 'Partner'),
    finding('D-02', 'med',
            'Rate opacity is the market norm and makes pricing a matter of primary quotes, not desk research.',
            'Of fifteen Toronto-area studios checked directly, one published a rate range and six '
            'returned no retrievable content. Union Sound Company states the norm in writing and puts '
            'the Toronto commercial band at $500 to $1,500 per day on a ten-hour day with a fifty '
            'percent deposit, placing itself in the lower half. One published Toronto card exists in '
            'full — Private Ear Recording’s 2026 rates — and it is the only usable '
            'anchor for post and audio-for-picture work.',
            'unionsoundcompany.com/frequently-asked-questions; privateearrecording.com/rates (2026).',
            'Any pro-forma built on "market rate" is built on one data point. Rate positioning has to '
            'come from calls, not from the web.',
            'Call three comparable rooms for a quote before setting a card. Publish a rate — the '
            'opacity is an opportunity, and the one Toronto room that publishes is the one this '
            'venture can most usefully be benchmarked against.',
            'Low', 'Partner'),
    finding('D-03', 'med',
            'The room would have no studio neighbours; Toronto’s studio geography is elsewhere.',
            'Toronto’s commercial recording capacity sits in Parkdale (Noble Street), Corktown '
            '(Union Sound), Leslieville (Revolution and postRevolution), Scarborough (Phase One) and '
            'Mississauga (Metalworks). The nearest comparable to 20 Maud is Desert Fish at 401 '
            'Richmond Street West, a lower-level room about one kilometre away running Dolby Atmos '
            '9.1.4 and a full voice, ADR, game and post stack. Grayson Music opened a three-studio '
            'music-and-post hub in the fashion district in February 2026.',
            'desertfishstudios.com; newswire.ca — Grayson Music launch (2026-02-24).',
            'The Fashion District is not a studio cluster, and one credible competitor opened in it '
            'six months ago. Framing the location as "joining a cluster" would be inaccurate; framing '
            'it as differentiation is defensible.',
            'Position on differentiation and on the neighbour relationship, not on cluster effects. '
            'Treat Desert Fish and Grayson as the competitive set and price against them.',
            'Low — positioning', 'DGTL'),
    finding('D-04', 'low',
            'The demand backdrop is healthy — included because it is, and because the rest of this section is not.',
            'Ontario film and television production reached $2.70 billion in 2025, up 5.7 percent '
            'across 363 productions and 35,268 full-time-equivalent jobs. National sound-recording '
            'studio revenue rose 10.2 percent to $169.0 million. Canadian recorded music grew 5.6 '
            'percent to $957.9 million, with synchronisation revenue up 11.0 percent to $13.8 million. '
            'Toronto counts 85 listed recording studios, 75 labels, more than 60 publishing and '
            'licensing companies and over 18,000 SOCAN creators.',
            'ontariocreates.ca — 2025 Film and Television Production Statistics (filed 2026-03-30); '
            'statcan.gc.ca table 21-10-0055-01 (ref. 2023); musiccanada.com — IFPI Global Music '
            'Report 2026 (2026-03-18); toronto.ca — Music Industry Strategy 2022–2026.',
            'The market is growing and the post-production demand is real. Nothing in this document '
            'argues the sector is shrinking; the risks are all local to this venture.',
            'Use these figures in client-facing material — they are the strongest sourced '
            'numbers available and they belong in the pitch.',
            'None', 'DGTL'),
]))

F.append(('E', 'Category E · Rights, Registration and DGTL Records',
          'The publishing and label arm proposed alongside the room. Four findings.', [
    finding('E-01', 'crit',
            'Taking master stakes in lieu of cash has no published success rate, and the base rate makes it a lottery priced in unbilled studio days.',
            'The industry has never measured the outcome of spec or "studio for points" arrangements; '
            'no hit rate is published anywhere. What is published is the earnings distribution beneath '
            'it: the hundred-thousandth-highest-earning artist on Spotify made just over $7,300 in '
            '2025. Spotify represents roughly thirty percent of global recorded revenue, so an '
            'all-platform figure for that artist is in the low tens of thousands. A three-point stake '
            'in that release is worth a few hundred dollars a year. Practitioners on record describe '
            'unrecouped balances, liens that are impractical to enforce, and one reporting fifteen '
            'thousand dollars of uncollected production fees.',
            'loudandclear.byspotify.com/takeaways/ (modified 2026-03-11); '
            'gearspace.com/board/audio-student-engineering-production-question-zone/1110478-studio-owning-masters.html '
            '(September 2016); blog.discmakers.com/2020/11/music-producer-points/ (2020-11-19).',
            'If DGTL Records takes master stakes in exchange for studio time, DGTL is trading billable '
            'capacity — the only reliably monetisable asset in the venture — for an unpriced '
            'option. Compounding this, FACTOR’s business policies require notice and approval '
            'before any transfer of interest in a funded recording, and a transfer to a non-Canadian '
            'label triggers immediate one-hundred-percent repayment.',
            'Do not make points the default. Where a stake is taken, cap it, define the royalty base '
            'explicitly (points on suggested retail price and points on published price to dealer are '
            'not the same number), and write a reversion trigger. Screen every candidate release '
            'against FACTOR’s transfer rules before signing.',
            'Medium — legal', 'DGTL',
            'DGTL is not a law firm and this is not legal advice. Any points structure should be '
            'reviewed by counsel before it is offered to a first artist.'),
    finding('E-02', 'high',
            'Canada’s collection landscape changed twice in eighteen months; any advice from pre-2025 sources is wrong.',
            'MROC has wound down and transferred its remaining mandates to ARTISTI. Connect Music '
            'Licensing terminated all agency agreements effective 1 January 2025 and now represents '
            'major labels only. SOPROQ was renamed Panorama on 15 September 2025 and is now the '
            'collective for independent master owners in Canada — and the issuer of ISRC '
            'registrant codes, although IFPI’s own contact list still names Connect. SOCAN '
            'announced an agreement to acquire CMRRA on 29 July 2026.',
            'resound.ca — 2024 Annual Report; connectmusic.ca FAQ (updated 2025-10-29); '
            'panorama.mu/en/faq; socan.com — SOCAN/SoundExchange announcement (2026-07-29).',
            'A label arm registering repertoire against the pre-2025 map would file with bodies that '
            'no longer accept it, and would miss neighbouring-rights income entirely.',
            'Register through the current map: SOCAN as writer and publisher, then either SOCAN '
            'Reproduction Rights or CMRRA but never both, Panorama for neighbouring rights, ACTRA '
            'RACS per performer, SoundExchange for United States digital, and the MLC through one '
            'route only.',
            'Low — administrative', 'DGTL'),
    finding('E-03', 'med',
            'The registration barrier is administrative, not financial — which is why leaving it undone is the expensive choice.',
            'Setting up a label’s rights infrastructure properly costs under CAD $300 in year one. '
            'SoundExchange, the MLC, ISNI and ISWC registration are free; a SOCAN publisher account is '
            'a one-time fee; the only recurring cost is a GS1 Canada barcode licence, whose individual '
            'tier is $26.25 a year for businesses under $250,000 in revenue. ISRCs are free through a '
            'distributor, or through a Panorama registrant prefix if the label wants its own.',
            'gs1ca.org/small-business/; themlc.com/membership; soundcredit.com/isni-registration; '
            'panorama.mu/en/get-an-isrc.',
            'Every unregistered master the operator has already recorded is earning nothing and has '
            'been earning nothing for as long as it has existed. That backlog is the cheapest asset in '
            'the venture and it requires no room, no lease and no build.',
            'Register the existing catalogue first, before the lease is signed. It is the one piece of '
            'the plan that can start this week and it is the proof-of-work that de-risks everything '
            'else.',
            'Low', 'DGTL'),
    finding('E-04', 'med',
            'Dolby does not certify Atmos music studios, two local competitors imply otherwise, and only Apple pays a premium.',
            'Dolby’s Atmos music studio directory is a self-submission list; there is no '
            'certification or approval programme for music, and the cinema certification is a separate '
            'thing entirely. Two Toronto-area rooms currently describe themselves as "approved" or '
            '"authorized" for Atmos music. On payout: Apple Music states that Spatial Audio content '
            'receives a greater share of sound-recording royalties, "by a rate of up to 10%", counting '
            'any stream of a Spatial-available track regardless of device — conditional on the '
            'mix coming from multitracks or stems, with upmixing and stem-extraction disallowed. '
            'Spotify has no Atmos tier at all; its quality ladder tops out at lossless stereo.',
            'professional.dolby.com/music/dolby-atmos-music-studios; artists.apple.com/support/'
            '5477-elevate-sound-spatial-audio-dolby-atmos; support.spotify.com/us/article/audio-quality/ '
            '(all observed 2026-08-10).',
            'Atmos is the only line of the offer with a documented royalty premium attached, and it is '
            'also the one where a false claim is easiest to make and easiest to catch.',
            'Never describe a DGTL room as Dolby-certified or approved for music. State the '
            'configuration and the room dimensions instead. Quote the Apple figure precisely as "up '
            'to 10%" and always state the Spotify position alongside it.',
            'Low — editorial', 'DGTL'),
]))

F.append(('F', 'Category F · What DGTL Would Inherit',
          'Reputational and contractual exposure created by attaching the DGTL name. Four findings.', [
    finding('F-01', 'crit',
            'The proposal front-loads DGTL’s brand onto a venture whose principal and premises are both unconfirmed.',
            'The agreed structure is that the operator signs the lease and owns the gear, while the '
            'public identity is DGTL Studios and DGTL Records. That means the party carrying the '
            'delivery risk in the market’s eyes is DGTL, and the party carrying the legal control '
            'of the room and the equipment is not.',
            'Structure as briefed, 2026-08-10; unresolved findings A-01 and B-01.',
            'If the room does not open, opens late, or opens and fails, the failure is branded DGTL '
            'and the assets walk. DGTL would hold the reputational downside without the operating '
            'control that would let it manage the outcome.',
            'Either move the public identity to a co-brand that survives a separation, or take a '
            'contractual seat proportionate to the brand exposure — a naming licence terminable '
            'on defined events, with a wind-down clause covering how the DGTL marks come off the door, '
            'the site and the socials.',
            'Medium — legal', 'DGTL'),
    finding('F-02', 'high',
            'No written partnership memo exists, and the revenue share is described but not defined.',
            'DGTL is to provide brand, website and booking system, client pipeline, and the label back '
            'end, in exchange for a revenue share or fee on originated work. Nothing defines what '
            '"originated" means, how it is attributed, what happens to a client who arrives through '
            'DGTL and returns directly, or how the build fee for the brand and site is treated if the '
            'venture folds in year one.',
            'Structure as briefed, 2026-08-10; no memo produced.',
            'Attribution disputes are the standard failure mode of referral partnerships between '
            'friends, and they surface at exactly the point the venture starts working.',
            'Write a two-page memo before anything is built: definition of originated work, '
            'attribution window, treatment of repeat clients, build-fee treatment on early '
            'termination, and an explicit statement that DGTL has no claim on the operator’s '
            'pre-existing clients.',
            'Low', 'Both'),
    finding('F-03', 'high',
            'Six domains are proposed and none has been confirmed as registered, held or clearable.',
            'The concept brief lists therecordstore.ca, brainstore.ca, brstr.co, dgtl.services, '
            'dgtl.audio and dgtl.video. Registration status, ownership and renewal position are '
            'unconfirmed for all six, and no trademark clearance has been performed on any of the '
            'proposed names.',
            'Concept brief supplied 2026-08-10; no registrar or CIPO records produced.',
            'Building a brand on a domain that is not held, or on a name that cannot be registered, '
            'converts design work into sunk cost. "The Record Store" in particular is descriptive and '
            'unlikely to be registrable as a bare word mark.',
            'Confirm registrant and expiry on all six before any identity work begins. Run a CIPO '
            'knock-out search on the two names that would actually be used. Consolidate the rest or '
            'let them lapse.',
            'Low', 'DGTL'),
    finding('F-04', 'med',
            'No DGTL Pay or settlement seat is proposed here, and none should be opened at this stage.',
            'The venture would take deposits — a fifty percent deposit is the Toronto norm — '
            'and could plausibly route them through DGTL rails. Studio deposits are a low-dispute '
            'product, but the volume is small and the counterparty is unassessed.',
            'unionsoundcompany.com/frequently-asked-questions (deposit norm); finding A-01.',
            'Whoever holds the merchant relationship inherits the dispute rate, the chargeback '
            'liability and the contagion risk that follows a merchant onto a processor blacklist. '
            'A single-room studio does not generate the volume to justify that exposure.',
            'Do not open a settlement seat in phase one. Revisit only after twelve months of trading '
            'history, and then only on the lowest-risk self-serve line, priced and capped, with '
            'counsel review. DGTL is not a law firm and this is not legal advice.',
            'None — decision', 'DGTL'),
]))

N = {'crit': 0, 'high': 0, 'med': 0, 'low': 0}
for _, _, _, cards in F:
    for c in cards:
        for k, (lab, cls) in SEV.items():
            if f'badge {cls}' in c:
                N[k] += 1
TOTAL = sum(N.values())

CRIT_ROWS = [
    ('A-01', 'No assessment of the proposed operator has been possible', 'Low', 'Partner'),
    ('B-01', 'Unit B3 is recorded as occupied; no lower-level vacancy is listed', 'Low', 'DGTL'),
    ('B-02', 'Lease term is the dominant risk in the venture', 'Medium', 'Partner'),
    ('C-01', 'The footfall version of the adjacency thesis is unsupported', 'Low', 'DGTL'),
    ('E-01', 'Master stakes in lieu of cash have no published success rate', 'Medium', 'DGTL'),
    ('F-01', 'DGTL’s brand is front-loaded onto an unconfirmed venture', 'Medium', 'DGTL'),
]


def page_head(txt):
    return (f'<div class="page-head"><img class="ph-logo" src="{LOGO}" alt="DGTL Group">'
            f'<div class="ph-spacer"></div><div class="ph-txt">{txt}</div></div>')


findings_html = []
for i, (letter, title, sub, cards) in enumerate(F):
    cls = 'cat-group new-page' if i else 'cat-group'
    findings_html.append(
        f'<div class="{cls}"><div class="cat-head"><div class="cat-title">{title}</div>'
        f'<div class="cat-sub">{sub}</div><div class="cat-rule"></div></div></div>'
        + '\n'.join(cards))

crit_rows = '\n'.join(
    f'<tr><td class="id">{i}</td><td class="w">{t}</td><td>{e}</td><td>{o}</td></tr>'
    for i, t, e, o in CRIT_ROWS)

FITS = [
    ('Audio post and Atmos delivery for DGTL’s own production work', 'strong',
     'DGTL already ships film, campaign and documentary content — the Epidemic Sound cinematic '
     'film, the Swae Lee day-in-the-life, the Lil Tjay live recap, the Canon and Anker campaigns. '
     'All of it needs mix, sound design and increasingly Atmos deliverables, and all of it is '
     'currently bought outside. This seat is DGTL buying hours it already spends, from a room it '
     'helped build.',
     'brand-facts.md — verified DGTL case studies; privateearrecording.com/rates (published '
     'Toronto post rates: foley $100/hr or $1,000/day; sound design and scoring plus mix $800 per '
     'minute of finished output).'),
    ('Website, booking system and commerce', 'strong',
     'The closest match in DGTL’s verified record: The 400 Market rebuild — Next.js 15 and '
     'React 19 on Payload CMS, Stripe with webhook order sync, bidirectional CRM sync, marketing '
     'automation, ten-plus integrations, 90/91 Lighthouse. A studio booking and deposit flow is a '
     'strict subset of that build. The preceding engagement lifted mobile Lighthouse from 45 to 86 '
     'and doubled organic traffic in twelve months.',
     'brand-facts.md — The 400 Market, 2025 and 2026.'),
    ('Brand identity and content', 'gated',
     'Within capability and squarely in DGTL’s service set. Gated only because the identity '
     'would be built on names and domains that have not been cleared, and because the public '
     'identity currently proposed puts DGTL’s mark on a third party’s premises.',
     'Gated by F-01 and F-03.'),
    ('Client pipeline into the room', 'gated',
     'DGTL Influence runs 80+ vetted creators with 350M+ combined reach across 60+ campaigns, and '
     'DGTL’s own productions generate recurring audio need. The flow is real. What is not '
     'defined is how an originated booking is attributed, priced and shared, and there is no basis '
     'yet for forecasting volume against the 100-to-150 billable-hour benchmark.',
     'brand-facts.md — DGTL Influence network. Gated by D-01 and F-02.'),
    ('DGTL Records — registration and rights administration', 'gated',
     'The administrative case is strong and cheap: under CAD $300 in year one to register properly, '
     'against a backlog of unregistered masters that is currently earning nothing. The equity case '
     'is not: master stakes taken in lieu of cash have no published success rate and a base-rate '
     'distribution that makes them a lottery. Split the seat — take the administration, defer '
     'the equity.',
     'Gated by E-01 and E-02. Supported by E-03.'),
    ('DGTL Pay / settlement', 'no',
     'Not proposed and not appropriate at this stage. A single-room studio taking fifty-percent '
     'deposits does not generate volume that justifies inheriting dispute rate and chargeback '
     'liability on an unassessed counterparty.',
     'See F-04.'),
    ('Capital participation in the build or the rent', 'no',
     'No position should be taken until B-01 and B-02 clear. Improvements to a below-grade unit are '
     'immovable and accrue to the landlord; on a short term they are a wasting asset. This is the '
     'documented way studios die.',
     'See B-02.'),
]

fit_html = '\n'.join(
    f'<div class="fit"><div class="fh"><span class="fn">{i+1}. {name}</span>'
    f'<span class="rate r-{r}">{ {"strong":"Strong fit","gated":"Gated fit","no":"No fit"}[r] }</span></div>'
    f'<p>{body}</p><p class="ev"><b>Evidence</b> &nbsp;{ev}</p></div>'
    for i, (name, r, body, ev) in enumerate(FITS))

SOURCES = [
    ('Strashin tenant record — unit B3, lower level', 'internal tenant roll / brain vault', '2026-08-10'),
    ('20 Maud Street — Suite 302 listing, building spec', 'loopnet.com/Listing/20-Maud-St-Toronto-ON/33753707/', '2026-08-10'),
    ('20 Maud Street — Suite 100, $26.00 net + $19.00 TMI', 'gitalis.com/listing/20-maud-street-toronto/', '2026-08-10'),
    ('20 Maud Street — Suite 100 listings', 'spacelist.ca/listings/965740 and /975000', '2026-08-10'),
    ('Strashin Developments — portfolio, "new media studios" leasing copy', 'loopnet.com/company/strashin-developments/6pl1rxvl', '2026-08-10'),
    ('Archive Threads / 20 Maud — unit B2, appointment model, rental tiers', 'archivethreads.ca/pages/visit; maudst.ca/pages/rental', '2026-08-10'),
    ('20 Maud — launch memberships $350–$700, photography studio, events', 'streetsoftoronto.com/toronto-culture/20-maud-archive-fashion-shop-toronto/', '2024-04-26'),
    ('20 Maud — founder feature, follower figures, client roster claim', 'blogto.com/fashion_style/2025/02/20-maud-store-toronto/', '2025-02'),
    ('20 Maud — Heated Rivalry costume credit, Instagram-to-appointment path', 'theglobeandmail.com — Heated Rivalry costume feature', '2026-01-04'),
    ('Converse Rubber Tracks — marketing purpose stated by Converse', 'digiday.com/marketing/inside-rubber-tracks-converses-contribution-music-community/', '2015-08-31'),
    ('Red Bull — global studio network closure', 'musicbusinessworldwide.com — Red Bull studios', '2020-07'),
    ('House of Vans London — closure', 'nme.com/news/music/london-house-of-vans-venue-to-close-after-eight-years-3354555', '2022'),
    ('Studio acquisition channels — operator interviews', 'soundonsound.com/music-business/running-commercial-studio', '2023-06'),
    ('Studio client acquisition — practitioner thread', 'gearspace.com/threads/how-to-attract-new-clients-to-your-studio.1251890/', '2019-02-25'),
    ('Utilization and break-even benchmarks', 'sonicscoop.com/should-recording-studios-advertise-their-rates-and-how-much-should-they-charge/', '2017-02-05'),
    ('Toronto day-rate band, deposit norm, rate-opacity statement', 'unionsoundcompany.com/frequently-asked-questions', '2026-08-10'),
    ('Published Toronto rate card — tracking, mix, master, ADR, foley, sound design', 'privateearrecording.com/rates', '2026-08-10'),
    ('Nearest lower-level comparable — Atmos 9.1.4, full post stack', 'desertfishstudios.com', '2026-08-10'),
    ('Grayson Music — fashion-district music and post hub opening', 'newswire.ca — Grayson Music launch', '2026-02-24'),
    ('Candle studio closure over rising rent', 'exclaim.ca/music/article/torontos_candle_recording_studio_closes_due_to_rising_rent', '2022-10-25'),
    ('Deep Water Studio opening — same operator, smaller room', 'exclaim.ca/music/article/josh-korody-opens-new-studio-in-toronto-s-west-end', '2025-10-14'),
    ('Nashville Music Row demolitions', 'savingplaces.org/places/nashvilles-music-row/updates/the-way-forward-for-music-row', '2019-05-31'),
    ('Toronto commercial fit-out cost bands', 'marketintelligence.turnerandtownsend.com — Canada Annual Cost Guide', '2025-01'),
    ('GTA soundproofing labour rates', 'renovationprice.ca/soundproofing-costs-in-toronto-gta/', '2026-02-27'),
    ('Toronto construction escalation Q2–Q4 2025', 'rlb.com — Canada construction cost reports', '2025'),
    ('Downtown West office vacancy and net asking rent', 'cbre.ca/insights/figures/toronto-downtown-office-figures-q2-2026', '2026-07-29'),
    ('Dolby Atmos music studios — directory is self-submission', 'professional.dolby.com/music/dolby-atmos-music-studios', '2026-08-10'),
    ('Dolby Atmos room technical guidelines — 7.1.4, 2.4 m overhead', 'professionalsupport.dolby.com — Home Entertainment Studio Technical Guidelines', '2026-02-17'),
    ('Apple Music — Spatial Audio royalty share "up to 10%", mix-source rules', 'artists.apple.com/support/5477-elevate-sound-spatial-audio-dolby-atmos', '2026-08-10'),
    ('Spotify — quality ladder tops at lossless stereo, no Atmos tier', 'support.spotify.com/us/article/audio-quality/', '2026-08-10'),
    ('Spotify earnings distribution — 100,000th artist $7,300+', 'loudandclear.byspotify.com/takeaways/', '2026-03-11'),
    ('Spec / points arrangements — practitioner accounts', 'gearspace.com/board/audio-student-engineering-production-question-zone/1110478-studio-owning-masters.html', '2016-09'),
    ('Producer points conventions and royalty base', 'blog.discmakers.com/2020/11/music-producer-points/', '2020-11-19'),
    ('FACTOR business policies — transfer of interest, approval, repayment', 'factor.ca — Business Policies (PDF)', '2025-08-26'),
    ('MROC wind-down, Re:Sound membership', 'resound.ca — 2024 Annual Report', '2025-06'),
    ('Connect Music — agency agreements terminated, majors only', 'connectmusic.ca — Connect/SOPROQ FAQ', '2025-10-29'),
    ('SOPROQ renamed Panorama; ISRC issuance', 'panorama.mu/en/faq; panorama.mu/en/get-an-isrc', '2026-08-10'),
    ('SOCAN agreement to acquire CMRRA', 'socan.com — SOCAN / SoundExchange announcement', '2026-07-29'),
    ('GS1 Canada barcode licence tiers', 'gs1ca.org/small-business/', '2026-08-10'),
    ('MLC and ISNI registration — no fee', 'themlc.com/membership; soundcredit.com/isni-registration', '2026-08-10'),
    ('Ontario Arts Council — recording studios ineligible; eligible costs', 'arts.on.ca/grants/music-recording-projects', '2026-08-10'),
    ('Ontario film and television production 2025', 'ontariocreates.ca — 2025 Film and Television Production Statistics', '2026-03-30'),
    ('National sound-recording studio revenue', 'statcan.gc.ca — table 21-10-0055-01, ref. 2023', '2025-01-24'),
    ('Canadian recorded music and sync revenue 2025', 'musiccanada.com — IFPI Global Music Report 2026', '2026-03-18'),
    ('Toronto music sector counts — studios, labels, publishers, creators', 'toronto.ca — Toronto Music Industry Strategy 2022–2026', '2022'),
    ('Ontario studio business counts — NAICS 5122', 'ised-isde.canada.ca/app/ixb/cis/businesses-entreprises/5122', '2025'),
    ('ASHRAE noise criteria for recording studios', 'ASHRAE Handbook Ch. 48 Table 1 (via acousplan.com)', '2026-03-20'),
]
src_rows = '\n'.join(
    f'<tr><td class="w">{a}</td><td><span class="u">{b}</span></td><td>{c}</td></tr>'
    for a, b, c in SOURCES)

DOC = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Partner-Fit Audit — 20 Maud Studio Venture — DGTL Group</title>
<style>
{CSS}
{EXTRA_CSS}
</style>
</head>
<body>

<div class="cover">
  <img class="cover-watermark" src="{SPARK}" alt="">
  <div class="cover-inner">
    <img class="cover-logo" src="{LOGO}" alt="DGTL Group">
    <p class="kicker">Confidential — Internal Strategy Deliverable</p>
    <h1>Partner-Fit<br><span class="g">Audit</span></h1>
    <div class="cover-meta-rule"></div>
    <div class="cover-subject">DGTL Studios &times; DGTL Records — 20 Maud Street</div>
    <div class="cover-subject-sub">Proposed studio venture, Unit B3 (lower level), 20 Maud Street, Toronto &middot;
      assessed as prospective studio-operator and rights partner</div>
  </div>
  <div class="cover-foot">
    <div class="cover-foot-rule"></div>
    <div class="cover-foot-row"><span class="dim">Prepared by</span> &nbsp;DGTL Group &nbsp;&middot;&nbsp; dgtlgroup.io</div>
    <div class="cover-foot-row"><span class="dim">Date of review</span> &nbsp;10 August 2026</div>
    <div class="cover-foot-row"><span class="dim">Document</span> &nbsp;Partner-Fit Audit &middot; Version 1.0</div>
    <div class="cover-conf">Confidential. Prepared for internal DGTL use only. This document names risks that
      belong in a negotiation, not in a pitch; it is not for onward distribution to the counterparty
      or to the landlord without the written consent of DGTL Group.</div>
  </div>
</div>

<section class="section">
  {page_head('Section 01 &middot; Executive Summary')}
  <p class="kicker">Section 01</p>
  <h2 class="sec-title">Executive <span class="g">Summary</span></h2>
  <div class="sec-rule"></div>

  <p class="lead">The venture has a genuine and unusual asset, and it is not the room. A working sound
  engineer already owns a full recording, mixing and mastering complement, which means the capital
  question is a build question rather than a signal-chain question — and in a sector where
  Ontario’s studio employers are overwhelmingly one-to-four-person businesses, an operator who
  arrives with the gear already paid for starts several years ahead of the field. Alongside it sits
  a second asset nobody has monetised: every master he has recorded to date is unregistered and
  earning nothing, and correcting that costs under three hundred dollars in year one.</p>

  <p>What is not established is almost everything else. The operator has not been assessed — no
  name, entity, credit list or client roster has been supplied to this review. The target unit, B3,
  appears in the landlord’s own tenant record as occupied, and no below-grade vacancy at 20 Maud
  is publicly listed at any rate. And the argument doing the most work in the concept — that
  being next door to Archive Threads will bring business — is unsupported in its usual form:
  two research passes found no case anywhere of a recording studio attributing bookings to a
  neighbouring shop, and the brand-funded in-store studio is a category that has closed everywhere
  it was tried.</p>

  <p>What is already working is the demand backdrop and DGTL’s own half of the proposition.
  Ontario production reached $2.70 billion in 2025, national studio revenue rose 10.2 percent, and
  Canadian sync grew 11.0 percent. DGTL’s verified record contains the two capabilities the
  venture most needs — a commerce-grade booking build (The 400 Market: Next.js, Payload, Stripe,
  bidirectional CRM, 90/91 Lighthouse) and a production pipeline that already buys audio post it
  currently sources elsewhere. Those are the seats where fit is strongest, and they do not depend on
  the adjacency argument being true.</p>

  <p>This review records {TOTAL} findings across six categories, {N['crit']} of them Critical.
  Category D is included specifically because it is healthy. The distribution matters more than the
  count: most of the Critical findings are cheap to clear and clear in a conversation rather than a
  workstream — three of the six are resolved by a phone call to the landlord, a phone call to
  the neighbour, and one honest conversation with the friend. What is expensive is the sequence.
  Nothing in Section 07 should begin before Phase 0 closes.</p>

  <p class="kicker" style="margin-top:14px">Findings at a Glance</p>
  <div class="glance">
    <div class="glance-cell"><div class="n n-crit">{N['crit']}</div><div class="l">Critical</div></div>
    <div class="glance-cell"><div class="n n-high">{N['high']}</div><div class="l">High</div></div>
    <div class="glance-cell"><div class="n n-med">{N['med']}</div><div class="l">Medium</div></div>
    <div class="glance-cell"><div class="n n-low">{N['low']}</div><div class="l">Low</div></div>
    <div class="glance-cell"><div class="n">{TOTAL}</div><div class="l">Total</div></div>
  </div>
  <p class="dim" style="font-size:7.5pt">Partner-fit severity lens: Critical means something DGTL would
  inherit reputationally or contractually on the day it attaches its name. It does not track effort —
  four of the six Critical findings are rated Low effort.</p>

  <table class="t">
    <tr><th style="width:14mm">ID</th><th>Finding</th><th style="width:20mm">Effort</th><th style="width:22mm">Owner</th></tr>
    {crit_rows}
  </table>
  <p class="dim" style="font-size:7.5pt">The {N['crit']} Critical findings. The full set is detailed in Section 04.</p>
</section>

<section class="section">
  {page_head('Section 02 &middot; Scope and Method')}
  <p class="kicker">Section 02</p>
  <h2 class="sec-title">Scope &amp; <span class="g">Method</span></h2>
  <div class="sec-rule"></div>

  <p><strong>What was reviewed.</strong> The building and unit record for 20 Maud Street across three
  commercial listing platforms and the landlord’s own marketing copy; the internal Strashin tenant
  roll and its lower-level unit assignments; the public web presence of the adjacent tenant
  (archivethreads.ca, maudst.ca) and its press coverage from April 2024 to January 2026; fifteen
  Toronto-area commercial studios and their published or absent rate cards; Canadian rights-collection
  bodies and their 2025–26 restructuring; Dolby, Apple and Spotify’s own published positions
  on immersive audio; Ontario and federal production statistics and grant programmes; and the
  published record on commercial studio economics, utilization and failure.</p>

  <p><strong>Method.</strong> Manual source inspection and search-result review through the approved
  web-fetch tooling, conducted 10 August 2026, across four parallel research lanes. Every claim in
  this document resolves to a row in Appendix A. Where a source is a self-claim rather than a
  third-party finding, it is labelled as such in the finding.</p>

  <p><strong>Explicitly out of scope, and why.</strong></p>
  <ul>
    <li><strong>The operator.</strong> No identifying information was supplied. Category A is therefore
      an intake register rather than an assessment — the honest form of the finding.</li>
    <li><strong>The unit itself.</strong> No site visit, no measurement, no acoustic or mechanical
      survey. Ceiling height, slab detail and structural noise are unknown.</li>
    <li><strong>Lease documents and the landlord’s position.</strong> Not obtained. Availability of
      B3 is inferred from a tenant roll and from the absence of a listing, not confirmed by Strashin.</li>
    <li><strong>The neighbour’s intentions.</strong> No conversation with 20 Maud is on record. Their
      retired services layer is inferred from the disappearance of pages from their own sites.</li>
    <li><strong>Anything requiring credentials.</strong> Booking history, financial records, equipment
      finance position, domain registrar accounts, and any analytics.</li>
    <li><strong>Live social metrics.</strong> Instagram blocks unauthenticated inspection; the only
      sourced follower figures for the neighbour are eighteen months old and are not relied upon here.</li>
  </ul>

  <div class="callout">
    <p class="kicker">The consequence, stated plainly</p>
    <p>This audit can say with confidence <strong>what is unestablished</strong> and <strong>what the
    published record does and does not support</strong>. It cannot say whether this particular operator
    can fill this particular room, because the two facts that would answer that — who he is and
    whether the room exists — are both open. No traffic figure, ranking position, booking volume or
    revenue estimate appears anywhere in this document, because none was measured.</p>
  </div>
</section>

<section class="section">
  {page_head('Section 03 &middot; Venture Architecture')}
  <p class="kicker">Section 03</p>
  <h2 class="sec-title">Venture <span class="g">Architecture</span></h2>
  <div class="sec-rule"></div>

  <p>The proposal has no website and no funnel to map, so the equivalent exercise is to draw where
  value and money would actually move, and to mark which nodes exist today. Read left to right within
  each row.</p>

  <div class="tree">
    <div class="tree-row">
      <div class="node money"><div class="nt">Node 1 &middot; Exists</div><div class="nb">
        <strong>The signal chain.</strong> Recording, mixing and mastering equipment, owned outright by
        the operator. Asserted, not inventoried — see A-02.</div></div>
      <div class="node empty"><div class="nt">Node 2 &middot; Unbuilt</div><div class="nb">
        <strong>The room.</strong> Unit B3, lower level, 20 Maud Street. Recorded as occupied; no
        below-grade vacancy listed; no rate published; unmeasured — B-01, B-03, B-04.</div></div>
      <div class="node empty"><div class="nt">Node 3 &middot; Unbuilt</div><div class="nb">
        <strong>The lease.</strong> Signed by the operator. Term is the dominant risk in the whole
        structure — B-02.</div></div>
    </div>
    <div class="tree-row">
      <div class="node money"><div class="nt">Node 4 &middot; Money node</div><div class="nb">
        <strong>Engine One — billable hours.</strong> Toronto band $500–$1,500 per day, ten-hour
        day, fifty percent deposit. Break-even at 100–150 billable hours a month — D-01, D-02.</div></div>
      <div class="node money"><div class="nt">Node 5 &middot; Money node</div><div class="nb">
        <strong>Engine Two — rights.</strong> Registration, mechanicals, neighbouring rights, sync.
        Switch-on cost under CAD $300 in year one — E-02, E-03.</div></div>
      <div class="node empty"><div class="nt">Node 6 &middot; Unbuilt</div><div class="nb">
        <strong>DGTL Records equity.</strong> Master stakes taken in lieu of cash. No published success
        rate; base rate makes it a lottery — E-01.</div></div>
    </div>
    <div class="tree-row">
      <div class="node"><div class="nt">Node 7 &middot; Inbound, real</div><div class="nb">
        <strong>The operator’s referral network.</strong> The only acquisition channel operators
        report works. Unverified here — A-03.</div></div>
      <div class="node"><div class="nt">Node 8 &middot; Inbound, gated</div><div class="nb">
        <strong>DGTL-originated work.</strong> Real pipeline; no attribution definition, no share
        defined, no memo — F-02.</div></div>
      <div class="node empty"><div class="nt">Node 9 &middot; Advertised, empty</div><div class="nb">
        <strong>Adjacency footfall.</strong> No supporting evidence exists anywhere. The referral
        version of this node is real; the footfall version is not — C-01, C-02.</div></div>
    </div>
    <div class="tree-row">
      <div class="node empty"><div class="nt">Node 10 &middot; Unbuilt</div><div class="nb">
        <strong>Brand, site, booking, deposits.</strong> DGTL’s strongest seat. Blocked on names and
        domains that have not been cleared — F-03.</div></div>
      <div class="node empty"><div class="nt">Node 11 &middot; Not proposed</div><div class="nb">
        <strong>Settlement rails.</strong> Deliberately closed at this stage. Merchant of record inherits
        dispute liability — F-04.</div></div>
      <div class="node"><div class="nt">Node 12 &middot; Exposure</div><div class="nb">
        <strong>The DGTL name on the door.</strong> Brand risk sits with DGTL; legal control of room and
        gear sits with the operator — F-01.</div></div>
    </div>
  </div>
  <p class="legend"><span class="sw">Gold border</span> = money moves through this node &nbsp;&middot;&nbsp;
  Dashed border = advertised or assumed but not yet built &nbsp;&middot;&nbsp; Plain border = exists or is
  structural</p>

  <div class="callout">
    <p class="kicker">Architecture read</p>
    <p>Three of the four money nodes are real and two of them are cheap. Engine Two — registering
    the existing catalogue — requires no room, no lease and no build, costs under three hundred
    dollars, and can start this week. It is the only part of the venture with no dependency on any
    open finding, and it is the natural first proof of the partnership.</p>
    <p>The structural problem is that the two nodes carrying the most weight in the pitch — the
    room and the adjacency — are the two least established, while the node carrying the most
    exposure — the DGTL name — is the one furthest from DGTL’s control.</p>
  </div>
</section>

<section class="section">
  {page_head('Section 04 &middot; Findings')}
  <p class="kicker">Section 04</p>
  <h2 class="sec-title"><span class="g">Findings</span></h2>
  <div class="sec-rule"></div>
  <p>{TOTAL} findings across six categories. Category D is included because the demand backdrop is
  genuinely healthy and a document that only records risk misrepresents the opportunity. Category C
  contains one supportive finding — the version of the adjacency thesis that the evidence does
  support. Severity reflects what DGTL would inherit on attaching its name, not effort to fix.</p>

  {chr(10).join(findings_html)}
</section>

<section class="section">
  {page_head('Section 05 &middot; Market Context')}
  <p class="kicker">Section 05</p>
  <h2 class="sec-title">Market Context &amp; the <span class="g">Break-Even Question</span></h2>
  <div class="sec-rule"></div>

  <p>This section replaces the competitive-context section of a client audit. The question is not
  whether the sector is attractive — D-04 establishes that it is — but whether the specific
  claim underneath this venture, that a room in this building can fill, is plausible against what the
  market publishes.</p>

  <p class="kicker" style="margin-top:14px">Comparable set</p>
  <table class="t">
    <tr><th style="width:34mm">Room</th><th style="width:38mm">Location &amp; grade</th><th>Position</th><th style="width:22mm">Rates published</th></tr>
    <tr><td class="w">Desert Fish</td><td>401 Richmond St W, Suite B102 — lower level, ~1 km away</td><td>The direct comparable. Atmos 9.1.4, Sony 360RA, full VO / ADR / audiobook / game / post stack, film score mixing.</td><td>No</td></tr>
    <tr><td class="w">Grayson Music</td><td>Fashion District — opened February 2026</td><td>Three commercial studios, writing rooms, vinyl bar, stage, coworking. Music plus full audio post. The newest and closest competitive threat.</td><td>No</td></tr>
    <tr><td class="w">Noble Street</td><td>17 Noble St, Parkdale — purpose-built</td><td>Four rooms, 1,200 sq ft live room, SSL. Destination tracking.</td><td>No</td></tr>
    <tr><td class="w">Revolution / postRevolution</td><td>36 Laing St, Leslieville — 8,500 sq ft</td><td>Three rooms; the fullest post stack in the city — radio, ad, sound design, foley, ADR, audiobooks, gaming.</td><td>No</td></tr>
    <tr><td class="w">Union Sound Company</td><td>89 Sackville St, Corktown — 2,400 sq ft</td><td>Tracking on a 1971 Neve. The only room that publishes the market band.</td><td>Band only</td></tr>
    <tr><td class="w">Private Ear</td><td>Toronto</td><td>Two rooms plus live. The only full published card in the city.</td><td>Yes — 2026</td></tr>
  </table>
  <p class="dim" style="font-size:7.5pt">Of fifteen Toronto-area studios checked directly, one published a full
  rate card and six returned no retrievable content. This section is qualitative: it reflects what was publicly
  visible on one day, from one location.</p>

  <div class="callout">
    <p class="kicker">Plausibility read — qualitative</p>
    <p>The published break-even benchmark is fifty percent utilization, roughly 140 to 150 billable
    hours a month, with 100 hours as a conservative floor — and the same source advises against
    opening unless the operator can <em>start</em> near fifty percent. Against a Toronto day-rate band
    of $500 to $1,500, that is the entire question. It is not a question research can answer. It is
    answered by the operator’s existing client list, which has not been produced (A-03), and by
    the occupancy cost of a unit whose rate is not published (B-03).</p>
    <p>What can be said: the two nearest comparables both lead with <em>post-production</em>, not music
    tracking, and Ontario production spend grew 5.7 percent to $2.70 billion in 2025 while Canadian
    sync grew 11.0 percent. If this room is going to fill, the published evidence points at audio for
    picture — foley, ADR, dialogue, sound design, mix-to-picture — more strongly than at
    album work. That is also the seat where DGTL is a buyer rather than a marketer.</p>
  </div>

  <p class="kicker" style="margin-top:14px">Category risk register</p>
  <table class="t">
    <tr><th style="width:40mm">Risk</th><th>What the record shows</th><th style="width:22mm">Bears on</th></tr>
    <tr><td class="w">Rent and land value</td><td>The dominant documented cause of studio closure. A local precedent two years old (Candle, 2022) and a national one (50 buildings demolished on Music Row, 2013–2019). Improvements to a below-grade unit are immovable.</td><td class="id">B-02</td></tr>
    <tr><td class="w">Grant ineligibility</td><td>Recording studios are the first item on the Ontario Arts Council’s ineligible-applicant list. Public money routes through the artist — OAC pays up to $10,000 for an album and counts studio rental as an eligible cost. The room’s role is vendor, not applicant.</td><td class="id">D-04</td></tr>
    <tr><td class="w">Immersive-audio claims</td><td>No certification exists for Atmos music studios; two local rooms imply otherwise. Apple pays up to ten percent more for Spatial; Spotify pays nothing. A false claim here is trivially checkable.</td><td class="id">E-04</td></tr>
    <tr><td class="w">Generative AI in library and sync</td><td>CISAC / PMP projects generative AI reaching roughly sixty percent of music-library revenues by 2028, with about a quarter of creators’ revenues at risk. Deezer reported AI tracks exceeding half of daily uploads in June 2026.</td><td class="id">E-01</td></tr>
    <tr><td class="w">Streaming base rates</td><td>Blended indie payouts are flat to declining. Spotify’s hundred-thousandth-ranked artist earned just over $7,300 in 2025. Any plan whose upside rests on streaming income is resting on that distribution.</td><td class="id">E-01</td></tr>
    <tr><td class="w">Creative-space displacement</td><td>Toronto lost multiple creative spaces through 2025 — 379 Adelaide St W terminated early, It’s OK* Studios vacating, Velvet Underground closed. The City’s Culture Connects plan promises a million square feet of new cultural space over ten years; none of it is committed to this venture.</td><td class="id">B-02</td></tr>
  </table>
</section>

<section class="section">
  {page_head('Section 06 &middot; Partnership Fit')}
  <p class="kicker">Section 06</p>
  <h2 class="sec-title">Partnership Fit — <span class="g">Where DGTL Plugs In</span></h2>
  <div class="sec-rule"></div>

  <p>Seven candidate seats, each rated on the evidence rather than on enthusiasm. Two are strong and
  neither of them depends on the adjacency argument being true. Three are gated. Two should stay
  closed.</p>

  {fit_html}

  <div class="callout">
    <p class="kicker">Gating conditions</p>
    <p><strong>(a) Before any DGTL-branded asset ships publicly</strong> — before the pitch page
    goes to a live URL, before an identity is designed, before the DGTL name appears on a door, a
    site or a social account: <span class="gold">A-01</span> (operator assessed),
    <span class="gold">A-02</span> (equipment schedule received),
    <span class="gold">B-01</span> (unit availability confirmed in writing by Strashin),
    <span class="gold">F-03</span> (domains confirmed held and names knocked out) must all clear, and
    <span class="gold">F-02</span> (a signed two-page memo) must exist.</p>
    <p><strong>(b) Before DGTL Records takes any master stake</strong>, or any settlement or DGTL Pay
    pilot is discussed: <span class="gold">E-01</span> and <span class="gold">E-02</span> must clear,
    <span class="gold">F-04</span> stands as a decision to defer, and counsel must review the points
    structure. Settlement rule of thumb: whoever holds the merchant relationship inherits the dispute
    rate, the chargeback liability and processor-blacklist contagion. If a pilot is ever opened, open
    it on the lowest-risk self-serve line only, priced and capped. DGTL is not a law firm and none of
    this is legal advice.</p>
    <p><strong>(c) Before capital of any kind is committed</strong> to the build or the rent:
    <span class="gold">B-02</span> (term negotiated) and <span class="gold">B-04</span> (unit measured
    and surveyed) must clear. On a short term, a below-grade build is a gift to the landlord.</p>
  </div>
</section>

<section class="section">
  {page_head('Section 07 &middot; Roadmap')}
  <p class="kicker">Section 07</p>
  <h2 class="sec-title">Sequenced <span class="g">Roadmap</span></h2>
  <div class="sec-rule"></div>

  <p>Four phases. No prices appear in this document — it is a diagnostic, and keeping commercial
  terms out of it is what lets it be read without a guard up. Finding IDs are rendered in gold so the
  table ties back to Section 04.</p>

  <table class="t">
    <tr><th style="width:38mm">Phase</th><th style="width:38mm">Workstream</th><th style="width:34mm">Findings</th><th style="width:24mm">Owner</th><th>Dependency</th></tr>
    <tr><td class="w">Phase 0 &middot; Verification<br><span class="dim">Week 1–2</span></td>
      <td>Three conversations and one document request. Landlord on B3; neighbour on their retired
        services layer; friend on identity, entity, credits and equipment. Domain and mark check.</td>
      <td class="id">A-01 A-02 A-03 B-01 B-03 C-03 F-03</td><td>Both</td>
      <td>Gates every other phase</td></tr>
    <tr><td class="w">Phase 1 &middot; Proof without premises<br><span class="dim">Week 1–4, parallel</span></td>
      <td>Register the existing catalogue against the current Canadian rights map. Under CAD $300,
        no room required. Establishes the working relationship before either party is exposed.</td>
      <td class="id">E-02 E-03</td><td>DGTL</td>
      <td>None — start immediately</td></tr>
    <tr><td class="w">Phase 2 &middot; Room and lease<br><span class="dim">Week 3–8</span></td>
      <td>Measure the unit, commission the acoustic and mechanical walk-through, obtain two fixed-price
        build quotes, then negotiate term before rate.</td>
      <td class="id">B-02 B-04 B-05</td><td>Partner, DGTL advises</td>
      <td>Phase 0 closed</td></tr>
    <tr><td class="w">Phase 3 &middot; Brand, site, pipeline<br><span class="dim">Month 2–4</span></td>
      <td>Identity, website, booking and deposit flow, rate card, positioning on post rather than
        footfall. Convert the operator’s client list into committed hours before launch.</td>
      <td class="id">C-01 C-02 D-01 D-02 D-03 F-01 F-02</td><td>DGTL</td>
      <td>Gate (a) cleared</td></tr>
    <tr><td class="w">Phase 4 &middot; Rights equity<br><span class="dim">Month 6+, gated hardest</span></td>
      <td>Any master-stake structure, any settlement discussion. Deferred by default.</td>
      <td class="id">E-01 E-04 F-04</td><td>DGTL + counsel</td>
      <td>Gate (b) cleared</td></tr>
  </table>

  <div class="callout">
    <p class="kicker">Sequencing rationale</p>
    <p>Phase 0 is three phone calls and it can invalidate the entire venture, so it costs almost
    nothing and is worth more than everything after it. Phase 1 runs in parallel deliberately: it is
    the only workstream with no dependencies, it produces revenue from work already done, and it lets
    both parties find out how they work together before either has signed anything. Room and lease
    precede brand because a brand built for a unit that turns out to be unavailable is sunk cost, and
    because term negotiation is easier before a public commitment exists. Rights equity is last and
    gated hardest because it is the only element where DGTL trades a certain asset — billable
    capacity — for an uncertain one.</p>
    <p>The order also protects the friendship, which is a real consideration and not a soft one.
    Every question in Phase 0 is easier to ask before money moves than after.</p>
  </div>
</section>

<section class="section">
  {page_head('Section 08 &middot; Measurement')}
  <p class="kicker">Section 08</p>
  <h2 class="sec-title">Measurement <span class="g">Plan</span></h2>
  <div class="sec-rule"></div>

  <p>Baseline must be captured before any Phase 3 asset ships. Capturing it afterwards makes the
  engagement unprovable — this is the second time that is stated in this document, deliberately.</p>

  <table class="t">
    <tr><th style="width:44mm">Metric</th><th>Definition and baseline</th><th style="width:24mm">Cadence</th><th style="width:22mm">Proves</th></tr>
    <tr><td class="w">Billable hours per month</td><td>Hours invoiced, against the published floor of 100 and the fifty-percent benchmark of 140–150. Baseline is the operator’s current monthly hours before the room exists.</td><td>Monthly</td><td class="id">D-01</td></tr>
    <tr><td class="w">Booking source attribution</td><td>Every booking tagged at intake: operator referral, DGTL-originated, neighbour or building referral, or inbound web. This is the only way the adjacency claim ever becomes measurable rather than argued.</td><td>Per booking</td><td class="id">C-01 C-02 F-02</td></tr>
    <tr><td class="w">Occupancy cost ratio</td><td>Gross rent plus TMI as a share of monthly revenue. The number that predicts the documented failure mode.</td><td>Monthly</td><td class="id">B-02 B-03</td></tr>
    <tr><td class="w">Catalogue registration completeness</td><td>Count of masters with ISRC, SOCAN, Panorama, MLC and SoundExchange registration complete, against total masters held. Baseline is almost certainly zero, which is the point.</td><td>Monthly to complete</td><td class="id">E-02 E-03</td></tr>
    <tr><td class="w">Rights income received</td><td>Actual distributions by body. Note the lag structure: SOCAN quarterly, Panorama Canadian once a year in July, Re:Sound annually the year after broadcast. Do not read year one as a signal.</td><td>Quarterly</td><td class="id">E-01 E-03</td></tr>
    <tr><td class="w">Post-production share of revenue</td><td>Audio-for-picture revenue as a share of total. Tests the Section 05 read that post, not album work, is where this room fills.</td><td>Quarterly</td><td class="id">D-03</td></tr>
  </table>
</section>

<section class="section">
  {page_head('Appendix A &middot; Sources')}
  <p class="kicker">Appendix A</p>
  <h2 class="sec-title">Sources &amp; <span class="g">Evidence Log</span></h2>
  <div class="sec-rule"></div>

  <table class="t">
    <tr><th style="width:56mm">What was checked</th><th>Source</th><th style="width:20mm">Accessed</th></tr>
    {src_rows}
  </table>

  <div class="callout" style="margin-top:14px">
    <p class="kicker">Limitations</p>
    <p>No owner-credentialled data was available for any party. Inaccessible: the operator’s
    identity, entity, credits, client list and equipment schedule; the lease and the landlord’s
    position on B3; the unit’s dimensions, slab detail and mechanical noise floor; the
    neighbour’s current commercial intentions; live social metrics on any platform; and domain
    registrar records for the six proposed domains.</p>
    <p>Two specific evidentiary cautions carry into any onward use. First, the adjacent tenant’s
    &ldquo;largest in Canada&rdquo; positioning is their own marketing copy, not a third-party finding
    — the most credible outlet to touch it framed it as a stated goal. Second, the celebrity
    client roster attributed to them is single-sourced to one local publication relaying the founders,
    with no dates and no corroboration; only one name carries first-party photographic evidence. None
    of it is used in this document or in the accompanying pitch page, and none of it should be.</p>
    <p>Accordingly: this audit can say what is <strong>unestablished</strong> and what the published
    record <strong>does and does not support</strong>. It cannot say what any of it has cost or will
    earn. Quantifying that requires the access described above, beginning with A-01.</p>
  </div>

  <div style="margin-top:16mm">
    <img src="{LOGO}" alt="DGTL Group" style="height:9mm">
    <p class="dim" style="font-size:7.5pt;margin-top:6px">Prepared by DGTL Group &nbsp;&middot;&nbsp; dgtlgroup.io<br>
    Partner-Fit Audit &middot; 20 Maud Studio Venture &middot; Version 1.0 &middot; 10 August 2026<br>
    &copy; 2026 DGTL. All Rights Reserved.</p>
  </div>
</section>

</body>
</html>"""

out = os.path.join(BASE, 'audit.html')
open(out, 'w', encoding='utf-8').write(DOC)
print('wrote', out, len(DOC), 'bytes')
print('severities', N, 'total', TOTAL)
