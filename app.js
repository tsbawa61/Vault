/**
 * =========================================================================
 * GlamTrack Core Platform Controller - Enterprise Salon Fidelity System
 * Authoritative Master Engine Build
 * =========================================================================
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { 
    getFirestore, collection, query, where, getDocs, doc, setDoc, onSnapshot, writeBatch, deleteDoc 
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { SAMPLE_CATEGORIES, SAMPLE_SERVICES, SAMPLE_SUB_SERVICES } from "./constants.js";
import { reportRuntimeCrash } from "./errorMailer.js";

// 1. Authoritative System Configuration Core Vault
const firebaseConfig = {
  apiKey: "AIzaSyDQO_LSnflOgA5H-Nz95eIksx94BhlZP_c",
  authDomain: "vault-050166.firebaseapp.com",
  projectId: "vault-050166",
  storageBucket: "vault-050166.firebasestorage.app",
  messagingSenderId: "252753845895",
  appId: "1:252753845895:web:0def3dc427df7938c12222",
  measurementId: "G-4XEPZ5S45V"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

// Explicit Security Parameters
const MASTER_SUPER_USER_EMAIL = "bawa.codes@gmail.com";
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 Minutes Inactivity Boundary Rule

// System Execution Runtime States
let activeSessionUser = null;
let realtimePacksUnsubscribe = null;
let sessionWatchdogTimer = null;

// =========================================================================
// UI Lifecycle Router Initialization Hook
// =========================================================================
document.addEventListener("DOMContentLoaded", () => {
    initViewRouterLinks();
    setupMediaPreviewListener("pack-promo-file", "preview-pack-img");
});

function initViewRouterLinks() {
    document.getElementById("nav-home").addEventListener("click", () => showActiveFrame("sec-home"));
    document.getElementById("nav-login").addEventListener("click", () => showActiveFrame("sec-login"));
    document.getElementById("nav-dashboard").addEventListener("click", () => showActiveFrame("sec-dashboard"));
    document.getElementById("nav-adm-catalog").addEventListener("click", () => showActiveFrame("sec-adm-catalog"));
    document.getElementById("nav-adm-packs").addEventListener("click", () => showActiveFrame("sec-adm-packs"));
    document.getElementById("nav-adm-users").addEventListener("click", () => showActiveFrame("sec-adm-users"));
    document.getElementById("nav-logout").addEventListener("click", performSessionLogoutAction);
    
    // Dynamic Form Interface Management Toggle
    document.getElementById("txt-login-role").addEventListener("change", (e) => {
        const passwordGroup = document.getElementById("grp-login-pass");
        if (e.target.value === "SUPER_USER") {
            passwordGroup.insertAdjacentHTML('beforebegin', `
                <div class="mb-3" id="grp-otp-challenge" style="display:none;">
                    <label class="form-label fw-bold text-danger small">Enter 6-Digit Secure Verification OTP</label>
                    <input type="text" class="form-control" id="txt-login-otp" placeholder="e.g., 123456" maxlength="6">
                </div>
            `);
            passwordGroup.style.display = "none";
        } else {
            const otpNode = document.getElementById("grp-otp-challenge");
            if (otpNode) otpNode.remove();
            passwordGroup.style.display = "block";
        }
    });
    
    document.getElementById("btn-execute-auth").addEventListener("click", processSecureProfileAuthentication);
    document.getElementById("btn-trigger-autopopulate").addEventListener("click", executeDynamicAutopopulateMenuTask);
    
    // Core Administrative Entity Lifecycle Pipelines
    document.getElementById("frm-adm-category").addEventListener("submit", processCategoryADMFormSubmission);
    document.getElementById("frm-adm-service").addEventListener("submit", processServiceADMFormSubmission);
    document.getElementById("frm-adm-subservice").addEventListener("submit", processSubServiceADMFormSubmission);
    document.getElementById("frm-adm-commonpack").addEventListener("submit", processCommonPackADMFormSubmission);
    document.getElementById("frm-adm-user-profile").addEventListener("submit", processUserADMFormSubmission);
    document.getElementById("frm-allot-membership").addEventListener("submit", processAllotmentFormSubmission);
}

function showActiveFrame(sectionId) {
    document.querySelectorAll(".view-section").forEach(s => s.classList.remove("active"));
    document.getElementById(sectionId).classList.add("active");
}

function startSessionWatchdog() {
    if (sessionWatchdogTimer) clearTimeout(sessionWatchdogTimer);
    sessionWatchdogTimer = setTimeout(() => {
        alert("Session expired due to 15 minutes of inactivity. System re-locking standard ports.");
        performSessionLogoutAction();
    }, INACTIVITY_TIMEOUT_MS);
}

// =========================================================================
// Dual-Factor Security Identity Authentication Pipeline
// =========================================================================
async function processSecureProfileAuthentication() {
    const selectedRole = document.getElementById("txt-login-role").value;
    const emailInput = document.getElementById("txt-login-email").value.trim().toLowerCase();
    const passwordInput = document.getElementById("txt-login-pass") ? document.getElementById("txt-login-pass").value : "";

    if (!emailInput) return alert("Email identity must be explicitly defined.");

    try {
        // --- 1. SUPER_USER / ADM USER ISOLATION LAYER ---
        if (selectedRole === "SUPER_USER") {
            if (emailInput !== MASTER_SUPER_USER_EMAIL) {
                alert("Access Denied: This email identifier is not registered as the system Super User.");
                return;
            }

            const otpContainer = document.getElementById("grp-otp-challenge");
            const otpInputVal = document.getElementById("txt-login-otp") ? document.getElementById("txt-login-otp").value.trim() : "";

            // Step A: Initial Input Stage - Dispatch dynamic security OTP
            if (!otpContainer || otpContainer.style.display === "none") {
                const secureGeneratedToken = Math.floor(100000 + Math.random() * 900000);
                window.tempSessionOtpStorage = secureGeneratedToken;

                if (otpContainer) otpContainer.style.display = "block";

                await emailjs.send('service_050166', 'template_050166', {
                    to_email: MASTER_SUPER_USER_EMAIL,
                    subject: "GlamTrack Security Access - ADM User Verification OTP",
                    body: `Your secure validation one-time password for GlamTrack Developer Access is: ${secureGeneratedToken}.\nThis token expires automatically in 15 minutes.`
                });

                alert(`Authorization code dispatched safely to your mailbox at: ${MASTER_SUPER_USER_EMAIL}`);
                return;
            }

            // Step B: Evaluation Challenge Stage
            if (parseInt(otpInputVal, 10) !== window.tempSessionOtpStorage) {
                alert("Verification Failed: Invalid Security One-Time Password token supplied.");
                return;
            }

            // Flush out memory footprint tracking variables
            delete window.tempSessionOtpStorage;

            activeSessionUser = { 
                userNo: "0001", 
                role: "SUPER_USER", 
                name: "Bawa Codes Developer", 
                email: MASTER_SUPER_USER_EMAIL,
                ownerUserNo: "000" 
            };
            
            renderAuthorizedWorkspaceSession();
            return;
        }

        // --- 2. MULTI-TENANT ROLES LAYER (OWNER / MANAGER / CUSTOMER) ---
        const q = query(collection(db, "users"), where("email", "==", emailInput), where("role", "==", selectedRole));
        const res = await getDocs(q);
        if (res.empty) return alert("Profile parameters matched no structural user nodes on file.");

        const userDoc = res.docs[0].data();
        if (userDoc.password !== passwordInput) return alert("Authentication profile verification failed.");

        // Anachronistic system validation constraint boundaries checks
        const isoToday = new Date().toISOString().split("T")[0];
        if (userDoc.startDate && isoToday < userDoc.startDate) return alert("System Closed: Pre-operational schedule boundary.");
        if (userDoc.expiryDate && isoToday > userDoc.expiryDate) return alert("System Closed: Expiry execution contract state.");
        if (!userDoc.active) return alert("Account flag is currently flagged as inactive/archived.");

        activeSessionUser = userDoc;
        renderAuthorizedWorkspaceSession();
    } catch (crash) {
        reportRuntimeCrash(activeSessionUser?.name || "Anonymous / Security Guard Context", activeSessionUser, crash);
    }
}

function renderAuthorizedWorkspaceSession() {
    document.getElementById("nav-logout").classList.remove("d-none");
    document.getElementById("nav-dashboard").classList.remove("d-none");
    document.getElementById("nav-login").classList.add("d-none");
    
    // Dynamically grant administrative visibility partitions matching authorization rights
    if (activeSessionUser.role === "SUPER_USER" || activeSessionUser.role === "OWNER") {
        document.getElementById("nav-adm-catalog").classList.remove("d-none");
        document.getElementById("nav-adm-packs").classList.remove("d-none");
        document.getElementById("nav-adm-users").classList.remove("d-none");
        document.getElementById("btn-trigger-autopopulate").classList.remove("d-none");
    } else {
        document.getElementById("nav-adm-catalog").classList.add("d-none");
        document.getElementById("nav-adm-packs").classList.add("d-none");
        document.getElementById("nav-adm-users").classList.add("d-none");
        document.getElementById("btn-trigger-autopopulate").classList.add("d-none");
    }

    document.getElementById("lbl-active-context").innerText = `Scope ID: ${activeSessionUser.ownerUserNo} | Active Context Profile: ${activeSessionUser.role}`;
    startSessionWatchdog();
    showActiveFrame("sec-dashboard");
    
    bindRealtimeAnalyticsStream();
    loadWorkspaceDropdownMappings();
    refreshAllAdministrativeTables();
}

function performSessionLogoutAction() {
    if (realtimePacksUnsubscribe) realtimePacksUnsubscribe();
    if (sessionWatchdogTimer) clearTimeout(sessionWatchdogTimer);
    activeSessionUser = null;
    window.location.reload();
}

// =========================================================================
// Auto-Populate Automation & Code Generation Processing Core Engine
// =========================================================================
async function getHighestFieldOffset(tableName, fieldKey) {
    let topVal = 0;
    const q = query(collection(db, tableName), where("ownerUserNo", "==", activeSessionUser.ownerUserNo));
    const snap = await getDocs(q);
    snap.forEach(d => {
        const parsed = parseInt(d.data()[fieldKey], 10);
        if(!isNaN(parsed) && parsed > topVal) topVal = parsed;
    });
    return topVal;
}

async function executeDynamicAutopopulateMenuTask() {
    if(!activeSessionUser) return alert("No active user configuration session present.");
    const ownerId = activeSessionUser.ownerUserNo;

    try {
        const batch = writeBatch(db);
        const isoNow = new Date().toISOString().split("T")[0];
        const timestamp = new Date().toISOString();

        const offsetCat = await getHighestFieldOffset("serviceCategories", "catCode");
        const offsetSrv = await getHighestFieldOffset("services", "serviceCode");
        const offsetSub = await getHighestFieldOffset("subServices", "subServiceCode");

        const categoryMap = {}, serviceMap = {};

        SAMPLE_CATEGORIES.forEach((c, idx) => {
            const calculatedCode = String(offsetCat + (idx + 1)).padStart(2, "0");
            categoryMap[c.catCode] = calculatedCode;
            batch.set(doc(db, "serviceCategories", `${ownerId}_CAT_${calculatedCode}`), {
                ownerUserNo: ownerId, catCode: calculatedCode, catName: c.catName, catDescription: c.catDescription,
                active: true, createdBy: activeSessionUser.role, startDate: isoNow, expiryDate: null, createdAt: timestamp
            });
        });

        SAMPLE_SERVICES.forEach((s, idx) => {
            const calculatedCode = String(offsetSrv + (idx + 1)).padStart(2, "0");
            serviceMap[s.serviceCode] = calculatedCode;
            const contextCatParent = categoryMap[s.catCode] || s.catCode;
            batch.set(doc(db, "services", `${ownerId}_SRV_${calculatedCode}`), {
                ownerUserNo: ownerId, serviceCode: calculatedCode, serviceName: s.serviceName, serviceDescription: s.serviceDescription,
                catCode: contextCatParent, active: true, createdBy: activeSessionUser.role, startDate: isoNow, expiryDate: null, createdAt: timestamp
            });
        });

        SAMPLE_SUB_SERVICES.forEach((ss, idx) => {
            const calculatedCode = String(offsetSub + (idx + 1)).padStart(3, "0");
            const contextSrvParent = serviceMap[ss.serviceCode] || ss.serviceCode;
            batch.set(doc(db, "subServices", `${ownerId}_SUB_${calculatedCode}`), {
                ownerUserNo: ownerId, subServiceCode: calculatedCode, subServiceName: ss.subServiceName, serviceCode: contextSrvParent,
                rate: Number(ss.rate), durationMinutes: Number(ss.durationMinutes), active: true, createdBy: activeSessionUser.role,
                startDate: isoNow, expiryDate: null, createdAt: timestamp
            });
        });

        await batch.commit();
        alert("Autopopulate tracking arrays successfully appended inside multi-tenant datastores.");
        refreshAllAdministrativeTables();
    } catch(err) {
        reportRuntimeCrash(activeSessionUser.name, activeSessionUser, err);
    }
}

// =========================================================================
// Real-Time Analytics Monitoring Subsystem
// =========================================================================
function bindRealtimeAnalyticsStream() {
    const ownerId = activeSessionUser.ownerUserNo;
    const qPacks = query(collection(db, "customerServicePacks"), where("ownerUserNo", "==", ownerId));

    realtimePacksUnsubscribe = onSnapshot(qPacks, async (snapshot) => {
        try {
            const packsArray = [];
            snapshot.forEach(d => packsArray.push(d.data()));

            document.getElementById("stat-active-packs").innerText = packsArray.filter(p => p.active).length;

            const tExp = document.getElementById("tbl-dash-expiries");
            tExp.innerHTML = "";
            
            const today = new Date();
            const limitWindow = new Date();
            limitWindow.setDate(today.getDate() + 10);

            const urgentExpiries = packsArray.filter(p => {
                if(!p.expiryDate) return false;
                const d = new Date(p.expiryDate);
                return d >= today && d <= limitWindow;
            });

            if(urgentExpiries.length === 0) {
                tExp.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-2">No pending package expirations found within the 10-day timeline.</td></tr>`;
            } else {
                urgentExpiries.forEach(p => {
                    const row = document.createElement("tr");
                    row.innerHTML = `<td><strong>${p.customerNo}</strong></td><td>${p.packName}</td><td class="clickable-phone" onclick="navigator.clipboard.writeText('9810001234')">Copy Contact</td><td><span class="badge bg-danger">${p.expiryDate}</span></td>`;
                    tExp.appendChild(row);
                });
            }
        } catch(err) {
            reportRuntimeCrash(activeSessionUser.name, activeSessionUser, err);
        }
    });
}

// =========================================================================
// Data Entry ADM Form Submission Pipelines
// =========================================================================
async function processCategoryADMFormSubmission(e) {
    e.preventDefault();
    const name = document.getElementById("cat-name").value.trim();
    const desc = document.getElementById("cat-desc").value.trim();
    const activeFlag = document.getElementById("cat-active").checked;
    
    try {
        const nextCode = String(await getHighestFieldOffset("serviceCategories", "catCode") + 1).padStart(2, "0");
        await setDoc(doc(db, "serviceCategories", `${activeSessionUser.ownerUserNo}_CAT_${nextCode}`), {
            ownerUserNo: activeSessionUser.ownerUserNo, catCode: nextCode, catName: name, catDescription: desc,
            active: activeFlag, createdBy: activeSessionUser.role, startDate: new Date().toISOString().split("T")[0],
            expiryDate: null, createdAt: new Date().toISOString()
        });
        document.getElementById("frm-adm-category").reset();
        refreshAllAdministrativeTables();
    } catch(err) { reportRuntimeCrash(activeSessionUser.name, activeSessionUser, err); }
}

async function processServiceADMFormSubmission(e) {
    e.preventDefault();
    const parentCat = document.getElementById("srv-parent-cat").value;
    const name = document.getElementById("srv-name").value.trim();
    const desc = document.getElementById("srv-desc").value.trim();
    const activeFlag = document.getElementById("srv-active").checked;

    try {
        const nextCode = String(await getHighestFieldOffset("services", "serviceCode") + 1).padStart(2, "0");
        await setDoc(doc(db, "services", `${activeSessionUser.ownerUserNo}_SRV_${nextCode}`), {
            ownerUserNo: activeSessionUser.ownerUserNo, serviceCode: nextCode, serviceName: name, serviceDescription: desc,
            catCode: parentCat, active: activeFlag, createdBy: activeSessionUser.role, startDate: new Date().toISOString().split("T")[0],
            expiryDate: null, createdAt: new Date().toISOString()
        });
        document.getElementById("frm-adm-service").reset();
        refreshAllAdministrativeTables();
    } catch(err) { reportRuntimeCrash(activeSessionUser.name, activeSessionUser, err); }
}

async function processSubServiceADMFormSubmission(e) {
    e.preventDefault();
    const parentSrv = document.getElementById("sub-parent-srv").value;
    const name = document.getElementById("sub-name").value.trim();
    const rate = document.getElementById("sub-rate").value;
    const duration = document.getElementById("sub-duration").value;
    const activeFlag = document.getElementById("sub-active").checked;

    try {
        const nextCode = String(await getHighestFieldOffset("subServices", "subServiceCode") + 1).padStart(3, "0");
        await setDoc(doc(db, "subServices", `${activeSessionUser.ownerUserNo}_SUB_${nextCode}`), {
            ownerUserNo: activeSessionUser.ownerUserNo, subServiceCode: nextCode, subServiceName: name, serviceCode: parentSrv,
            rate: Number(rate), durationMinutes: Number(duration), active: activeFlag, createdBy: activeSessionUser.role,
            startDate: new Date().toISOString().split("T")[0], expiryDate: null, createdAt: new Date().toISOString()
        });
        document.getElementById("frm-adm-subservice").reset();
        refreshAllAdministrativeTables();
    } catch(err) { reportRuntimeCrash(activeSessionUser.name, activeSessionUser, err); }
}

async function processCommonPackADMFormSubmission(e) {
    e.preventDefault();
    const nameId = document.getElementById("pack-name-id").value.trim();
    const type = document.getElementById("pack-type-select").value;
    const price = document.getElementById("pack-price").value;
    const totalAmt = document.getElementById("pack-total-amt").value;
    const activeFlag = document.getElementById("pack-active").checked;

    try {
        const docId = `${activeSessionUser.ownerUserNo}_CPACK_${nameId.replace(/\s+/g, "_")}`;
        await setDoc(doc(db, "commonServicePacks", docId), {
            ownerUserNo: activeSessionUser.ownerUserNo, packName: nameId, packType: type, offerPrice: Number(price),
            totalAmount: Number(totalAmt), active: activeFlag, createdAt: new Date().toISOString()
        });
        document.getElementById("frm-adm-commonpack").reset();
        document.getElementById("preview-pack-img").style.display = "none";
        refreshAllAdministrativeTables();
    } catch(err) { reportRuntimeCrash(activeSessionUser.name, activeSessionUser, err); }
}

async function processUserADMFormSubmission(e) {
    e.preventDefault();
    const role = document.getElementById("usr-role").value;
    const name = document.getElementById("usr-fullname").value.trim();
    const sex = document.getElementById("usr-sex").value;
    const age = document.getElementById("usr-age").value;
    const email = document.getElementById("usr-email").value.trim().toLowerCase();
    const pass = document.getElementById("usr-password").value;
    const phone = document.getElementById("usr-phone").value.trim();
    const dist = document.getElementById("usr-distance").value;
    const addr = document.getElementById("usr-address").value.trim();
    const maps = document.getElementById("usr-mapurl").value.trim();
    const activeFlag = document.getElementById("usr-active").checked;

    try {
        let runningSerial = String(Math.floor(1000 + Math.random() * 9000));
        await setDoc(doc(db, "users", `${activeSessionUser.ownerUserNo}_USR_${runningSerial}`), {
            ownerUserNo: activeSessionUser.ownerUserNo, userNo: runningSerial, role: role, name: name, sex: sex,
            ageGroup: age, email: email, password: pass, phone: phone, distance: dist, address: addr,
            googleMapLink: maps, active: activeFlag, startDate: new Date().toISOString().split("T")[0], createdAt: new Date().toISOString()
        });
        document.getElementById("frm-adm-user-profile").reset();
        refreshAllAdministrativeTables();
    } catch(err) { reportRuntimeCrash(activeSessionUser.name, activeSessionUser, err); }
}

async function processAllotmentFormSubmission(e) {
    e.preventDefault();
    const cust = document.getElementById("allot-customer-select").value;
    const templatePack = document.getElementById("allot-pack-select").value;
    const start = document.getElementById("allot-start-date").value;
    const expiry = document.getElementById("allot-expiry-date").value;

    if (expiry && new Date(start) > new Date(expiry)) return alert("Date Conflict: Activation must precede expiration boundary.");

    try {
        const uniqueAllotId = "APACK-" + Math.floor(10000 + Math.random() * 90000);
        await setDoc(doc(db, "customerServicePacks", `${activeSessionUser.ownerUserNo}_ALLOT_${uniqueAllotId}`), {
            ownerUserNo: activeSessionUser.ownerUserNo, customerNo: cust, packName: templatePack,
            startDate: start, expiryDate: expiry || null, active: true, createdAt: new Date().toISOString()
        });
        alert("Package template instance allotted safely.");
        document.getElementById("frm-allot-membership").reset();
    } catch(err) { reportRuntimeCrash(activeSessionUser.name, activeSessionUser, err); }
}

// =========================================================================
// Data Presentation Layout Engine Grid Builders
// =========================================================================
async function refreshAllAdministrativeTables() {
    if(!activeSessionUser) return;
    const ownerId = activeSessionUser.ownerUserNo;

    const renderTable = async (colName, elementId, rowBuilder) => {
        const q = query(collection(db, colName), where("ownerUserNo", "==", ownerId));
        const snap = await getDocs(q);
        const tbody = document.getElementById(elementId);
        if(tbody) {
            tbody.innerHTML = "";
            snap.forEach(d => tbody.appendChild(rowBuilder(d.data(), d.id)));
        }
    };

    renderTable("serviceCategories", "tbl-adm-categories", (data) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${data.catCode}</td><td>${data.catName}</td><td>${data.catDescription}</td><td>${data.active}</td><td>-</td>`;
        return tr;
    });

    renderTable("services", "tbl-adm-services", (data) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${data.serviceCode}</td><td>Cat Ref: ${data.catCode}</td><td>${data.serviceName}</td><td>${data.active}</td><td>-</td>`;
        return tr;
    });

    renderTable("subServices", "tbl-adm-subservices", (data) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${data.subServiceCode}</td><td>Srv Ref: ${data.serviceCode}</td><td>${data.subServiceName}</td><td>$${data.rate}</td><td>${data.durationMinutes} mins</td><td>${data.active}</td><td>-</td>`;
        return tr;
    });

    renderTable("commonServicePacks", "tbl-adm-commonpacks", (data) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${data.packName}</td><td>${data.packType}</td><td>$${data.offerPrice}</td><td>$${data.totalAmount}</td><td>None</td><td>${data.active}</td><td>-</td>`;
        return tr;
    });

    renderTable("users", "tbl-adm-users", (data) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${data.userNo}</td><td><span class="badge bg-secondary">${data.role}</span></td><td>${data.name}</td><td>${data.email}</td><td>${data.active}</td><td>-</td>`;
        return tr;
    });
}

async function loadWorkspaceDropdownMappings() {
    const ownerId = activeSessionUser.ownerUserNo;

    const populateSelect = async (colName, elementId, valKey, txtKey) => {
        const q = query(collection(db, colName), where("ownerUserNo", "==", ownerId));
        const snap = await getDocs(q);
        const el = document.getElementById(elementId);
        if(el) {
            el.innerHTML = `<option value="">Select Target Link...</option>`;
            snap.forEach(d => {
                const data = d.data();
                el.innerHTML += `<option value="${data[valKey]}">${data[txtKey]}</option>`;
            });
        }
    };

    await populateSelect("serviceCategories", "srv-parent-cat", "catCode", "catName");
    await populateSelect("services", "sub-parent-srv", "serviceCode", "serviceName");
    await populateSelect("users", "allot-customer-select", "userNo", "name");
    await populateSelect("commonServicePacks", "allot-pack-select", "packName", "packName");
}

function setupMediaPreviewListener(inputId, imgId) {
    const fileEl = document.getElementById(inputId);
    const imgEl = document.getElementById(imgId);
    if (!fileEl || !imgEl) return;

    fileEl.addEventListener("change", function() {
        const assetFile = this.files[0];
        if (assetFile) {
            const reader = new FileReader();
            reader.onload = (e) => {
                imgEl.src = e.target.result;
                imgEl.style.display = "block";
            };
            reader.readAsDataURL(assetFile);
        }
    });
}
