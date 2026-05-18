/**
 * GlamTrack Telemetry Engine
 * Relays detailed trace analysis dumps via EmailJS directly to the Super User.
 */

// EmailJS Initialization Context Hooks [cite: 149]
const EMAILJS_SERVICE  = 'service_050166';
const EMAILJS_TEMPLATE = 'template_050166';
const EMAILJS_KEY      = 'hWr0F4DVvhcHN3D5v';

// Auto-boot sequence verification binding
if (typeof emailjs !== 'undefined') {
    emailjs.init(EMAILJS_KEY);
}

/**
 * Parses and routes unhandled code execution breaks to the developer.
 */
export async function reportRuntimeCrash(ownerName, activeSessionContext, errorObject) {
    console.error("GlamTrack captured layout error intercept:", errorObject);

    const crashDataDump = {
        errorId: `ERR_LOG_${Date.now()}`,
        salonOwnerName: ownerName || "Unassigned Context",
        userLoginContext: activeSessionContext ? activeSessionContext.role : "Anonymous/Guest Role",
        ownerUserNo: activeSessionContext ? activeSessionContext.ownerUserNo : "N/A",
        errorMessage: errorObject.message || String(errorObject),
        errorStack: errorObject.stack || "No callstack trace generated.",
        timestamp: new Date().toISOString()
    };

    try {
        if (typeof emailjs === 'undefined') {
            console.warn("Telemetry distribution channel unavailable: EmailJS library script not ready.");
            return;
        }

        // Send out trace mail to the Super User 
        await emailjs.send(EMAILJS_SERVICE, EMAILJS_TEMPLATE, {
            subject: `CRITICAL ALERT: System Error generated in ${crashDataDump.salonOwnerName}'s layout`,
            body: `
                System Diagnostics Event Record:
                ----------------------------------------
                Log Reference ID : ${crashDataDump.errorId}
                Salon Name Reference: ${crashDataDump.salonOwnerName}
                Scope User Number: ${crashDataDump.ownerUserNo}
                Active Session View : ${crashDataDump.userLoginContext}
                Incident Timestamp : ${crashDataDump.timestamp}

                Error Description:
                ----------------------------------------
                ${crashDataDump.errorMessage}

                Stack Frame Trace Summary:
                ${crashDataDump.errorStack}
            `
        });
        console.log("Telemetry details successfully routed out to developer.");
    } catch (emailjsNetworkFailure) {
        console.error("Critical Exception: Infrastructure reporting pipeline disrupted.", emailjsNetworkFailure);
    }
}