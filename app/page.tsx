"use client";
import { useState } from "react";

type DemoStop = { time: string; duration: string; name: string; detail: string };

const scenarios = {
  rain: {
    label: "It’s raining",
    icon: "☂",
    title: "A beautiful way through Paris—mostly under cover.",
    route: "Galerie Vivienne → Palais-Royal → Passage Véro-Dodat",
    meta: "64 min · 0.8 km · 82% sheltered",
    compatibility: "96%",
    reason: "Long covered sections, short street crossings and one memorable reveal without sacrificing the atmosphere of Paris.",
    change: "RAIN GETS HEAVIER",
    recoveredTitle: "Route contracted—more shelter, no wasted crossing.",
    recoveredMeta: "48 min · 0.5 km · 94% sheltered",
    stops: [
      { time: "NOW", duration: "18 min", name: "Galerie Vivienne", detail: "Enter through rue Vivienne · covered" },
      { time: "+24", duration: "16 min", name: "Palais-Royal arcades", detail: "6 min walk · mostly sheltered" },
      { time: "+48", duration: "12 min", name: "Passage Véro-Dodat", detail: "8 min walk · final reveal" },
    ],
    recovery: [
      { time: "NOW", duration: "22 min", name: "Galerie Vivienne", detail: "Stay inside while the rain intensifies" },
      { time: "+28", duration: "16 min", name: "Palais-Royal arcades", detail: "6 min transfer · sheltered finish" },
    ],
  },
  heat: {
    label: "It’s too hot",
    icon: "◒",
    title: "Cool interiors, short crossings, no wasted energy.",
    route: "Salle Ovale → Galerie Colbert → shaded Palais-Royal",
    meta: "72 min · low effort · indoor-first",
    compatibility: "94%",
    reason: "Air-conditioned or naturally cool interiors lead the route, with shade and recovery time built between stops.",
    change: "ENERGY DROPS",
    recoveredTitle: "Route shortened—same quality, less effort.",
    recoveredMeta: "49 min · seated recovery · 0.6 km",
    stops: [
      { time: "NOW", duration: "24 min", name: "Salle Ovale", detail: "Cool interior · free entry" },
      { time: "+29", duration: "16 min", name: "Galerie Colbert", detail: "5 min crossing · indoors" },
      { time: "+52", duration: "14 min", name: "Palais-Royal shade", detail: "7 min walk · seated finish" },
    ],
    recovery: [
      { time: "NOW", duration: "28 min", name: "Salle Ovale", detail: "Longer cool recovery" },
      { time: "+34", duration: "12 min", name: "Galerie Colbert", detail: "6 min transfer · indoor finish" },
    ],
  },
  ticket: {
    label: "I have a Louvre ticket",
    icon: "◇",
    title: "Your reservation becomes the anchor of the day.",
    route: "Quiet discovery → correct Louvre entrance → protected arrival",
    meta: "20 min safety margin · ticket protected",
    compatibility: "98%",
    reason: "NOW works backward from the reservation, removes risky detours and preserves a calm discovery before the correct entrance.",
    change: "METRO DELAY DETECTED",
    recoveredTitle: "Discovery removed—your Louvre arrival stays protected.",
    recoveredMeta: "Direct route · 18 min margin retained",
    stops: [
      { time: "3:18", duration: "18 min", name: "Palais-Royal courtyard", detail: "Low-risk discovery near the Louvre" },
      { time: "3:42", duration: "8 min", name: "Walk to Carrousel entrance", detail: "Correct access · crowd-aware" },
      { time: "4:00", duration: "20 min", name: "Protected arrival window", detail: "Ticket 4:30 PM · no rush" },
    ],
    recovery: [
      { time: "3:34", duration: "12 min", name: "Direct approach", detail: "Optional stop removed automatically" },
      { time: "3:52", duration: "18 min", name: "Protected Louvre arrival", detail: "Correct entrance · ticket safe" },
    ],
  },
  care: {
    label: "I need a break",
    icon: "◌",
    title: "A human pause—without losing the rest of your day.",
    route: "Quiet café → water & restroom → protected next arrival",
    meta: "36 min · seated · 4 min detour",
    compatibility: "97%",
    reason: "NOW protects the next commitment while creating enough time to eat, drink, sit down and reset.",
    change: "I NEED MORE TIME",
    recoveredTitle: "Pause extended—the optional stop was removed.",
    recoveredMeta: "52 min recovery · next reservation protected",
    stops: [
      { time: "NOW", duration: "4 min", name: "Walk to a quiet café", detail: "Open now · seating · restroom" },
      { time: "+04", duration: "24 min", name: "Food, water and recovery", detail: "Quick service · calm interior" },
      { time: "+32", duration: "12 min", name: "Protected next arrival", detail: "Route resumes without rushing" },
    ],
    recovery: [
      { time: "NOW", duration: "8 min", name: "Stay seated and recover", detail: "Extra time added immediately" },
      { time: "+38", duration: "14 min", name: "Direct protected arrival", detail: "Optional discovery removed" },
    ],
  },
  water: {
    label: "I need water",
    icon: "◉",
    title: "Water now—the route can wait three minutes.",
    route: "Nearest verified water point → quick reset → route resumes",
    meta: "3 min away · free · no meaningful delay",
    compatibility: "99%",
    reason: "NOW prioritizes a verified drinking-water point on the natural direction of travel, without creating unnecessary backtracking.",
    change: "THE WATER POINT IS UNAVAILABLE",
    recoveredTitle: "Next verified water point selected.",
    recoveredMeta: "5 min away · open access · route preserved",
    stops: [
      { time: "NOW", duration: "3 min", name: "Walk to public drinking water", detail: "Verified point · on your route" },
      { time: "+03", duration: "4 min", name: "Water and short reset", detail: "Free · public access" },
      { time: "+07", duration: "12 min", name: "Resume current route", detail: "Destination remains protected" },
    ],
    recovery: [
      { time: "NOW", duration: "5 min", name: "Alternate water point", detail: "Verified available · 350 m" },
      { time: "+09", duration: "12 min", name: "Resume current route", detail: "Only 2 minutes added" },
    ],
  },
  restroom: {
    label: "I need a restroom",
    icon: "WC",
    title: "The nearest practical restroom—not merely the nearest pin.",
    route: "Verified access → facilities → resume from the correct exit",
    meta: "5 min away · open access · route protected",
    compatibility: "98%",
    reason: "NOW checks practical access, opening status and walking direction before inserting the stop into the active route.",
    change: "FACILITIES TEMPORARILY CLOSED",
    recoveredTitle: "A verified alternative is ready nearby.",
    recoveredMeta: "7 min away · accessible · +3 min total",
    stops: [
      { time: "NOW", duration: "5 min", name: "Carrousel du Louvre facilities", detail: "Access route verified · open in demo" },
      { time: "+05", duration: "8 min", name: "Restroom stop", detail: "Indoor · accessible facilities" },
      { time: "+13", duration: "12 min", name: "Resume from Carrousel exit", detail: "Original destination preserved" },
    ],
    recovery: [
      { time: "NOW", duration: "7 min", name: "Alternative public facilities", detail: "Verified access · no backtracking" },
      { time: "+15", duration: "12 min", name: "Resume protected route", detail: "3 minutes added" },
    ],
  },
  guardian: {
    label: "I need help",
    icon: "✚",
    title: "NOW Guardian pauses the journey and puts help first.",
    route: "Confirm safety → show exact location → choose the right help",
    meta: "Safety mode · location ready · route paused",
    compatibility: "100%",
    reason: "Guardian separates a travel disruption from a true emergency and places location, trusted contacts and official help within immediate reach.",
    change: "I AM NOT OKAY",
    recoveredTitle: "Guardian mode active—your journey remains paused.",
    recoveredMeta: "Location prepared · trusted contact available · emergency options ready",
    stops: [
      { time: "NOW", duration: "Check", name: "Everything okay?", detail: "I’m fine · Find help · Emergency" },
      { time: "+01", duration: "Ready", name: "Your exact location", detail: "Copy address · share with hotel or trusted contact" },
      { time: "+02", duration: "Choose", name: "The right level of help", detail: "Pharmacy · hospital · police · emergency services" },
    ],
    recovery: [
      { time: "NOW", duration: "Paused", name: "Stay where you feel safe", detail: "Paris NOW stops the itinerary" },
      { time: "+01", duration: "Ready", name: "Help and location panel", detail: "Clearly labelled emergency services" },
    ],
  },
  blocked: {
    label: "Street blocked",
    icon: "⊘",
    title: "The destination stays. The blocked street does not.",
    route: "Current street → live obstruction → verified alternate approach",
    meta: "Detour ready · destination preserved · +4 min",
    compatibility: "99%",
    reason: "NOW keeps the purpose of the route, isolates the blocked segment and selects the shortest viable pedestrian alternative.",
    change: "STREET CLOSURE DETECTED",
    recoveredTitle: "Blocked segment removed—a calmer approach is ready.",
    recoveredMeta: "Alternate street · +4 min · no backtracking",
    stops: [
      { time: "NOW", duration: "6 min", name: "Continue on current approach", detail: "Live route monitoring active" },
      { time: "+06", duration: "Blocked", name: "Rue closed ahead", detail: "Automatic signal or STREET BLOCKED report" },
      { time: "+10", duration: "12 min", name: "Original destination", detail: "Arrival retained · new approach ready" },
    ],
    recovery: [
      { time: "NOW", duration: "5 min", name: "Turn onto alternate street", detail: "Blocked segment removed" },
      { time: "+09", duration: "12 min", name: "Original destination", detail: "Arrive from the verified open side" },
    ],
  },
  food: {
    label: "Find Chinese food",
    icon: "⌖",
    title: "Three good Chinese options—ranked for this exact moment.",
    route: "Compare nearby options → eat without rushing → resume the day",
    meta: "Open now · well rated · route compatible",
    compatibility: "95%",
    reason: "NOW balances cuisine, current opening status, rating confidence, price, walking time and the next commitment—not popularity alone.",
    change: "I WANT MORE TIME TO EAT",
    recoveredTitle: "Dining window extended—the next optional stop was removed.",
    recoveredMeta: "58 min dining window · next reservation protected",
    stops: [
      { time: "NOW", duration: "Choose", name: "Select one of 3 nearby restaurants", detail: "Distance · rating · price · availability" },
      { time: "+08", duration: "42 min", name: "Selected Chinese restaurant", detail: "Seated meal · open now" },
      { time: "+54", duration: "14 min", name: "Resume protected route", detail: "Next commitment remains safe" },
    ],
    recovery: [
      { time: "NOW", duration: "58 min", name: "Enjoy a longer meal", detail: "Optional visit removed from the route" },
      { time: "+62", duration: "14 min", name: "Resume protected route", detail: "Direct departure · no rush" },
    ],
  },
  secret: {
    label: "Surprise me",
    icon: "✦",
    title: "The Paris most visitors walk straight past.",
    route: "Rare gallery → overlooked courtyard → quiet final reveal",
    meta: "58 min · no ticket · Velvet Pick",
    compatibility: "92%",
    reason: "The route avoids famous anchors and combines three verified places with genuine discovery value and a natural walking sequence.",
    change: "FIRST PLACE IS CLOSED",
    recoveredTitle: "Closure absorbed—a new rare opening takes its place.",
    recoveredMeta: "61 min · replacement verified · no backtracking",
    stops: [
      { time: "NOW", duration: "16 min", name: "A discreet historic gallery", detail: "Unmarked entrance · Velvet Pick" },
      { time: "+23", duration: "14 min", name: "An overlooked courtyard", detail: "7 min walk · free" },
      { time: "+44", duration: "10 min", name: "A quiet architectural reveal", detail: "7 min walk · final stop" },
    ],
    recovery: [
      { time: "NOW", duration: "19 min", name: "Replacement Velvet Pick", detail: "Verified open · 5 min away" },
      { time: "+27", duration: "14 min", name: "Overlooked courtyard", detail: "8 min walk · route preserved" },
      { time: "+48", duration: "9 min", name: "Quiet final reveal", detail: "7 min walk · no backtracking" },
    ],
  },
} as const;

const scenarioVisuals = {
  rain: { start: "/images/paris-covered-passage.webp", end: "/images/paris-hidden-courtyard.webp" },
  heat: { start: "/images/paris-hidden-courtyard.webp", end: "/images/paris-covered-passage.webp" },
  ticket: { start: "/images/paris-haussmann-evening.webp", end: "/images/paris-covered-passage.webp" },
  care: { start: "/images/paris-covered-passage.webp", end: "/images/paris-quiet-cafe.webp" },
  water: { start: "/images/paris-haussmann-evening.webp", end: "/images/paris-covered-passage.webp" },
  restroom: { start: "/images/paris-haussmann-evening.webp", end: "/images/paris-covered-passage.webp" },
  guardian: { start: "/images/paris-haussmann-evening.webp", end: "/images/paris-covered-passage.webp" },
  blocked: { start: "/images/paris-haussmann-evening.webp", end: "/images/paris-hidden-courtyard.webp" },
  food: { start: "/images/paris-haussmann-evening.webp", end: "/images/paris-quiet-cafe.webp" },
  secret: { start: "/images/paris-haussmann-evening.webp", end: "/images/paris-hidden-courtyard.webp" },
} as const;

const foodOptions = [
  { tag: "BEST FIT", name: "Chez Vong", rating: "9.1/10", reviews: "TheFork rating", price: "€€€", travel: "11 min walk", walk: 11, meal: 48, resume: 14, margin: 17, note: "Cantonese · 10 rue de la Grande Truanderie", status: "Open in demo · table likely", fits: true },
  { tag: "BEST VALUE", name: "Nouilles Ceinture", rating: "4.6 ★", reviews: "1,000+ demo reviews", price: "€", travel: "7 min walk", walk: 7, meal: 36, resume: 12, margin: 35, note: "Hand-pulled noodles · quick service", status: "Open in demo · no reservation", fits: true },
  { tag: "PREMIUM", name: "Shang Palace", rating: "MICHELIN ★", reviews: "Official Guide status", price: "€€€€", travel: "24 min by car", walk: 24, meal: 90, resume: 28, margin: -52, note: "Cantonese fine dining · reservation required", status: "Does not fit before Louvre", fits: false },
] as const;

const scenarioGroups = [
  { label: "CITY & ROUTE", keys: ["rain","heat","ticket","blocked"] as const },
  { label: "HUMAN NEEDS", keys: ["food","water","restroom","care"] as const },
  { label: "DISCOVERY & SAFETY", keys: ["secret","guardian"] as const },
] as const;

export default function Home(){
  const [scenario,setScenario]=useState<keyof typeof scenarios>("rain");
  const [openFaq,setOpenFaq]=useState(0);
  const [checkout,setCheckout]=useState(false);
  const [foodChoice,setFoodChoice]=useState(0);
  const [demoPhase,setDemoPhase]=useState<"ready"|"building"|"result"|"problem"|"recovered">("result");
  const selected=scenarios[scenario];
  const visual=scenarioVisuals[scenario];
  const selectedFood=foodOptions[foodChoice];
  const selectScenario=(key:keyof typeof scenarios)=>{setScenario(key);setDemoPhase("ready");if(window.matchMedia("(max-width: 760px)").matches){window.setTimeout(()=>document.getElementById("demo-result")?.scrollIntoView({behavior:"smooth",block:"start"}),120)}};
  const runDemo=(recovery=false)=>{if(recovery){setDemoPhase("problem");setTimeout(()=>{setDemoPhase("building");setTimeout(()=>setDemoPhase("recovered"),1600)},2800);return}setDemoPhase("building");setTimeout(()=>setDemoPhase("result"),1400)};
  const chooseFood=(index:number)=>{if(index===foodChoice)return;setFoodChoice(index);setDemoPhase("building");setTimeout(()=>setDemoPhase("result"),900)};
  const foodArrival=selectedFood.walk+selectedFood.meal+4;
  const foodStops:readonly DemoStop[]=[
    {time:"NOW",duration:selectedFood.travel,name:`Go to ${selectedFood.name}`,detail:`${selectedFood.status} · ${selectedFood.price}`},
    {time:`+${selectedFood.walk}`,duration:`${selectedFood.meal} min`,name:selectedFood.name,detail:`${selectedFood.rating} · ${selectedFood.reviews} · ${selectedFood.note}`},
    {time:`+${foodArrival}`,duration:`${selectedFood.resume} min`,name:selectedFood.fits?"Resume protected route":"Louvre ticket conflict",detail:selectedFood.fits?`${selectedFood.margin} min arrival margin remains`:"Save this restaurant for dinner or change the ticket plan"},
  ];
  const activeStops:readonly DemoStop[]=scenario==="food"&&demoPhase!=="recovered"?foodStops:demoPhase==="recovered"?selected.recovery:selected.stops;
  const displayedTitle=scenario==="food"&&demoPhase==="result"?(selectedFood.fits?`${selectedFood.name} fits your day.`:`${selectedFood.name} does not fit safely before the Louvre.`):selected.title;
  const displayedMeta=scenario==="food"&&demoPhase==="result"?(selectedFood.fits?`${foodArrival+selectedFood.resume} min total · ${selectedFood.margin} min ticket margin retained`:`${foodArrival+selectedFood.resume} min total · 52 min ticket conflict`):selected.meta;
  const displayedCompatibility=scenario==="food"?(selectedFood.fits?"95%":"34%"):selected.compatibility;
  const buy=()=>{setCheckout(true);setTimeout(()=>document.querySelector("#checkout")?.scrollIntoView({behavior:"smooth",block:"center"}),20)};
  const faqs=[
    ["When does my Pass start?","Only when you press “Activate now” and confirm. Buying or opening your link does not start the clock."],
    ["Do I need to download an app?","No. The launch version opens as a secure web app on your phone. You may add it to your home screen."],
    ["Are museum tickets included?","No. NOW can protect a ticket you own and help find booking options, but attraction tickets are purchased separately."],
    ["Is Paris Uncovered required?","Never. Paris NOW is complete on its own. Uncovered is an optional permanent premium guide."],
    ["What language is available?","The launch edition is in English. Additional languages and destinations are planned."],
  ];
  return <main>
    <header className="nav"><a className="wordmark nowWordmark" href="#top"><span className="rings"><i/><i/></span><span className="productBrand"><b><span>Paris</span><em>NOW</em></b></span></a><nav><a href="#how">How it works</a><a href="#features">Inside NOW</a><a href="#passes">Passes</a></nav><div className="navRight"><span className="navHouse"><small>BY</small><img src="/images/velvet-passport-logo.png" alt="Velvet Passport"/></span><a className="navCta" href="#passes">GET PARIS NOW</a></div></header>

    <section className="hero" id="top"><div className="heroCopy"><p className="kicker heroKicker"><b>WELCOME TO PARIS NOW</b><span>INTELLIGENT TRAVEL, IN THE MOMENT</span></p><h1>Paris, as it happens.<br/><em>Your plans, built for the moment.</em></h1><p className="lead">Paris NOW builds your next experience around where you are, how much time you have, the weather, your energy and the tickets you cannot afford to miss.</p><div className="actions"><a className="button gold" href="#passes">CHOOSE YOUR PASS <span>→</span></a><a className="textLink" href="#demo">See NOW decide ↓</a></div><div className="trust"><span>✓ Activate when you’re ready</span><span>✓ No app download</span><span>✓ One payment</span></div></div>
      <div className="product"><div className="halo"/><div className="phone"><div className="phoneTop"><span className="smallRings"><i/><i/></span><b><span>Paris</span><em>NOW</em></b><small>PARIS⌄</small></div><div className="phoneBody"><p>PARIS · LOUVRE & OPÉRA</p><h2>Your next<br/><em>great moment</em><br/>starts now.</h2><div className="weather"><span className="weatherIcon" aria-hidden="true">☂</span><div><b>18°</b><small>Light rain</small></div><i/><div><b>65 min</b><small>Available</small></div></div><button>BUILD MY ROUTE →</button><div className="pick"><small>NOW ROUTE · MOSTLY SHELTERED</small><b>Galerie Vivienne → Palais-Royal</b><span>64 min · 0.8 km · starts 7 min away</span></div></div><div className="phoneNav"><b>NOW</b><span>SAVED</span><span>PASS</span></div></div><div className="float one"><small>WEATHER SHIFT</small><b>Rain detected</b><span>Route rebuilt · 2 sec</span></div><div className="float two"><small>TICKET PROTECTION</small><b>Louvre · 4:30 PM</b><span>Protected arrival · armed</span></div></div>
    </section>

    <section className="proof"><p>NOT ANOTHER LIST OF PLACES</p><strong>A decision engine for the city you are actually experiencing.</strong></section>
    <section className="problem" id="why"><div className="problemIntro"><p className="kicker">THE GUIDEBOOK PROBLEM</p><h2>A city never follows<br/><em>the plan you made at home.</em></h2><figure className="editorialImage problemImage"><img src="/images/paris-covered-passage.webp" alt="A rain-washed historic covered passage in Paris at blue hour"/></figure></div><div className="problemGrid">{[["01","The weather turns","NOW changes the kind of experience—not merely the order of the same list."],["02","Your energy changes","Choose low effort, fewer crowds, less walking or a shorter, better route."],["03","A ticket controls the day","NOW protects the reservation, correct entrance and time needed to arrive."],["04","You have an unexpected hour","Start where you really are. No “Start walking” from the wrong side of Paris."]].map(x=><article key={x[0]}><span>{x[0]}</span><h3>{x[1]}</h3><p>{x[2]}</p></article>)}</div></section>

    <section className="howNow" id="how"><div className="heading"><p className="kicker">HOW PARIS NOW WORKS</p><h2>Give it the moment.<br/>Get the right next move.</h2></div><div className="howSteps"><article><span>01</span><small>TELL NOW WHAT YOU HAVE</small><h3>Your real situation</h3><p>Location, available time, weather, energy and any ticket that controls the day.</p></article><article><span>02</span><small>GET YOUR ROUTE</small><h3>A realistic sequence</h3><p>Verified places, walking time, useful margins and a minute-by-minute order that makes sense.</p></article><article><span>03</span><small>ADAPT AS PARIS CHANGES</small><h3>Your day stays intact</h3><p>Rain, heat, delays, closures or fatigue can contract or rebuild the route without starting over.</p></article></div></section>

    <section className="demo" id="demo"><Heading kicker="TRY IT BEFORE YOU BUY" title="Watch Paris NOW make the decision." text="Choose a city condition or a human need. Every selection recalculates the route in front of you."/><button type="button" className="demoLaunchTop" onClick={()=>{runDemo(false);window.setTimeout(()=>document.getElementById("demo-result")?.scrollIntoView({behavior:"smooth",block:"start"}),80)}}>TRY THE LIVE DEMO →</button><div className="demoGrid demoExperience"><div id="demo-options" className="controls"><small className="controlLabel">WHAT DO YOU NEED RIGHT NOW?</small>{scenarioGroups.map(group=><div className="controlGroup" key={group.label}><small>{group.label}</small><div>{group.keys.map(key=>{const value=scenarios[key];return <button className={scenario===key?"active":""} type="button" onClick={()=>selectScenario(key)} key={key}><span>{value.icon}</span>{value.label}</button>})}</div></div>)}<p>Interactive demonstration · every option rebuilds the result</p></div><div id="demo-result" className="decision demoDecision" aria-live="polite"><button type="button" className="demoScenarioReturn" onClick={()=>{setDemoPhase("ready");document.getElementById("demo-options")?.scrollIntoView({behavior:"smooth",block:"start"})}}>← TRY ANOTHER SCENARIO</button><div className="decisionTop"><small>LOUVRE & OPÉRA · LIVE DEMO</small><span className={scenario==="food"&&!selectedFood.fits?"compatibilityWarning":""}>{displayedCompatibility} compatible</span></div>{demoPhase==="ready"?<div className="demoReady"><span className="demoIcon">{selected.icon}</span><h3>{selected.title}</h3><p>Paris NOW is ready to combine your conditions with verified places and realistic travel time.</p><button type="button" className="demoBuild" onClick={()=>runDemo(false)}>BUILD MY DEMO ROUTE →</button></div>:demoPhase==="building"?<div className="demoBuilding"><span className="demoSpinner"/><b>Paris NOW is rebuilding your route…</b><small>Checking time · conditions · walking logic · recovery margin</small></div>:<><div className="demoResultHead"><small>{demoPhase==="recovered"?"RECOVERY MODE · ROUTE REBUILT":demoPhase==="problem"?"LIVE PROBLEM DETECTED":"YOUR NOW ROUTE"}</small><h3>{demoPhase==="recovered"?selected.recoveredTitle:demoPhase==="problem"?selected.change:displayedTitle}</h3><p>{demoPhase==="recovered"?selected.recoveredMeta:demoPhase==="problem"?"Paris NOW is isolating the affected step before rebuilding.":displayedMeta}</p></div>{scenario==="food"&&demoPhase!=="problem"&&<div className="restaurantChoices"><div className="restaurantChoicesTitle"><small>3 LIVE-STYLE RESULTS · PALAIS-ROYAL</small><span>Tap one to recalculate</span></div>{foodOptions.map((item,index)=><button type="button" className={`${foodChoice===index?"selected":""} ${!item.fits?"conflict":""}`} onClick={()=>chooseFood(index)} key={item.name}><small>{item.tag}</small><h4>{item.name}</h4><b>{item.rating} <i>·</i> {item.price}</b><span>{item.reviews} · {item.travel}</span><em>{item.note}</em><strong>{foodChoice===index?(item.fits?"SELECTED · ROUTE UPDATED ✓":"SELECTED · CONFLICT SHOWN"):(item.fits?"ADD & RECALCULATE":"CHECK THIS OPTION")}</strong></button>)}</div>}{scenario==="guardian"?<div className="guardianHelpPanel"><div className="guardianLocation"><small>YOUR LOCATION IS READY</small><b>Share my exact position</b><span>With my hotel or trusted contact</span></div><div className="guardianNumbers"><button type="button"><small>MEDICAL EMERGENCY</small><b>SAMU · 15</b></button><button type="button"><small>POLICE OR GENDARMERIE</small><b>CALL · 17</b></button><button type="button"><small>FIRE OR RESCUE</small><b>FIREFIGHTERS · 18</b></button><button type="button"><small>EUROPEAN EMERGENCY</small><b>CALL · 112</b></button><button type="button"><small>EMERGENCY BY TEXT</small><b>TEXT · 114</b></button><button type="button" className="nearbyHelp"><small>NEARBY CARE</small><b>Hospital · Pharmacy</b></button></div><p>Demo preview only · Buttons do not place a call.</p></div>:<div className="routeVisuals"><figure><img src={visual.start} alt="Visual preview of the starting area"/><figcaption><small>STARTING POINT</small><b>{activeStops[0].name}</b></figcaption></figure><span>→</span><figure className="arrivalVisual"><img src={visual.end} alt="Visual preview of the final area"/><figcaption><small>FINAL DESTINATION</small><b>{activeStops[activeStops.length-1].name}</b></figcaption></figure></div>}<div className={`routeTimeline ${demoPhase}`}>{activeStops.map((stop,index)=><article className={index===activeStops.length-1?(scenario==="food"&&!selectedFood.fits?"problemStop":"destinationStop"):demoPhase==="problem"&&index===1?"problemStop":""} key={stop.name}><div className="routeTime"><b>{stop.time}</b><small>{stop.duration}</small></div><i/><div className="routeStop"><b>{stop.name}</b><span>{stop.detail}</span></div>{index<activeStops.length-1&&<em/>}</article>)}</div><div className="routeLegend"><span><i/>Current</span><span><i/>Next</span><span><i/>Destination</span></div><div className="demoWhy"><small>WHY NOW CHOSE THIS</small><p>{selected.reason}</p></div>{demoPhase==="result"&&<button type="button" className="demoChange" onClick={()=>runDemo(true)}>{selected.change} — REBUILD →</button>}{demoPhase==="recovered"&&<button type="button" className="demoChange secondary" onClick={()=>setDemoPhase("ready")}>TRY ANOTHER VERSION ↻</button>}<a className="demoCta" href="#passes">UNLOCK PARIS ACROSS THE CITY →</a></>}</div></div><p className="demoDisclosure">This demonstration uses prepared scenarios and illustrative location photography and restaurant data in one zone. A paid Pass will unlock the complete Paris NOW decision system across available Paris zones.</p></section>

    <section className="careNow" id="guardian"><div className="careIntro"><p className="kicker">PARIS NOW · COMPLETE TRAVEL CARE</p><h2>Built around the journey.<br/><em>And the person living it.</em></h2><p>Plans change because cities change—and because people do. NOW can create a food break, find water or a restroom, reduce effort, protect a medication reminder and pause the journey when help matters more than sightseeing.</p></div><div className="careConsole"><div className="careConsoleTop"><span>NOW CARE</span><b>What do you need right now?</b></div><div className="careUnified"><small>ONE DEMO · EVERY REAL-LIFE OPTION</small><b>Food, water, restroom, rest, blocked streets and Guardian now live together in the demonstrator above.</b><a href="#demo">OPEN THE COMPLETE DEMO ↑</a></div><a href="#demo" onClick={()=>selectScenario("guardian")} className="guardianPreview"><span>✚</span><div><small>NOW GUARDIAN</small><b>I NEED HELP</b><p>Pause the journey · prepare my location · show help options</p></div><em>→</em></a><p className="careSafety">Guardian supports access to help; it does not replace emergency services or medical advice.</p></div></section>

    <section className="features" id="features"><div className="heading dark featuresHeading"><div className="sectionNowMark"><span className="rings"><i/><i/></span><b><span>Paris</span><em>NOW</em></b></div><h2>Built for the moments that ordinary travel apps ignore.</h2><p className="kicker featureKicker">INSIDE YOUR PASS</p></div><figure className="editorialImage featureImage"><img src="/images/paris-hidden-courtyard.webp" alt="A secluded Paris courtyard illuminated at dusk"/></figure><div className="featureGrid">{[["⌁","01 · NOW ROUTES","Minute-by-minute routes","Pre-researched experiences that contract or rebuild around your real time and location."],["☂","02 · WEATHER INTELLIGENCE","Too hot. Too cold. Rain. Snow.","Conditions change the recommendation itself, with shelter and recovery logic."],["◉","03 · TICKET RESCUE","Find a viable ticket—fast","Official ticketing first, qualified alternatives and always a no-ticket Plan B."],["◇","04 · TICKET PROTECTION","Protect what you booked","Your ticket becomes the anchor. NOW contracts the route and guides the right access."],["✦","05 · VELVET PICKS","Rare, discreet, exceptional","NOW can favour places with genuine discovery value, not only famous attractions."],["↗","06 · RECOVERY MODE","When the day goes wrong","A closure, delay or refusal does not need to destroy the day. NOW rebuilds it."],["○","07 · HUMAN NEEDS","Food. Water. Restroom. Rest.","NOW creates the pause you need and protects what comes next."],["✚","08 · NOW GUARDIAN","A discreet layer of reassurance","Pause the journey, prepare your exact location and reach the right help quickly."]].map(x=><article key={x[1]}><span>{x[0]}</span><small>{x[1]}</small><h3>{x[2]}</h3><p>{x[3]}</p></article>)}</div></section>

    <section className="activation"><div><p className="kicker">BUY NOW · START LATER</p><h2>Your Pass never<br/><em>starts at checkout.</em></h2><p>Purchase before your trip. Your time begins only when you explicitly choose <b>Activate now</b>—in Paris, when you are ready.</p></div><div className="flow">{[["1","Purchase","Pass status: Not activated"],["2","Arrive in Paris","Open your secure personal link"],["3","Activate","72 hours or 7 days begin"]].map((x,i)=><div className="flowWrap" key={x[0]}><article><span>{x[0]}</span><b>{x[1]}</b><small>{x[2]}</small></article>{i<2&&<i>→</i>}</div>)}</div></section>

    <section className="pricing" id="passes"><Heading kicker="CHOOSE YOUR PARIS NOW PASS" title="Less than the price of one wasted hour." text="Tickets, transport and paid attractions are purchased separately."/><div className="priceGrid"><Price title="Paris NOW 72 Hours" price="11" cents=".90" description="Three continuous days from activation." items={["Full NOW decision engine","Weather and energy filters","NOW routes and Velvet Picks","Ticket Rescue and Protection","Activate within 12 months"]} buy={buy}/><Price featured title="Paris NOW 7 Days" price="18" cents=".90" description="Seven continuous days from activation." items={["Everything in the 72-hour Pass","More room for changing plans","Ideal for a full Paris stay","One account, one secure Pass","Activate within 12 months"]} buy={buy}/></div><div id="checkout" className={`checkout ${checkout?"show":""}`}><span>◇</span><div><b>Stripe Checkout will open here.</b><p>Live payment links will be connected after the commercial offer and refund policy are approved. No payment has been taken.</p></div></div><p className="micro">Secure checkout powered by Stripe · Buy now, activate later · English launch edition</p></section>

    <section className="productCompare"><div className="heading"><p className="kicker">TWO DIFFERENT WAYS TO EXPERIENCE PARIS</p><h2>NOW guides the moment.<br/>Uncovered stays with you.</h2></div><div className="compareGrid"><article className="compareNow"><small>LIVE GUIDED WEB APP</small><h3>Paris <b>NOW</b></h3><ul><li>72-hour or 7-day Pass</li><li>Builds and rebuilds live routes</li><li>Uses time, weather, energy and tickets</li><li>Designed for decisions during the trip</li></ul><a href="#passes">CHOOSE A NOW PASS →</a></article><article><small>PERMANENT DIGITAL GUIDE</small><h3>Paris Uncovered</h3><ul><li>One-time purchase</li><li>25 secret addresses and exact locations</li><li>Mobile-friendly PDF with permanent access</li><li>Designed for deeper independent discovery</li></ul><a href="https://www.etsy.com/listing/4517688727/paris-uncovered-25-secret-addresses" target="_blank" rel="noreferrer">BUY PARIS UNCOVERED →</a></article></div><p>They complement each other, but neither is required to use the other.</p></section>

    <section className="uncovered"><div><p className="kicker">PARIS UNCOVERED PREMIUM OPTION</p><h2><span className="inlineNow"><span>Paris</span><b>NOW</b></span> guides your day.<br/><em>Paris Uncovered takes you beyond the obvious.</em></h2><p><b>Paris Uncovered is a separate permanent digital guide—not included in your Paris NOW Pass.</b> It reveals 25 secret addresses, with exact locations and practical details, for travellers who want to explore beyond their live NOW routes.</p></div><div className="uncoveredSide"><figure className="editorialImage uncoveredImage"><img src="/images/paris-haussmann-evening.webp" alt="A quiet Haussmannian Paris street glowing after rain"/></figure><aside><small>SEPARATE DIGITAL GUIDE · OPTIONAL</small><b>Paris Uncovered</b><span>25 secret addresses · exact locations · mobile-friendly PDF</span><p>Buy once and keep it permanently. Delivered instantly through Etsy.</p><a className="uncoveredCta" href="https://www.etsy.com/listing/4517688727/paris-uncovered-25-secret-addresses" target="_blank" rel="noreferrer">BUY PARIS UNCOVERED →</a></aside></div></section>

    <section className="faq"><div><p className="kicker">QUESTIONS, ANSWERED</p><h2>Before you enter Paris NOW.</h2></div><div>{faqs.map((f,i)=><article className={openFaq===i?"open":""} key={f[0]}><button onClick={()=>setOpenFaq(openFaq===i?-1:i)} aria-expanded={openFaq===i}><b>{f[0]}</b><span>{openFaq===i?"−":"+"}</span></button>{openFaq===i&&<p>{f[1]}</p>}</article>)}</div></section>
    <section className="final"><div className="finalProductMark"><span className="largeRings"><i/><i/></span><b><span>Paris</span><em>NOW</em></b></div><p className="kicker">THE GUIDED APP THAT DIDN’T EXIST—UNTIL NOW</p><h2>Paris, exactly when<br/><em>you need it.</em></h2><a className="button gold" href="#passes">CHOOSE YOUR PASS →</a><small><span>One intelligent travel companion.</span><span>Every city, exactly when you need it.</span></small></section>
    <a className="mobileStickyCta" href="#passes"><span>GET PARIS NOW</span><small>FROM €11.90</small></a>
    <footer><nav><a href="/terms">Terms</a><a href="/privacy">Privacy</a><a href="/refund-policy">Refund policy</a><a href="/contact">Contact</a></nav><small>© 2026 Velvet Passport. Attraction names and trademarks belong to their respective owners.</small></footer>
  </main>
}

function Heading({kicker,title,text,dark=false}:{kicker:string,title:string,text?:string,dark?:boolean}){return <div className={`heading ${dark?"dark":""}`}><p className="kicker">{kicker}</p><h2>{title}</h2>{text&&<p>{text}</p>}</div>}
function Price({title,price,cents,description,items,buy,featured=false}:{title:string,price:string,cents:string,description:string,items:string[],buy:()=>void,featured?:boolean}){return <article className={featured?"featured":""}>{featured&&<div className="best">BEST VALUE</div>}<small>{featured?"THE COMPLETE STAY":"SHORT CITY BREAK"}</small><h3>{title}</h3><div className="price"><sup>€</sup>{price}<sup>{cents}</sup></div><p>{description}</p><ul>{items.map(x=><li key={x}>{x}</li>)}</ul><button onClick={buy}>BUY {featured?"7-DAY":"72-HOUR"} PASS →</button></article>}
