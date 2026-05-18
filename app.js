import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { 
    getFirestore, collection, query, where, getDocs, doc, setDoc, onSnapshot, writeBatch 
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { SAMPLE_CATEGORIES, SAMPLE_SERVICES, SAMPLE_SUB_SERVICES } from "./constants.js";
import { reportRuntimeCrash } from "./errorMailer.js";

// 1. Firebase JS SDK Version 9 Configuration Object 
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

// Operational Context Variables
let activeSessionUser = null;
let structuredRealtimeUnsubscribe = null;

// DOM Form Elements Mapping Hook
document.addEventListener("DOMContentLoaded", () => {
    initViewListeners();
    setupFileInputPreview("input-asset-promo-file", "img-element-preview");
});

function initViewListeners() {
    document.getElementById("menu-login-trigger").addEventListener("click", () => switchView("section-login"));
    document.getElementById("menu-home").addEventListener("click", () => switchView("section-home"));
    document.getElementById("menu-dashboard").addEventListener("click", () => switchView("section-dashboard"));
    document.getElementById("menu-logout").addEventListener("click", handleLogoutExecution);
    document.getElementById("login-role").addEventListener("change", handleRoleMenuToggling);
    document.getElementById("btn-submit-auth").addEventListener("click", executeContextAuthentication);
    document.getElementById("btn-autopopulate").addEventListener("click", runAutopopulationRouting);
    document.getElementById("form-allot-pack").addEventListener("submit", processPackageAllotmentForm);
}

function switchView(targetSectionId) {
    ["section-home", "section-login", "section-dashboard"].forEach(id => {
        document.getElementById(id).classList.add("hidden-section");
    });
    document.getElementById(targetSectionId).classList.remove("hidden-section");
}

function handleRoleMenuToggling(e) {
    const passwordGroup = document.getElementById("password-input-group");
    // Super User logs in strictly using Email OTP [cite: 25]
    if (e.target.value === "SUPER_USER") {
        passwordGroup.classList.add("hidden-section");
    } else {
        passwordGroup.classList.remove("hidden-section");
    }
}

// 2. Client-Side Login & Verification Pipeline [cite: 26]
async function executeContextAuthentication() {
    const role = document.getElementById("login-role").value;
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;

    if (!email) return alert("Email parameter required.");

    try {
        if (role === "SUPER_USER") {
            // Emulated Super User login bypass for design framework validation [cite: 25]
            activeSessionUser = { userNo: "0000", role: "SUPER_USER", name: "Developer Admin", ownerUserNo: "000" };
            configureSessionPermissions();
            return;
        }

        // Standard operational validation logic against backend stores [cite: 162]
        const q = query(collection(db, "users"), where("email", "==", email), where("role", "==", role));
        const snapshots = await getDocs(q);

        if (snapshots.empty) return alert("Invalid credentials or matching record not found.");

        const matchedDoc = snapshots.docs[0].data();

        // Rules check enforcement: Start Date, Expiry Date, Active state [cite: 26]
        const currentDateStr = new Date().toISOString().split("T")[0];
        if (matchedDoc.startDate && currentDateStr < matchedDoc.startDate) {
            return alert("Access Denied: Salon operational start window not yet open.");
        }
        if (matchedDoc.expiryDate && currentDateStr > matchedDoc.expiryDate) {
            return alert("Access Denied: Contract lifespan expired.");
        }
        if (!matchedDoc.active) {
            return alert("Access Denied: Account status deactivated.");
        }

        activeSessionUser = matchedDoc;
        configureSessionPermissions();
    } catch (crashError) {
        reportRuntimeCrash(activeSessionUser?.name || "Anonymous", activeSessionUser, crashError);
    }
}

function configureSessionPermissions() {
    document.getElementById("menu-logout").classList.remove("hidden-section");
    document.getElementById("menu-dashboard").classList.remove("hidden-section");
    document.getElementById("menu-login-trigger").classList.add("hidden-section");
    
    document.getElementById("dashboard-salon-identity").innerText = 
        `Scope ID: ${activeSessionUser.ownerUserNo} | Role: ${activeSessionUser.role}`;

    switchView("section-dashboard");
    bindRealtimeSalonDataSync();
}

function handleLogoutExecution() {
    if (structuredRealtimeUnsubscribe) structuredRealtimeUnsubscribe();
    activeSessionUser = null;
    document.getElementById("menu-logout").classList.add("hidden-section");
    document.getElementById("menu-dashboard").classList.add("hidden-section");
    document.getElementById("menu-login-trigger").classList.remove("hidden-section");
    switchView("section-home");
}

// 3. Sequential Increment Code Autopopulate Routine [cite: 41, 45]
async function getHighestNumericalOffset(collectionName, fieldCode) {
    let largestInt = 0;
    const q = query(collection(db, collectionName), where("ownerUserNo", "==", activeSessionUser.ownerUserNo));
    const snapshot = await getDocs(q);
    snapshot.forEach(docSnap => {
        const val = parseInt(docSnap.data()[fieldCode], 10);
        if (!isNaN(val) && val > largestInt) largestInt = val;
    });
    return largestInt;
}

async function runAutopopulationRouting() {
    if (!activeSessionUser) return alert("Session expired.");
    const ownerId = activeSessionUser.ownerUserNo;
    
    try {
        const batch = writeBatch(db);
        const isoDate = new Date().toISOString().split("T")[0];
        const timestamp = new Date().toISOString();

        // Safe dynamic scaling offsets calculated directly on load [cite: 34]
        const catOffset = await getHighestNumericalOffset("serviceCategories", "catCode");
        const srvOffset = await getHighestNumericalOffset("services", "serviceCode");
        const subOffset = await getHighestNumericalOffset("subServices", "subServiceCode");

        const catMap = {}, srvMap = {};

        // Process Category Layout Loops 
        SAMPLE_CATEGORIES.forEach((cat, idx) => {
            const code = String(catOffset + (idx + 1)).padStart(2, "0");
            catMap[cat.catCode] = code;
            const ref = doc(db, "serviceCategories", `${ownerId}_CAT_${code}`);
            batch.set(ref, { 
                ownerUserNo: ownerId, catCode: code, catName: cat.catName, 
                catDescription: cat.catDescription, active: true, createdBy: activeSessionUser.role,
                startDate: isoDate, expiryDate: null, createdAt: timestamp 
            });
        });

        // Process Base Services Mapping 
        SAMPLE_SERVICES.forEach((srv, idx) => {
            const code = String(srvOffset + (idx + 1)).padStart(2, "0");
            srvMap[srv.serviceCode] = code;
            const newCatParent = catMap[srv.catCode] || srv.catCode;
            const ref = doc(db, "services", `${ownerId}_SRV_${code}`);
            batch.set(ref, {
                ownerUserNo: ownerId, serviceCode: code, serviceName: srv.serviceName,
                serviceDescription: srv.serviceDescription, catCode: newCatParent,
                active: true, createdBy: activeSessionUser.role, startDate: isoDate, expiryDate: null, createdAt: timestamp
            });
        });

        // Process Complete Sub-Services Catalog 
        SAMPLE_SUB_SERVICES.forEach((sub, idx) => {
            const code = String(subOffset + (idx + 1)).padStart(3, "0");
            const newSrvParent = srvMap[sub.serviceCode] || sub.serviceCode;
            const ref = doc(db, "subServices", `${ownerId}_SUB_${code}`);
            batch.set(ref, {
                ownerUserNo: ownerId, subServiceCode: code, subServiceName: sub.subServiceName,
                serviceCode: newSrvParent, rate: Number(sub.rate), durationMinutes: Number(sub.durationMinutes),
                active: true, createdBy: activeSessionUser.role, startDate: isoDate, expiryDate: null, createdAt: timestamp
            });
        });

        await batch.commit();
        alert("Success! 7 Categories, 23 Services, and 70 Sub-services populated safely starting after your existing items.");
    } catch (err) {
        reportRuntimeCrash(activeSessionUser.name, activeSessionUser, err);
    }
}

// 4. Live Real-Time Dashboard Synchronization 
function bindRealtimeSalonDataSync() {
    const ownerId = activeSessionUser.ownerUserNo;
    const packsQuery = query(collection(db, "customerServicePacks"), where("ownerUserNo", "==", ownerId));

    structuredRealtimeUnsubscribe = onSnapshot(packsQuery, async (snapshot) => {
        try {
            const packs = [];
            snapshot.forEach(d => packs.push(d.data()));
            
            // Build comparative date baselines for the 10-day filter 
            const totalActive = packs.filter(p => p.active).length;
            document.getElementById("stat-active-customers").innerText = totalActive;

            const today = new Date();
            const limit = new Date();
            limit.setDate(today.getDate() + 10);

            const expiryTbody = document.getElementById("table-body-expiries");
            expiryTbody.innerHTML = "";

            const filteredExpiries = packs.filter(p => {
                if (!p.expiryDate) return false;
                const d = new Date(p.expiryDate);
                return d >= today && d <= limit;
            });

            if (filteredExpiries.length === 0) {
                expiryTbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-2">No packages expiring soon.</td></tr>`;
            } else {
                filteredExpiries.forEach(p => {
                    const tr = document.createElement("tr");
                    tr.innerHTML = `
                        <td><strong>${p.customerNo}</strong></td>
                        <td>${p.packName}</td>
                        <td class="clickable-contact" onclick="navigator.clipboard.writeText('${p.receiptNo || '9999999999'}')">Copy Contact</td>
                        <td><span class="badge bg-danger">${p.expiryDate}</span></td>`;
                    expiryTbody.appendChild(tr);
                });
            }
        } catch (err) {
            reportRuntimeCrash(activeSessionUser.name, activeSessionUser, err);
        }
    });
}

// 5. Date Validation & Data Entry [cite: 158]
async function processPackageAllotmentForm(e) {
    e.preventDefault();
    const custNo = document.getElementById("form-cust-no").value.trim();
    const packType = document.getElementById("form-pack-type").value;
    const start = document.getElementById("form-start-date").value;
    const expiry = document.getElementById("form-expiry-date").value;

    // Preventive validation constraints [cite: 158]
    if (expiry && new Date(start) > new Date(expiry)) {
        return alert("Anachronism Conflict: Package initialization date cannot sit past the expiry envelope boundary.");
    }

    try {
        const generatedPackId = "SP-" + Math.floor(1000 + Math.random() * 9000);
        const docRef = doc(db, "customerServicePacks", `${activeSessionUser.ownerUserNo}_${generatedPackId}`);
        
        await setDoc(docRef, {
            ownerUserNo: activeSessionUser.ownerUserNo,
            customerNo: custNo,
            packName: generatedPackId,
            packType: packType,
            startDate: start,
            expiryDate: expiry || null, // Optional parameter initialization fallback [cite: 159, 160]
            active: true,
            createdAt: new Date().toISOString()
        });

        alert(`Success! Package ${generatedPackId} allotted safely.`);
        document.getElementById("form-allot-pack").reset();
        document.getElementById("img-element-preview").style.display = "none";
    } catch (err) {
        reportRuntimeCrash(activeSessionUser.name, activeSessionUser, err);
    }
}

// 6. Responsive UI Component Management Utility 
function setupFileInputPreview(inputId, imgId) {
    const input = document.getElementById(inputId);
    const img = document.getElementById(imgId);
    if (!input || !img) return;

    input.addEventListener("change", function() {
        const file = this.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                img.src = e.target.result;
                img.style.display = "block";
                img.style.maxWidth = "160px";
                img.style.height = "auto";
            };
            reader.readAsDataURL(file);
        }
    });
}
