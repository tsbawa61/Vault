/**
 * =========================================================================
 * GlamTrack Core Platform Controller - Salon Worker Translation Layer
 * Production Engine Build - Synced with Provided Constants & ErrorMailer
 * =========================================================================
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { 
    getFirestore, collection, query, where, getDocs, doc, setDoc, onSnapshot, writeBatch, updateDoc, deleteDoc
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
let allotCurrentPackTotalAmount = 0;
let allotPacksCache = new Map();
let utilizePrevUnpaidBalance = 0;
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 Minutes Boundary

// =========================================================================
// Catalog admin helpers (category / service / sub-service edit-delete)
// =========================================================================
function removeCatalogDeleteButton(buttonId) {
    const oldBtn = document.getElementById(buttonId);
    if (oldBtn) oldBtn.remove();
}

function appendCatalogDeleteButton({ formId, buttonId, itemName, targetDocRef, onDeleted, preDeleteConfirm }) {
    const formEl = document.getElementById(formId);
    const saveBtn = formEl.querySelector("button[type='submit']");
    removeCatalogDeleteButton(buttonId);

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.id = buttonId;
    deleteBtn.className = "btn btn-danger btn-sm d-block w-100 mt-2 fw-bold";
    deleteBtn.innerText = "🗑️ Delete Item Permanently";
    deleteBtn.addEventListener("click", async () => {
        const proceed = preDeleteConfirm
            ? await preDeleteConfirm()
            : confirm(`Are you absolutely sure you want to permanently delete "${itemName}"? This action cannot be reversed.`);
        if (!proceed) return;
        try {
            await deleteDoc(targetDocRef);
            alert("Success: The item has been completely removed from the menu configuration.");
            onDeleted();
        } catch (delErr) {
            console.error("Deletion process fault trace:", delErr);
            alert("Failed to drop record item from database execution context.");
        }
    });
    saveBtn.parentNode.appendChild(deleteBtn);
}

async function fetchOwnerRecordByCode(collectionName, codeField, selectedCode) {
    const collRef = collection(db, collectionName);
    let q = query(
        collRef,
        where("ownerUserNo", "==", activeSessionUser.ownerUserNo),
        where(codeField, "==", selectedCode)
    );
    let res = await getDocs(q);
    if (res.empty && !isNaN(selectedCode)) {
        q = query(
            collRef,
            where("ownerUserNo", "==", activeSessionUser.ownerUserNo),
            where(codeField, "==", Number(selectedCode))
        );
        res = await getDocs(q);
    }
    return res.empty ? null : res.docs[0];
}

// =========================================================================
// UI Lifecycle Router Initialization Hook
// =========================================================================
document.addEventListener("DOMContentLoaded", () => {
    initViewRouterLinks();
    setupMediaPreviewListener("pack-promo-file", "preview-pack-img");

    const packSubservicesContainer = document.getElementById("container-pack-subservices");
    if (packSubservicesContainer) {
        packSubservicesContainer.addEventListener("change", (e) => {
            if (e.target.matches(".chk-pack-subservice")) {
                updatePackSubServicesRunningSum();
            }
        });
    }

    const packSubSearch = document.getElementById("pack-subservices-search");
    if (packSubSearch) {
        packSubSearch.addEventListener("input", () => {
            const term = packSubSearch.value.toLowerCase().trim();
            document.querySelectorAll("#container-pack-subservices .form-check").forEach(item => {
                const label = item.querySelector("label");
                const text = label ? label.textContent.toLowerCase() : "";
                item.style.display = term === "" || text.includes(term) ? "" : "none";
            });
        });
    }

    const allotCustSearch = document.getElementById("allot-customer-search");
    if (allotCustSearch) {
        allotCustSearch.addEventListener("input", () => {
            const term = allotCustSearch.value.toLowerCase().trim();
            const sel = document.getElementById("allot-customer-select");
            if (!sel || !sel._allOptions) return;
            const prevVal = sel.value;
            sel.innerHTML = "";
            sel._allOptions.forEach(opt => {
                if (term === "" || opt.text.toLowerCase().includes(term)) {
                    sel.appendChild(opt.cloneNode(true));
                }
            });
            if ([...sel.options].some(o => o.value === prevVal)) sel.value = prevVal;
        });
    }

    const utilizeCustSearch = document.getElementById("utilize-customer-search");
    if (utilizeCustSearch) {
        utilizeCustSearch.addEventListener("input", () => {
            const term = utilizeCustSearch.value.toLowerCase().trim();
            const sel = document.getElementById("utilize-customer-select");
            if (!sel || !sel._allOptions) return;
            const prevVal = sel.value;
            sel.innerHTML = "";
            sel._allOptions.forEach(opt => {
                if (term === "" || opt.text.toLowerCase().includes(term)) {
                    sel.appendChild(opt.cloneNode(true));
                }
            });
            if ([...sel.options].some(o => o.value === prevVal)) sel.value = prevVal;
            sel.dispatchEvent(new Event("change"));
        });
    }
    ["sub-select-search/sub-select-existing","sub-parent-srv-search/sub-parent-srv","usr-select-search/usr-select-existing"].forEach(pair => {
        const [sid, did] = pair.split("/");
        const si = document.getElementById(sid);
        if (!si) return;
        si.addEventListener("input", () => {
            const term = si.value.toLowerCase().trim();
            const sel = document.getElementById(did);
            if (!sel || !sel._allOptions) return;
            const pv = sel.value; sel.innerHTML = "";
            sel._allOptions.forEach(o => { if (term === "" || o.text.toLowerCase().includes(term)) sel.appendChild(o.cloneNode(true)); });
            if ([...sel.options].some(o => o.value === pv)) sel.value = pv;
        });
    });

    const packPriceInput = document.getElementById("pack-price");
    if (packPriceInput) {
        packPriceInput.addEventListener("input", updatePackDiscountDisplay);
    }

    const allotSoldPriceInput = document.getElementById("allot-sold-price");
    if (allotSoldPriceInput) allotSoldPriceInput.addEventListener("input", updateAllotmentDiscountAndBalance);

    const allotAmtReceivedInput = document.getElementById("allot-amount-received");
    if (allotAmtReceivedInput) allotAmtReceivedInput.addEventListener("input", updateAllotmentDiscountAndBalance);

    const utilizeAddlAmtInput = document.getElementById("utilize-addl-amt-received");
    if (utilizeAddlAmtInput) utilizeAddlAmtInput.addEventListener("input", updateUtilizeNewUnpaidDisplay);
});

function updatePackDiscountDisplay() {
    const priceEl = document.getElementById("pack-price");
    const totalAmtEl = document.getElementById("pack-total-amt");
    const discountEl = document.getElementById("pack-discount-display");
    if (!priceEl || !totalAmtEl || !discountEl) return;

    const price = parseFloat(priceEl.value);
    const totalAmt = parseFloat(totalAmtEl.value);

    if (!isNaN(price) && !isNaN(totalAmt) && totalAmt > 0 && price >= 0) {
        const discount = ((totalAmt - price) / totalAmt) * 100;
        if (discount > 0) {
            discountEl.textContent = `${discount.toFixed(1)}% discount`;
            discountEl.className = "text-success fw-bold small text-nowrap";
        } else if (discount < 0) {
            discountEl.textContent = `${Math.abs(discount).toFixed(1)}% above list`;
            discountEl.className = "text-danger fw-bold small text-nowrap";
        } else {
            discountEl.textContent = "No discount";
            discountEl.className = "text-muted fw-bold small text-nowrap";
        }
    } else {
        discountEl.textContent = "";
    }
}

function updatePackSubServicesRunningSum() {
    const sumEl = document.getElementById("pack-subservices-sum");
    if (!sumEl) return;

    const checked = document.querySelectorAll(".chk-pack-subservice:checked");
    let total = 0;
    checked.forEach((input) => {
        total += Number(input.getAttribute("data-rate")) || 0;
    });

    const count = checked.length;
    sumEl.textContent = count === 0
        ? "Selected items total: ₹0"
        : `Selected items total: ₹${total.toLocaleString("en-IN")} (${count} item${count === 1 ? "" : "s"} selected)`;

    const totalAmtEl = document.getElementById("pack-total-amt");
    if (totalAmtEl) {
        totalAmtEl.value = count === 0 ? "" : total;
        updatePackDiscountDisplay();
    }
}

function initViewRouterLinks() {
    document.getElementById("nav-home").addEventListener("click", () => showActiveFrame("sec-home"));
    document.getElementById("nav-login").addEventListener("click", () => showActiveFrame("sec-login"));
    document.getElementById("nav-dashboard").addEventListener("click", () => showActiveFrame("sec-dashboard"));
    document.getElementById("nav-adm-catalog").addEventListener("click", () => {
        showActiveFrame("sec-adm-catalog");
        document.getElementById("frm-adm-subservice").reset();
        document.getElementById("sub-active").checked = true;
        removeCatalogDeleteButton("btn-dynamic-sub-delete");
    });
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
    document.getElementById("frm-adm-subservice").addEventListener("submit", processSubServiceFormSubmission);
    document.getElementById("frm-adm-commonpack").addEventListener("submit", processCommonPackADMFormSubmission);
    document.getElementById("frm-adm-user-profile").addEventListener("submit", processUserADMFormSubmission);
    document.getElementById("frm-allot-membership").addEventListener("submit", processAllotmentFormSubmission);

    // Core Security Configuration Form Submit Pipelines
    document.getElementById("frm-access-control-matrix").addEventListener("submit", processAccessControlFormSubmission);
    document.getElementById("frm-utilize-service-visit").addEventListener("submit", processVisitDeductionFormSubmission);
    
    // Automated reactive lookups processing links
    document.getElementById("utilize-customer-select").addEventListener("change", updateCustomerAllottedPacksDropdown);
    document.getElementById("utilize-pack-select").addEventListener("change", renderUtilizeSubServicesCheckboxes);
    document.getElementById("allot-pack-select").addEventListener("change", handleAllotPackSelectChange);

    document.getElementById("cat-select-existing").addEventListener("change", async (e) => {
        const selectedCode = e.target.value ? e.target.value.trim() : "";
        removeCatalogDeleteButton("btn-dynamic-cat-delete");

        if (!selectedCode) {
            document.getElementById("frm-adm-category").reset();
            document.getElementById("cat-active").checked = true;
            return;
        }

        try {
            const targetDoc = await fetchOwnerRecordByCode("serviceCategories", "catCode", selectedCode);
            if (!targetDoc) {
                console.warn(`No category record matched code signature: ${selectedCode}`);
                return;
            }

            const itemData = targetDoc.data();
            document.getElementById("cat-name").value = itemData.catName || "";
            document.getElementById("cat-desc").value = itemData.catDescription || "";
            document.getElementById("cat-active").checked = itemData.active === true;

            appendCatalogDeleteButton({
                formId: "frm-adm-category",
                buttonId: "btn-dynamic-cat-delete",
                itemName: itemData.catName || selectedCode,
                targetDocRef: targetDoc.ref,
                onDeleted: () => {
                    document.getElementById("frm-adm-category").reset();
                    document.getElementById("cat-active").checked = true;
                    removeCatalogDeleteButton("btn-dynamic-cat-delete");
                    refreshAllAdministrativeTables();
                    loadWorkspaceDropdownMappings();
                }
            });
        } catch (err) {
            console.error("Category autofill mapping pipeline runtime failure:", err);
        }
    });

    document.getElementById("srv-select-existing").addEventListener("change", async (e) => {
        const selectedCode = e.target.value ? e.target.value.trim() : "";
        removeCatalogDeleteButton("btn-dynamic-srv-delete");

        if (!selectedCode) {
            document.getElementById("frm-adm-service").reset();
            document.getElementById("srv-active").checked = true;
            return;
        }

        try {
            const targetDoc = await fetchOwnerRecordByCode("services", "serviceCode", selectedCode);
            if (!targetDoc) {
                console.warn(`No service record matched code signature: ${selectedCode}`);
                return;
            }

            const itemData = targetDoc.data();
            document.getElementById("srv-parent-cat").value = itemData.catCode || "";
            document.getElementById("srv-name").value = itemData.serviceName || "";
            document.getElementById("srv-desc").value = itemData.serviceDescription || "";
            document.getElementById("srv-active").checked = itemData.active === true;

            appendCatalogDeleteButton({
                formId: "frm-adm-service",
                buttonId: "btn-dynamic-srv-delete",
                itemName: itemData.serviceName || selectedCode,
                targetDocRef: targetDoc.ref,
                onDeleted: () => {
                    document.getElementById("frm-adm-service").reset();
                    document.getElementById("srv-active").checked = true;
                    removeCatalogDeleteButton("btn-dynamic-srv-delete");
                    refreshAllAdministrativeTables();
                    loadWorkspaceDropdownMappings();
                }
            });
        } catch (err) {
            console.error("Service autofill mapping pipeline runtime failure:", err);
        }
    });

    document.getElementById("usr-select-existing").addEventListener("change", async (e) => {
        const selectedUserNo = e.target.value ? e.target.value.trim() : "";
        removeCatalogDeleteButton("btn-dynamic-usr-delete");

        if (!selectedUserNo) {
            document.getElementById("frm-adm-user-profile").reset();
            document.getElementById("usr-active").checked = true;
            return;
        }

        try {
            const targetDoc = await fetchOwnerRecordByCode("users", "userNo", selectedUserNo);
            if (!targetDoc) {
                console.warn(`No user profile matched ID: ${selectedUserNo}`);
                return;
            }

            const itemData = targetDoc.data();
            document.getElementById("usr-role").value = itemData.role || "";
            document.getElementById("usr-fullname").value = itemData.name || "";
            document.getElementById("usr-sex").value = itemData.sex || "Female";
            document.getElementById("usr-age").value = itemData.ageGroup || "";
            document.getElementById("usr-email").value = itemData.email || "";
            document.getElementById("usr-password").value = itemData.password || "";
            document.getElementById("usr-phone").value = itemData.phone || "";
            document.getElementById("usr-distance").value = itemData.distance !== undefined ? itemData.distance : "";
            document.getElementById("usr-address").value = itemData.address || "";
            document.getElementById("usr-mapurl").value = itemData.googleMapLink || "";
            document.getElementById("usr-active").checked = itemData.active === true;

            appendCatalogDeleteButton({
                formId: "frm-adm-user-profile",
                buttonId: "btn-dynamic-usr-delete",
                itemName: itemData.name || selectedUserNo,
                targetDocRef: targetDoc.ref,
                onDeleted: () => {
                    document.getElementById("frm-adm-user-profile").reset();
                    document.getElementById("usr-active").checked = true;
                    removeCatalogDeleteButton("btn-dynamic-usr-delete");
                    refreshAllAdministrativeTables();
                    loadWorkspaceDropdownMappings();
                },
                preDeleteConfirm: itemData.role === "OWNER"
                    ? () => {
                        if (!confirm(
                            `⚠️ WARNING: You are about to delete the Owner profile "${itemData.name || selectedUserNo}".

` +
                            `All data linked to this owner (sub-services, packages, customer profiles, visit logs) ` +
                            `will NOT be automatically removed from the database — it must be cleaned up manually.

` +
                            `Are you sure you want to proceed?`
                        )) return false;
                        return confirm(
                            `Final confirmation: Permanently delete Owner "${itemData.name || selectedUserNo}"?

This cannot be undone.`
                        );
                    }
                    : undefined
            });
        } catch (err) {
            console.error("User profile autofill mapping pipeline runtime failure:", err);
        }
    });

    document.getElementById("pack-select-existing").addEventListener("change", async (e) => {
        const selectedPackName = e.target.value ? e.target.value.trim() : "";
        removeCatalogDeleteButton("btn-dynamic-pack-delete");

        if (!selectedPackName) {
            document.getElementById("frm-adm-commonpack").reset();
            document.getElementById("pack-active").checked = true;
            document.getElementById("pack-type-select").value = "Type2";
            const discEl = document.getElementById("pack-discount-display");
            if (discEl) discEl.textContent = "";
            renderCatalogSubServicesCheckboxes();
            return;
        }

        try {
            const targetDoc = await fetchOwnerRecordByCode("commonServicePacks", "packName", selectedPackName);
            if (!targetDoc) {
                console.warn(`No package record matched name: ${selectedPackName}`);
                return;
            }

            const itemData = targetDoc.data();
            document.getElementById("pack-name-id").value = itemData.packName || "";
            document.getElementById("pack-type-select").value = "Type2";
            document.getElementById("pack-total-amt").value = itemData.totalAmount !== undefined ? itemData.totalAmount : "";
            document.getElementById("pack-price").value = itemData.offerPrice !== undefined ? itemData.offerPrice : "";
            document.getElementById("pack-active").checked = itemData.active === true;
            updatePackDiscountDisplay();

            await renderCatalogSubServicesCheckboxes();
            const selectedCodes = itemData.subServicesArray || [];
            document.querySelectorAll(".chk-pack-subservice").forEach((input) => {
                input.checked = selectedCodes.includes(input.value);
            });
            updatePackSubServicesRunningSum();

            appendCatalogDeleteButton({
                formId: "frm-adm-commonpack",
                buttonId: "btn-dynamic-pack-delete",
                itemName: itemData.packName || selectedPackName,
                targetDocRef: targetDoc.ref,
                preDeleteConfirm: async () => {
                    // (d) Block deletion if pack is allotted to any customer
                    const allotQ = query(collection(db, "customerServicePacks"),
                        where("ownerUserNo", "==", activeSessionUser.ownerUserNo),
                        where("packName",    "==", selectedPackName));
                    const allotSnap = await getDocs(allotQ);
                    if (!allotSnap.empty) {
                        alert(`⚠️ Deletion Blocked: The package "${selectedPackName}" has been allotted to ${allotSnap.size} customer(s) and cannot be deleted.\n\nTo retire this package, create a new one with updated settings and stop selling this one.`);
                        return false;
                    }
                    return confirm(`Are you absolutely sure you want to permanently delete "${itemData.packName || selectedPackName}"? This action cannot be reversed.`);
                },
                onDeleted: () => {
                    document.getElementById("frm-adm-commonpack").reset();
                    document.getElementById("pack-active").checked = true;
                    document.getElementById("pack-type-select").value = "Type2";
                    const discEl = document.getElementById("pack-discount-display");
                    if (discEl) discEl.textContent = "";
                    removeCatalogDeleteButton("btn-dynamic-pack-delete");
                    renderCatalogSubServicesCheckboxes();
                    refreshAllAdministrativeTables();
                    loadWorkspaceDropdownMappings();
                }
            });
        } catch (err) {
            console.error("Package autofill mapping pipeline runtime failure:", err);
        }
    });

    document.getElementById("sub-select-existing").addEventListener("change", async (e) => {
        const selectedCode = e.target.value ? e.target.value.trim() : "";
        removeCatalogDeleteButton("btn-dynamic-sub-delete");

        if (!selectedCode) {
            document.getElementById("frm-adm-subservice").reset();
            document.getElementById("sub-active").checked = true;
            return;
        }

        try {
            const targetDoc = await fetchOwnerRecordByCode("subServices", "subServiceCode", selectedCode);
            if (!targetDoc) {
                console.warn(`No collection record matched code signature: ${selectedCode}`);
                return;
            }

            const itemData = targetDoc.data();
            document.getElementById("sub-parent-srv").value = itemData.serviceCode || "";
            document.getElementById("sub-name").value = itemData.subServiceName || "";
            document.getElementById("sub-rate").value = itemData.rate !== undefined ? itemData.rate : "";
            document.getElementById("sub-duration").value = itemData.durationMinutes || "";
            document.getElementById("sub-active").checked = itemData.active === true;

            appendCatalogDeleteButton({
                formId: "frm-adm-subservice",
                buttonId: "btn-dynamic-sub-delete",
                itemName: itemData.subServiceName || selectedCode,
                targetDocRef: targetDoc.ref,
                onDeleted: () => {
                    document.getElementById("frm-adm-subservice").reset();
                    document.getElementById("sub-active").checked = true;
                    removeCatalogDeleteButton("btn-dynamic-sub-delete");
                    refreshAllAdministrativeTables();
                    loadWorkspaceDropdownMappings();
                    renderCatalogSubServicesCheckboxes();
                }
            });
        } catch (err) {
            console.error("Autofill mapping pipeline runtime failure:", err);
        }
    });
}

function showActiveFrame(sectionId) {
    document.querySelectorAll(".view-section").forEach(s => s.classList.remove("active"));
    const targetSection = document.getElementById(sectionId);
    if (targetSection) targetSection.classList.add("active");
}

function resetSessionWatchdog() {
    if (sessionWatchdogTimer) clearTimeout(sessionWatchdogTimer);
    sessionWatchdogTimer = setTimeout(() => {
        alert("Security Lockout: You have been signed out automatically due to 15 minutes of inactivity.");
        performSessionLogoutAction();
    }, INACTIVITY_TIMEOUT_MS);
}
const ACTIVITY_EVENTS = ["mousemove","keydown","click","scroll","touchstart"];
function startSessionWatchdog() {
    resetSessionWatchdog();
    ACTIVITY_EVENTS.forEach(evt => document.addEventListener(evt, resetSessionWatchdog, { passive: true }));
}
function stopSessionWatchdog() {
    if (sessionWatchdogTimer) clearTimeout(sessionWatchdogTimer);
    sessionWatchdogTimer = null;
    ACTIVITY_EVENTS.forEach(evt => document.removeEventListener(evt, resetSessionWatchdog));
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
        // Owners must use their own userNo as their tenant key, not the creator's ownerUserNo
        if (activeSessionUser.role === "OWNER") {
            activeSessionUser = { ...activeSessionUser, ownerUserNo: activeSessionUser.userNo };
        }
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

    document.getElementById("lbl-active-context").innerText = `Branch ID Layer: ${activeSessionUser.userNo} | Logged In Role: ${activeSessionUser.role} | ${activeSessionUser.name}`;
    configureUserProfileFormForRole(activeSessionUser.role);
    startSessionWatchdog();
    showActiveFrame("sec-dashboard");
    
    bindRealtimeAnalyticsStream();
    loadWorkspaceDropdownMappings();
    refreshAllAdministrativeTables();
    renderCatalogSubServicesCheckboxes();
}

function performSessionLogoutAction() {
    if (realtimePacksUnsubscribe) realtimePacksUnsubscribe();
    stopSessionWatchdog();
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
        
        const srchBox = document.getElementById("pack-subservices-search");
        if (srchBox) srchBox.value = "";
        container.innerHTML = "";
        if (snap.empty) {
            container.innerHTML = `<p class="text-danger small my-0">No active menu service items found. Please setup or load standard menus first.</p>`;
            return;
        }

        snap.forEach(d => {
            const ss = d.data();
            container.innerHTML += `
                <div class="form-check">
                    <input class="form-check-input chk-pack-subservice" type="checkbox" value="${ss.subServiceCode}" data-rate="${ss.rate}" id="chk-ss-${ss.subServiceCode}">
                    <label class="form-check-label small" for="chk-ss-${ss.subServiceCode}">
                        ${ss.subServiceName} (₹${ss.rate})
                    </label>
                </div>`;
        });
        updatePackSubServicesRunningSum();
    } catch (err) { await handleTelemetryAlert("Catalog Checkbox Mapping Engine", err); }
}

// =========================================================================
// Structural Administration Form Submission Handlers
// =========================================================================
async function processCategoryADMFormSubmission(e) {
    e.preventDefault();
    const existingCode = document.getElementById("cat-select-existing").value;
    const name = document.getElementById("cat-name").value.trim();
    const desc = document.getElementById("cat-desc").value.trim();
    const activeFlag = document.getElementById("cat-active").checked;
    
    try {
        let targetCode = existingCode;
        let isNewItem = false;

        if (!targetCode) {
            isNewItem = true;
            targetCode = String(await getHighestFieldOffset("serviceCategories", "catCode") + 1).padStart(2, "0");
        }

        await setDoc(doc(db, "serviceCategories", `${activeSessionUser.ownerUserNo}_CAT_${targetCode}`), {
            ownerUserNo: activeSessionUser.ownerUserNo, catCode: targetCode, catName: name, catDescription: desc,
            active: activeFlag, createdBy: activeSessionUser.role, startDate: new Date().toISOString().split("T")[0],
            expiryDate: null, createdAt: new Date().toISOString()
        });

        alert(isNewItem ? "Success: Menu category added successfully." : `✅ Success: Changes saved for "${name}".`);

        document.getElementById("frm-adm-category").reset();
        document.getElementById("cat-active").checked = true;
        removeCatalogDeleteButton("btn-dynamic-cat-delete");

        refreshAllAdministrativeTables();
        loadWorkspaceDropdownMappings();
    } catch(err) { await handleTelemetryAlert("Category Storage Submission Pipeline", err); }
}

async function processServiceADMFormSubmission(e) {
    e.preventDefault();
    const existingCode = document.getElementById("srv-select-existing").value;
    const parentCat = document.getElementById("srv-parent-cat").value;
    const name = document.getElementById("srv-name").value.trim();
    const desc = document.getElementById("srv-desc").value.trim();
    const activeFlag = document.getElementById("srv-active").checked;

    try {
        let targetCode = existingCode;
        let isNewItem = false;

        if (!targetCode) {
            isNewItem = true;
            targetCode = String(await getHighestFieldOffset("services", "serviceCode") + 1).padStart(2, "0");
        }

        await setDoc(doc(db, "services", `${activeSessionUser.ownerUserNo}_SRV_${targetCode}`), {
            ownerUserNo: activeSessionUser.ownerUserNo, serviceCode: targetCode, serviceName: name, serviceDescription: desc,
            catCode: parentCat, active: activeFlag, createdBy: activeSessionUser.role, startDate: new Date().toISOString().split("T")[0],
            expiryDate: null, createdAt: new Date().toISOString()
        });

        alert(isNewItem ? "Success: Main service group added successfully." : `✅ Success: Changes saved for "${name}".`);

        document.getElementById("frm-adm-service").reset();
        document.getElementById("srv-active").checked = true;
        removeCatalogDeleteButton("btn-dynamic-srv-delete");

        refreshAllAdministrativeTables();
        loadWorkspaceDropdownMappings();
    } catch(err) { await handleTelemetryAlert("Service Storage Submission Pipeline", err); }
}

async function processSubServiceFormSubmission(e) {
    e.preventDefault();
    
    const existingCode = document.getElementById("sub-select-existing").value;
    const parentSrv = document.getElementById("sub-parent-srv").value;
    const name = document.getElementById("sub-name").value.trim();
    const rate = document.getElementById("sub-rate").value;
    const duration = document.getElementById("sub-duration").value;
    const activeFlag = document.getElementById("sub-active").checked;
    if (!parentSrv) return alert("Validation: Please select a Main Service this item belongs to.");
    if (!name)      return alert("Validation: Please enter a name for this service item.");
    try {
        let targetCode = existingCode;
        let isNewItem = false;

        if (!targetCode) {
            isNewItem = true;
            targetCode = String(await getHighestFieldOffset("subServices", "subServiceCode") + 1).padStart(3, "0");
        }

        await setDoc(doc(db, "subServices", `${activeSessionUser.ownerUserNo}_SUB_${targetCode}`), {
            ownerUserNo: activeSessionUser.ownerUserNo,
            subServiceCode: targetCode,
            subServiceName: name,
            serviceCode: parentSrv,
            rate: Number(rate),
            durationMinutes: Number(duration),
            active: activeFlag,
            createdBy: activeSessionUser.role,
            startDate: new Date().toISOString().split("T")[0],
            expiryDate: null,
            createdAt: new Date().toISOString()
        });

        alert(isNewItem ? `✨ Success: "${name}" added to menu!` : `✅ Success: Changes saved.`);

        document.getElementById("frm-adm-subservice").reset();
        document.getElementById("sub-active").checked = true;
        
        const oldDelBtn = document.getElementById("btn-dynamic-sub-delete");
        if (oldDelBtn) oldDelBtn.remove();
        
        refreshAllAdministrativeTables();
        loadWorkspaceDropdownMappings();
        renderCatalogSubServicesCheckboxes();
    } catch(err) { 
        console.error("Subservice storage execution breakdown:", err); 
    }
}

async function processCommonPackADMFormSubmission(e) {
    e.preventDefault();

    const existingPackName = document.getElementById("pack-select-existing").value;
    const nameId    = document.getElementById("pack-name-id").value.trim();
    const type      = document.getElementById("pack-type-select").value;
    const price     = parseFloat(document.getElementById("pack-price").value) || 0;
    const totalAmt  = parseFloat(document.getElementById("pack-total-amt").value) || 0;
    const activeFlag = document.getElementById("pack-active").checked;

    // (c) No subservices selected
    const selectedSubServices = [];
    document.querySelectorAll(".chk-pack-subservice:checked").forEach(input => selectedSubServices.push(input.value));
    if (selectedSubServices.length === 0)
        return alert("Validation: Please select at least one Individual Service Item for this package before saving.");

    // (a) Price validation: must be between 15% and 100% of total
    if (totalAmt > 0) {
        const minAllowed = totalAmt * 0.15;
        if (price > totalAmt) {
            const go = confirm(`⚠️ Price Alert: The Offered Price (₹${price.toLocaleString("en-IN")}) is above the Total Services Price (₹${totalAmt.toLocaleString("en-IN")}). This means you are charging more than list price.\n\nProceed anyway?`);
            if (!go) return;
        } else if (price < minAllowed) {
            const go = confirm(`⚠️ Price Alert: The Offered Price (₹${price.toLocaleString("en-IN")}) is below 15% of the Total Services Price (₹${totalAmt.toLocaleString("en-IN")}). Minimum suggested price is ₹${minAllowed.toLocaleString("en-IN", {maximumFractionDigits:0})}.\n\nProceed anyway?`);
            if (!go) return;
        }
    }

    try {
        let packDocRef;
        let isNewItem = false;

        if (existingPackName) {
            const targetDoc = await fetchOwnerRecordByCode("commonServicePacks", "packName", existingPackName);
            if (!targetDoc)
                return alert("Update blocked: Could not find the selected package in the catalog.");

            // (d) Block modify if pack is already allotted to any customer
            const allotQ = query(collection(db, "customerServicePacks"),
                where("ownerUserNo", "==", activeSessionUser.ownerUserNo),
                where("packName",    "==", existingPackName));
            const allotSnap = await getDocs(allotQ);
            if (!allotSnap.empty) {
                return alert(`⚠️ Modification Blocked: The package "${existingPackName}" has already been allotted to ${allotSnap.size} customer(s) and cannot be modified.\n\nTo make changes, please create a new package with the updated settings instead.`);
            }

            packDocRef = targetDoc.ref;
        } else {
            isNewItem = true;
            packDocRef = doc(db, "commonServicePacks", `${activeSessionUser.ownerUserNo}_CPACK_${nameId.replace(/\s+/g, "_")}`);
        }

        // (b) setDoc with no merge — fully replaces subServicesArray and all fields
        await setDoc(packDocRef, {
            ownerUserNo: activeSessionUser.ownerUserNo, packName: nameId, packType: "Type2",
            offerPrice: price, totalAmount: totalAmt,
            subServicesArray: selectedSubServices,   // complete replacement
            active: activeFlag, createdAt: new Date().toISOString()
        });

        alert(isNewItem
            ? "Success: New pre-paid package added to available salon catalog."
            : `✅ Success: Changes saved for "${nameId}".`);

        document.getElementById("frm-adm-commonpack").reset();
        document.getElementById("pack-active").checked = true;
        document.getElementById("pack-type-select").value = "Type2";
        const discountEl = document.getElementById("pack-discount-display");
        if (discountEl) discountEl.textContent = "";
        removeCatalogDeleteButton("btn-dynamic-pack-delete");
        renderCatalogSubServicesCheckboxes();
        refreshAllAdministrativeTables();
        loadWorkspaceDropdownMappings();
    } catch(err) { await handleTelemetryAlert("Master Package Creation Node", err); }
}

function configureUserProfileFormForRole(loggedInRole) {
    const roleSelect = document.getElementById("usr-role");
    const distWrapper = document.getElementById("usr-distance-wrapper");
    if (!roleSelect) return;
    const ownerOpt = roleSelect.querySelector("option[value='OWNER']");
    const mgrOpt   = roleSelect.querySelector("option[value='MANAGER']");
    const custOpt  = roleSelect.querySelector("option[value='CUSTOMER']");
    if (loggedInRole === "SUPER_USER") {
        if (ownerOpt) ownerOpt.hidden = false;
        if (mgrOpt)   mgrOpt.hidden   = true;
        if (custOpt)  custOpt.hidden   = true;
        if (distWrapper) distWrapper.hidden = true;
    } else {
        if (ownerOpt) ownerOpt.hidden = true;
        if (mgrOpt)   mgrOpt.hidden   = false;
        if (custOpt)  custOpt.hidden   = false;
        if (distWrapper) distWrapper.hidden = false;
    }
}
async function processUserADMFormSubmission(e) {
    e.preventDefault();
    const existingUserNo = document.getElementById("usr-select-existing").value;
    const role = document.getElementById("usr-role").value;
    const name = document.getElementById("usr-fullname").value.trim();
    const sex = document.getElementById("usr-sex").value;
    const age = document.getElementById("usr-age").value;
    const email = document.getElementById("usr-email").value.trim().toLowerCase();
    const pass = document.getElementById("usr-password").value;
    const phone = document.getElementById("usr-phone").value.trim();
    if ((role === "MANAGER" || role === "OWNER") && !pass.trim())
        return alert("Validation Error: Password is required for MANAGER and OWNER profiles.");
    const dist = document.getElementById("usr-distance").value;
    const addr = document.getElementById("usr-address").value.trim();
    const maps = document.getElementById("usr-mapurl").value.trim();
    const activeFlag = document.getElementById("usr-active").checked;

    try {
        let targetUserNo = existingUserNo;
        let isNewItem = false;

        if (!targetUserNo) {
            isNewItem = true;
            targetUserNo = String(Math.floor(1000 + Math.random() * 9000));
        }

        // OWNER accounts use their own userNo as their ownerUserNo (tenant key)
        const recordOwnerUserNo = (role === "OWNER") ? targetUserNo : activeSessionUser.ownerUserNo;
        await setDoc(doc(db, "users", `${recordOwnerUserNo}_USR_${targetUserNo}`), {
            ownerUserNo: recordOwnerUserNo, userNo: targetUserNo, role: role, name: name, sex: sex,
            ageGroup: age, email: email, password: pass, phone: phone, distance: dist, address: addr,
            googleMapLink: maps, active: activeFlag, startDate: new Date().toISOString().split("T")[0], createdAt: new Date().toISOString()
        });

        alert(isNewItem
            ? `Success: Profile record file registered successfully as a salon ${role}.`
            : `✅ Success: Changes saved for "${name}".`);

        document.getElementById("frm-adm-user-profile").reset();
        document.getElementById("usr-active").checked = true;
        removeCatalogDeleteButton("btn-dynamic-usr-delete");

        refreshAllAdministrativeTables();
        loadWorkspaceDropdownMappings();
    } catch(err) { await handleTelemetryAlert("User Identity Provisioning Endpoint", err); }
}

async function handleAllotPackSelectChange() {
    const packName = document.getElementById("allot-pack-select").value;
    const previewEl = document.getElementById("allot-pack-preview");
    const detailsEl = document.getElementById("allot-pack-preview-details");
    const soldPriceEl = document.getElementById("allot-sold-price");
    const discountEl = document.getElementById("allot-sold-discount");
    const unpaidEl = document.getElementById("allot-unpaid-display");

    allotCurrentPackTotalAmount = 0;
    if (previewEl) previewEl.style.display = "none";
    if (soldPriceEl) soldPriceEl.value = "";
    if (discountEl) discountEl.textContent = "";
    if (unpaidEl) unpaidEl.textContent = "";

    if (!packName) return;

    const pack = allotPacksCache.get(packName);
    if (!pack) return;

    allotCurrentPackTotalAmount = Number(pack.totalAmount) || 0;
    const offerPrice = pack.offerPrice !== undefined ? Number(pack.offerPrice) : null;
    const serviceCount = pack.subServicesArray ? pack.subServicesArray.length : 0;

    let discountBadge = "";
    if (offerPrice !== null && allotCurrentPackTotalAmount > 0) {
        const disc = ((allotCurrentPackTotalAmount - offerPrice) / allotCurrentPackTotalAmount * 100);
        if (disc > 0) discountBadge = ` <span class="badge bg-success">${disc.toFixed(1)}% off</span>`;
    }

    detailsEl.innerHTML = `
        <div class="row g-2">
            <div class="col-6"><span class="text-muted">Total Services Price (₹):</span> <strong>₹${allotCurrentPackTotalAmount.toLocaleString("en-IN")}</strong></div>
            <div class="col-6"><span class="text-muted">Pack Offered Price (₹):</span> <strong>${offerPrice !== null ? "₹" + offerPrice.toLocaleString("en-IN") : "N/A"}${discountBadge}</strong></div>
            <div class="col-12"><span class="text-muted">Service Items Allowed in this Pack:</span> <strong>${serviceCount} item${serviceCount === 1 ? "" : "s"}</strong></div>
        </div>`;
    previewEl.style.display = "block";

    if (soldPriceEl && offerPrice !== null) {
        soldPriceEl.value = offerPrice;
        updateAllotmentDiscountAndBalance();
    }
}

function updateAllotmentDiscountAndBalance() {
    const soldPriceEl = document.getElementById("allot-sold-price");
    const amtReceivedEl = document.getElementById("allot-amount-received");
    const discountEl = document.getElementById("allot-sold-discount");
    const unpaidEl = document.getElementById("allot-unpaid-display");
    if (!soldPriceEl || !discountEl || !unpaidEl) return;

    const soldPrice = parseFloat(soldPriceEl.value);
    const amtReceived = parseFloat(amtReceivedEl ? amtReceivedEl.value : "") || 0;

    if (!isNaN(soldPrice) && allotCurrentPackTotalAmount > 0) {
        const discount = ((allotCurrentPackTotalAmount - soldPrice) / allotCurrentPackTotalAmount * 100);
        if (discount > 0) {
            discountEl.textContent = `${discount.toFixed(1)}% off`;
            discountEl.className = "fw-bold small text-nowrap text-success";
        } else if (discount < 0) {
            discountEl.textContent = `${Math.abs(discount).toFixed(1)}% above list`;
            discountEl.className = "fw-bold small text-nowrap text-danger";
        } else {
            discountEl.textContent = "No discount";
            discountEl.className = "fw-bold small text-nowrap text-muted";
        }
    } else {
        discountEl.textContent = "";
    }

    if (!isNaN(soldPrice)) {
        const unpaid = soldPrice - amtReceived;
        if (unpaid > 0) {
            unpaidEl.textContent = `₹${unpaid.toLocaleString("en-IN")} unpaid`;
            unpaidEl.className = "fw-bold small text-nowrap text-danger";
        } else if (unpaid < 0) {
            unpaidEl.textContent = `₹${Math.abs(unpaid).toLocaleString("en-IN")} overpaid`;
            unpaidEl.className = "fw-bold small text-nowrap text-warning";
        } else {
            unpaidEl.textContent = "Fully paid ✓";
            unpaidEl.className = "fw-bold small text-nowrap text-success";
        }
    } else {
        unpaidEl.textContent = "";
    }
}

async function processAllotmentFormSubmission(e) {
    e.preventDefault();
    const cust = document.getElementById("allot-customer-select").value;
    const templatePackName = document.getElementById("allot-pack-select").value;
    const start = document.getElementById("allot-start-date").value;
    const expiry = document.getElementById("allot-expiry-date").value;
    const soldPrice = parseFloat(document.getElementById("allot-sold-price").value) || 0;
    const amountReceived = parseFloat(document.getElementById("allot-amount-received") ? document.getElementById("allot-amount-received").value : "") || 0;
    const unpaidBalance = Math.max(0, soldPrice - amountReceived);

    if (!cust || !templatePackName) return alert("System Configuration Error: Please ensure you select both a valid client and an active package setup template.");

    try {
        const q = query(collection(db, "commonServicePacks"), where("ownerUserNo", "==", activeSessionUser.ownerUserNo), where("packName", "==", templatePackName));
        const res = await getDocs(q);
        if (res.empty) return alert("Activation Blocked: Could not find the selected core packaging model blueprint rules.");
        const templateData = res.docs[0].data();

        const uniqueAllotId = "APACK-" + Math.floor(10000 + Math.random() * 90000);
        await setDoc(doc(db, "customerServicePacks", `${activeSessionUser.ownerUserNo}_ALLOT_${uniqueAllotId}`), {
            ownerUserNo: activeSessionUser.ownerUserNo, allotId: uniqueAllotId, customerNo: cust, packName: templatePackName,
            packType: templateData.packType,
            remainingBalance: soldPrice,
            totalAmount: Number(templateData.totalAmount),
            soldPrice: soldPrice,
            amountReceived: amountReceived,
            unpaidBalance: unpaidBalance,
            subServicesArray: templateData.subServicesArray || [], startDate: start, expiryDate: expiry || null, active: true, createdAt: new Date().toISOString()
        });

        alert("Success: Package has been successfully assigned and logged to this client profile account card.");
        document.getElementById("frm-allot-membership").reset();
        const _srch = document.getElementById("allot-customer-search");
        if (_srch) { _srch.value = ""; _srch.dispatchEvent(new Event("input")); }
        allotCurrentPackTotalAmount = 0;
        const previewEl = document.getElementById("allot-pack-preview");
        if (previewEl) previewEl.style.display = "none";
        const discEl = document.getElementById("allot-sold-discount");
        if (discEl) discEl.textContent = "";
        const unpaidEl = document.getElementById("allot-unpaid-display");
        if (unpaidEl) unpaidEl.textContent = "";
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
            packEl.innerHTML += `<option value="${data.allotId}">${data.packName} | Allot ID: ${data.allotId} (Remaining Balance: ${data.remainingBalance})</option>`;
        });
    } catch (err) { await handleTelemetryAlert("Dynamic Dropdown Sync Loop", err); }
}

async function renderUtilizeSubServicesCheckboxes() {
    const allotId = document.getElementById("utilize-pack-select").value;
    const container = document.getElementById("container-utilize-subservices");
    const financialEl = document.getElementById("utilize-pack-financial");
    const totalEl = document.getElementById("utilize-services-total");
    const newUnpaidEl = document.getElementById("utilize-new-unpaid-display");
    const addlAmtEl = document.getElementById("utilize-addl-amt-received");
    if (!container) return;

    container.innerHTML = "";
    if (financialEl) financialEl.style.display = "none";
    if (totalEl) { totalEl.style.display = "none"; totalEl.textContent = ""; }
    if (newUnpaidEl) newUnpaidEl.textContent = "";
    if (addlAmtEl) addlAmtEl.value = "0";
    utilizePrevUnpaidBalance = 0;
    if (!allotId) return;

    try {
        const q = query(collection(db, "customerServicePacks"), where("ownerUserNo", "==", activeSessionUser.ownerUserNo), where("allotId", "==", allotId)); 
        const res = await getDocs(q);
        if (res.empty) return;
        const pData = res.docs[0].data();

        const soldPrice = pData.soldPrice !== undefined ? Number(pData.soldPrice) : null;
        const amtReceived = pData.amountReceived !== undefined ? Number(pData.amountReceived) : null;
        const unpaidBalance = pData.unpaidBalance !== undefined
            ? Number(pData.unpaidBalance)
            : (soldPrice !== null && amtReceived !== null ? soldPrice - amtReceived : 0);
        utilizePrevUnpaidBalance = unpaidBalance;

        const isExhausted = Number(pData.remainingBalance) <= 0;
        const isExpired   = pData.expiryDate && pData.expiryDate !== null;
        if (isExhausted || isExpired) {
            let reason = [];
            if (isExhausted) reason.push(`remaining balance is ${pData.remainingBalance} (exhausted)`);
            if (isExpired)   reason.push(`package expired on ${pData.expiryDate}`);
            alert(`⚠️ Package Exhausted/Expired: ${reason.join(" and ")}.`);
        }
        if (financialEl) {
            const detailsEl = document.getElementById("utilize-pack-financial-details");
            if (detailsEl) {
                const unpaidClass = unpaidBalance > 0 ? "text-danger" : "text-success";
                detailsEl.innerHTML = `
                    <div class="row g-2">
                        <div class="col-6"><span class="text-muted">Sold at Price (₹):</span> <strong>${soldPrice !== null ? "₹" + soldPrice.toLocaleString("en-IN") : "N/A"}</strong></div>
                        <div class="col-6"><span class="text-muted">Amount Received Before This Visit (₹):</span> <strong>${amtReceived !== null ? "₹" + amtReceived.toLocaleString("en-IN") : "N/A"}</strong></div>
                        <div class="col-12"><span class="text-muted">Unpaid Balance Before This Visit (₹):</span> <strong class="${unpaidClass}">₹${unpaidBalance.toLocaleString("en-IN")}</strong></div>
                    </div>`;
            }
            financialEl.style.display = "block";
        }

        updateUtilizeNewUnpaidDisplay();

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

        container.querySelectorAll(".chk-utilize-subservice").forEach(chk => {
            chk.addEventListener("change", updateUtilizeServicesTotal);
        });
        if (totalEl) totalEl.style.display = "block";

    } catch (err) { await handleTelemetryAlert("Dynamic Subservice Checker Interface", err); }
}

function updateUtilizeNewUnpaidDisplay() {
    const addlAmtEl = document.getElementById("utilize-addl-amt-received");
    const newUnpaidEl = document.getElementById("utilize-new-unpaid-display");
    if (!newUnpaidEl) return;
    const addl = parseFloat(addlAmtEl ? addlAmtEl.value : "") || 0;
    const newUnpaid = utilizePrevUnpaidBalance - addl;
    if (utilizePrevUnpaidBalance === 0 && addl === 0) {
        newUnpaidEl.textContent = "";
        return;
    }
    if (newUnpaid > 0) {
        newUnpaidEl.textContent = `₹${newUnpaid.toLocaleString("en-IN")} still unpaid`;
        newUnpaidEl.className = "fw-bold small text-nowrap text-danger";
    } else if (newUnpaid < 0) {
        newUnpaidEl.textContent = `₹${Math.abs(newUnpaid).toLocaleString("en-IN")} overpaid`;
        newUnpaidEl.className = "fw-bold small text-nowrap text-warning";
    } else {
        newUnpaidEl.textContent = "Fully paid ✓";
        newUnpaidEl.className = "fw-bold small text-nowrap text-success";
    }
}

function updateUtilizeServicesTotal() {
    const totalEl = document.getElementById("utilize-services-total");
    if (!totalEl) return;
    const checked = document.querySelectorAll(".chk-utilize-subservice:checked");
    if (checked.length === 0) {
        totalEl.textContent = "Selected services total: ₹0";
        return;
    }
    let total = 0;
    checked.forEach(chk => { total += Number(chk.getAttribute("data-rate")) || 0; });
    totalEl.textContent = `Selected services total: ₹${total.toLocaleString("en-IN")} (${checked.length} item${checked.length === 1 ? "" : "s"})`;
}

async function processVisitDeductionFormSubmission(e) {
    e.preventDefault();
    const custNo = document.getElementById("utilize-customer-select").value;
    const allotId = document.getElementById("utilize-pack-select").value;
    const visitDate = document.getElementById("utilize-visit-date").value;
    const addlAmtReceived = parseFloat(document.getElementById("utilize-addl-amt-received") ? document.getElementById("utilize-addl-amt-received").value : "") || 0;

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

        const prevUnpaid = Number(pData.unpaidBalance !== undefined ? pData.unpaidBalance : 0);
        const prevAmtReceived = Number(pData.amountReceived !== undefined ? pData.amountReceived : 0);
        const newUnpaidBalance = Math.max(0, prevUnpaid - addlAmtReceived);
        const newAmountReceived = prevAmtReceived + addlAmtReceived;

        const nowExhausted = updatedBalance <= 0;
        const exhaustionUpdate = { remainingBalance: updatedBalance, unpaidBalance: newUnpaidBalance, amountReceived: newAmountReceived };
        if (nowExhausted) exhaustionUpdate.expiryDate = visitDate;
        await updateDoc(docRef, exhaustionUpdate);
        if (nowExhausted)
            alert(`⚠️ Package Fully Exhausted: "${pData.packName}" consumed. Expiry set to ${visitDate}.`);

        const logIdString = "LOG-" + Math.floor(100000 + Math.random() * 900000);
        await setDoc(doc(db, "serviceUtilizationLogs", `${activeSessionUser.ownerUserNo}_LOG_${logIdString}`), {
            ownerUserNo: activeSessionUser.ownerUserNo, logId: logIdString, customerNo: custNo, allotId: allotId,
            packName: pData.packName, visitDate: visitDate, itemsRendered: renderedItemCodeTrackers,
            unitsSubtracted: checkedInputs.length, calculatedValueCost: totalSubServicesValueCost,
            addlAmtReceived: addlAmtReceived, loggedAt: new Date().toISOString()
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
        const _uSrch = document.getElementById("utilize-customer-search");
        if (_uSrch) { _uSrch.value = ""; _uSrch.dispatchEvent(new Event("input")); }
        document.getElementById("container-utilize-subservices").innerHTML = "";
        utilizePrevUnpaidBalance = 0;
        const financialEl = document.getElementById("utilize-pack-financial");
        if (financialEl) financialEl.style.display = "none";
        const totalEl = document.getElementById("utilize-services-total");
        if (totalEl) { totalEl.style.display = "none"; totalEl.textContent = ""; }
        const newUnpaidEl = document.getElementById("utilize-new-unpaid-display");
        if (newUnpaidEl) newUnpaidEl.textContent = "";
        const addlEl = document.getElementById("utilize-addl-amt-received");
        if (addlEl) addlEl.value = "0";
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

    {
        const catQ = query(collection(db, "serviceCategories"),
            where("ownerUserNo", "==", ownerId),
            where("active", "==", true));
        const catSnap = await getDocs(catQ);
        const catTbody = document.getElementById("tbl-adm-categories");
        if (catTbody) {
            catTbody.innerHTML = "";
            catSnap.forEach(d => {
                const data = d.data();
                const tr = document.createElement("tr");
                tr.innerHTML = `<td><strong>[${data.catCode}]</strong></td><td>${data.catName}</td>`;
                catTbody.appendChild(tr);
            });
        }
    }

    {
        const srvQ = query(collection(db, "services"),
            where("ownerUserNo", "==", ownerId),
            where("active", "==", true));
        const srvSnap = await getDocs(srvQ);
        const srvTbody = document.getElementById("tbl-adm-services");
        if (srvTbody) {
            srvTbody.innerHTML = "";
            srvSnap.forEach(d => {
                const data = d.data();
                const tr = document.createElement("tr");
                tr.innerHTML = `<td><strong>[${data.serviceCode}]</strong></td><td>${data.serviceName}</td>`;
                srvTbody.appendChild(tr);
            });
        }
    }

    {
        const ssQ = query(collection(db, "subServices"),
            where("ownerUserNo", "==", ownerId),
            where("active", "==", true));
        const ssSnap = await getDocs(ssQ);
        const ssTbody = document.getElementById("tbl-adm-subservices");
        if (ssTbody) {
            ssTbody.innerHTML = "";
            ssSnap.forEach(d => {
                const data = d.data();
                const tr = document.createElement("tr");
                tr.innerHTML = `<td>${data.subServiceName}</td><td><strong>₹${data.rate}</strong></td>`;
                ssTbody.appendChild(tr);
            });
        }
    }

    renderTable("commonServicePacks", "tbl-adm-commonpacks", (data) => {
        const tr = document.createElement("tr");
        const serviceCount = data.subServicesArray ? data.subServicesArray.length : 0;
        const discount = (data.totalAmount > 0 && data.offerPrice >= 0)
            ? ((data.totalAmount - data.offerPrice) / data.totalAmount * 100)
            : null;
        const discountBadge = (discount !== null && discount > 0)
            ? ` <span class="badge bg-success ms-1">${discount.toFixed(1)}% off</span>`
            : "No Discount";

        tr.innerHTML = `
            <td>${data.packName}</td>
            <td hidden><span class="badge bg-dark">${data.packType === "Type1" ? "Item Counts" : "Cash Value Balance"}</span></td>
            <td>₹${data.offerPrice}${discountBadge}</td>
            <td>₹${data.totalAmount}</td>
            <td>${serviceCount} item${serviceCount === 1 ? "" : "s"} linked</td>
            <td><span class="badge ${data.active ? 'bg-success' : 'bg-secondary'}">${data.active ? 'Active' : 'Hidden'}</span></td>
            <td><button class="btn btn-outline-secondary btn-sm py-0 px-2 copy-pack-btn" title="Copy package summary to clipboard">📋 Copy</button></td>`;

        tr.querySelector(".copy-pack-btn").addEventListener("click", () => {
            const discountLine = (discount !== null && discount > 0)
                ? `\nDiscount: ${discount.toFixed(1)}% off list price`
                : "";
            const summary = [
                `📦 ${data.packName}`,
                `Offered Price: ₹${data.offerPrice}${discountLine}`,
                `Total Services Value: ₹${data.totalAmount}`,
                `Includes: ${serviceCount} service item${serviceCount === 1 ? "" : "s"}`,
                `Status: ${data.active ? "Available for subscription" : "Currently unavailable"}`
            ].join("\n");

            navigator.clipboard.writeText(summary).then(() => {
                const btn = tr.querySelector(".copy-pack-btn");
                btn.textContent = "✅ Copied!";
                btn.classList.replace("btn-outline-secondary", "btn-success");
                setTimeout(() => {
                    btn.textContent = "📋 Copy";
                    btn.classList.replace("btn-success", "btn-outline-secondary");
                }, 2000);
            }).catch(() => {
                alert("Clipboard access was blocked. Please copy manually.");
            });
        });

        return tr;
    });

    {
        const usrQ = query(collection(db, "users"),
            where("ownerUserNo", "==", ownerId));
        const usrSnap = await getDocs(usrQ);
        const usrTbody = document.getElementById("tbl-adm-users");
        if (usrTbody) {
            usrTbody.innerHTML = "";
            usrSnap.forEach(d => {
                const data = d.data();
                const tr = document.createElement("tr");
                tr.innerHTML = `<td>#${data.userNo}</td><td><span class="badge bg-secondary text-uppercase">${data.role}</span></td><td><strong>${data.name}</strong></td><td>${data.email}</td><td><span class="badge ${data.active?'bg-success':'bg-secondary'}">${data.active?'Active Card':'Archived'}</span></td><td>-</td>`;
                usrTbody.appendChild(tr);
            });
        }
    }
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
    await populateSelect("serviceCategories", "cat-select-existing", "catCode", "catName");
    await populateSelect("services", "srv-select-existing", "serviceCode", "serviceName");
    {
        const superSrvQ = query(collection(db, "services"), where("createdBy", "==", "SUPER_USER"));
        const superSrvSnap = await getDocs(superSrvQ);
        const subParentEl = document.getElementById("sub-parent-srv");
        if (subParentEl) {
            subParentEl.innerHTML = `<option value="">-- Choose from Available List --</option>`;
            superSrvSnap.forEach(d => {
                const data = d.data();
                subParentEl.innerHTML += `<option value="${data.serviceCode}">${data.serviceName} (ID: ${data.serviceCode})</option>`;
            });
            subParentEl._allOptions = Array.from(subParentEl.options);
        }
    }
    {
        const packQ = query(collection(db, "commonServicePacks"), where("ownerUserNo", "==", ownerId));
        const packSnap = await getDocs(packQ);
        allotPacksCache.clear();
        const allotSelectEl = document.getElementById("allot-pack-select");
        if (allotSelectEl) {
            allotSelectEl.innerHTML = `<option value="">-- Choose from Available List --</option>`;
            packSnap.forEach(d => {
                const data = d.data();
                allotPacksCache.set(data.packName, data);
                allotSelectEl.innerHTML += `<option value="${data.packName}">${data.packName} (ID: ${data.packName})</option>`;
            });
        }
    }
    await populateSelect("commonServicePacks", "pack-select-existing", "packName", "packName");
    await populateSelect("users", "allot-customer-select", "userNo", "name", "CUSTOMER");
    {
        const _acEl = document.getElementById("allot-customer-select");
        if (_acEl) _acEl._allOptions = Array.from(_acEl.options);
    }
    await populateSelect("users", "utilize-customer-select", "userNo", "name", "CUSTOMER");
    {
        const _ucEl = document.getElementById("utilize-customer-select");
        if (_ucEl) _ucEl._allOptions = Array.from(_ucEl.options);
    }

    const userProfileSelect = document.getElementById("usr-select-existing");
    if (userProfileSelect) {
        const usersQuery = query(collection(db, "users"), where("ownerUserNo", "==", ownerId));
        const usersSnap = await getDocs(usersQuery);
        userProfileSelect.innerHTML = `<option value="">-- Choose from Available List --</option>`;
        usersSnap.forEach(d => {
            const data = d.data();
            userProfileSelect.innerHTML += `<option value="${data.userNo}">${data.name} — ${data.role} (ID: ${data.userNo})</option>`;
        });
    }

    await populateSelect("subServices", "sub-select-existing", "subServiceCode", "subServiceName");
    { const _s = document.getElementById("sub-select-existing"); if (_s) _s._allOptions = Array.from(_s.options); }
    { const _u = document.getElementById("usr-select-existing"); if (_u) _u._allOptions = Array.from(_u.options); }
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
