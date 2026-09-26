/* ═══════════════════════════════════════════════════════════════
   EDIT ONLY THIS BLOCK
   ═══════════════════════════════════════════════════════════════ */
const CFG = {

  /* 1 · CONNECTIONS */
  appsScriptUrl : "https://script.google.com/macros/s/AKfycbx-k-YC5AV6-W3Mr0kTOl54JLj4K04rIfdUfgvzlexzuAj8krkqzhM9ymDq2qZeujLc/exec",
  telegramUrl   : "https://t.me/+ouIRupHdiuQ2MjZl",
  contactEmail  : "persatuanbeliacendekiaholistik@gmail.com",

  /* 2 · THE 100 DAYS */
  startsAt : "2026-08-24T00:00:00+08:00",
  endsAt   : "2026-12-01T23:59:00+08:00",

  /* 3 · PLACES + WAITING LIST */
  capacity  : 500,   // hard cap on volunteer places
  filled    : 159,   // first-paint fallback only; the Sheet is the real count
  waitlist  : 0,     // how many are already queued
  forceOpen : true,  // true = form always visible

  /* 4 · VISITOR COUNTER
     "auto"  = real count from your Apps Script (needs the doGet in Code.gs)
     "off"   = hide it. Never invent a number here. */
  visitorCounter : "auto",

  /* 5 · SOCIAL. Leave url blank to hide a card. */
  social: [
    { key:"ig", name:"INSTAGRAM", handle:"@gengvolunteers", url:"https://www.instagram.com/gengvolunteers/" },
    { key:"ig2",name:"GENG SCHOLARS", handle:"@gengscholars", url:"https://www.instagram.com/gengscholars/" },
    { key:"tt", name:"TIKTOK",    handle:"@gengscholars",  url:"" },
    { key:"fb", name:"FACEBOOK",  handle:"GengVolunteers", url:"" },
    { key:"th", name:"THREADS",   handle:"@gengvolunteers",url:"" }
  ],

  /* 6 · INSTAGRAM EMBEDS
     Open a real post, copy the code out of the link:
     instagram.com/p/DGx1a2bQZk9/  →  "DGx1a2bQZk9"
     Reels use /reel/ but the same code works. Leave empty to hide. */
  igPosts: [
    { c:"DXUskeKkhav", t:"reel", g:"Field", n:"Cycle one, in motion" },
    { c:"DXUtIyLEtw5", t:"reel", g:"Field", n:"The teams, on the day" },
    { c:"DZzbBFomayD", t:"p", g:"Agency", n:"Working with government agencies" },
    { c:"DZE5jBEEdus", t:"p", g:"Agency", n:"On the agency programme" },
    { c:"DYi4TZaRInr", t:"reel", g:"Agency", n:"Agency collaboration, on site" },
    { c:"DYZHfy-RxiU", t:"reel", g:"Agency", n:"Partners in the field" },
    { c:"DY1yAFvkhjW", t:"p", g:"Agency", n:"The latest programme" },
    { c:"DY1pinaSJgy", t:"reel", g:"Agency", n:"Latest programme, in motion" },
    { c:"DX5VDIOSr_Z", t:"reel", g:"Squads", n:"Squad diary" },
    { c:"DX5VlXAS85W", t:"reel", g:"Squads", n:"Squad diary, part two" },
    { c:"DX5uS_IRX2c", t:"reel", g:"Squads", n:"Behind the build" },
    { c:"DXvOcPPSPYS", t:"reel", g:"Squads", n:"Project day" },
    { c:"DXvk3zhESNa", t:"p", g:"Squads", n:"Project day, in pictures" },
    { c:"DXtRynfkVl-", t:"reel", g:"Squads", n:"The volunteers speak" },
    { c:"DXqkgtakUDC", t:"reel", g:"Squads", n:"Getting it done" }
  ],

  /* 7 · THE RECORD (National Impact Report, April 2026) */
  record: [
    { n:14,    lab:"PROJECTS",       sub:"March to May 2026" },
    { n:13,    lab:"STATES",         sub:"four zones" },
    { n:1500,  suf:"+", lab:"VOLUNTEERS", sub:"registered nationwide" },
    { n:550,   suf:"+", lab:"BENEFICIARIES", sub:"orphans, OKU, Orang Asli, asnaf" },
    { n:28000, pre:"RM", suf:"+", lab:"CASH MOBILISED", sub:"crowdfunding and sponsors" },
    { n:7500,  pre:"RM", suf:"+", lab:"IN KIND VALUE",  sub:"food, goods, equipment" },
    { n:75,    suf:"+", lab:"ACTIVITY SLOTS", sub:"delivered nationwide" },
    { n:170,   suf:"+", lab:"HIGH COMMITTEE", sub:"appointed role holders" }
  ],

  /* 8 · MONTAGE. type: "image" or "video" */
  montage: [],

  /* 8b · NATIONAL XI. The national line for the 2026 cycle. */
  nationalXI: [
    { n:"Afiq Naufal",       r:"National Director",              c:"ND",    z:"" },
    { n:"Afriena Hafnie",    r:"Deputy Director, Communication", c:"DDC",   z:"" },
    { n:"Dhaniyah Nabilia",  r:"Deputy Director, Operation",     c:"DDO",   z:"" },
    { n:"Aisya Fazrul",      r:"Sponsorship & Funding Lead",     c:"SFL",   z:"" },
    { n:"Durratun Nadhirah", r:"Documentation & Reports Lead",   c:"DRL",   z:"" },
    { n:"Amal Sayyidah",     r:"T-shirt & Logistics Lead",       c:"TLD",   z:"" },
    { n:"Imran Mukhriz",     r:"Zone Coordinator, North",        c:"ZC-N",  z:"n" },
    { n:"Dalia Syamimi",     r:"Zone Coordinator, Central",      c:"ZC-C",  z:"c" },
    { n:"Aisya Sofea",       r:"Zone Coordinator, South",        c:"ZC-S",  z:"s" },
    { n:"Hana Khalila",      r:"Zone Coordinator, East Coast",   c:"ZC-EC", z:"e" },
    { n:"Nurul Najwa",       r:"Zone Coordinator, Borneo",       c:"ZC-B",  z:"b" }
  ],
  nationalXIImage : "assets/nationalxi.webp",

  /* 8c · THE SQUAD MAP
     Every squad that has a badge on the map.
       st    the squad name, shown on the card
       key   must match the state in the PROJECTS list further down so the
             card can pull that squad's cycle one project. Leave "" if none.
       zone  n north · c central · s south · e east coast · b borneo
       x,y   where the badge sits on the map, in per cent. Only change these
             if you replace the map artwork itself.
       w     how wide the tap target is, in per cent of the map
       logo  cut out badge for the card. Leave "" to show a lettered tile.
       poster the high committee poster. Leave "" if it is not ready. */
  stateSquads: [
    { st:"Perlis",          key:"Perlis",            zone:"n", x:9,    y:11, w:12,
      logo:"assets/lg-perlis.webp",           poster:"assets/hc-perlis.webp" },
    { st:"Perak",           key:"Perak",             zone:"n", x:21,   y:15, w:12,
      logo:"assets/lg-perak.webp",            poster:"assets/hc-perak.webp" },
    { st:"Kelantan",        key:"Kelantan",          zone:"e", x:32,   y:22, w:12,
      logo:"assets/lg-kelantan.webp",         poster:"assets/hc-kelantan.webp" },
    { st:"Pulau Pinang",    key:"Pulau Pinang",      zone:"n", x:7,    y:29, w:12,
      logo:"assets/lg-penang.webp",           poster:"assets/hc-penang.webp" },
    { st:"National XI",     key:"",                  zone:"",  x:61,   y:26, w:25,
      logo:"assets/lg-nationalxi.webp",       poster:"assets/nationalxi.webp",
      note:"The national line. Eleven people who run the whole cycle." },
    { st:"Terengganu",      key:"Terengganu",        zone:"e", x:40,   y:37, w:14,
      logo:"assets/lg-terengganu.webp",       poster:"assets/hc-terengganu.webp" },
    { st:"Kedah",           key:"Kedah",             zone:"n", x:7.5,  y:44, w:13,
      logo:"assets/lg-kedah.webp",            poster:"assets/hc-kedah.webp" },
    { st:"Sarawak",         key:"",                  zone:"b", x:60,   y:51, w:9,
      logo:"assets/lg-sarawak.webp",          poster:"", soon:"NO SQUAD<br>YET",
      note:"No squad on the ground yet. Borneo opens in cycle two." },
    { st:"Pahang",          key:"Pahang",            zone:"e", x:39,   y:52, w:10,
      logo:"assets/lg-pahang.webp",           poster:"assets/hc-pahang.webp" },
    { st:"Putrajaya",       key:"WP Putrajaya",      zone:"c", x:5,    y:60, w:10,
      logo:"assets/lg-putrajaya.webp",        poster:"assets/hc-putrajaya.webp" },
    { st:"Selangor",        key:"Selangor",          zone:"c", x:15,   y:62, w:10,
      logo:"assets/lg-selangor.webp",         poster:"assets/hc-selangor.webp" },
    { st:"Sabah",           key:"",                  zone:"b", x:83.5, y:66, w:11,
      logo:"assets/lg-sabah.webp",            poster:"", soon:"NO SQUAD<br>YET",
      note:"No squad on the ground yet. Borneo opens in cycle two." },
    { st:"Negeri Sembilan B", key:"Negeri Sembilan B", zone:"c", x:44, y:69, w:9,
      logo:"assets/lg-negerisembilan-b.webp", poster:"assets/hc-negerisembilan.webp" },
    { st:"Kuala Lumpur",    key:"WP Kuala Lumpur",   zone:"c", x:12.5, y:74, w:11,
      logo:"assets/lg-kualalumpur.webp",      poster:"assets/hc-kualalumpur.webp" },
    { st:"Negeri Sembilan A", key:"Negeri Sembilan A", zone:"c", x:23, y:76, w:10,
      logo:"assets/lg-negerisembilan-a.webp", poster:"" },
    { st:"Melaka",          key:"Melaka",            zone:"s", x:31.5, y:88, w:13,
      logo:"",                                poster:"assets/hc-melaka.webp" },
    { st:"Johor",           key:"Johor",             zone:"s", x:41,   y:89, w:11,
      logo:"assets/lg-johor.webp",            poster:"assets/hc-johor.webp" }
  ],

  /* 9 · SPONSOR TIERS (Sponsorship Kit 2026) */
  tiers: [
    { name:"BRONZE", key:"bronze", price:"RM500", line:"worn by every volunteer",
      worth:"Roughly the cost of one squad's materials for a full project day.",
      reach:["1 STATE","SHIRT TAG","REPORT CREDIT"],
      items:["Logo on the volunteer shirt, sleeve or back tag","Named in the project report","Certificate of appreciation","Named in the community channel"] },
    { name:"SILVER", key:"silver", price:"RM800", line:"seen by the whole village",
      worth:"Covers catering and logistics for a project of forty volunteers.",
      reach:["1 ZONE","BANNERS","1 SOCIAL POST"],
      items:["Logo on project banners in your chosen state or zone","Logo in the official project report","One dedicated social post","Recognised as Community Partner 2026","Certificate of appreciation"] },
    { name:"GOLD", key:"gold", price:"RM1,500+", line:"front of shirt, every state", feat:true,
      worth:"Underwrites an entire state project end to end, materials included.",
      reach:["ALL 13 STATES","FRONT OF SHIRT","DEDICATED FEATURE"],
      items:["Premium placement on the volunteer shirt, front and centre","Logo on every banner where your sponsorship applies","Dedicated social feature across both accounts","Brand in the final national impact report","Certificate on association letterhead","Named in the closing ceremony"] }
  ],

  registeredEntity : "Persatuan Belia Cendekia Holistik",
  regStatusLine    : "Registration with the Registrar of Youth is in progress. The number goes here the day it is issued."
};
