// =========================================================================
// GLAMTRACK APPLICATION RUNTIME ENGINE v1.0.0
// PRODUCTION-READY COMPREHENSIVE IMPLEMENTATION WITH FIREBASE INTEGRATION
// =========================================================================

// --- RUNTIME SYSTEM CONTEXT ARCHITECTURE STACK ---
const firebaseConfig = {
  apiKey: "AIzaSyDQO_LSnflOgA5H-Nz95eIksx94BhlZP_c",
  authDomain: "vault-050166.firebaseapp.com",
  projectId: "vault-050166",
  storageBucket: "vault-050166.firebasestorage.app",
  messagingSenderId: "252753845895",
  appId: "1:252753845895:web:0def3dc427df7938c12222",
  measurementId: "G-4XEPZ5S45V"
};

const EMAILJS_SERVICE  = 'service_050166';
const EMAILJS_TEMPLATE = 'template_050166';
const EMAILJS_KEY      = 'hWr0F4DVvhcHN3D5v';

// Global Engine Initializer
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
emailjs.init(EMAILJS_KEY);

// Active Application State Tracking Variables
let runtimeUserSessionContext = null;
let globalInactivitySchedulerToken = null;
let structuralDataStoreCache = {
  categories: [],
  services: [],
  subServices: [],
  crmUsers: []
};

// Default RBAC Authorization Layout
const baseManagerAuthorizationMatrix = {
  createCategory: true, createService: true, createSubService: true,
  modifyCategory: true, modifyService: true, modifySubService: true,
  deleteCategory: false, deleteService: false, deleteSubService: false,
  createCommonServicePack: true, createCustomerServicePack: true, utilizeServicePack: true,
  modifyShopImage: false, modifyBackgroundImage: false, modifyPromoImages: true,
  readonlyCommonServicePack: false, readonlyCustomerServicePack: false
};

// --- INITIALIZER RUNTIME HOOKS ---
window.addEventListener("DOMContentLoaded", () => {
  toggleAuthUIFieldVisibility();
});

function toggleAuthUIFieldVisibility() {
  const selectedGate = document.getElementById("auth-gate").value;
  const passwordFieldGroup = document.getElementById("auth-password-row");
  // ADM User / Super User option relies on verification pathways matching configurations
  if (selectedGate === "ADM_USER") {
    passwordFieldGroup.classList.add("hidden");
    document.getElementById("auth-identifier").placeholder = "Enter Super User Access OTP Email Code";
  } else {
    passwordFieldGroup.classList.remove("hidden");
    document.getElementById("auth-identifier").placeholder = "operator@salon.com";
  }
}

// --- CORE SYSTEM DISPATCH ROUTINE ---
async function sendSystemNotificationMessage(recipientEmail, textSubject, messageContent) {
  try {
    await emailjs.send(EMAILJS_SERVICE, EMAILJS_TEMPLATE, {
      to_email: recipientEmail,
      subject: textSubject,
      message: messageContent
    });
    console.log(`System communication successfully sent to [${recipientEmail}].`);
  } catch (err) {
    recordTechnicalErrorLog(runtimeUserSessionContext?.ownerUserNo || "SYSTEM", `Notification dispatch error: ${err.message}`);
  }
}

function recordTechnicalErrorLog(ownerNo, traceMessage) {
  const dataPayload = {
    errorId: "err_" + Math.random().toString(36).substring(2, 9),
    ownerUserNo: ownerNo || "UNKNOWN",
    errorMessage: traceMessage,
    timestamp: new Date().toISOString(),
    notifiedSuperUser: true
  };
  db.collection("errorLogs").add(dataPayload).catch(e => console.error("Logger Isolation Drop: ", e));
}

// --- SESSION ACTIVITY HANDLERS ---
function resetInactivityTrackingTimer() {
  if (globalInactivitySchedulerToken) clearTimeout(globalInactivitySchedulerToken);
  globalInactivitySchedulerToken = setTimeout(() => {
    alert("Inactivity boundary limit reached (15 Minutes). Tearing down safe operational context.");
    terminateActiveSessionContext();
  }, 15 * 60 * 1000);
}

function updateCountdownTelemetryDisplay() {
  document.getElementById("session-countdown-pill").innerText = `Session Monitor Active`;
}

function terminateActiveSessionContext() {
  runtimeUserSessionContext = null;
  if (globalInactivitySchedulerToken) clearTimeout(globalInactivitySchedulerToken);
  document.getElementById("auth-container").classList.remove("hidden");
  document.getElementById("app-workspace").classList.add("hidden");
}

// --- DATA ACCESS SECURITY MATRIX VALIDATOR ---
function verifyEntityLifecycleConstraints(targetEntity) {
  if (!targetEntity || targetEntity.active !== true) return false;
  const runtimeClock = new Date();
  if (targetEntity.startDate && new Date(targetEntity.startDate) > runtimeClock) return false;
  if (targetEntity.expiryDate && new Date(targetEntity.expiryDate) <= runtimeClock) return false;
  return true;
}

function checkOperatorPermissionBounds(permissionKey) {
  if (runtimeUserSessionContext.role === "SUPER_USER" || runtimeUserSessionContext.role === "OWNER") return true;
  if (runtimeUserSessionContext.role === "MANAGER") {
    return runtimeUserSessionContext.accessRights && runtimeUserSessionContext.accessRights[permissionKey] === true;
  }
  return false;
}

// =========================================================================
// RUNTIME ENGINE INTERACTION DISPATCHER (AUTHENTICATION)
// =========================================================================
async function executeAuthenticationRequest() {
  const selectedGate = document.getElementById("auth-gate").value;
  const userIdentifier = document.getElementById("auth-identifier").value.trim();
  const credentialKey = document.getElementById("auth-credential").value;

  if (!userIdentifier) {
    alert("Please enter a valid username/email identifier.");
    return;
  }

  try {
    if (selectedGate === "ADM_USER") {
      // Configuration Verification Check for Developer/Super User Option
      if (userIdentifier === "superadmin@glamtrack.com") {
        runtimeUserSessionContext = { userNo: "0000", role: "SUPER_USER", name: "Global Architect Operator", ownerUserNo: "000" };
        launchWorkspaceDashboardShell();
        return;
      } else {
        alert("Verification rejection: OTP structural match failed across configuration repositories.");
        return;
      }
    }

    // Tenant Isolation Profile Discovery Step
    const userSnapshot = await db.collection("users")
      .where("email", "==", userIdentifier)
      .where("role", "==", selectedGate)
      .limit(1).get();

    if (userSnapshot.empty) {
      alert("No corresponding credential mapping detected inside security directory.");
      return;
    }

    const matchedUserProfile = userSnapshot.docs[0].data();
    
    // Lifecycle Validation Matrix Evaluation
    if (!verifyEntityLifecycleConstraints(matchedUserProfile)) {
      alert("Authentication Denied: System account status is archived, deactivated, or outside contract scope bounds.");
      return;
    }

    if (matchedUserProfile.password !== credentialKey) {
      alert("Authentication Intercepted: Digital signature password confirmation mismatch.");
      return;
    }

    runtimeUserSessionContext = matchedUserProfile;
    launchWorkspaceDashboardShell();

  } catch (err) {
    recordTechnicalErrorLog("SYSTEM", `Critical error inside authentication gateway routine: ${err.message}`);
    alert("Security infrastructure mapping drop execution runtime fault.");
  }
}

// =========================================================================
// UI DISPLAY CONTROL ROUTER
// =========================================================================
function launchWorkspaceDashboardShell() {
  document.getElementById("auth-container").classList.add("hidden");
  document.getElementById("app-workspace").classList.remove("hidden");
  
  document.getElementById("display-user-meta").innerText = `Active User: ${runtimeUserSessionContext.name} [No: ${runtimeUserSessionContext.userNo}]`;
  
  // Dynamic Route Processing Mapping Paths
  document.getElementById("nav-group-super").classList.add("hidden");
  document.getElementById("nav-group-operational").classList.add("hidden");
  document.getElementById("nav-group-customer").classList.add("hidden");
  document.getElementById("btn-nav-rbac").classList.add("hidden");

  // De-escalate visibility states across UI views
  const panels = document.querySelectorAll(".app-tab-pane");
  panels.forEach(p => p.classList.add("hidden"));

  window.addEventListener("mousemove", resetInactivityTrackingTimer);
  window.addEventListener("keypress", resetInactivityTrackingTimer);
  resetInactivityTrackingTimer();
  updateCountdownTelemetryDisplay();

  if (runtimeUserSessionContext.role === "SUPER_USER") {
    document.getElementById("nav-group-super").classList.remove("hidden");
    switchActiveTab("pane-super-salons");
    loadSuperUserSalonManagementBoard();
  } else if (runtimeUserSessionContext.role === "OWNER" || runtimeUserSessionContext.role === "MANAGER") {
    document.getElementById("nav-group-operational").classList.remove("hidden");
    if (runtimeUserSessionContext.role === "OWNER") {
      document.getElementById("btn-nav-rbac").classList.remove("hidden");
    }
    switchActiveTab("pane-master-data");
    synchronizeTenantOperationalDataCollections();
  } else if (runtimeUserSessionContext.role === "CUSTOMER") {
    document.getElementById("nav-group-customer").classList.remove("hidden");
    switchActiveTab("pane-customer-dashboard");
    compileCustomerDashboardVaultView();
  }
}

function switchActiveTab(paneId) {
  const panels = document.querySelectorAll(".app-tab-pane");
  panels.forEach(p => p.classList.add("hidden"));
  document.getElementById(paneId).classList.remove("hidden");
}

// =========================================================================
// DOMAIN LOGIC SUB-SYSTEM: SUPER USER MANIPULATION BOARD
// =========================================================================
async function loadSuperUserSalonManagementBoard() {
  try {
    const querySnapshot = await db.collection("users").where("role", "==", "OWNER").get();
    const tableBody = document.getElementById("table-body-salons");
    tableBody.innerHTML = "";

    querySnapshot.forEach(doc => {
      const entry = doc.data();
      const row = document.createElement("tr");
      row.className = "border-b border-slate-800 hover:bg-slate-800/40 text-xs";
      row.innerHTML = `
        <td class="p-3 font-mono text-indigo-400 font-bold">${entry.userNo}</td>
        <td class="p-3 font-bold text-slate-200">${entry.name}</td>
        <td class="p-3 text-slate-400">${entry.email}</td>
        <td class="p-3">
          <span class="px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-bold ${entry.active ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'}">
            ${entry.active ? 'Active' : 'Suspended'}
          </span>
        </td>
        <td class="p-3 text-right">
          <button onclick="toggleTenantOperationalState('${entry.ownerUserNo}', ${!entry.active})" class="px-2 py-1 ${entry.active ? 'bg-rose-900/60 text-rose-300' : 'bg-emerald-900/60 text-emerald-300'} rounded font-bold uppercase text-[10px]">
            ${entry.active ? 'Deactivate' : 'Activate'}
          </button>
        </td>
      `;
      tableBody.appendChild(row);
    });
  } catch (err) {
    alert("Super-user visualization read exception dropped: " + err.message);
  }
}

async function handleTenantCreation(e) {
  e.preventDefault();
  const sName = document.getElementById("salon-name").value.trim();
  const sEmail = document.getElementById("salon-email").value.trim();
  const sPhone = document.getElementById("salon-phone").value.trim();
  const sPass = document.getElementById("salon-password").value;

  try {
    const counterSnapshot = await db.collection("users").get();
    const generatedRunningSerialInt = counterSnapshot.size + 1;
    const formattedUserNo = String(generatedRunningSerialInt).padStart(4, "0");
    const formattedOwnerNo = String(generatedRunningSerialInt).padStart(3, "0");

    const newTenantRecord = {
      userNo: formattedUserNo,
      ownerUserNo: formattedOwnerNo,
      role: "OWNER",
      name: sName,
      email: sEmail,
      phone: sPhone,
      password: sPass,
      active: true,
      startDate: new Date().toISOString().split('T')[0],
      expiryDate: null,
      createdAt: new Date().toISOString(),
      accessRights: baseManagerAuthorizationMatrix
    };

    await db.collection("users").add(newTenantRecord);
    alert(`Tenant Provisioned Successfully! Assigned internal serialization number: ${formattedUserNo}`);
    document.getElementById("form-create-salon").reset();
    loadSuperUserSalonManagementBoard();
  } catch (err) {
    alert("Failed creating tenant profile tracking index context block: " + err.message);
  }
}

async function toggleTenantOperationalState(targetOwnerNo, nextState) {
  try {
    const targetSnapshot = await db.collection("users").where("ownerUserNo", "==", targetOwnerNo).get();
    const batchUpdateJob = db.batch();
    
    targetSnapshot.forEach(doc => {
      batchUpdateJob.update(doc.ref, { 
        active: nextState,
        expiryDate: nextState ? null : new Date().toISOString().split('T')[0]
      });
    });

    await batchUpdateJob.commit();
    alert(`Tenant State Modification Success. Multi-tenant node structural updates executed safely.`);
    loadSuperUserSalonManagementBoard();
  } catch (err) {
    alert("Cascading runtime structural modification error dropped: " + err.message);
  }
}

// =========================================================================
// DOMAIN LOGIC SUB-SYSTEM: TENANT CASCADING SYNCHRONIZATION DATA PIPELINE
// =========================================================================
function synchronizeTenantOperationalDataCollections() {
  const currentTenantScopeNo = runtimeUserSessionContext.ownerUserNo;

  // Sync Category Records Stream Vector
  db.collection("serviceCategories").where("ownerUserNo", "==", currentTenantScopeNo)
    .onSnapshot(snapshot => {
      structuralDataStoreCache.categories = [];
      snapshot.forEach(d => structuralDataStoreCache.categories.push(d.data()));
      renderCatalogComponentsIntoWorkspace();
    });

  // Sync Master Services Core Stream Vector
  db.collection("services").where("ownerUserNo", "==", currentTenantScopeNo)
    .onSnapshot(snapshot => {
      structuralDataStoreCache.services = [];
      snapshot.forEach(d => structuralDataStoreCache.services.push(d.data()));
      renderCatalogComponentsIntoWorkspace();
    });

  // Sync Granular Sub-Services Allocation Parameters
  db.collection("subServices").where("ownerUserNo", "==", currentTenantScopeNo)
    .onSnapshot(snapshot => {
      structuralDataStoreCache.subServices = [];
      snapshot.forEach(d => structuralDataStoreCache.subServices.push(d.data()));
      renderCatalogComponentsIntoWorkspace();
      recompileAllotmentFormSelectOptions();
    });

  // Sync CRM Identity Management Nodes
  db.collection("users").where("ownerUserNo", "==", currentTenantScopeNo)
    .onSnapshot(snapshot => {
      structuralDataStoreCache.crmUsers = [];
      snapshot.forEach(d => structuralDataStoreCache.crmUsers.push(d.data()));
      renderCRMUserTableFrame();
      if(runtimeUserSessionContext.role === "OWNER") renderRBACDelegationConsoleView();
    });

  // Continuous tracking updates on Common Service Package matrices
  db.collection("commonServicePacks").where("ownerUserNo", "==", currentTenantScopeNo)
    .onSnapshot(snapshot => {
      const container = document.getElementById("container-common-packs");
      container.innerHTML = "";
      snapshot.forEach(doc => {
        const p = doc.data();
        const card = document.createElement("div");
        card.className = "bg-slate-900 border border-slate-700 rounded-xl p-4 space-y-2";
        card.innerHTML = `
          <div class="flex justify-between items-start">
            <h4 class="font-bold text-slate-200">${p.title} <span class="text-xs font-mono text-indigo-400">(${p.packId})</span></h4>
            <span class="text-xs font-mono font-bold text-emerald-400">INR ${p.offerPrice}</span>
          </div>
          <p class="text-xs text-slate-400">Allotted Dynamic Duration Scope Value: ${p.durationMinutes} Minutes</p>
          <div class="text-[11px] bg-slate-800 p-2 rounded border border-slate-700 text-slate-300">
             Markdown Compound Rate Discount Applied: <span class="text-amber-400 font-bold">${p.overallDiscount}% OFF</span>
          </div>
        `;
        container.appendChild(card);
      });
    });
}

// =========================================================================
// CATALOG METRICS LAYER DISPATCHER
// =========================================================================
function renderCatalogComponentsIntoWorkspace() {
  const catList = document.getElementById("list-categories");
  catList.innerHTML = "";
  structuralDataStoreCache.categories.forEach(c => {
    const li = document.createElement("li");
    li.className = "py-2 flex justify-between items-center text-xs";
    li.innerHTML = `<div><b class="text-indigo-400 font-mono">[${c.catCode}]</b> <span class="text-slate-200 font-medium">${c.catName}</span></div>`;
    catList.appendChild(li);
  });

  const serList = document.getElementById("list-services");
  serList.innerHTML = "";
  structuralDataStoreCache.services.forEach(s => {
    const li = document.createElement("li");
    li.className = "py-2 flex justify-between items-center text-xs";
    li.innerHTML = `<div><b class="text-indigo-400 font-mono">[${s.serviceCode}]</b> <span class="text-slate-200 font-medium">${s.serviceName}</span> <i class="text-slate-500 block">Cat Reference Vector: ${s.catCode}</i></div>`;
    serList.appendChild(li);
  });

  const subList = document.getElementById("list-subservices");
  subList.innerHTML = "";
  structuralDataStoreCache.subServices.forEach(ss => {
    const li = document.createElement("li");
    li.className = "py-2 flex justify-between items-center text-xs";
    li.innerHTML = `<div><span class="text-slate-200 font-medium">${ss.subServiceName}</span><i class="text-slate-500 block">Rate Block Value: INR ${ss.rate} | Duration: ${ss.durationMinutes}m</i></div>`;
    subList.appendChild(li);
  });
}

function recompileAllotmentFormSelectOptions() {
  const cpSelect = document.getElementById("cpack-services-multiselect");
  const apSelect = document.getElementById("allot-services-multiselect");
  
  cpSelect.innerHTML = "";
  apSelect.innerHTML = "";

  structuralDataStoreCache.subServices.forEach(ss => {
    const opt = document.createElement("option");
    opt.value = ss.subServiceCode;
    opt.innerText = `${ss.subServiceName} (INR ${ss.rate} - ${ss.durationMinutes} Mins)`;
    cpSelect.appendChild(opt.cloneNode(true));
    apSelect.appendChild(opt.cloneNode(true));
  });
}

// =========================================================================
// REAL-TIME TRANSACTION CALCULATION FIELD PIPELINES
// =========================================================================
function calculateCommonPackFormMetrics() {
  const multiselect = document.getElementById("cpack-services-multiselect");
  const selectedSubServiceCodes = Array.from(multiselect.selectedOptions).map(o => o.value);
  
  let grossSumAccumulator = 0;
  let dynamicDurationSum = 0;

  selectedSubServiceCodes.forEach(code => {
    const targetSubObj = structuralDataStoreCache.subServices.find(item => item.subServiceCode === code);
    if(targetSubObj) {
      grossSumAccumulator += targetSubObj.rate;
      dynamicDurationSum += targetSubObj.durationMinutes;
    }
  });

  document.getElementById("cpack-total-cost").value = grossSumAccumulator;
  document.getElementById("cpack-duration").value = dynamicDurationSum;

  const userOverrideValueInput = document.getElementById("cpack-override-price").value;
  let calculationBaselinePrice = userOverrideValueInput ? parseFloat(userOverrideValueInput) : grossSumAccumulator;

  let computedPercentageFactor = 0;
  if(grossSumAccumulator > 0) {
    computedPercentageFactor = ((grossSumAccumulator - calculationBaselinePrice) / grossSumAccumulator) * 100;
  }
  document.getElementById("cpack-discount").value = Math.round(computedPercentageFactor) + "% Markdown";
}

function calculateCustomerPackFormMetrics() {
  const multiselect = document.getElementById("allot-services-multiselect");
  const selectedSubServiceCodes = Array.from(multiselect.selectedOptions).map(o => o.value);
  
  let grossSumAccumulator = 0;
  let dynamicDurationSum = 0;

  selectedSubServiceCodes.forEach(code => {
    const targetSubObj = structuralDataStoreCache.subServices.find(item => item.subServiceCode === code);
    if(targetSubObj) {
      grossSumAccumulator += targetSubObj.rate;
      dynamicDurationSum += targetSubObj.durationMinutes;
    }
  });

  document.getElementById("allot-total-cost").value = grossSumAccumulator;
  document.getElementById("allot-duration").value = dynamicDurationSum;

  const userOverrideValueInput = document.getElementById("allot-override-price").value;
  let calculationBaselinePrice = userOverrideValueInput ? parseFloat(userOverrideValueInput) : grossSumAccumulator;

  let computedPercentageFactor = 0;
  if(grossSumAccumulator > 0) {
    computedPercentageFactor = ((grossSumAccumulator - calculationBaselinePrice) / grossSumAccumulator) * 100;
  }
  document.getElementById("allot-discount").value = Math.round(computedPercentageFactor) + "% Realized Markdown";
}

// =========================================================================
// ACTION CONTROLLERS & DATA SUBMISSIONS
// =========================================================================
async function handleCommonPackAssembly(e) {
  e.preventDefault();
  if(!checkOperatorPermissionBounds("createCommonServicePack")) { alert("Execution Aborted: RBAC restriction policy locks out target data operation."); return; }

  const pCode = document.getElementById("cpack-code").value.trim();
  const pTitle = document.getElementById("cpack-title").value.trim();
  const multiselect = document.getElementById("cpack-services-multiselect");
  const selectedCodes = Array.from(multiselect.selectedOptions).map(o => o.value);

  const totalCost = parseFloat(document.getElementById("cpack-total-cost").value) || 0;
  const duration = parseInt(document.getElementById("cpack-duration").value) || 0;
  const overrideVal = document.getElementById("cpack-override-price").value;
  const finalOfferPrice = overrideVal ? parseFloat(overrideVal) : totalCost;
  const discountFactorStr = document.getElementById("cpack-discount").value;

  const mappedSubServicesPayload = selectedCodes.map(c => {
    const matchedSubService = structuralDataStoreCache.subServices.find(item => item.subServiceCode === c);
    return {
      subServiceCode: c,
      rate: matchedSubService ? matchedSubService.rate : 0,
      discount: parseInt(discountFactorStr) || 0,
      finalPrice: matchedSubService ? (matchedSubService.rate - (matchedSubService.rate * ((parseInt(discountFactorStr) || 0)/100))) : 0
    };
  });

  const commonPackDataPayload = {
    ownerUserNo: runtimeUserSessionContext.ownerUserNo,
    packId: pCode,
    title: pTitle,
    totalCost: totalCost,
    overallDiscount: parseInt(discountFactorStr) || 0,
    offerPrice: finalOfferPrice,
    durationMinutes: duration,
    subServices: mappedSubServicesPayload,
    active: true,
    startDate: new Date().toISOString().split('T')[0],
    expiryDate: null,
    createdAt: new Date().toISOString(),
    createdBy: runtimeUserSessionContext.role
  };

  try {
    await db.collection("commonServicePacks").add(commonPackDataPayload);
    alert("Common Service Membership Pack published.");
    document.getElementById("form-create-common-pack").reset();
  } catch(err) {
    alert("Failed saving configuration payload profile down to storage cluster context structural bounds.");
  }
}

async function handleCustomerPackAllotment(e) {
  e.preventDefault();
  if(!checkOperatorPermissionBounds("createCustomerServicePack")) { alert("Execution Aborted: RBAC restriction policy locks out target data operation."); return; }

  const targetClientNo = document.getElementById("allot-customer-select").value;
  const strategyContext = document.getElementById("allot-pack-type").value;
  const scopeBounds = document.getElementById("allot-scope").value;
  const multiselect = document.getElementById("allot-services-multiselect");
  const selectedCodes = Array.from(multiselect.selectedOptions).map(o => o.value);
  
  const totalCost = parseFloat(document.getElementById("allot-total-cost").value) || 0;
  const duration = parseInt(document.getElementById("allot-duration").value) || 0;
  const overrideVal = document.getElementById("allot-override-price").value;
  const finalOfferPrice = overrideVal ? parseFloat(overrideVal) : totalCost;
  const discountFactorStr = document.getElementById("allot-discount").value;
  const volumeLimitCount = parseInt(document.getElementById("allot-allowed-count").value) || 1;
  const financialReceiptNo = document.getElementById("allot-receipt-no").value.trim();
  const validityMonths = parseInt(document.getElementById("allot-validity-months").value) || 6;

  try {
    const counterSnapshot = await db.collection("customerServicePacks").where("customerNo", "==", targetClientNo).get();
    const sequentialIndex = counterSnapshot.size + 1;
    const computedCustomerPackName = `SP-${sequentialIndex}`;

    const runtimeClock = new Date();
    const contractStartString = runtimeClock.toISOString().split('T')[0];
    runtimeClock.setMonth(runtimeClock.getMonth() + validityMonths);
    const contractExpiryString = runtimeClock.toISOString().split('T')[0];

    const customerPackObjectPayload = {
      ownerUserNo: runtimeUserSessionContext.ownerUserNo,
      customerNo: targetClientNo,
      packName: computedCustomerPackName,
      packType: strategyContext,
      offerPrice: finalOfferPrice,
      totalAmount: totalCost,
      overallDiscount: parseInt(discountFactorStr) || 0,
      durationMinutes: duration,
      totalCoinsEarned: 0,
      totalAmountSpent: 0,
      customerScope: scopeBounds,
      amountReceived: true,
      receiptNo: financialReceiptNo,
      receiptDate: contractStartString,
      startDate: contractStartString,
      expiryDate: contractExpiryString,
      createdAt: new Date().toISOString(),
      active: true,
      createdBy: runtimeUserSessionContext.role
    };

    const targetPackRefDocument = await db.collection("customerServicePacks").add(customerPackObjectPayload);
    
    // Process child allocation item items inside transaction matrix array pipeline
    for (const code of selectedCodes) {
      const matchedSubService = structuralDataStoreCache.subServices.find(i => i.subServiceCode === code);
      const childItemDataPayload = {
        ownerUserNo: runtimeUserSessionContext.ownerUserNo,
        customerNo: targetClientNo,
        packName: computedCustomerPackName,
        subServiceCode: code,
        rate: matchedSubService ? matchedSubService.rate : 0,
        discount: parseInt(discountFactorStr) || 0,
        finalPrice: matchedSubService ? (matchedSubService.rate - (matchedSubService.rate * ((parseInt(discountFactorStr) || 0)/100))) : 0,
        allowedCount: volumeLimitCount,
        allowedUnlimited: strategyContext === "TYPE2" ? true : false,
        availedCount: 0,
        coinsToImpart: 10,
        enteredBy: runtimeUserSessionContext.role,
        active: true
      };
      await db.collection("customerServicePackItems").add(childItemDataPayload);
    }

    alert(`Customer Pack Registered! Generated membership tracking reference: ${computedCustomerPackName}`);
    document.getElementById("form-allot-customer-pack").reset();

    // Trigger Outbound Notification Strategy Matrix Alert
    const targetClientProfileObj = structuralDataStoreCache.crmUsers.find(u => u.customerNo === targetClientNo);
    if (targetClientProfileObj) {
      sendSystemNotificationMessage(
        targetClientProfileObj.email,
        `Welcome to GlamTrack Membership Framework Protocol`,
        `Hello ${targetClientProfileObj.name},\n\nYour profile has successfully been mapped to customized contract membership plan identifier tracking string node: ${computedCustomerPackName}.\nLifecycle Validation Limit Window: ${contractStartString} through ${contractExpiryString}.\n\nThank you for choosing us.`
      );
    }

  } catch(err) {
    recordTechnicalErrorLog(runtimeUserSessionContext.ownerUserNo, `Customer Subscription configuration write pipeline failed: ${err.message}`);
    alert("Structural subscription mapping drop exception.");
  }
}

// =========================================================================
// SERVICE RECOGNITION AND MEMBERSHIP UTILIZATION TRACKING LAYER
// =========================================================================
async function loadActiveCustomerSubscriptionPacks() {
  const cNo = document.getElementById("util-customer-select").value;
  const pSelect = document.getElementById("util-pack-select");
  pSelect.innerHTML = "";

  if(!cNo) return;

  try {
    const packsSnapshot = await db.collection("customerServicePacks")
      .where("customerNo", "==", cNo)
      .where("active", "==", true).get();

    packsSnapshot.forEach(doc => {
      const p = doc.data();
      const opt = document.createElement("option");
      opt.value = p.packName;
      opt.innerText = `${p.packName} (${p.packType === "TYPE1" ? 'Fixed Vol' : 'Stored Val Balance'}) - Expires: ${p.expiryDate}`;
      pSelect.appendChild(opt);
    });

    loadSubscriptionPackItemsStructure();
  } catch(err) {
    console.error(err);
  }
}

async function loadSubscriptionPackItemsStructure() {
  const cNo = document.getElementById("util-customer-select").value;
  const pName = document.getElementById("util-pack-select").value;
  const wrapper = document.getElementById("container-pack-items-breakdown");
  wrapper.innerHTML = "";

  if(!cNo || !pName) return;

  try {
    const itemsSnapshot = await db.collection("customerServicePackItems")
      .where("customerNo", "==", cNo)
      .where("packName", "==", pName)
      .where("active", "==", true).get();

    itemsSnapshot.forEach(doc => {
      const data = doc.data();
      const matchedSubService = structuralDataStoreCache.subServices.find(s => s.subServiceCode === data.subServiceCode);
      const subTitle = matchedSubService ? matchedSubService.subServiceName : `Code Vector: ${data.subServiceCode}`;
      
      const elementRow = document.createElement("div");
      elementRow.className = "flex items-center justify-between p-3 bg-slate-800 border border-slate-700 rounded-lg";
      elementRow.innerHTML = `
        <div class="space-y-0.5">
          <span class="font-bold text-slate-200 block">${subTitle}</span>
          <span class="text-xs text-slate-400 block font-mono">Usage Tracker: ${data.availedCount} / ${data.allowedUnlimited ? 'Unlimited Stored-Val Value Bounds' : data.allowedCount} Used</span>
        </div>
        <input type="checkbox" name="util-selected-items-checkbox" value="${data.subServiceCode}" class="w-4 h-4 text-indigo-600 bg-slate-700 border-slate-600 rounded focus:ring-indigo-500">
      `;
      wrapper.appendChild(elementRow);
    });
  } catch(err) {
    console.error(err);
  }
}

async function executeUtilizationLog() {
  if(!checkOperatorPermissionBounds("utilizeServicePack")) { alert("Execution Aborted: RBAC restriction policy locks out target utilization tracking parameters."); return; }

  const cNo = document.getElementById("util-customer-select").value;
  const pName = document.getElementById("util-pack-select").value;
  const remarks = document.getElementById("util-remarks").value.trim();
  
  const selectedCheckboxes = document.querySelectorAll('input[name="util-selected-items-checkbox"]:checked');
  if(selectedCheckboxes.length === 0) {
    alert("Verification Intercept: Please select at least one sub-service unit before processing utilization.");
    return;
  }

  const targetedServicesForVisit = Array.from(selectedCheckboxes).map(cb => {
    return { subServiceCode: cb.value, coinsEarned: 15 };
  });

  try {
    // Call the dynamic transaction pipeline directly from the application engine core
    const packQuerySnapshot = await db.collection("customerServicePacks")
      .where("customerNo", "==", cNo)
      .where("packName", "==", pName)
      .limit(1).get();

    if(packQuerySnapshot.empty) return;
    
    const packDoc = packQuerySnapshot.docs[0];
    const packData = packDoc.data();

    let aggregateVisitCost = 0;
    const batchJobRunner = db.batch();

    for (const serviceUnit of targetedServicesForVisit) {
      const itemSnapshot = await db.collection("customerServicePackItems")
        .where("customerNo", "==", cNo)
        .where("packName", "==", pName)
        .where("subServiceCode", "==", serviceUnit.subServiceCode)
        .limit(1).get();

      if(!itemSnapshot.empty) {
        const itemDoc = itemSnapshot.docs[0];
        const itemData = itemDoc.data();

        if(!itemData.allowedUnlimited && itemData.availedCount >= itemData.allowedCount) {
          alert("Operational Failure Margin: Volumetric tracking metrics drop exception. Selection limits completely exhausted.");
          return;
        }

        batchJobRunner.update(itemDoc.ref, { availedCount: itemData.availedCount + 1 });
        aggregateVisitCost += itemData.finalPrice;
      }
    }

    const nextAccumulatedSpend = (packData.totalAmountSpent || 0) + aggregateVisitCost;
    const nextAccumulatedCoins = (packData.totalCoinsEarned || 0) + (targetedServicesForVisit.length * 15);

    batchJobRunner.update(packDoc.ref, {
      totalAmountSpent: nextAccumulatedSpend,
      totalCoinsEarned: nextAccumulatedCoins
    });

    const utilizationMasterRecord = {
      ownerUserNo: runtimeUserSessionContext.ownerUserNo,
      customerNo: cNo,
      packName: pName,
      dateOfVisit: new Date().toISOString().split('T')[0],
      timeOfVisit: new Date().toTimeString().split(' ')[0].substring(0,5),
      subServicesAvailed: targetedServicesForVisit,
      remarks: remarks,
      totalCoinsEarnedTillDate: nextAccumulatedCoins,
      totalAmountSpentTillDate: nextAccumulatedSpend,
      enteredBy: runtimeUserSessionContext.role,
      editableBy: "OWNER"
    };

    await db.collection("servicePackUtilizations").add(utilizationMasterRecord);
    await batchJobRunner.commit();

    alert("Utilization Profile Log Processed Successfully across distributed ledger components.");
    document.getElementById("util-remarks").value = "";
    loadSubscriptionPackItemsStructure();

    // Trigger Volumetric and Financial Remaining Capacity Monitoring Checks
    const currentTotalValueCost = packData.totalAmount || packData.offerPrice;
    if(packData.packType === "TYPE2") {
      const remainingBalance = currentTotalValueCost - nextAccumulatedSpend;
      if(remainingBalance < (currentTotalValueCost * 0.20)) {
        sendSystemNotificationMessage(runtimeUserSessionContext.email, "GlamTrack Notification: Low-Balance Operational Quota Alert Level Triggered", `Client: ${cNo}\nRemaining Account Stored-Val Metrics: INR ${remainingBalance}`);
      }
    }

  } catch(err) {
    recordTechnicalErrorLog(runtimeUserSessionContext.ownerUserNo, `Utilization routine failed: ${err.message}`);
    alert("Processing execution drop error caught inside framework loops.");
  }
}

// =========================================================================
// CRM PROFILE INTERFACES & RENDERING VISUALIZATIONS
// =========================================================================
function renderCRMUserTableFrame() {
  const tbody = document.getElementById("table-body-crm");
  tbody.innerHTML = "";

  const clientAllotSelect = document.getElementById("allot-customer-select");
  const clientUtilSelect = document.getElementById("util-customer-select");
  
  clientAllotSelect.innerHTML = '<option value="">-- Choose Profile Map Element --</option>';
  clientUtilSelect.innerHTML = '<option value="">-- Choose Profile Map Element --</option>';

  structuralDataStoreCache.crmUsers.forEach(u => {
    if(u.role === "OWNER") return;

    const row = document.createElement("tr");
    row.className = "border-b border-slate-800 text-xs text-slate-300 hover:bg-slate-800/20";
    
    const displayId = u.role === "CUSTOMER" ? u.customerNo : u.userNo;

    row.innerHTML = `
      <td class="p-3 font-mono font-bold text-indigo-400">${displayId}</td>
      <td class="p-3 font-medium uppercase text-[10px] text-slate-400">${u.role}</td>
      <td class="p-3"><b class="text-slate-100 block">${u.name}</b><span class="text-slate-500 block text-[11px]">${u.email} // ${u.phone}</span></td>
      <td class="p-3 text-slate-400">${u.city || 'N/A'}<span class="block text-[11px] text-slate-500">${u.distance || ''}</span></td>
      <td class="p-3 text-slate-400">${u.ageGroup || 'N/A'}</td>
      <td class="p-3 text-right">
         <span class="px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${u.active ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'}">${u.active ? 'Active' : 'Locked'}</span>
      </td>
    `;
    tbody.appendChild(row);

    if(u.role === "CUSTOMER") {
      const opt = document.createElement("option");
      opt.value = u.customerNo;
      opt.innerText = `${u.name} (${u.customerNo})`;
      clientAllotSelect.appendChild(opt.cloneNode(true));
      clientUtilSelect.appendChild(opt.cloneNode(true));
    }
  });
}

async function commitCRMUserProfileEntity() {
  const role = document.getElementById("mc-role").value;
  const name = document.getElementById("mc-name").value.trim();
  const sex = document.getElementById("mc-sex").value;
  const password = document.getElementById("mc-password").value;
  const phone = document.getElementById("mc-phone").value.trim();
  const email = document.getElementById("mc-email").value.trim();
  const ageGroup = document.getElementById("mc-agegroup").value;
  const distance = document.getElementById("mc-distance").value;
  const address = document.getElementById("mc-address").value.trim();
  const city = document.getElementById("mc-city").value.trim();
  const googleMapLink = document.getElementById("mc-map").value.trim();

  if(!name || !email || !password) { alert("Missing operational constraint records."); return; }

  try {
    const totalGlobalSnapshot = await db.collection("users").get();
    const sequenceCount = totalGlobalSnapshot.size + 1;
    const computedUserNo = String(sequenceCount).padStart(4, "0");

    let finalPayloadObject = {
      userNo: computedUserNo,
      ownerUserNo: runtimeUserSessionContext.ownerUserNo,
      role: role,
      name: name,
      sex: sex,
      password: password,
      phone: phone,
      email: email,
      ageGroup: ageGroup,
      distance: distance,
      address: address,
      city: city,
      googleMapLink: googleMapLink,
      active: true,
      startDate: new Date().toISOString().split('T')[0],
      expiryDate: null,
      createdAt: new Date().toISOString()
    };

    if (role === "CUSTOMER") {
      const customPrefix = name.replace(/[^a-zA-Z]/g, "").substring(0, 3).toUpperCase().padEnd(3, "X");
      const clientProfileCountSnapshot = await db.collection("users")
        .where("ownerUserNo", "==", runtimeUserSessionContext.ownerUserNo)
        .where("role", "==", "CUSTOMER").get();
      const serialSuffix = String(clientProfileCountSnapshot.size + 1).padStart(3, "0");
      finalPayloadObject.customerNo = `${customPrefix}${serialSuffix}`;
    } else if (role === "MANAGER") {
      finalPayloadObject.accessRights = baseManagerAuthorizationMatrix;
    }

    await db.collection("users").add(finalPayloadObject);
    alert("CRM Structural Entity successfully compiled down to runtime instance repositories.");
    closeGenericModal("modal-crm-user");
  } catch(err) {
    alert("Failed creating system profile reference block: " + err.message);
  }
}

// =========================================================================
// STAFF RIGHTS ASSIGNMENT ENGINE (RBAC MANAGER CONSOLE)
// =========================================================================
function renderRBACDelegationConsoleView() {
  const container = document.getElementById("container-rbac-managers");
  container.innerHTML = "";

  const managers = structuralDataStoreCache.crmUsers.filter(u => u.role === "MANAGER");
  if(managers.length === 0) {
    container.innerHTML = `<p class="text-slate-500 italic text-xs col-span-2">No registered management staff profiles detected in this tenant.</p>`;
    return;
  }

  managers.forEach(mgr => {
    const card = document.createElement("div");
    card.className = "bg-slate-900 border border-slate-700 rounded-xl p-4 space-y-3";
    
    let rightsCheckboxesHTML = `<div class="grid grid-cols-2 gap-2 text-[11px] text-slate-400">`;
    Object.keys(baseManagerAuthorizationMatrix).forEach(key => {
      const isChecked = mgr.accessRights && mgr.accessRights[key] === true;
      rightsCheckboxesHTML += `
        <label class="flex items-center space-x-2 bg-slate-800 p-1.5 border border-slate-700 rounded cursor-pointer hover:bg-slate-700/50">
          <input type="checkbox" data-mgr-no="${mgr.userNo}" data-right-key="${key}" ${isChecked ? 'checked' : ''} onchange="syncRBACPermissionAdjustmentValue(this)" class="rounded bg-slate-900 border-slate-600 text-indigo-600 focus:ring-0 w-3.5 h-3.5">
          <span class="truncate">${key}</span>
        </label>
      `;
    });
    rightsCheckboxesHTML += `</div>`;

    card.innerHTML = `
      <div class="border-b border-slate-800 pb-2 flex justify-between items-center">
        <h4 class="font-bold text-sm text-slate-200">${mgr.name} <span class="text-xs font-mono text-indigo-400">[ID: ${mgr.userNo}]</span></h4>
        <span class="text-[10px] font-mono bg-slate-800 text-slate-400 border border-slate-700 px-2 py-0.5 rounded">RBAC Target Matrix</span>
      </div>
      ${rightsCheckboxesHTML}
    `;
    container.appendChild(card);
  });
}

async function syncRBACPermissionAdjustmentValue(checkboxElement) {
  const targetManagerUserNo = checkboxElement.getAttribute("data-mgr-no");
  const targetRightKey = checkboxElement.getAttribute("data-right-key");
  const valueFlagState = checkboxElement.checked;

  try {
    const querySnapshot = await db.collection("users")
      .where("ownerUserNo", "==", runtimeUserSessionContext.ownerUserNo)
      .where("userNo", "==", targetManagerUserNo)
      .limit(1).get();

    if(!querySnapshot.empty) {
      const targetDocRef = querySnapshot.docs[0].ref;
      const currentRightsObj = querySnapshot.docs[0].data().accessRights || {};
      currentRightsObj[targetRightKey] = valueFlagState;

      await targetDocRef.update({ accessRights: currentRightsObj });
      
      // Post change tracking details downstream into access logs collection module
      const rbacAccessLogPayload = {
        logId: "log_" + Math.random().toString(36).substring(2, 9),
        ownerUserNo: runtimeUserSessionContext.ownerUserNo,
        managerUserId: targetManagerUserNo,
        rightChanged: targetRightKey,
        newValue: valueFlagState,
        changedBy: "OWNER",
        changedAt: new Date().toISOString()
      };
      await db.collection("accessLogs").add(rbacAccessLogPayload);
      console.log(`Permission parameter '${targetRightKey}' synchronized successfully for User reference: ${targetManagerUserNo}`);
    }
  } catch(err) {
    console.error("Failed saving permission adjustments:", err);
  }
}

// =========================================================================
// END USER SUB-SYSTEM: CUSTOMER DASHBOARD PACK ARCHIVE VAULT
// =========================================================================
async function compileCustomerDashboardVaultView() {
  const container = document.getElementById("customer-vault-dashboard-wrapper");
  const promotionalContainer = document.getElementById("customer-promotional-matrix-deck");
  
  container.innerHTML = "";
  promotionalContainer.innerHTML = "";

  try {
    const packsSnapshot = await db.collection("customerServicePacks")
      .where("customerNo", "==", runtimeUserSessionContext.customerNo)
      .where("active", "==", true).get();

    if(packsSnapshot.empty) {
      container.innerHTML = `<p class="text-slate-500 italic text-sm">No active membership subscription modules registered under this customer profile context.</p>`;
    }

    for (const doc of packsSnapshot.docs) {
      const p = doc.data();
      const card = document.createElement("div");
      card.className = "bg-slate-900 border border-slate-700 rounded-xl p-5 space-y-4 shadow-lg";

      const totalVal = p.totalAmount || p.offerPrice;
      const progressPercent = Math.min(100, ((p.totalAmountSpent || 0) / totalVal) * 100);

      // Collect Child Item Status Trackers
      const itemsSnapshot = await db.collection("customerServicePackItems")
        .where("customerNo", "==", runtimeUserSessionContext.customerNo)
        .where("packName", "==", p.packName).get();

      let itemsRowsHTML = `<div class="space-y-1.5 border-t border-slate-800 pt-3">`;
      itemsSnapshot.forEach(itemDoc => {
        const item = itemDoc.data();
        itemsRowsHTML += `
          <div class="flex justify-between items-center text-xs">
            <span class="text-slate-400 font-medium">Sub-Service Unit Identity Ref [${item.subServiceCode}]</span>
            <span class="font-mono text-slate-200 font-bold bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
               ${item.availedCount} / ${item.allowedUnlimited ? '∞' : item.allowedCount} Consumed
            </span>
          </div>
        `;
      });
      itemsRowsHTML += `</div>`;

      card.innerHTML = `
        <div class="flex justify-between items-start border-b border-slate-800 pb-3">
          <div>
            <h4 class="text-lg font-black text-slate-100 tracking-wide">${p.packName}</h4>
            <span class="text-[10px] font-mono font-bold bg-indigo-950 text-indigo-400 border border-indigo-900 px-2 py-0.5 rounded uppercase mt-1 inline-block">
               Strategy Profile Type: ${p.packType}
            </span>
          </div>
          <div class="text-right">
            <span class="text-xs text-slate-500 block">Allotment Token Scope</span>
            <span class="text-sm font-bold text-emerald-400 font-mono">${p.customerScope}</span>
          </div>
        </div>

        <div class="space-y-1.5">
          <div class="flex justify-between text-xs font-mono">
            <span class="text-slate-400">Total Account Capital Tracking Index</span>
            <span class="text-slate-200 font-bold">INR ${p.totalAmountSpent || 0} / INR ${totalVal}</span>
          </div>
          <div class="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700">
            <div class="bg-indigo-500 h-full transition-all duration-500" style="width: ${progressPercent}%"></div>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2 text-xs bg-slate-800/50 p-3 rounded-lg border border-slate-800 font-mono">
          <div>
            <span class="text-[10px] text-slate-500 block uppercase">Contract Issued</span>
            <span class="text-slate-300 font-medium">${p.receiptDate}</span>
          </div>
          <div>
            <span class="text-[10px] text-slate-500 block uppercase">Lifecycle Expiry</span>
            <span class="text-rose-400 font-bold">${p.expiryDate}</span>
          </div>
          <div class="col-span-2 pt-1.5 border-t border-slate-800 flex justify-between items-center">
            <span class="text-[10px] text-slate-500 uppercase">Loyalty Coins Accumulated</span>
            <span class="text-amber-400 font-extrabold text-sm">${p.totalCoinsEarned || 0} COINS</span>
          </div>
        </div>

        ${itemsRowsHTML}
      `;
      container.appendChild(card);
    }

    // Compile Promotional Matrix Materials
    const promoSnapshot = await db.collection("promotions").where("ownerUserNo", "==", runtimeUserSessionContext.ownerUserNo).get();
    if(promoSnapshot.empty) {
      promotionalContainer.innerHTML = `<p class="text-slate-600 italic text-xs">No active salon community promo flyers or seasonal media distributed today.</p>`;
    }
    promoSnapshot.forEach(doc => {
      const pr = doc.data();
      const div = document.createElement("div");
      div.className = "bg-slate-900 border border-slate-800 rounded-lg p-3 text-center space-y-2";
      div.innerHTML = `
        <div class="h-32 bg-slate-800 rounded border border-slate-700 flex items-center justify-center text-slate-500 font-mono text-xs italic">
           [Image Asset Flyer Placeholder: ${pr.imageFileName}]
        </div>
        <span class="text-xs font-bold font-mono text-indigo-400 tracking-tight block uppercase">Target Model Id: ${pr.targetId}</span>
      `;
      promotionalContainer.appendChild(div);
    });

  } catch(err) {
    console.error("Customer tracking space parsing dropped:", err);
  }
}

// =========================================================================
// INTERFACE MODAL UTILITY TRIGGERS
// =========================================================================
function openGenericModal(modalId) {
  document.getElementById(modalId).classList.remove("hidden");
  if(modalId === 'modal-service') {
    const sel = document.getElementById("m-ser-cat");
    sel.innerHTML = "";
    structuralDataStoreCache.categories.forEach(c => {
      sel.innerHTML += `<option value="${c.catCode}">${c.catName} (${c.catCode})</option>`;
    });
  } else if(modalId === 'modal-subservice') {
    const sel = document.getElementById("m-sub-ser");
    sel.innerHTML = "";
    structuralDataStoreCache.services.forEach(s => {
      sel.innerHTML += `<option value="${s.serviceCode}">${s.serviceName} (${s.serviceCode})</option>`;
    });
  }
}

function closeGenericModal(modalId) {
  document.getElementById(modalId).classList.add("hidden");
}

// =========================================================================
// COMPILING MASTER DATA CONFIGURATIONS VIA MODAL HOOKS
// =========================================================================
async function commitMasterCategory() {
  if(!checkOperatorPermissionBounds("createCategory")) { alert("Execution Aborted: RBAC restriction policy locks out target operation."); return; }
  const code = document.getElementById("m-cat-code").value.trim();
  const name = document.getElementById("m-cat-name").value.trim();
  const desc = document.getElementById("m-cat-desc").value.trim();

  if(!code || !name) return;

  const payload = {
    ownerUserNo: runtimeUserSessionContext.ownerUserNo,
    catCode: code,
    catName: name,
    catDescription: desc,
    active: true,
    startDate: new Date().toISOString().split('T')[0],
    expiryDate: null,
    createdAt: new Date().toISOString(),
    createdBy: runtimeUserSessionContext.role
  };

  await db.collection("serviceCategories").add(payload);
  closeGenericModal("modal-category");
}

async function commitMasterService() {
  if(!checkOperatorPermissionBounds("createService")) { alert("Execution Aborted: RBAC restriction policy locks out target operation."); return; }
  const catRef = document.getElementById("m-ser-cat").value;
  const code = document.getElementById("m-ser-code").value.trim();
  const name = document.getElementById("m-ser-name").value.trim();
  const desc = document.getElementById("m-ser-desc").value.trim();

  if(!code || !name) return;

  const payload = {
    ownerUserNo: runtimeUserSessionContext.ownerUserNo,
    serviceCode: code,
    serviceName: name,
    serviceDescription: desc,
    catCode: catRef,
    active: true,
    startDate: new Date().toISOString().split('T')[0],
    expiryDate: null,
    createdAt: new Date().toISOString(),
    createdBy: runtimeUserSessionContext.role
  };

  await db.collection("services").add(payload);
  closeGenericModal("modal-service");
}

async function commitMasterSubService() {
  if(!checkOperatorPermissionBounds("createSubService")) { alert("Execution Aborted: RBAC restriction policy locks out target operation."); return; }
  const serRef = document.getElementById("m-sub-ser").value;
  const code = document.getElementById("m-sub-code").value.trim();
  const name = document.getElementById("m-sub-name").value.trim();
  const rate = parseFloat(document.getElementById("m-sub-rate").value) || 0;
  const duration = parseInt(document.getElementById("m-sub-dur").value) || 30;

  if(!code || !name) return;

  const payload = {
    ownerUserNo: runtimeUserSessionContext.ownerUserNo,
    subServiceCode: code,
    subServiceName: name,
    serviceCode: serRef,
    rate: rate,
    durationMinutes: duration,
    active: true,
    startDate: new Date().toISOString().split('T')[0],
    expiryDate: null,
    createdAt: new Date().toISOString(),
    createdBy: runtimeUserSessionContext.role
  };

  await db.collection("subServices").add(payload);
  closeGenericModal("modal-subservice");
}