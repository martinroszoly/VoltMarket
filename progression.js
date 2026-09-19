/* VoltMarket 4.0 – late-game progression, multi-customer desk and managed technicians. */
'use strict';

const VM4 = {
  franchisePrice: 12000000,
  franchiseCycle: 60,
  flagshipPrice: 45000000,
  flagshipCycle: 120,
  premiumFloorPrice: 15000000,
  jobTechPrice: 6500000,
  repairPrices: [3500000, 5250000, 7500000],
  customerPrices: [4000000, 6000000, 8500000]
};

const vmText = (hu, en) => state.language === 'en' ? en : hu;
const vmRandomDelay = () => 20000 + Math.floor(Math.random() * 15001);
const vmId = prefix => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

Object.assign(translations.hu, {
  navWheel:'Tech bónusz', launchWheel:'Vedd át',
  techBonusEyebrow:'INGYENES TECH BÓNUSZ',techBonusTitle:'Tech jutalomkör',techBonusSubtitle:'Tizenöt percenként aktiválhatod a következő, előre látható játékbeli bónuszt.',techBonusClaim:'JUTALOM AKTIVÁLÁSA',techBonusReadyText:'A következő jutalom előre látható és tizenöt percenként aktiválható.',techBonusRewards:'20 ELÉRHETŐ JUTALOM',techBonusNoStake:'Ingyenes · nincs tét · a termékjutalmak prémium minőségűek',
  customerDeskEyebrow:'ÜGYFÉLSZOLGÁLAT', customerDeskTitle:'Ügyfélajánlatok',
  businessHubTitle:'VoltMarket üzleti központ', businessHubSubtitle:'Nyiss üzleteket, fejleszd a franchise-t és építs prémium technológiai emeletet.'
});
Object.assign(translations.en, {
  navWheel:'Tech bonus', launchWheel:'Claim bonus',
  techBonusEyebrow:'FREE TECH BONUS',techBonusTitle:'Tech reward orbit',techBonusSubtitle:'Activate the next visible in-game bonus every fifteen minutes.',techBonusClaim:'ACTIVATE REWARD',techBonusReadyText:'The next reward is visible in advance and can be activated every fifteen minutes.',techBonusRewards:'20 AVAILABLE REWARDS',techBonusNoStake:'Free · no stake · product rewards are premium quality',
  customerDeskEyebrow:'CUSTOMER SERVICE', customerDeskTitle:'Customer offers',
  businessHubTitle:'VoltMarket business hub', businessHubSubtitle:'Open stores, upgrade your franchise, and build a premium technology floor.'
});

const vmDefaults = {
  customerSlots: [],
  activeOrders: [],
  enterpriseOffer: null,
  enterpriseNextAt: 0,
  enterpriseContract: null,
  repairCrewHired: 0,
  repairCrewJobs: [null, null, null],
  customerCrewHired: 0,
  customerCrewJobs: [null, null, null],
  jobTechHired: false,
  jobTechJob: null,
  employeeXpNextAt: 0,
  franchiseOwned: false,
  franchiseUpgrades: [],
  franchiseNextPayAt: 0,
  franchisePending: 0,
  premiumFloorOwned: false,
  premiumShelves: [],
  premiumListings: [],
  flagshipOwned: false,
  flagshipUpgrades: [],
  flagshipNextPayAt: 0,
  flagshipPending: 0
};

Object.entries(vmDefaults).forEach(([key, value]) => {
  if (workshop[key] === undefined) workshop[key] = Array.isArray(value) ? [...value] : value;
});
workshop.repairCrewJobs = Array.from({length: 3}, (_, i) => workshop.repairCrewJobs?.[i] || null);
workshop.customerCrewJobs = Array.from({length: 3}, (_, i) => workshop.customerCrewJobs?.[i] || null);

if (workshop.activeOrder && !workshop.activeOrder.multiMode) {
  workshop.activeOrders.push(workshop.activeOrder);
}
workshop.activeOrder = {multiMode: true};

function vmPersist() {
  localStorage.setItem('voltmarket-workshop', JSON.stringify(workshop));
  localStorage.setItem('voltmarket-save', JSON.stringify(state));
  updateHud();
}

function vmCommit(message) {
  updateLevel();
  vmPersist();
  renderWorkshop();
  renderEmployees();
  renderStore();
  renderJobs();
  if (message) toast(message);
}

/* Advanced parts and level-50 products. */
[
  {id:'flightController',name:'Drón repülésvezérlő',nameEn:'Drone flight controller',icon:'◇',price:88000,level:50},
  {id:'droneMotor',name:'Kefe nélküli motorkészlet',nameEn:'Brushless motor set',icon:'✣',price:74000,level:50},
  {id:'lidar',name:'LiDAR érzékelő',nameEn:'LiDAR sensor',icon:'◉',price:96000,level:50},
  {id:'robotDrive',name:'Robotikai meghajtás',nameEn:'Robotic drive unit',icon:'⚙',price:105000,level:50}
].forEach(part => { if (!workshopParts.some(p => p.id === part.id)) workshopParts.push(part); });

[
  {id:'dronefix',name:'Hibás AeroVolt drón',nameEn:'Faulty AeroVolt drone',icon:'✥',buy:145000,sell:720000,parts:['flightController','droneMotor','camera','battery'],fault:'Instabil repülésvezérlés és sérült kamerarendszer.',faultEn:'Unstable flight control and a damaged camera system.',level:50,premiumFloor:true,shelf:'drone'},
  {id:'mixedrealityfix',name:'Hibás Nova XR rendszer',nameEn:'Faulty Nova XR system',icon:'◈',buy:175000,sell:840000,parts:['vrDisplay','motion','lens','lidar'],fault:'Térérzékelési és optikai kalibrációs hibák.',faultEn:'Spatial tracking and optical calibration faults.',level:50,premiumFloor:true,shelf:'xr'},
  {id:'robotfix',name:'Hibás Vector szervizrobot',nameEn:'Faulty Vector service robot',icon:'✦',buy:210000,sell:980000,parts:['cpu','robotDrive','lidar','battery'],fault:'Meghajtási és navigációs rendszerhiba.',faultEn:'Drive and navigation system failure.',level:50,premiumFloor:true,shelf:'robotics'}
].forEach(item => { if (!blueprints.some(b => b.id === item.id)) blueprints.push(item); });

const vmBaseBlueprintAccess = blueprintAccess;
blueprintAccess = function (item) {
  if (item?.premiumFloor && (!workshop.premiumFloorOwned || !workshop.premiumShelves.includes(item.shelf))) return false;
  return vmBaseBlueprintAccess(item);
};
const vmBaseAccessText = accessText;
accessText = function (item) {
  if (item?.premiumFloor && state.level < 50) return vmText('50. szint','Level 50');
  if (item?.premiumFloor && !workshop.premiumFloorOwned) return vmText('Prémium emelet','Premium floor');
  if (item?.premiumFloor && !workshop.premiumShelves.includes(item.shelf)) return vmText('Megfelelő termékpolc','Matching product shelf');
  return vmBaseAccessText(item);
};

function vmBlueprintName(item) { return state.language === 'en' && item.nameEn ? item.nameEn : item.name; }
function vmBlueprintFault(item) { return state.language === 'en' && item.faultEn ? item.faultEn : item.fault; }
function vmQualityName(id) {
  const names = {used:['Használt','Used'],normal:['Normál','Standard'],premium:['Prémium','Premium']};
  return vmText(...(names[id] || [id,id]));
}

/* Five independent, hidden-timer customer slots. */
function vmCreateOffer(slot) {
  const pool = blueprints.filter(b => !b.printer && !b.premiumFloor && vmBaseBlueprintAccess(b));
  const item = pool[Math.floor(Math.random() * pool.length)] || blueprints[0];
  const qualityPool = state.level >= 8 ? ['used','normal','premium'] : ['used','normal'];
  const quality = qualityPool[Math.floor(Math.random() * qualityPool.length)];
  const profile = customerProfiles[Math.floor(Math.random() * customerProfiles.length)];
  const now = Date.now();
  slot.offer = {
    id: vmId('customer'), customer: profile.name, gender: profile.gender, avatar: profile.avatar,
    type: item.id, quality, reward: Math.round(item.sell * qualities[quality].sell * 1.16),
    xp: 35 + Math.round(item.level * 2), expiresAt: now + vmRandomDelay()
  };
  slot.nextAt = 0;
}

function vmEnsureCustomerSlots() {
  const now = Date.now();
  if(!Array.isArray(workshop.customerSlots))workshop.customerSlots=[];
  if(!Array.isArray(workshop.activeOrders))workshop.activeOrders=[];
  if(!workshop.activeOrder?.multiMode)workshop.activeOrder={multiMode:true};
  while (workshop.customerSlots.length < 5) workshop.customerSlots.push({offer:null,nextAt:now + Math.floor(Math.random()*2500)});
  workshop.customerSlots = workshop.customerSlots.slice(0,5);
}

function vmTickCustomers() {
  vmEnsureCustomerSlots();
  const now = Date.now();
  workshop.customerSlots.forEach(slot => {
    if (slot.offer && now >= slot.offer.expiresAt) {
      slot.offer = null;
      slot.nextAt = now + vmRandomDelay();
    } else if (!slot.offer && now >= (slot.nextAt || 0)) vmCreateOffer(slot);
  });
}

generateCustomerOffer = function () { vmTickCustomers(); };
acceptOffer = function (slotIndex = 0) {
  if (workshop.activeOrders.length >= 5) return toast(vmText('Egyszerre legfeljebb öt ügyfélmunkát vállalhatsz.','You can accept up to five customer jobs at once.'));
  const slot = workshop.customerSlots[Number(slotIndex)], order = slot?.offer;
  if (!order) return;
  workshop.activeOrders.push({...order});
  workshop.projects.push({uid:workshop.nextId++,type:order.type,diagnosed:false,quality:order.quality,source:'customer',orderId:order.id,reward:order.reward,investment:0});
  slot.offer = null;
  slot.nextAt = Date.now() + vmRandomDelay();
  vmCommit(vmText(`${order.customer} megrendelése bekerült a műhelybe.`,`${order.customer}'s order was added to the workshop.`));
};
declineOffer = function (slotIndex = 0) {
  const slot = workshop.customerSlots[Number(slotIndex)];
  if (!slot?.offer) return;
  slot.offer = null;
  slot.nextAt = Date.now() + vmRandomDelay();
  vmCommit(vmText('Az ajánlat elutasítva. Az új ügyfél később érkezik.','Offer declined. A new customer will arrive later.'));
};
deliverOrder = function (index) {
  const item = workshop.finished[index];
  if (!item || item.source !== 'customer') return;
  const orderIndex = workshop.activeOrders.findIndex(o => o.id === item.orderId);
  if (orderIndex < 0) return toast(vmText('A megrendelés nem található.','The order could not be found.'));
  const order = workshop.activeOrders[orderIndex];
  state.balance += order.reward;
  state.xp += order.xp;
  addHistory(`${vmText('Ügyfélrendelés','Customer order')}: ${vmBlueprintName(blueprint(item.type))}`, order.reward);
  workshop.finished.splice(index,1);
  workshop.activeOrders.splice(orderIndex,1);
  vmCommit(vmText(`Megrendelés átadva: +${fmt(order.reward)} CR`,`Order delivered: +${fmt(order.reward)} CR`));
};

renderCustomerMarket = function () {
  const offerEl = document.querySelector('#customerOffer'), marketEl = document.querySelector('#marketGrid');
  if (!offerEl || !marketEl) return;
  vmEnsureCustomerSlots();
  const active = workshop.activeOrders.map(order => {
    const b = blueprint(order.type), p = customerProfile(order);
    return `<article class="offer-card compact active-order"><img class="customer-avatar" src="${p.avatar}" alt="${p.customer}"><span class="category">${vmText('ELFOGADOTT','ACCEPTED')}</span><h3>${p.customer}: ${vmBlueprintName(b)}</h3><p>${vmText('Kért minőség','Requested quality')}: <strong>${vmQualityName(order.quality)}</strong></p><div class="offer-reward">${fmt(order.reward)} CR · +${order.xp} XP</div><small>${vmText('Nincs teljesítési határidő.','No completion deadline.')}</small></article>`;
  }).join('');
  const offers = workshop.customerSlots.map((slot,index) => {
    if (!slot.offer) return `<article class="offer-card compact waiting-offer"><span class="customer-loader"></span><span class="category">${vmText('ÜGYFÉLFOGADÁS','CUSTOMER DESK')}</span><h3>${vmText('Új ügyfél kapcsolása…','Connecting a new customer…')}</h3><p>${vmText('Az ajánlat hamarosan megérkezik.','A new offer will arrive shortly.')}</p></article>`;
    const o = customerProfile(slot.offer), b = blueprint(o.type);
    return `<article class="offer-card compact"><img class="customer-avatar" src="${o.avatar}" alt="${o.customer}"><span class="category">${o.customer.toUpperCase()} · ${vmText('AJÁNLAT','OFFER')}</span><h3>${vmBlueprintName(b)}</h3><p>${vmText('Kért minőség','Requested quality')}: <strong>${vmQualityName(o.quality)}</strong></p><div class="offer-reward">${fmt(o.reward)} CR · +${o.xp} XP</div><div class="offer-actions"><button class="small-btn accept-offer-v4" data-customer-slot="${index}">${vmText('Elfogadás','Accept')}</button><button class="small-btn decline-offer-v4" data-customer-slot="${index}">${vmText('Elutasítás','Decline')}</button></div></article>`;
  }).join('');
  const customerKey = `${state.language}|${workshop.activeOrders.map(o=>`${o.id}:${o.type}:${o.quality}`).join(',')}|${workshop.customerSlots.map(slot=>slot.offer?`${slot.offer.id}:${slot.offer.type}:${slot.offer.quality}`:'waiting').join(',')}`;
  if (offerEl.dataset.renderKey !== customerKey) {
    offerEl.dataset.renderKey = customerKey;
    offerEl.innerHTML = `<div class="customer-board-head"><strong>${vmText('Élő ügyfélpult','Live customer desk')}</strong><span>${workshop.activeOrders.length} / 5 ${vmText('aktív munka','active jobs')}</span></div><div class="active-order-stage">${active ? `<div class="active-order-grid">${active}</div>` : ''}</div><div class="customer-offer-grid">${offers}</div>`;
  }
  const marketKey = `${state.language}|${workshop.marketListings.map(item=>`${item.listingId||item.completed}:${item.type}:${item.quality}`).join(',')}`;
  if (marketEl.dataset.renderKey !== marketKey) {
    marketEl.dataset.renderKey = marketKey;
    marketEl.innerHTML = workshop.marketListings.length ? workshop.marketListings.map(item => {const b=blueprint(item.type);return `<article class="market-card"><span class="device-icon">${b.icon}</span><div><strong>${vmBlueprintName(b)}</strong><small>${vmQualityName(item.quality||'normal')}</small><span class="market-searching">● ${vmText('Vevő keresése…','Finding a buyer…')}</span></div></article>`}).join('') : `<div class="mini-empty">${vmText('Nincs piacon lévő termék.','No products are listed.')}</div>`;
  }
  const storeGrid=document.querySelector('#storeMarketGrid');
  if(storeGrid){
    const storeKey=`${state.language}|${workshop.storeOwned}|${workshop.marketListings.map(item=>`${item.listingId}:${item.type}:${item.quality}:${item.bidPrice}:${item.bidExpiresAt}`).join(',')}`;
    if(storeGrid.dataset.renderKey!==storeKey){
      storeGrid.dataset.renderKey=storeKey;
      if(!workshop.storeOwned)storeGrid.innerHTML=`<div class="mini-empty">${vmText('A licitpiac az első üzlet megvásárlása után nyílik meg.','The bidding market opens after purchasing the first store.')}</div>`;
      else storeGrid.innerHTML=workshop.marketListings.length?workshop.marketListings.map(item=>{const b=blueprint(item.type),left=Math.max(0,Math.ceil(((item.bidExpiresAt||Date.now())-Date.now())/1000));return `<article class="bid-card"><span class="device-icon">${b.icon}</span><div><strong>${vmBlueprintName(b)}</strong><small>${item.premium?vmText('Prémium emelet','Premium floor'):vmQualityName(item.quality||'normal')}</small><span class="bid-price">${fmt(item.bidPrice||item.salePrice)} CR</span><span class="bid-timer">${vmText('Licit vége','Bid ends')}: <b data-bid-expires="${item.bidExpiresAt||Date.now()}">${left}</b> ${vmText('mp','sec')}</span></div><button class="primary accept-bid" data-listing="${item.listingId}">${vmText('Elfogadom','Accept')}</button></article>`}).join(''):`<div class="mini-empty">${vmText('Nincs aktív licit.','No active bids.')}</div>`;
    }
    storeGrid.querySelectorAll('[data-bid-expires]').forEach(el=>{el.textContent=Math.max(0,Math.ceil((Number(el.dataset.bidExpires)-Date.now())/1000))});
  }
};

/* Corporate contracts at level 37. */
function vmCreateEnterpriseOffer() {
  const pool = blueprints.filter(b => !b.printer && !b.premiumFloor && vmBaseBlueprintAccess(b));
  const count = 2 + Math.floor(Math.random()*2);
  const items = Array.from({length:count}, () => pool[Math.floor(Math.random()*pool.length)]?.id || 'phonefix');
  workshop.enterpriseOffer = {id:vmId('enterprise'),company:['Nexa Systems','Orbit Labs','PixelWorks','Vertex Group'][Math.floor(Math.random()*4)],items,reward:420000+count*165000,xp:170+count*45};
}

function renderEnterprise() {
  const el = document.querySelector('#enterpriseContracts');
  if (!el) return;
  if (state.level < 37) {
    el.innerHTML = `<section class="locked-feature"><span class="level-orb">37</span><div><span class="eyebrow">${vmText('KÖVETKEZŐ MÉRFÖLDKŐ','NEXT MILESTONE')}</span><h2>${vmText('Vállalati szerződések','Corporate contracts')}</h2><p>${vmText('Nagy értékű, többeszközös szervizmegbízások.','High-value service contracts containing several devices.')}</p></div></section>`;
    return;
  }
  if (!workshop.enterpriseOffer && !workshop.enterpriseContract && Date.now() >= (workshop.enterpriseNextAt||0)) vmCreateEnterpriseOffer();
  let body = '';
  if (workshop.enterpriseContract) {
    const c = workshop.enterpriseContract;
    body = `<article class="enterprise-card active"><span class="feature-icon">▦</span><div><span class="category">${vmText('AKTÍV SZERZŐDÉS','ACTIVE CONTRACT')}</span><h3>${c.company}</h3><p>${c.items.map(id=>vmBlueprintName(blueprint(id))).join(' · ')}</p><div class="offer-reward">${fmt(c.reward)} CR · +${c.xp} XP</div><small>${vmText('A hozzárendelt termékek elkészülése után automatikusan elszámoljuk.','The contract is settled when all assigned devices are completed.')}</small></div></article>`;
  } else if (workshop.enterpriseOffer) {
    const c = workshop.enterpriseOffer;
    body = `<article class="enterprise-card"><span class="feature-icon">▦</span><div><span class="category">${vmText('VÁLLALATI AJÁNLAT','CORPORATE OFFER')}</span><h3>${c.company}</h3><p>${c.items.map(id=>vmBlueprintName(blueprint(id))).join(' · ')}</p><div class="offer-reward">${fmt(c.reward)} CR · +${c.xp} XP</div></div><div class="enterprise-actions"><button class="primary accept-enterprise">${vmText('Szerződés elfogadása','Accept contract')}</button><button class="small-btn decline-enterprise">${vmText('Elutasítás','Decline')}</button></div></article>`;
  } else body = `<div class="mini-empty">${vmText('Új vállalati ajánlat előkészítése…','Preparing a new corporate offer…')}</div>`;
  el.innerHTML = `<div class="subhead"><span class="eyebrow">LEVEL 37 // B2B</span><h2>${vmText('Vállalati szerződések','Corporate contracts')}</h2></div>${body}`;
}

function vmAcceptEnterprise() {
  const offer = workshop.enterpriseOffer;
  if (!offer || workshop.enterpriseContract) return;
  const projectIds = offer.items.map(type => {
    const uid = workshop.nextId++;
    workshop.projects.push({uid,type,diagnosed:false,quality:'premium',source:'corporate',orderId:offer.id,reward:0,investment:0});
    return uid;
  });
  workshop.enterpriseContract = {...offer,projectIds};
  workshop.enterpriseOffer = null;
  vmCommit(vmText('A vállalati eszközök bekerültek a műhelybe.','Corporate devices were added to the workshop.'));
}
function vmDeclineEnterprise() {
  workshop.enterpriseOffer = null;
  workshop.enterpriseNextAt = Date.now()+30000;
  vmCommit(vmText('A vállalati ajánlat elutasítva.','Corporate offer declined.'));
}
function vmCheckEnterpriseCompletion() {
  const c=workshop.enterpriseContract;
  if(!c)return;
  const active=c.projectIds.some(uid=>workshop.projects.some(p=>p.uid===uid));
  if(active)return;
  const done=workshop.finished.filter(f=>f.source==='corporate'&&f.orderId===c.id);
  if(done.length<c.projectIds.length)return;
  workshop.finished=workshop.finished.filter(f=>!(f.source==='corporate'&&f.orderId===c.id));
  state.balance+=c.reward;state.xp+=c.xp;addHistory(`${vmText('Vállalati szerződés','Corporate contract')}: ${c.company}`,c.reward);
  workshop.enterpriseContract=null;workshop.enterpriseNextAt=Date.now()+30000;
  toast(vmText(`Vállalati szerződés teljesítve: +${fmt(c.reward)} CR`,`Corporate contract completed: +${fmt(c.reward)} CR`));
}

/* Level-45 manually controlled service centre. */
function vmWorkerProgress(job) {
  if (!job?.readyAt || !job.startedAt) return 0;
  return Math.max(3,Math.min(100,(Date.now()-job.startedAt)/(job.readyAt-job.startedAt)*100));
}
function vmProjectOptions(kind) {
  return workshop.projects.filter(p => !p.assignedWorker && (kind==='customer' ? p.source==='customer' : p.source!=='customer')).map(p=>`<option value="${p.uid}">${vmBlueprintName(blueprint(p.type))}</option>`).join('');
}
function vmWorkerCard(kind,index) {
  const isCustomer=kind==='customer', hired=index<(isCustomer?workshop.customerCrewHired:workshop.repairCrewHired), jobs=isCustomer?workshop.customerCrewJobs:workshop.repairCrewJobs, job=jobs[index], price=(isCustomer?VM4.customerPrices:VM4.repairPrices)[index];
  const title=isCustomer?vmText(`Ügyfélszerviz-technikus ${index+1}`,`Customer Service Technician ${index+1}`):vmText(`Javítástechnikus ${index+1}`,`Repair Technician ${index+1}`);
  if(!hired)return `<article class="employee-card managed-worker"><span class="employee-icon">${isCustomer?'◉':'⚙'}</span><span class="category">LEVEL 45 // ${isCustomer?vmText('ÜGYFÉLTERMÉKEK','CUSTOMER DEVICES'):vmText('SAJÁT, VÁLLALATI ÉS 3D','OWN, CORPORATE & 3D')}</span><h3>${title}</h3><p>${vmText('Minden diagnosztikát és összeszerelést külön kell elindítanod.','Every diagnosis and assembly stage must be started manually.')}</p><div class="employee-foot"><strong>${fmt(price)} CR</strong><button class="primary hire-managed-worker" data-worker-kind="${kind}" data-worker-index="${index}">${vmText('Felvétel','Hire')}</button></div></article>`;
  if(!job){const options=vmProjectOptions(kind),qualityControl=isCustomer?`<small>${vmText('Az alkalmazott a vevő által kért minőséget használja.','The technician uses the quality requested by the customer.')}</small>`:`<select id="vm-${kind}-quality-${index}">${Object.keys(qualities).map(q=>`<option value="${q}">${vmQualityName(q)}</option>`).join('')}</select>`;return `<article class="employee-card managed-worker"><span class="employee-icon">${isCustomer?'◉':'⚙'}</span><span class="category">${vmText('SZABAD','AVAILABLE')}</span><h3>${title}</h3>${options?`<div class="repair-controls"><select id="vm-${kind}-project-${index}"><option value="">${vmText('Válassz terméket','Choose device')}</option>${options}</select>${qualityControl}<button class="primary assign-managed-worker" data-worker-kind="${kind}" data-worker-index="${index}">${vmText('Termék hozzárendelése','Assign device')}</button></div>`:`<div class="mini-empty">${vmText('Nincs hozzárendelhető termék.','No eligible device is available.')}</div>`}</article>`;}
  const p=projectByUid(job.projectId),b=p&&blueprint(p.type);if(!p||!b)return `<article class="employee-card managed-worker"><h3>${title}</h3><button class="small-btn clear-managed-worker" data-worker-kind="${kind}" data-worker-index="${index}">${vmText('Hibás feladat törlése','Clear invalid task')}</button></article>`;
  let controls='';
  if(job.status==='assigned')controls=`<button class="primary start-worker-diagnostic" data-worker-kind="${kind}" data-worker-index="${index}">${vmText('Diagnosztika indítása','Start diagnosis')}</button>`;
  else if(job.status==='diagnosing')controls=`<div class="employee-progress"><span style="width:${vmWorkerProgress(job)}%"></span></div><small>${vmText('Diagnosztika folyamatban','Diagnosis in progress')} · ${Math.max(0,Math.ceil((job.readyAt-Date.now())/1000))} ${vmText('mp','sec')}</small>`;
  else if(job.status==='assemblyReady')controls=`<div class="employee-benefit">${vmText('Diagnosztika kész. A hiányzó alkatrészeket indításkor megvásárolja.','Diagnosis complete. Missing parts will be purchased when assembly starts.')}</div><button class="primary start-worker-assembly" data-worker-kind="${kind}" data-worker-index="${index}">${vmText('Összeszerelés indítása','Start assembly')}</button>`;
  else controls=`<div class="employee-progress"><span style="width:${vmWorkerProgress(job)}%"></span></div><small>${vmText('Összeszerelés folyamatban','Assembly in progress')} · ${Math.max(0,Math.ceil((job.readyAt-Date.now())/1000))} ${vmText('mp','sec')}</small>`;
  return `<article class="employee-card managed-worker busy"><span class="employee-icon">${b.icon}</span><span class="category">${vmText('FOGLALT','BUSY')}</span><h3>${title}</h3><p><strong>${vmBlueprintName(b)}</strong><br>${vmText('Kiválasztott minőség','Selected quality')}: ${vmQualityName(job.quality)}</p>${controls}</article>`;
}

function renderServiceCenter() {
  const el=document.querySelector('#serviceCenter');if(!el)return;
  workshop.repairCrewHired=Number(workshop.repairCrewHired||0);workshop.customerCrewHired=Number(workshop.customerCrewHired||0);
  if(!Array.isArray(workshop.repairCrewJobs))workshop.repairCrewJobs=[null,null,null];
  if(!Array.isArray(workshop.customerCrewJobs))workshop.customerCrewJobs=[null,null,null];
  if(state.level<45){el.innerHTML=`<section class="locked-feature"><span class="level-orb">45</span><div><span class="eyebrow">${vmText('SZERVIZIRÁNYÍTÁS','SERVICE MANAGEMENT')}</span><h2>${vmText('Szervizirányító központ','Service control centre')}</h2><p>${vmText('Hat kézzel irányítható technikus és egy munkatechnikus válik elérhetővé.','Six manually controlled technicians and one job technician become available.')}</p></div></section>`;return}
  const jobTech=vmRenderJobTechnician();
  el.innerHTML=`<div class="subhead"><span class="eyebrow">LEVEL 45 // CONTROL HUB</span><h2>${vmText('Szervizirányító központ','Service control centre')}</h2><p>${vmText('Itt semmi nem indul el magától: minden munkafázist te vezérlesz.','Nothing starts automatically: you control every work stage.')}</p></div><div class="service-lanes"><section><h3>${vmText('Saját, vállalati és 3D-termékek','Owned, corporate and 3D devices')}</h3><div class="employee-grid">${[0,1,2].map(i=>vmWorkerCard('repair',i)).join('')}</div></section><section><h3>${vmText('Ügyféltermékek','Customer devices')}</h3><div class="employee-grid">${[0,1,2].map(i=>vmWorkerCard('customer',i)).join('')}</div></section><section><h3>${vmText('Munkák technikusa','Jobs technician')}</h3>${jobTech}</section></div>`;
}

function vmRenderJobTechnician(){
  if(!workshop.jobTechHired)return `<article class="employee-card managed-worker"><span class="employee-icon">⌁</span><span class="category">LEVEL 45 // JOB DESK</span><h3>${vmText('Feladatkezelő technikus','Task Operations Technician')}</h3><p>${vmText('Egy kiválasztott munkát végez el, majd megáll. A teljes jutalom a tiéd.','Completes one selected job, then stops. You receive the full reward.')}</p><div class="employee-foot"><strong>${fmt(VM4.jobTechPrice)} CR</strong><button class="primary hire-job-tech">${vmText('Felvétel','Hire')}</button></div></article>`;
  const task=workshop.jobTechJob;
  if(task){const j=jobs.find(x=>x.id===task.jobId);return `<article class="employee-card managed-worker busy"><span class="employee-icon">${j?.icon||'⌁'}</span><span class="category">${vmText('MUNKA FOLYAMATBAN','JOB IN PROGRESS')}</span><h3>${j?getJobMeta(j.id).name:''}</h3><div class="employee-progress"><span style="width:${vmWorkerProgress(task)}%"></span></div><small>${Math.max(0,Math.ceil((task.readyAt-Date.now())/1000))} ${vmText('mp','sec')}</small></article>`}
  const options=jobs.filter(requirements).map(j=>`<option value="${j.id}">${getJobMeta(j.id).name} · ${fmt(Math.round(j.reward*(1+bonus())))} CR</option>`).join('');
  return `<article class="employee-card managed-worker"><span class="employee-icon">⌁</span><span class="category">${vmText('SZABAD','AVAILABLE')}</span><h3>${vmText('Feladatkezelő technikus','Task Operations Technician')}</h3><div class="repair-controls"><select id="vm-job-tech-select">${options}</select><button class="primary start-job-tech">${vmText('Kiválasztott munka indítása','Start selected job')}</button></div></article>`;
}

function vmHireWorker(kind,index){if(state.level<45)return;const current=kind==='customer'?workshop.customerCrewHired:workshop.repairCrewHired;if(index!==current)return toast(vmText('Előbb az előző alkalmazottat kell felvenned.','Hire the previous technician first.'));const price=(kind==='customer'?VM4.customerPrices:VM4.repairPrices)[index];if(state.balance<price)return toast(vmText('Nincs elég kredited.','Not enough credit.'));state.balance-=price;if(kind==='customer')workshop.customerCrewHired++;else workshop.repairCrewHired++;addHistory(vmText('Új szerviztechnikus','New service technician'),-price);vmCommit(vmText('Az új technikus munkára kész.','The new technician is ready.'))}
function vmAssignWorker(kind,index){const select=document.querySelector(`#vm-${kind}-project-${index}`),p=projectByUid(Number(select?.value));if(!p||p.assignedWorker)return;const correct=kind==='customer'?p.source==='customer':p.source!=='customer';if(!correct)return;const quality=kind==='customer'?(p.quality||'normal'):(document.querySelector(`#vm-${kind}-quality-${index}`)?.value||'normal');p.assignedWorker=`${kind}-${index}`;const jobsList=kind==='customer'?workshop.customerCrewJobs:workshop.repairCrewJobs;jobsList[index]={projectId:p.uid,quality,status:'assigned',startedAt:0,readyAt:0};vmCommit(vmText('Termék hozzárendelve. Indítsd el a diagnosztikát.','Device assigned. Start the diagnosis.'))}
function vmStartWorkerDiagnostic(kind,index){const job=(kind==='customer'?workshop.customerCrewJobs:workshop.repairCrewJobs)[index];if(!job||job.status!=='assigned')return;job.status='diagnosing';job.startedAt=Date.now();job.readyAt=job.startedAt+60000;vmCommit(vmText('A diagnosztika elindult.','Diagnosis started.'))}
function vmStartWorkerAssembly(kind,index){const jobsList=kind==='customer'?workshop.customerCrewJobs:workshop.repairCrewJobs,job=jobsList[index],p=job&&projectByUid(job.projectId),b=p&&blueprint(p.type);if(!job||job.status!=='assemblyReady'||!p||!b)return;let purchase=0;for(const id of b.parts){if(stock(id,job.quality)<=0){const part=workshopParts.find(x=>x.id===id);purchase+=Math.round(part.price*qualities[job.quality].price)}}if(state.balance<purchase)return toast(vmText(`A hiányzó alkatrészekhez még ${fmt(purchase-state.balance)} CR szükséges.`,`You need ${fmt(purchase-state.balance)} more CR for missing parts.`));for(const id of b.parts){if(stock(id,job.quality)<=0)ensurePart(id)[job.quality]++;ensurePart(id)[job.quality]--}state.balance-=purchase;if(purchase)addHistory(vmText('Automatikus alkatrészbeszerzés','Automatic parts purchase'),-purchase);job.partsCost=b.parts.reduce((sum,id)=>sum+Math.round(workshopParts.find(x=>x.id===id).price*qualities[job.quality].price),0);job.status='assembling';job.startedAt=Date.now();job.readyAt=job.startedAt+120000;vmCommit(vmText('Az összeszerelés elindult.','Assembly started.'))}
function vmClearWorker(kind,index){const list=kind==='customer'?workshop.customerCrewJobs:workshop.repairCrewJobs,p=list[index]&&projectByUid(list[index].projectId);if(p)delete p.assignedWorker;list[index]=null;vmCommit()}

function vmTickWorkers(){
  if(!Array.isArray(workshop.repairCrewJobs))workshop.repairCrewJobs=[null,null,null];
  if(!Array.isArray(workshop.customerCrewJobs))workshop.customerCrewJobs=[null,null,null];
  while(workshop.repairCrewJobs.length<3)workshop.repairCrewJobs.push(null);
  while(workshop.customerCrewJobs.length<3)workshop.customerCrewJobs.push(null);
  for(const kind of ['repair','customer']){const list=kind==='customer'?workshop.customerCrewJobs:workshop.repairCrewJobs;list.forEach((job,index)=>{if(!job)return;const p=projectByUid(job.projectId),b=p&&blueprint(p.type);if(!p||!b){list[index]=null;return}if(job.status==='diagnosing'&&Date.now()>=job.readyAt){p.diagnosed=true;job.status='assemblyReady';toast(vmText('Egy alkalmazotti diagnosztika elkészült.','A technician diagnosis is complete.'))}else if(job.status==='assembling'&&Date.now()>=job.readyAt){workshop.projects=workshop.projects.filter(x=>x.uid!==p.uid);workshop.finished.push({type:p.type,quality:job.quality,source:p.source||'self',orderId:p.orderId||null,reward:p.reward||0,investment:(p.investment||0)+(job.partsCost||0),completed:Date.now()});state.xp+=45;list[index]=null;toast(vmText('Egy alkalmazott befejezte az összeszerelést.','A technician completed an assembly.'))}})}
  const task=workshop.jobTechJob;if(task&&Date.now()>=task.readyAt){const j=jobs.find(x=>x.id===task.jobId);if(j){const reward=Math.round(j.reward*(1+bonus()));state.balance+=reward;state.xp+=Math.round(j.xp*(1+xpBoost()));addHistory(`${vmText('Munkatechnikus','Job technician')}: ${getJobMeta(j.id).name}`,reward);toast(vmText(`Munkatechnikus: +${fmt(reward)} CR`,`Job technician: +${fmt(reward)} CR`))}workshop.jobTechJob=null}
}
function vmHireJobTech(){if(state.level<45||workshop.jobTechHired)return;if(state.balance<VM4.jobTechPrice)return toast(vmText('Nincs elég kredited.','Not enough credit.'));state.balance-=VM4.jobTechPrice;workshop.jobTechHired=true;addHistory(vmText('Feladatkezelő technikus','Task Operations Technician'),-VM4.jobTechPrice);vmCommit(vmText('A munkatechnikus készen áll.','The job technician is ready.'))}
function vmStartJobTech(){if(!workshop.jobTechHired||workshop.jobTechJob)return;const j=jobs.find(x=>x.id===document.querySelector('#vm-job-tech-select')?.value);if(!j||!requirements(j))return;const duration=effectiveJobSeconds(j);workshop.jobTechJob={jobId:j.id,startedAt:Date.now(),readyAt:Date.now()+duration*1000};vmCommit(vmText('A kiválasztott munka elindult.','The selected job has started.'))}

/* Passive franchise and flagship, plus the active premium floor. */
const vmFranchiseUpgrades=[
  {id:'traffic',name:['Vásárlói forgalom','Customer traffic'],price:1200000,bonus:.18,icon:'◉'},
  {id:'interior',name:['Modern belső tér','Modern interior'],price:1800000,bonus:.22,icon:'◇'},
  {id:'ads',name:['Városi reklámkampány','City ad campaign'],price:2600000,bonus:.28,icon:'✦'},
  {id:'logistics',name:['Gyors logisztika','Fast logistics'],price:3600000,bonus:.32,icon:'⇄'},
  {id:'network',name:['Franchise hálózat','Franchise network'],price:5000000,bonus:.4,icon:'⬡'},
  {id:'max',name:['Automata üzlet 2.0','Automated Store 2.0'],price:7000000,bonus:.5,icon:'⚡'}
];
const vmFlagshipUpgrades=[
  {id:'vip',name:['VIP ügyfélprogram','VIP customer program'],price:7000000,bonus:.18,xp:2,icon:'◆'},
  {id:'ai',name:['AI készletvezérlés','AI inventory control'],price:9500000,bonus:.22,xp:3,icon:'⌁'},
  {id:'globalAds',name:['Nemzetközi kampány','International campaign'],price:13000000,bonus:.28,xp:4,icon:'✦'},
  {id:'express',name:['Expressz kiszolgálás','Express service'],price:17000000,bonus:.34,xp:5,icon:'⚡'},
  {id:'academy',name:['Technológiai akadémia','Technology academy'],price:22000000,bonus:.4,xp:8,icon:'▦'},
  {id:'empire',name:['VoltMarket birodalom','VoltMarket empire'],price:30000000,bonus:.55,xp:12,icon:'⬡'}
];
const vmShelves=[
  {id:'drone',name:['Drónlabor','Drone Lab'],desc:['Drónok és repülési modulok.','Drones and flight modules.'],price:2500000,icon:'✥'},
  {id:'xr',name:['XR stúdió','XR Studio'],desc:['VR és kevert valóság rendszerek.','VR and mixed-reality systems.'],price:3200000,icon:'◈'},
  {id:'robotics',name:['Robotikai polc','Robotics Shelf'],desc:['Robotok és intelligens automaták.','Robots and intelligent machines.'],price:4200000,icon:'✦'}
];
function vmUpgradeMultiplier(list,defs){return 1+defs.filter(u=>list.includes(u.id)).reduce((s,u)=>s+u.bonus,0)}
function vmFranchiseIncome(){return Math.round(75000*vmUpgradeMultiplier(workshop.franchiseUpgrades,vmFranchiseUpgrades)*(1+bonus()))}
function vmFlagshipIncome(){return Math.round(350000*vmUpgradeMultiplier(workshop.flagshipUpgrades,vmFlagshipUpgrades)*(1+bonus()))}
function vmFlagshipXp(){return 25+vmFlagshipUpgrades.filter(u=>workshop.flagshipUpgrades.includes(u.id)).reduce((s,u)=>s+(u.xp||0),0)}

function vmRenderUpgradeList(defs,owned,kind){return defs.map((u,i)=>{const done=owned.includes(u.id),open=i===0||owned.includes(defs[i-1].id);return `<article class="store-upgrade ${done?'owned':''} ${open?'':'locked-card'}"><span>${u.icon}</span><div><small>${i+1}. ${vmText('FEJLESZTÉSI SZINT','UPGRADE TIER')}</small><h3>${vmText(...u.name)}</h3><p>+${Math.round(u.bonus*100)}% ${vmText('bevétel','income')}${u.xp?` · +${u.xp} XP`:''}</p><strong>${fmt(u.price)} CR</strong></div><button class="small-btn buy-vm-upgrade" data-vm-kind="${kind}" data-vm-upgrade="${u.id}" ${done||!open?'disabled':''}>${done?vmText('Kész','Done'):open?vmText('Fejlesztés','Upgrade'):vmText('Előző szükséges','Previous required')}</button></article>`}).join('')}

function renderAdvancedStore(){
  const franchise=document.querySelector('#franchisePanel'),premium=document.querySelector('#premiumFloorPanel'),flagship=document.querySelector('#flagshipPanel');if(!franchise||!premium||!flagship)return;
  if(!Array.isArray(workshop.franchiseUpgrades))workshop.franchiseUpgrades=[];
  if(!Array.isArray(workshop.premiumShelves))workshop.premiumShelves=[];
  if(!Array.isArray(workshop.flagshipUpgrades))workshop.flagshipUpgrades=[];
  if(!workshop.franchiseOwned){franchise.innerHTML=`<section class="milestone-card ${state.level>=35?'ready':'locked'}"><span class="level-orb">35</span><div><span class="eyebrow">FRANCHISE // PASSIVE</span><h2>${vmText('Második automatikus üzlet','Second automated store')}</h2><p>${vmText('Önállóan termel kreditet; neked csak fejlesztened kell.','Generates credit automatically; you only manage upgrades.')}</p><strong>${fmt(VM4.franchisePrice)} CR</strong></div><button class="primary buy-franchise" ${state.level>=35?'':'disabled'}>${state.level>=35?vmText('Franchise megvásárlása','Purchase franchise'):vmText('35. szinten nyílik meg','Unlocks at level 35')}</button></section>`}else{const next=Math.max(0,Math.ceil((workshop.franchiseNextPayAt-Date.now())/1000));franchise.innerHTML=`<div class="subhead"><span class="eyebrow">LEVEL 35 // PASSIVE</span><h2>${vmText('Második automatikus üzlet','Second automated store')}</h2></div><div class="store-dashboard"><div><span>${vmText('ÁLLAPOT','STATUS')}</span><strong>${vmText('AUTOMATIKUS','AUTOMATED')}</strong></div><div><span>${vmText('KÖVETKEZŐ BEVÉTEL','NEXT PAYOUT')}</span><strong>${next} ${vmText('mp','sec')}</strong></div><div><span>${vmText('BEVÉTEL','INCOME')}</span><strong>${fmt(vmFranchiseIncome())} CR</strong></div><div><span>${vmText('FEJLESZTÉS','UPGRADES')}</span><strong>${workshop.franchiseUpgrades.length}/6</strong></div></div><div class="store-upgrade-grid">${vmRenderUpgradeList(vmFranchiseUpgrades,workshop.franchiseUpgrades,'franchise')}</div>`}
  if(!workshop.premiumFloorOwned){premium.innerHTML=`<section class="milestone-card ${state.level>=50?'ready':'locked'}"><span class="level-orb">50</span><div><span class="eyebrow">PREMIUM FLOOR // ACTIVE</span><h2>${vmText('Prémium üzleti emelet','Premium retail floor')}</h2><p>${vmText('Külön polcok drónokhoz, XR-rendszerekhez és robotikához.','Dedicated shelves for drones, XR systems and robotics.')}</p><strong>${fmt(VM4.premiumFloorPrice)} CR</strong></div><button class="primary buy-premium-floor" ${state.level>=50?'':'disabled'}>${state.level>=50?vmText('Emelet megnyitása','Open floor'):vmText('50. szinten nyílik meg','Unlocks at level 50')}</button></section>`}else{premium.innerHTML=`<div class="subhead"><span class="eyebrow">LEVEL 50 // PREMIUM FLOOR</span><h2>${vmText('Különleges termékpolcok','Special product shelves')}</h2><p>${vmText('Az itt feloldott termékeket csak a prémium emeleten lehet értékesíteni.','Products unlocked here can only be sold on the premium floor.')}</p></div><div class="premium-shelf-grid">${vmShelves.map(s=>{const owned=workshop.premiumShelves.includes(s.id);return `<article class="premium-shelf ${owned?'owned':''}"><span class="feature-icon">${s.icon}</span><span class="category">${owned?vmText('AKTÍV POLC','ACTIVE SHELF'):vmText('LEZÁRT POLC','LOCKED SHELF')}</span><h3>${vmText(...s.name)}</h3><p>${vmText(...s.desc)}</p><div class="employee-foot"><strong>${fmt(s.price)} CR</strong><button class="primary buy-premium-shelf" data-shelf="${s.id}" ${owned?'disabled':''}>${owned?vmText('Megnyitva','Opened'):vmText('Polc megvásárlása','Purchase shelf')}</button></div></article>`}).join('')}</div>`}
  if(!workshop.flagshipOwned){flagship.innerHTML=`<section class="milestone-card ${state.level>=50?'ready':'locked'}"><span class="level-orb">50</span><div><span class="eyebrow">FLAGSHIP // PASSIVE XP</span><h2>${vmText('Harmadik automatikus üzlet','Third automated store')}</h2><p>${vmText('Nagy passzív bevétel és XP hosszabb ciklusokban.','High passive income and XP in longer cycles.')}</p><strong>${fmt(VM4.flagshipPrice)} CR</strong></div><button class="primary buy-flagship" ${state.level>=50?'':'disabled'}>${state.level>=50?vmText('Prémium üzlet megvásárlása','Purchase flagship store'):vmText('50. szinten nyílik meg','Unlocks at level 50')}</button></section>`}else{const next=Math.max(0,Math.ceil((workshop.flagshipNextPayAt-Date.now())/1000));flagship.innerHTML=`<div class="subhead"><span class="eyebrow">LEVEL 50 // FLAGSHIP</span><h2>${vmText('Harmadik automatikus üzlet','Third automated store')}</h2></div><div class="store-dashboard"><div><span>${vmText('ÁLLAPOT','STATUS')}</span><strong>${vmText('AUTOMATIKUS','AUTOMATED')}</strong></div><div><span>${vmText('KÖVETKEZŐ CIKLUS','NEXT CYCLE')}</span><strong>${next} ${vmText('mp','sec')}</strong></div><div><span>${vmText('CIKLUSJUTALOM','CYCLE REWARD')}</span><strong>${fmt(vmFlagshipIncome())} CR</strong></div><div><span>XP</span><strong>+${vmFlagshipXp()} XP</strong></div></div><div class="store-upgrade-grid">${vmRenderUpgradeList(vmFlagshipUpgrades,workshop.flagshipUpgrades,'flagship')}</div>`}
}

function vmBuyFeature(kind){let price=0;if(kind==='franchise'){if(state.level<35||workshop.franchiseOwned)return;price=VM4.franchisePrice}else if(kind==='premium'){if(state.level<50||workshop.premiumFloorOwned)return;price=VM4.premiumFloorPrice}else if(kind==='flagship'){if(state.level<50||workshop.flagshipOwned)return;price=VM4.flagshipPrice}if(state.balance<price)return toast(vmText('Nincs elég kredited.','Not enough credit.'));state.balance-=price;if(kind==='franchise'){workshop.franchiseOwned=true;workshop.franchiseNextPayAt=Date.now()+VM4.franchiseCycle*1000}else if(kind==='premium')workshop.premiumFloorOwned=true;else{workshop.flagshipOwned=true;workshop.flagshipNextPayAt=Date.now()+VM4.flagshipCycle*1000}addHistory(vmText('Új üzleti fejlesztés','New business expansion'),-price);vmCommit(vmText('Az új üzleti egység megnyílt.','The new business unit is open.'))}
function vmBuyUpgrade(kind,id){const defs=kind==='franchise'?vmFranchiseUpgrades:vmFlagshipUpgrades,list=kind==='franchise'?workshop.franchiseUpgrades:workshop.flagshipUpgrades,index=defs.findIndex(u=>u.id===id),u=defs[index];if(!u||list.includes(id)||(index>0&&!list.includes(defs[index-1].id)))return;if(state.balance<u.price)return toast(vmText('Nincs elég kredited.','Not enough credit.'));state.balance-=u.price;list.push(id);addHistory(vmText(...u.name),-u.price);vmCommit(vmText('Fejlesztés elkészült.','Upgrade completed.'))}
function vmBuyShelf(id){const s=vmShelves.find(x=>x.id===id);if(!workshop.premiumFloorOwned||!s||workshop.premiumShelves.includes(id))return;if(state.balance<s.price)return toast(vmText('Nincs elég kredited.','Not enough credit.'));state.balance-=s.price;workshop.premiumShelves.push(id);addHistory(vmText(...s.name),-s.price);vmCommit(vmText('Az új prémium polc megnyílt.','The new premium shelf is open.'))}

function vmTickBusinesses(){const now=Date.now();if(workshop.franchiseOwned){if(!workshop.franchiseNextPayAt)workshop.franchiseNextPayAt=now+VM4.franchiseCycle*1000;else if(now>=workshop.franchiseNextPayAt){const income=vmFranchiseIncome();state.balance+=income;workshop.franchisePending+=income;workshop.franchiseNextPayAt=now+VM4.franchiseCycle*1000;if(workshop.franchisePending>=income*3){addHistory(vmText('Összesített franchise-bevétel','Combined franchise income'),workshop.franchisePending);workshop.franchisePending=0}}}if(workshop.flagshipOwned){if(!workshop.flagshipNextPayAt)workshop.flagshipNextPayAt=now+VM4.flagshipCycle*1000;else if(now>=workshop.flagshipNextPayAt){const income=vmFlagshipIncome(),xp=vmFlagshipXp();state.balance+=income;state.xp+=xp;workshop.flagshipPending+=income;workshop.flagshipNextPayAt=now+VM4.flagshipCycle*1000;addHistory(vmText('Prémium üzleti ciklus','Flagship business cycle'),income);toast(vmText(`Prémium üzlet: +${fmt(income)} CR és +${xp} XP`,`Flagship store: +${fmt(income)} CR and +${xp} XP`))}}}

/* Passive employee XP, deliberately independent from speed bonuses. */
function vmTickEmployeeXp(){const now=Date.now();if(!workshop.employeeXpNextAt)workshop.employeeXpNextAt=now+60000;if(now<workshop.employeeXpNextAt)return;const xp=employees.filter(e=>workshop.employees.includes(e.id)).reduce((sum,e)=>sum+({junior:1,system:2,senior:3}[e.id]||0),0);if(xp){state.xp+=xp;toast(vmText(`Csapattapasztalat: +${xp} XP`,`Team experience: +${xp} XP`))}workshop.employeeXpNextAt=now+60000}

/* 3D printer visual upgrade. */
function vmDecoratePrinter(){const art=document.querySelector('.printer-art');if(art){art.innerHTML='<img src="assets/3d-printer-v2.png" alt=""><span>3D</span>';art.classList.add('printer-art-v2')}}
renderPrinterLab=function(){const el=document.querySelector('#printerLab');if(!el)return;const ready=state.level>=30;if(!workshop.printerOwned){el.innerHTML=`<div class="printer-lock ${ready?'ready':''}"><div class="printer-art printer-art-v2"><img src="assets/3d-printer-v2.png" alt=""><span>3D</span></div><div><span class="eyebrow">LEVEL 30 // FAB LAB</span><h2>NovaForm 3D</h2><p>${vmText('Telefon- és kontrollerházakat nyomtathatsz. A belső elektronikát ezután külön kell beépíteni.','Print phone and controller shells, then install their internal electronics separately.')}</p></div><button class="primary buy-printer" ${ready?'':'disabled'}>${ready?`${fmt(PRINTER_PRICE)} CR · ${vmText('Megvásárolom','Purchase')}`:vmText('30. szinten nyílik meg','Unlocks at level 30')}</button></div>`;return}el.innerHTML=`<div class="printer-console"><div class="printer-head"><div><span class="eyebrow">NOVAFORM // ONLINE</span><h2>${vmText('3D gyártólabor','3D fabrication lab')}</h2><p>${vmText('Válassz tervet, majd teljesítsd az egérrel vagy érintéssel vezérelhető nyomtatási pályát.','Choose a blueprint, then complete the mouse- or touch-controlled printing path.')}</p></div><span class="printer-online">● ${vmText('ÜZEMKÉSZ','READY')}</span></div><div class="print-blueprints">${blueprints.filter(b=>b.printer).map(b=>`<article><span class="device-icon">${b.icon}</span><div><h3>${vmBlueprintName(b)}</h3><p>${vmBlueprintFault(b)}</p><strong>${vmText('Várható piaci alapár','Expected market value')}: ${fmt(b.sell)} CR</strong></div><button class="primary start-print" data-print="${b.id}">${vmText('Nyomtatás indítása','Start printing')}</button></article>`).join('')}</div></div>`}

/* Route level-50 products to the premium floor market. */
const vmBaseListOnMarket=listOnMarket;
listOnMarket=function(index){const item=workshop.finished[index],b=item&&blueprint(item.type);if(!item||!b)return;if(!b.premiumFloor)return vmBaseListOnMarket(index);if(!workshop.premiumFloorOwned||!workshop.premiumShelves.includes(b.shelf))return toast(vmText('A megfelelő prémium polc még nincs megnyitva.','The matching premium shelf is not open.'));const q=qualities[item.quality||'normal'],minimum=Math.ceil((item.investment||0)*1.12),bidPrice=Math.max(minimum,Math.round(b.sell*q.sell*(1.08+Math.random()*.34)));workshop.marketListings.push({...item,listingId:vmId('premium-bid'),bidPrice,bidExpiresAt:Date.now()+20000,premium:true});workshop.finished.splice(index,1);vmCommit(vmText('A termék felkerült a prémium emeletre.','The product was listed on the premium floor.'))}

/* Wrap existing render/tick entry points without breaking old saves. */
const vmBaseRenderJobs=renderJobs;
renderJobs=function(){vmBaseRenderJobs();renderEnterprise()};
const vmBaseRenderEmployees=renderEmployeesBase;
renderEmployees=function(){vmBaseRenderEmployees();const summary=document.querySelector('#employeeSummary');if(summary){const xp=employees.filter(e=>workshop.employees.includes(e.id)).reduce((sum,e)=>sum+({junior:1,system:2,senior:3}[e.id]||0),0);summary.insertAdjacentHTML('beforeend',`<div><span>${vmText('CSAPAT XP','TEAM XP')}</span><strong>+${xp} XP / 60 ${vmText('mp','sec')}</strong></div>`)}renderServiceCenter()};
const vmBaseRenderStore=renderStore;
renderStore=function(){vmBaseRenderStore();renderAdvancedStore()};
const vmBaseRenderWorkshop=renderWorkshop;
renderWorkshop=function(){vmBaseRenderWorkshop();vmDecoratePrinter()};
const vmBaseRenderAll=renderAll;
renderAll=function(){vmBaseRenderAll();renderEnterprise();renderServiceCenter();renderAdvancedStore();vmDecoratePrinter()};
const vmBaseEmployeeTick=employeeTick;
employeeTick=function(){vmBaseEmployeeTick();vmTickEmployeeXp()};
const vmBaseStoreTick=storeTick;
storeTick=function(){vmBaseStoreTick();vmTickCustomers();vmTickWorkers();vmTickBusinesses();vmCheckEnterpriseCompletion();updateLevel();vmPersist()};

document.addEventListener('click',event=>{
  const accept=event.target.closest('.accept-offer-v4');if(accept)return acceptOffer(accept.dataset.customerSlot);
  const decline=event.target.closest('.decline-offer-v4');if(decline)return declineOffer(decline.dataset.customerSlot);
  if(event.target.closest('.accept-enterprise'))return vmAcceptEnterprise();
  if(event.target.closest('.decline-enterprise'))return vmDeclineEnterprise();
  const hire=event.target.closest('.hire-managed-worker');if(hire)return vmHireWorker(hire.dataset.workerKind,Number(hire.dataset.workerIndex));
  const assign=event.target.closest('.assign-managed-worker');if(assign)return vmAssignWorker(assign.dataset.workerKind,Number(assign.dataset.workerIndex));
  const diagnose=event.target.closest('.start-worker-diagnostic');if(diagnose)return vmStartWorkerDiagnostic(diagnose.dataset.workerKind,Number(diagnose.dataset.workerIndex));
  const assembly=event.target.closest('.start-worker-assembly');if(assembly)return vmStartWorkerAssembly(assembly.dataset.workerKind,Number(assembly.dataset.workerIndex));
  const clear=event.target.closest('.clear-managed-worker');if(clear)return vmClearWorker(clear.dataset.workerKind,Number(clear.dataset.workerIndex));
  if(event.target.closest('.hire-job-tech'))return vmHireJobTech();
  if(event.target.closest('.start-job-tech'))return vmStartJobTech();
  if(event.target.closest('.buy-franchise'))return vmBuyFeature('franchise');
  if(event.target.closest('.buy-premium-floor'))return vmBuyFeature('premium');
  if(event.target.closest('.buy-flagship'))return vmBuyFeature('flagship');
  const upgrade=event.target.closest('.buy-vm-upgrade');if(upgrade)return vmBuyUpgrade(upgrade.dataset.vmKind,upgrade.dataset.vmUpgrade);
  const shelf=event.target.closest('.buy-premium-shelf');if(shelf)return vmBuyShelf(shelf.dataset.shelf);
});

vmEnsureCustomerSlots();
vmTickCustomers();
vmPersist();
renderAll();
