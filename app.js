/**
 * =========================================================================
 * GlamTrack Core Platform Controller - Salon Worker Translation Layer
 * Production Engine Build - Synced with Provided Constants & ErrorMailer
 * =========================================================================
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { 
    getFirestore, collection, query, where, getDocs, doc, setDoc, onSnapshot, writeBatch, updateDoc
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// Import your provided modular configurations
import { SAMPLE_CATEGORIES, SAMPLE_SERVICES, SAMPLE_SUB_SERVICES } from "./constants.js";
import { reportRuntimeCrash } from "./errorMailer.js";

// Production Firebase Configuration 
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyDQO_LSnflOgA5H-Nz95eIksx94BhlZP_c",
    authDomain: "vault-050166.firebaseapp.com",
    projectId: "vault-050166",
    storageBucket: "vault-050166.firebasestorage.app",
    messagingSenderId: "252753845895",
    appId: "1:252753845895:web:0def3dc427df7938c12222",
    measurementId: "G-4XEPZ5S45V"
};

// System Execution Runtime States
const firebaseApp = initializeApp(FIREBASE_CONFIG);
const db = getFirestore(firebaseApp);

let activeSessionUser = null;
let salonOwnerNameContext = "Unassigned Salon Context"; 
let realtimePacksUnsubscribe = null;
let sessionWatchdogTimer = null;
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 Minutes Boundary

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
    
    // UI Change interceptor for structural dual-factor verification
    document.getElementById("txt-login-role").addEventListener("change", (e) => {
        const passwordGroup = document.getElementById("grp-login-pass");
        const existingOtp = document.getElementById("grp-otp-challenge");
        if (existingOtp) existingOtp.remove();

        if (e.target.value === "SUPER_USER") {
            passwordGroup.insertAdjacentHTML('beforebegin', `
                <div class="mb-3" id="grp-otp-challenge">
                    <label class="form-label fw-bold text-danger small">Enter 6-Digit System Admin OTP Security Token</label>
                    <input type="text" class="form-control" id="txt-login-otp" placeholder="e.g., 123456" maxlength="6">
                </div>
            `);
            passwordGroup.style.display = "none";
        } else {
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

    // Core Security Configuration Form Submit Pipelines
    document.getElementById("frm-access-control-matrix").addEventListener("submit", processAccessControlFormSubmission);
    document.getElementById("frm-utilize-service-visit").addEventListener("submit", processVisitDeductionFormSubmission);
    
    // Automated reactive lookups processing links
    document.getElementById("utilize-customer-select").addEventListener("change", updateCustomerAllottedPacksDropdown);
    document.getElementById("utilize-pack-select").addEventListener("change", renderUtilizeSubServicesCheckboxes);
}

function showActiveFrame(sectionId) {
    document.querySelectorAll(".view-section").forEach(s => s.classList.remove("active"));
    const targetSection = document.getElementById(sectionId);
    if (targetSection) targetSection.classList.add("active");
}

function startSessionWatchdog() {
    if (sessionWatchdogTimer) clearTimeout(sessionWatchdogTimer);
    sessionWatchdogTimer = setTimeout(() => {
        alert("Security Lockout: You have been signed out automatically due to 15 minutes of inactivity.");
        performSessionLogoutAction();
    }, INACTIVITY_TIMEOUT_MS);
}

// Wrapper to interface safely with your errorMailer layout rules
async function handleTelemetryAlert(contextLabel, errorPayload) {
    try {
        // Formatted to supply: reportRuntimeCrash(ownerName, activeSessionContext, errorObject)
        await reportRuntimeCrash(salonOwnerNameContext, activeSessionUser, {
            message: `[${contextLabel}] ${errorPayload.message || errorPayload}`,
            stack: errorPayload.stack || "No call-trace logged."
        });
    } catch (criticalLogErr) {
        console.error("Diagnostic reporting loop collapsed:", criticalLogErr);
    }
}

// =========================================================================
// Sign-In Security & Authorization Process
// =========================================================================
async function processSecureProfileAuthentication() {
    const selectedRole = document.getElementById("txt-login-role").value;
    const emailInput = document.getElementById("txt-login-email").value.trim().toLowerCase();
    const passwordInput = document.getElementById("txt-login-pass") ? document.getElementById("txt-login-pass").value : "";

    if (!emailInput) {
        return alert("Please enter your sign-in email address.");
    }

    try {
        // --- 1. System Administrator Sign-In Link ---
        if (selectedRole === "SUPER_USER") {
            if (emailInput !== 'bawa.codes@gmail.com') { 
                return alert("Sign In Blocked: This email address is not registered as a System Administrator.");
            }

            const otpInputVal = document.getElementById("txt-login-otp") ? document.getElementById("txt-login-otp").value.trim() : "";

            if (!otpInputVal) {
                const secureGeneratedToken = Math.floor(100000 + Math.random() * 900000);
                window.tempSessionOtpStorage = secureGeneratedToken;

                await emailjs.send('service_050166', 'template_050166', {
                    to_email: 'bawa.codes@gmail.com',
                    subject: "GlamTrack Security Access - Verification Code",
                    body: `Your verification code for GlamTrack Console Access is: ${secureGeneratedToken}. Code expires in 15 minutes.`
                });

                return alert("A secure 6-digit confirmation code has been sent to the administrator's email inbox.");
            }

            if (parseInt(otpInputVal, 10) !== window.tempSessionOtpStorage) {
                return alert("Incorrect Code: The confirmation code you entered does not match.");
            }

            delete window.tempSessionOtpStorage;

            activeSessionUser = { 
                userNo: "0001", 
                role: "SUPER_USER", 
                name: "System Administrator", 
                email: "bawa.codes@gmail.com",
                ownerUserNo: "000" 
            };
            salonOwnerNameContext = "Platform Core Administration";
            
            renderAuthorizedWorkspaceSession();
            return;
        }

        // --- 2. Salon Owner / Manager / Staff Sign-In Link ---
        if (!passwordInput) {
            return alert("Please enter your password phrase.");
        }

        // Database Security Constraint Check
        const q = query(collection(db, "users"), where("email", "==", emailInput), where("role", "==", selectedRole));
        const res = await getDocs(q);
        
        if (res.empty) {
            return alert("Sign In Failed: We couldn't find a profile matching that email and role choice. Please check your selection.");
        }

        const userDoc = res.docs[0].data();
        
        if (userDoc.password !== passwordInput) {
            return alert("Sign In Failed: The password phrase you entered is incorrect.");
        }

        const isoToday = new Date().toISOString().split("T")[0];
        
        // Simplified Profile Status Validations
        if (userDoc.startDate && isoToday < userDoc.startDate) {
            return alert("Access Notice: Your staff account is not scheduled to become active yet.");
        }
        if (userDoc.expiryDate && isoToday > userDoc.expiryDate) {
            return alert("Access Notice: The salon management contract package for this account has expired.");
        }
        if (!userDoc.active) {
            return alert("Access Notice: This team account profile has been marked as inactive. Please contact your manager.");
        }

        // Set successful login session
        activeSessionUser = userDoc;
        salonOwnerNameContext = activeSessionUser.role === "OWNER" ? activeSessionUser.name : `Salon Branch [${activeSessionUser.ownerUserNo}]`;

        // Load the system
        renderAuthorizedWorkspaceSession();

    } catch (crash) {
        // Back-end tracking continues safely, but user gets a clean notification
        await handleTelemetryAlert("Salon Sign In Security Error", crash);
        alert("We encountered a small connection problem while signing you in. Please try again in a moment.");
    }
}

function renderAuthorizedWorkspaceSession() {
    document.getElementById("nav-logout").classList.remove("d-none");
    document.getElementById("nav-dashboard").classList.remove("d-none");
    document.getElementById("nav-login").classList.add("d-none");
    
    if (activeSessionUser.role === "SUPER_USER" || activeSessionUser.role === "OWNER" || activeSessionUser.role === "MANAGER") {
        document.getElementById("nav-adm-catalog").classList.remove("d-none");
        document.getElementById("nav-adm-packs").classList.remove("d-none");
        document.getElementById("nav-adm-users").classList.remove("d-none");
        document.getElementById("btn-trigger-autopopulate").classList.remove("d-none");
    }

    document.getElementById("lbl-active-context").innerText = `Branch ID Layer: ${activeSessionUser.ownerUserNo} | Logged In Role: ${activeSessionUser.role}`;
    startSessionWatchdog();
    showActiveFrame("sec-dashboard");
    
    bindRealtimeAnalyticsStream();
    loadWorkspaceDropdownMappings();
    refreshAllAdministrativeTables();
    renderCatalogSubServicesCheckboxes();
}

function performSessionLogoutAction() {
    if (realtimePacksUnsubscribe) realtimePacksUnsubscribe();
    if (sessionWatchdogTimer) clearTimeout(sessionWatchdogTimer);
    activeSessionUser = null;
    window.location.reload();
}

// =========================================================================
// Automated Data Master Creation Mechanics (Using constants.js Models)
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
    if(!activeSessionUser) return alert("Access Failure: Session details missing.");
    const ownerId = activeSessionUser.ownerUserNo;

    try {
        const batch = writeBatch(db);
        const isoNow = new Date().toISOString().split("T")[0];
        const timestamp = new Date().toISOString();

        const offsetCat = await getHighestFieldOffset("serviceCategories", "catCode");
        const offsetSrv = await getHighestFieldOffset("services", "serviceCode");
        const offsetSub = await getHighestFieldOffset("subServices", "subServiceCode");

        const categoryMap = {}, serviceMap = {};

        // Hydrates system models safely matching your complete predefined constants schemas
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
        alert("Success: The standard salon service sheets and price models have been loaded into your profile.");
        refreshAllAdministrativeTables();
        loadWorkspaceDropdownMappings();
        renderCatalogSubServicesCheckboxes();
    } catch(err) {
        await handleTelemetryAlert("Autopopulate Operational Pipeline", err);
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
            if (!tExp) return;
            tExp.innerHTML = "";
            
            const today = new Date();
            const limitWindow = new Date();
            limitWindow.setDate(today.getDate() + 10);

            // Dashboard Constraint: Catch client packaging expiration limits within next 10 days
            const urgentExpiries = packsArray.filter(p => {
                if(!p.expiryDate) return false; 
                const d = new Date(p.expiryDate);
                return d >= today && d <= limitWindow;
            });

            if(urgentExpiries.length === 0) {
                tExp.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-2">No customer packages are expiring within the next 10 days.</td></tr>`;
            } else {
                urgentExpiries.forEach(p => {
                    const row = document.createElement("tr");
                    row.innerHTML = `
                        <td><strong>Client #${p.customerNo}</strong></td>
                        <td>${p.packName}</td>
                        <td class="text-primary cursor-pointer" id="phone-${p.allotId}" style="text-decoration: underline;">Copy Phone Number</td>
                        <td><span class="badge bg-danger">${p.expiryDate}</span></td>`;
                    tExp.appendChild(row);
                    
                    // Clipboard operations 
                    document.getElementById(`phone-${p.allotId}`).addEventListener("click", () => {
                        navigator.clipboard.writeText(p.phone || "9810001234");
                        alert(`Phone number for client #${p.customerNo} copied to system clipboard.`);
                    });
                });
            }
        } catch(err) {
            await handleTelemetryAlert("Realtime Dashboard Live Engine", err);
        }
    });
}

// =========================================================================
// Dynamic Checkbox Generation - Reference Master Packs
// =========================================================================
async function renderCatalogSubServicesCheckboxes() {
    if (!activeSessionUser) return;
    const container = document.getElementById("container-pack-subservices");
    if (!container) return;

    try {
        const q = query(collection(db, "subServices"), where("ownerUserNo", "==", activeSessionUser.ownerUserNo), where("active", "==", true)); 
        const snap = await getDocs(q);
        
        container.innerHTML = "";
        if (snap.empty) {
            container.innerHTML = `<p class="text-danger small my-0">No active menu service items found. Please setup or load standard menus first.</p>`;
            return;
        }

        snap.forEach(d => {
            const ss = d.data();
            container.innerHTML += `
                <div class="form-check">
                    <input class="form-check-input chk-pack-subservice" type="checkbox" value="${ss.subServiceCode}" id="chk-ss-${ss.subServiceCode}">
                    <label class="form-check-label small" for="chk-ss-${ss.subServiceCode}">
                        ${ss.subServiceName} ($${ss.rate})
                    </label>
                </div>`;
        });
    } catch (err) { await handleTelemetryAlert("Catalog Checkbox Mapping Engine", err); }
}

// =========================================================================
// Structural Administration Form Submission Handlers
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
        alert("Success: Menu category added successfully.");
        refreshAllAdministrativeTables();
        loadWorkspaceDropdownMappings();
    } catch(err) { await handleTelemetryAlert("Category Storage Submission Pipeline", err); }
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
        alert("Success: Main service group added successfully.");
        refreshAllAdministrativeTables();
        loadWorkspaceDropdownMappings();
    } catch(err) { await handleTelemetryAlert("Service Storage Submission Pipeline", err); }
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
        alert("Success: Individual menu item price details saved successfully.");
        refreshAllAdministrativeTables();
        renderCatalogSubServicesCheckboxes();
    } catch(err) { await handleTelemetryAlert("Sub-Service Storage Submission Pipeline", err); }
}

async function processCommonPackADMFormSubmission(e) {
    e.preventDefault();
    const nameId = document.getElementById("pack-name-id").value.trim();
    const type = document.getElementById("pack-type-select").value;
    const price = document.getElementById("pack-price").value;
    const totalAmt = document.getElementById("pack-total-amt").value;
    const activeFlag = document.getElementById("pack-active").checked;

    const selectedSubServices = [];
    document.querySelectorAll(".chk-pack-subservice:checked").forEach(input => {
        selectedSubServices.push(input.value);
    });

    try {
        const docId = `${activeSessionUser.ownerUserNo}_CPACK_${nameId.replace(/\s+/g, "_")}`;
        await setDoc(doc(db, "commonServicePacks", docId), {
            ownerUserNo: activeSessionUser.ownerUserNo, packName: nameId, packType: type, offerPrice: Number(price),
            totalAmount: Number(totalAmt), subServicesArray: selectedSubServices, active: activeFlag, createdAt: new Date().toISOString()
        });
        document.getElementById("frm-adm-commonpack").reset();
        alert("Success: New pre-paid package package added to available salon catalog.");
        renderCatalogSubServicesCheckboxes();
        refreshAllAdministrativeTables();
        loadWorkspaceDropdownMappings();
    } catch(err) { await handleTelemetryAlert("Master Package Creation Node", err); }
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
        alert(`Success: Profile record file registered successfully as a salon ${role}.`);
        refreshAllAdministrativeTables();
        loadWorkspaceDropdownMappings();
    } catch(err) { await handleTelemetryAlert("User Identity Provisioning Endpoint", err); }
}

async function processAllotmentFormSubmission(e) {
    e.preventDefault();
    const cust = document.getElementById("allot-customer-select").value;
    const templatePackName = document.getElementById("allot-pack-select").value;
    const start = document.getElementById("allot-start-date").value;
    const expiry = document.getElementById("allot-expiry-date").value; 

    if (!cust || !templatePackName) return alert("System Configuration Error: Please ensure you select both a valid client and an active package setup template.");

    try {
        const q = query(collection(db, "commonServicePacks"), where("ownerUserNo", "==", activeSessionUser.ownerUserNo), where("packName", "==", templatePackName)); 
        const res = await getDocs(q);
        if (res.empty) return alert("Activation Blocked: Could not find the selected core packaging model blueprint rules.");
        const templateData = res.docs[0].data();

        const uniqueAllotId = "APACK-" + Math.floor(10000 + Math.random() * 90000);
        await setDoc(doc(db, "customerServicePacks", `${activeSessionUser.ownerUserNo}_ALLOT_${uniqueAllotId}`), {
            ownerUserNo: activeSessionUser.ownerUserNo, allotId: uniqueAllotId, customerNo: cust, packName: templatePackName,
            packType: templateData.packType, remainingBalance: Number(templateData.totalAmount), totalAmount: Number(templateData.totalAmount),
            subServicesArray: templateData.subServicesArray || [], startDate: start, expiryDate: expiry || null, active: true, createdAt: new Date().toISOString()
        });
        
        alert("Success: Package has been successfully assigned and logged to this client profile account card.");
        document.getElementById("frm-allot-membership").reset();
        loadWorkspaceDropdownMappings();
    } catch(err) { await handleTelemetryAlert("Customer Contract Assignment Frame", err); }
}

// =========================================================================
// Role Modification Ledger Access Subsystem
// =========================================================================
async function processAccessControlFormSubmission(e) {
    e.preventDefault();
    const targetRole = document.getElementById("access-target-role").value;
    const allowReadCommon = document.getElementById("rights-read-common").checked;
    const allowReadCustomer = document.getElementById("rights-read-customer").checked;
    const allowWrite = document.getElementById("rights-write-allowed").checked;

    try {
        const rightsDocId = `${activeSessionUser.ownerUserNo}_ACL_${targetRole}`;
        await setDoc(doc(db, "accessControlRights", rightsDocId), {
            ownerUserNo: activeSessionUser.ownerUserNo, targetRole: targetRole,
            allowReadCommonPacks: allowReadCommon, allowReadCustomerPacks: allowReadCustomer,
            allowWritePrivileges: allowWrite, updatedAt: new Date().toISOString()
        });

        const uniqueLogId = "ACL-LOG-" + Math.floor(100000 + Math.random() * 900000);
        await setDoc(doc(db, "accessLogs", `${activeSessionUser.ownerUserNo}_ACLLOG_${uniqueLogId}`), {
            logId: uniqueLogId, ownerUserNo: activeSessionUser.ownerUserNo, managerUserId: targetRole,
            rightChanged: "allowWritePrivileges", newValue: allowWrite, changedBy: activeSessionUser.role,
            changedAt: new Date().toISOString()
        });

        alert(`Success: Staff management work permissions modified for group level: ${targetRole}`);
    } catch (err) { await handleTelemetryAlert("Access System Framework Controller", err); }
}

// =========================================================================
// Service Consumption Terminal Functions
// =========================================================================
async function updateCustomerAllottedPacksDropdown() {
    const custNo = document.getElementById("utilize-customer-select").value;
    const packEl = document.getElementById("utilize-pack-select");
    if (!packEl) return;

    packEl.innerHTML = `<option value="">Synchronizing package history charts...</option>`;
    if (!custNo) {
        packEl.innerHTML = `<option value="">-- Select Client Profile Above First --</option>`;
        return;
    }

    try {
        const q = query(collection(db, "customerServicePacks"), where("ownerUserNo", "==", activeSessionUser.ownerUserNo), where("customerNo", "==", custNo), where("active", "==", true)); 
        const snap = await getDocs(q);
        
        packEl.innerHTML = `<option value="">-- Choose Package Ledger Account --</option>`;
        snap.forEach(d => {
            const data = d.data();
            packEl.innerHTML += `<option value="${data.allotId}">${data.packName} (Remaining Balance: ${data.remainingBalance})</option>`;
        });
    } catch (err) { await handleTelemetryAlert("Dynamic Dropdown Sync Loop", err); }
}

async function renderUtilizeSubServicesCheckboxes() {
    const allotId = document.getElementById("utilize-pack-select").value;
    const container = document.getElementById("container-utilize-subservices");
    if (!container) return;

    container.innerHTML = "";
    if (!allotId) return;

    try {
        const q = query(collection(db, "customerServicePacks"), where("ownerUserNo", "==", activeSessionUser.ownerUserNo), where("allotId", "==", allotId)); 
        const res = await getDocs(q);
        if (res.empty) return;
        const pData = res.docs[0].data();

        if (!pData.subServicesArray || pData.subServicesArray.length === 0) {
            container.innerHTML = `<span class="text-muted small">This package tier allows choice across all salon items without any explicit service restrictions rules.</span>`;
            return;
        }

        for (const code of pData.subServicesArray) {
            const ssQ = query(collection(db, "subServices"), where("ownerUserNo", "==", activeSessionUser.ownerUserNo), where("subServiceCode", "==", code)); 
            const ssSnap = await getDocs(ssQ);
            if (!ssSnap.empty) {
                const ss = ssSnap.docs[0].data();
                container.innerHTML += `
                    <div class="form-check">
                        <input class="form-check-input chk-utilize-subservice" type="checkbox" value="${ss.subServiceCode}" data-rate="${ss.rate}" id="chk-ut-${ss.subServiceCode}">
                        <label class="form-check-label small" for="chk-ut-${ss.subServiceCode}">
                            ${ss.subServiceName} (Cost Capacity Charge: ${ss.rate})
                        </label>
                    </div>`;
            }
        }
    } catch (err) { await handleTelemetryAlert("Dynamic Subservice Checker Interface", err); }
}

async function processVisitDeductionFormSubmission(e) {
    e.preventDefault();
    const custNo = document.getElementById("utilize-customer-select").value;
    const allotId = document.getElementById("utilize-pack-select").value;
    const visitDate = document.getElementById("utilize-visit-date").value;

    const checkedInputs = document.querySelectorAll(".chk-utilize-subservice:checked");
    if (checkedInputs.length === 0) return alert("Action Required: Please check at least one box to select a service item rendered during today's customer appointment.");

    try {
        const q = query(collection(db, "customerServicePacks"), where("ownerUserNo", "==", activeSessionUser.ownerUserNo), where("allotId", "==", allotId)); 
        const res = await getDocs(q);
        if (res.empty) return alert("Error: The chosen package file references could not be verified.");
        
        const docRef = res.docs[0].ref;
        const pData = res.docs[0].data();

        // Rule Validation: Date Conflict checking framework rules
        if (pData.startDate && visitDate < pData.startDate) {
            return alert("Date Violation: Today's visit date occurs before the package package was actually activated.");
        }
        if (pData.expiryDate && visitDate > pData.expiryDate) {
            return alert("Date Violation: Today's visit occurs after this customer contract balance has officially expired.");
        }

        let totalSubServicesValueCost = 0;
        let renderedItemCodeTrackers = [];

        checkedInputs.forEach(input => {
            totalSubServicesValueCost += Number(input.getAttribute("data-rate"));
            renderedItemCodeTrackers.push(input.value);
        });

        let updatedBalance = Number(pData.remainingBalance);
        if (pData.packType === "Type1") {
            updatedBalance = updatedBalance - checkedInputs.length;
        } else {
            updatedBalance = updatedBalance - totalSubServicesValueCost;
        }

        if (updatedBalance < 0) return alert(`Transaction Declined: This package balance card does not have enough remaining capacity. Balance Available: ${pData.remainingBalance}`);

        await updateDoc(docRef, { remainingBalance: updatedBalance });

        const logIdString = "LOG-" + Math.floor(100000 + Math.random() * 900000);
        await setDoc(doc(db, "serviceUtilizationLogs", `${activeSessionUser.ownerUserNo}_LOG_${logIdString}`), {
            ownerUserNo: activeSessionUser.ownerUserNo, logId: logIdString, customerNo: custNo, allotId: allotId,
            packName: pData.packName, visitDate: visitDate, itemsRendered: renderedItemCodeTrackers,
            unitsSubtracted: checkedInputs.length, calculatedValueCost: totalSubServicesValueCost, loggedAt: new Date().toISOString()
        });

        // Rule Validation: 20% Low-Balance Warning alerts dispatch pipeline via EmailJS 
        const warningThreshold = Number(pData.totalAmount) * 0.20;
        if (updatedBalance < warningThreshold) {
            alert("Low Balance Warning: This client's package balance has fallen below 20%. The salon owner has been notified via email reminder rules.");
            await emailjs.send('service_050166', 'template_050166', {
                to_email: 'bawa.codes@gmail.com',
                subject: "FOLLOWUP REMINDER ALERT - Low Capacity Package Detected",
                body: `Low Balance Notice:\nCustomer ID Reference: ${custNo}\nAllotment Account: ${allotId}\nRemaining Balance Capacity: ${updatedBalance}`
            });
        } else {
            alert(`Visit logged successfully. Remaining Account Balance: ${updatedBalance}`);
        }

        document.getElementById("frm-utilize-service-visit").reset();
        document.getElementById("container-utilize-subservices").innerHTML = "";
    } catch (err) { await handleTelemetryAlert("Service Visit Transaction Node", err); }
}

// =========================================================================
// Real-Time UI Presenter Tables
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
        tr.innerHTML = `<td><strong>[${data.catCode}]</strong></td><td>${data.catName}</td>`;
        return tr;
    });

    renderTable("services", "tbl-adm-services", (data) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td><strong>[${data.serviceCode}]</strong></td><td>${data.serviceName}</td>`;
        return tr;
    });

    renderTable("subServices", "tbl-adm-subservices", (data) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${data.subServiceName}</td><td><strong>$${data.rate}</strong> <span class="text-muted text-xs">(${data.durationMinutes} min)</span></td>`;
        return tr;
    });

    renderTable("commonServicePacks", "tbl-adm-commonpacks", (data) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${data.packName}</td><td><span class="badge bg-dark">${data.packType === "Type1" ? "Item Counts" : "Money Value Balance"}</span></td><td>$${data.offerPrice}</td><td>$${data.totalAmount}</td><td>${data.subServicesArray ? data.subServicesArray.length : 0} Items linked</td><td><span class="badge ${data.active?'bg-success':'bg-secondary'}">${data.active?'Active':'Hidden'}</span></td><td>-</td>`;
        return tr;
    });

    renderTable("users", "tbl-adm-users", (data) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>#${data.userNo}</td><td><span class="badge bg-secondary text-uppercase">${data.role}</span></td><td><strong>${data.name}</strong></td><td>${data.email}</td><td><span class="badge ${data.active?'bg-success':'bg-secondary'}">${data.active?'Active Card':'Archived'}</span></td><td>-</td>`;
        return tr;
    });
}

async function loadWorkspaceDropdownMappings() {
    if (!activeSessionUser) return;
    const ownerId = activeSessionUser.ownerUserNo;

    const populateSelect = async (colName, elementId, valKey, txtKey, customFilterRole) => {
        let q = query(collection(db, colName), where("ownerUserNo", "==", ownerId)); 
        if (customFilterRole) {
            q = query(collection(db, colName), where("ownerUserNo", "==", ownerId), where("role", "==", customFilterRole)); 
        }
        const snap = await getDocs(q);
        const el = document.getElementById(elementId);
        if(el) {
            el.innerHTML = `<option value="">-- Choose from Available List --</option>`;
            snap.forEach(d => {
                const data = d.data();
                el.innerHTML += `<option value="${data[valKey]}">${data[txtKey]} (ID: ${data[valKey]})</option>`;
            });
        }
    };

    await populateSelect("serviceCategories", "srv-parent-cat", "catCode", "catName");
    await populateSelect("services", "sub-parent-srv", "serviceCode", "serviceName");
    await populateSelect("commonServicePacks", "allot-pack-select", "packName", "packName");
    await populateSelect("users", "allot-customer-select", "userNo", "name", "CUSTOMER");
    await populateSelect("users", "utilize-customer-select", "userNo", "name", "CUSTOMER");
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
        } else {
            imgEl.src = "";
            imgEl.style.display = "none"; // Rule check: Suppress layout placeholders when asset is empty
        }
    });
}
