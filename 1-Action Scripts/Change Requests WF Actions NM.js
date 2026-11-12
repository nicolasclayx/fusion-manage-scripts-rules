/** ****************************************************************************
    Copyright © 2026, FTI Technologies Inc. All rights reserved.

    Script Name:                Change Requests WF Actions.js
    Script type:                Action
    Original Code By/Company:   FTI
    Creation Date:              10/02/2026
    Description:                Performs actions during Change Request workflow transitions.

    Imports:                    Change Management Library (optional; every call is guarded)

    Revisions:  10/02/2026      NM 1.01 - Initial
                ...             (see prior versions)
                11/07/2026      NM 1.10 - Auto-assign COORDINATOR; seed CHANGE_TEMPLATE/target dates for CO onCreate
                11/07/2026      NM 2.00 - Rewrite:
                                  * Current user resolved via getUserName()/userID (the 'user' variable
                                    is not defined, which silently broke approvals and coordinator)
                                  * Approvers handled with add()/remove() like the library
                                  * initCO(): requires CHANGE_TEMPLATE, tries template as dmsID/descriptor/item,
                                    NO bare createItem fallback, per-field try/catch with logging,
                                    THROWS if the CO cannot be created (transition no longer succeeds
                                    without a CO)
                                  * INITIATE_CO requires an approved CR (toggle: REQUIRE_APPROVAL_FOR_CO)
                11/11/2026      NM 2.01 - Fix RETURN_TO_CR_REVIEW:
                                  "InvalidFieldValueException: Can only set Parts from Parts, DMS IDs, or
                                  Descriptors" was caused by item.CHANGE_ORDER = [] (item-link fields reject
                                  arrays). Added clearLinkField()/clearListField() and used them in
                                  reset(), REJECT_RETURN and returnFromCO().
                
**************************************************************************** **/

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
var CO_WORKSPACE_NAME       = "WS_CHANGE_ORDERS";
var CO_WORKSPACE_ID         = 84;
var REQUIRE_APPROVAL_FOR_CO = true;    // INITIATE_CO only allowed when RESULT = Approved and no approvers remain
var DEFAULT_CO_WINDOW_DAYS  = 30;      // Target release = today + N days when CR has no dates

// Field IDs on the Change Approval Template ("CR Coordinator" / "CR Approvers").
// VERIFY these in Workspace Settings > Change Approval Templates > Item details tab.
// The first ID that exists is used; what was found (or not) is written to the script log.
var TEMPLATE_COORDINATOR_FIELDS = ["CR_COORDINATOR", "COORDINATOR"];
var TEMPLATE_APPROVERS_FIELDS   = ["CR_APPROVERS", "REQUIRED_APPROVERS"];
var CR_APPROVERS_FIELDS         = ["REQUIRED_APPROVERS", "CR_APPROVERS"];  // approver list on the Change Request

// Plain text / picklist fields copied CR -> CO (each copy is individually guarded)
var CO_FIELDS_TO_COPY = [
    "TITLE", "DESCRIPTION", "PRIORITY",
    "CHANGE_REASON", "CHANGE_REASON_CODE",
    "AFFECTED_QUANTITY",
    "RISKS", "ROOT_CAUSE", "ROOT_CAUSE_CODE",
    "SUPPLIER_INVOLVED", "CUSTOMER_IMPACTED", "CUSTOMER_APPROVAL_REQUIRED"
];

// Optional Change Management Library functions (null when the library is not imported)
var LIB = {
    saveCancellationDetails:   (typeof saveCancellationDetails   === 'function') ? saveCancellationDetails   : null,
    cancelChangeTasks:         (typeof cancelChangeTasks         === 'function') ? cancelChangeTasks         : null,
    updateStockSuppliesOrders: (typeof updateStockSuppliesOrders === 'function') ? updateStockSuppliesOrders : null,
    copyTaskTemplate:          (typeof copyTaskTemplate          === 'function') ? copyTaskTemplate          : null,
    setAffectedItems:          (typeof setAffectedItems          === 'function') ? setAffectedItems          : null,
    initiateChangeTasks:       (typeof initiateChangeTasks       === 'function') ? initiateChangeTasks       : null,
    transitionPrecedingProcess:(typeof transitionPrecedingProcess=== 'function') ? transitionPrecedingProcess: null
};

// ---------------------------------------------------------------------------
// Transition handling
// ---------------------------------------------------------------------------
switch (customTransID) {

    case 'START':
        reset();
        assignCoordinatorSafe();
        item.STEP = 1;
        break;

    case 'CANCEL_1':
    case 'CANCEL_2':
    case 'CANCEL_3':
        callIfDefined('saveCancellationDetails');
        callIfDefined('cancelChangeTasks');
        if (!item.CANCELLATION_DATE) saveDateSafe("CANCELLATION_DATE");   // fallback so the bar always shows cancelled
        item.RESULT = "Cancelled";
        item.STEP = 0;
        break;

    case 'RETURN_FROM_REVIEW':      // Review & Impact Analysis -> Create
        item.STEP = 1;
        break;

    case 'SHELVE':                  // Review & Impact Analysis -> Shelved
        item.STEP = -1;
        break;

    case 'REEVALUATE':              // Shelved -> Review & Impact Analysis
        item.STEP = 2;
        break;

    case 'UPDATE_AFFECTED_ITEMS_1':
    case 'UPDATE_AFFECTED_ITEMS_2':
        callIfDefined('updateStockSuppliesOrders');
        break;

    case 'COMPLETE_REVIEW':
        completeReview();
        break;

    case 'SUBMIT_FOR_REVIEW':
        syncFromTemplate(true);
        assignCoordinatorSafe();
        saveDateSafe("SUBMITTAL_DATE");
        setKPIProblemReportSafe();
        callIfDefined('copyTaskTemplate', ["Change Request"]);
        callIfDefined('setAffectedItems');
        item.STEP = 2;
        break;

    case 'REJECT_REQUEST':
        saveDateSafe("REJECTION_DATE");
        item.RESULT = "Rejected";
        break;

    case 'INITIATE_TASKS':
    case 'UPDATE_TASKS':
        callIfDefined('initiateChangeTasks', ["CHANGE_REQUEST"]);
        break;

    case 'INITIATE_CO_SKIP_CCB':
        saveDateSafe("APPROVAL_DATE");
        setKPISafe("CCB_REVIEW_SKIPPED", "Yes");
        item.RESULT = "Approved";
        initCO();
        item.STEP = 4;
        break;

    case 'SUBMIT_TO_CCB':
        submitToCCB();
        break;

    case 'APPROVE':
        saveApprovalSafe("APPROVED_BY", "REMAINING_APPROVERS");
        if (toList(item.REMAINING_APPROVERS).length === 0) {
            saveDateSafe("APPROVAL_DATE");
            try {
                item.RESULT = "Approved";
                println("APPROVE: RESULT is now '" + item.RESULT + "'");
            } catch (eResult) {
                println("Warning: could not set RESULT to 'Approved': " + eResult.message);
            }
        }
        break;

    // Coordinator-initiated CO creation after CCB approval
    case 'INITIATE_CO':
    case 'FINAL_APPROVAL':
        if (REQUIRE_APPROVAL_FOR_CO) {
            // Approval is judged from the approver lists (the real record), not from RESULT.
            var remainingNow = toList(item.REMAINING_APPROVERS).length;
            var approvedNow  = toList(item.APPROVED_BY).length;
            if (remainingNow > 0 || approvedNow === 0 || item.RESULT === "Rejected" || item.RESULT === "Cancelled") {
                throw new Error("Change Order cannot be initiated: the CCB approval is not complete (approved by: "
                    + approvedNow + ", approvers remaining: " + remainingNow + ", result: " + item.RESULT + ").");
            }
        }
        initCO();
        item.STEP = 4;
        break;

    case 'REJECT_RETURN':
        clearListField(item, "APPROVED_BY");
        clearListField(item, "REMAINING_APPROVERS");
        item.STEP = 2;
        break;

    case 'CO_COMPLETED':
        saveDateSafe("COMPLETION_DATE");
        if (item.PROBLEM_REPORT !== null && item.PROBLEM_REPORT !== undefined) {
            callIfDefined('transitionPrecedingProcess',
                ["PROBLEM_REPORT", "CR In Progress", "CR_COMPLETED", "Change Request completed"]);
        }
        item.STEP = 5;
        break;

    case 'RETURN_TO_CR_REVIEW':
        returnFromCO();
        item.STEP = 2;
        break;
}

// ---------------------------------------------------------------------------
// Workflow logic
// ---------------------------------------------------------------------------

function reset() {
    if (item.grid && typeof item.grid.clear === 'function') {
        try { item.grid.clear(); } catch (eGrid) {}
    }

    var pr = item.PROBLEM_REPORT;
    if (pr !== null && pr !== undefined) {
        try {
            if (!pr.CHANGE_REQUEST || pr.CHANGE_REQUEST !== item) resetFieldSafe("PROBLEM_REPORT");
        } catch (ePR) {}
    }

    var toReset = [
        "DESIGN_REVIEW", "CAPA", "PENDING_TASKS_COUNT", "TOTAL_TASKS_COUNT",
        "CHANGE_ORDER", "SUBMITTAL_DATE", "APPROVAL_DATE", "COMPLETION_DATE",
        "CANCELLATION_DATE", "REJECTION_DATE", "TASKS_INITIATED", "CCB_REVIEW_SKIPPED",
        "BASED_ON_PROBLEM_REPORT", "CCB_REVIEW_ROUNDS", "RESULT", "COPIED_TASKS_FROM_TEMPLATE",
        "CANCELLED_IN_STATUS", "CANCELLED_BY", "CANCELLATION_COMMENTS"
    ];
    for (var i = 0; i < toReset.length; i++) resetFieldSafe(toReset[i]);

    var crApprField = crApproversField();
    if (crApprField) clearListField(item, crApprField);
    clearListField(item, "APPROVED_BY");
    clearListField(item, "REMAINING_APPROVERS");
}

function completeReview() {
    var me = getCurrentUserName();
    if (!me) return;

    for (var n = 1; n <= 6; n++) {
        if (item['REQUIRED_' + n] === 'Yes' && sameUser(item['REVIEWER_' + n], me)) {
            item['REVIEW_COMPLETED_' + n] = 'Yes';
        }
    }
}

/**
 * Populate CR coordinator and required approvers from the selected Change Approval Template.
 * force = true overwrites; false only fills approvers/coordinator that are still empty.
 */
function syncFromTemplate(force) {
    var tmpl = item.CHANGE_TEMPLATE;
    if (tmpl === null || tmpl === undefined) {
        println("Notice: CR has no CHANGE_TEMPLATE; coordinator/approvers not populated from template.");
        return;
    }

    try {
        var coordField = firstDefinedField(tmpl, TEMPLATE_COORDINATOR_FIELDS);
        if (!coordField) {
            println("Notice: template has none of " + TEMPLATE_COORDINATOR_FIELDS.join(",") + ". Template fields: " + fieldIds(tmpl));
        } else {
            var coord = tmpl[coordField];
            println("Template coordinator (" + coordField + ") = " + coord);
            if (coord !== null && coord !== "" && (force || toList(item.COORDINATOR).length === 0)) {
                item.COORDINATOR = coord;
            }
        }
    } catch (eCoord) {
        println("Notice: could not set COORDINATOR from template: " + eCoord.message);
    }

    try {
        var tmplApprField = firstDefinedField(tmpl, TEMPLATE_APPROVERS_FIELDS);
        var crApprField   = crApproversField();
        if (!tmplApprField) {
            println("Notice: template has none of " + TEMPLATE_APPROVERS_FIELDS.join(",") + ". Template fields: " + fieldIds(tmpl));
        } else if (!crApprField) {
            println("Notice: CR has none of " + CR_APPROVERS_FIELDS.join(","));
        } else {
            var approvers = toList(tmpl[tmplApprField]);
            println("Template approvers (" + tmplApprField + ") -> CR (" + crApprField + "): " + approvers.join(" | "));
            if (force || toList(item[crApprField]).length === 0) item[crApprField] = approvers;
        }
    } catch (eAppr) {
        println("Notice: could not set approvers from template: " + eAppr.message);
    }
}

function firstDefinedField(obj, ids) {
    for (var i = 0; i < ids.length; i++) {
        if (obj[ids[i]] !== undefined) return ids[i];
    }
    return null;
}

function crApproversField() {
    return firstDefinedField(item, CR_APPROVERS_FIELDS);
}

/** Field IDs of an item, for troubleshooting output only. */
function fieldIds(obj) {
    try { return Object.keys(obj).join(", "); } catch (e) { return "(unavailable)"; }
}

function submitToCCB() {
    syncFromTemplate(false);
    setKPISafe("CCB_REVIEW_SKIPPED", "No");
    setKPIRoundCountSafe('CCB');

    clearListField(item, "APPROVED_BY");
    item.RESULT = null;

    var crApprField = crApproversField();
    var combined = toList(crApprField ? item[crApprField] : null).concat(toList(item.ADDITIONAL_APPROVERS));
    println("SUBMIT_TO_CCB approvers (" + crApprField + " + ADDITIONAL_APPROVERS): " + combined.join(" | "));
    var unique = [];
    for (var i = 0; i < combined.length; i++) {
        if (combined[i] !== null && combined[i] !== undefined && unique.indexOf(combined[i]) === -1) {
            unique.push(combined[i]);
        }
    }

    item.REMAINING_APPROVERS = unique;
    item.STEP = 3;
}

/**
 * Create the Change Order and link it to this Change Request.
 * Throws on failure so the transition does not complete without a CO.
 */
function initCO() {
    println("--- START initCO ---");

    // 1. The CO onCreate script requires CHANGE_TEMPLATE and target dates
    var tmpl = item.CHANGE_TEMPLATE;
    if (tmpl === null || tmpl === undefined) {
        throw new Error("Change Order cannot be created: this Change Request has no Change Template.");
    }

    var today = new Date();
    var defaultRelease = new Date();
    defaultRelease.setDate(today.getDate() + DEFAULT_CO_WINDOW_DAYS);

    var startDate   = item.TARGET_START_DATE   || today;
    var releaseDate = item.TARGET_RELEASE_DATE || defaultRelease;

    // 2. Create the CO (createItem takes the workspace only; field values are set afterwards).
    //    The CO's onCreate script runs when the item is saved, i.e. after this script,
    //    so CHANGE_TEMPLATE and the target dates are in place by then.
    var elemCO = null;
    try {
        elemCO = createItem(CO_WORKSPACE_NAME);
    } catch (eCreate) {
        println("createItem(" + CO_WORKSPACE_NAME + ") failed: " + eCreate.message);
        try {
            elemCO = createItem(CO_WORKSPACE_ID);
        } catch (eCreateId) {
            println("createItem(" + CO_WORKSPACE_ID + ") failed: " + eCreateId.message);
        }
    }

    if (!elemCO) {
        throw new Error("Change Order could not be created. See the script log for details.");
    }

    // 2b. Set the template: try the item itself, then its descriptor, then its dmsID.
    var templateSet = false;
    var variants = [
        { name: "item",       val: tmpl },
        { name: "descriptor", val: tmpl.descriptor },
        { name: "dmsID",      val: idOf(tmpl) }
    ];
    for (var v = 0; v < variants.length && !templateSet; v++) {
        if (variants[v].val === null || variants[v].val === undefined) continue;
        try {
            elemCO.CHANGE_TEMPLATE = variants[v].val;
            templateSet = true;
            println("CO CHANGE_TEMPLATE set (as " + variants[v].name + ")");
        } catch (eTmpl) {
            println("Setting CHANGE_TEMPLATE as " + variants[v].name + " failed: " + eTmpl.message);
        }
    }
    if (!templateSet) {
        throw new Error("Change Order could not be created: its Change Template could not be set. See the script log.");
    }

    try { elemCO.TARGET_START_DATE   = startDate;   } catch (eStart) { println("Notice: TARGET_START_DATE not set: " + eStart.message); }
    try { elemCO.TARGET_RELEASE_DATE = releaseDate; } catch (eRel)   { println("Notice: TARGET_RELEASE_DATE not set: " + eRel.message); }

    println("Change Order created: " + describe(elemCO));

    // 3. CO -> CR link
    linkReference(elemCO, "CHANGE_REQUESTS", item);

    // 4. Effort
    try {
        var effort = getTotalEffort();
        if (effort > 0 && elemCO.TOTAL_EFFORT_OF_CRS !== undefined) elemCO.TOTAL_EFFORT_OF_CRS = effort;
    } catch (eEff) {
        println("Notice: could not set TOTAL_EFFORT_OF_CRS: " + eEff.message);
    }

    // 5. Copy plain fields (each one guarded; a bad field no longer aborts the transition)
    for (var i = 0; i < CO_FIELDS_TO_COPY.length; i++) {
        var f = CO_FIELDS_TO_COPY[i];
        try {
            var val = item[f];
            if (elemCO[f] !== undefined && val !== null && val !== undefined && val !== "" && typeof val !== 'object') {
                elemCO[f] = val;
            }
        } catch (eCopy) {
            println("Notice: could not copy field " + f + ": " + eCopy.message);
        }
    }

    // 6. Affected items
    try {
        if (item.workflowItems && item.workflowItems.length > 0 &&
            elemCO.workflowItems && typeof elemCO.workflowItems.addItem === 'function') {
            for (var j = 0; j < item.workflowItems.length; j++) {
                var related = item.workflowItems[j] ? item.workflowItems[j].item : null;
                if (!related) continue;
                try {
                    elemCO.workflowItems.addItem({ RELATED: related });
                } catch (eItem) {
                    try {
                        elemCO.workflowItems.addItem({ RELATED: related.descriptor });
                    } catch (eItem2) {
                        println("Notice: could not link affected item " + j + ": " + eItem2.message);
                    }
                }
            }
        }
    } catch (eWF) {
        println("Notice: affected items skipped: " + eWF.message);
    }

    // 7. CR -> CO link (multi-select safe: append, never overwrite)
    linkReference(item, "CHANGE_ORDER", elemCO);

    // 8. Project task (optional)
    try {
        if (item.project && typeof item.project.addTask === 'function') item.project.addTask(elemCO);
    } catch (eTask) {
        println("Notice: could not add CO to project: " + eTask.message);
    }

    println("--- END initCO ---");
}

function getTotalEffort() {
    var result = 0;
    for (var i = 1; i <= 6; i++) {
        var val = item['EFFORT_' + i];
        if (val !== null && val !== undefined && !isNaN(val)) result += Number(val);
    }
    return result;
}

function returnFromCO() {
    var cos = toList(item.CHANGE_ORDER);

    // Unlink this CR from each CO first (while the CR -> CO link still exists)
    for (var k = 0; k < cos.length; k++) {
        var co = cos[k];
        if (!co) continue;
        try {
            var field = co.CHANGE_REQUESTS;
            if (field && typeof field.remove === 'function') {
                field.remove(item);
            } else if (field) {
                var keep = [];
                var list = toList(field);
                for (var i = 0; i < list.length; i++) {
                    if (idOf(list[i]) !== idOf(item)) keep.push(list[i]);
                }
                if (keep.length > 0) {
                    co.CHANGE_REQUESTS = keep;
                } else {
                    // Link fields reject [] -> clear them with null instead
                    co.CHANGE_REQUESTS = null;
                }
            }
        } catch (e) {
            println("Notice: could not unlink CR from " + describe(co) + ": " + e.message);
        }
    }

    item.APPROVAL_DATE = null;
    clearLinkField(item, "CHANGE_ORDER");      // was: item.CHANGE_ORDER = []  (caused the exception)
    clearListField(item, "APPROVED_BY");
    clearListField(item, "REMAINING_APPROVERS");
    item.RESULT = null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Clear an item-link field. Link fields only accept an item, a DMS ID or a descriptor,
 * so assigning [] throws "Can only set Parts from Parts, DMS IDs, or Descriptors".
 * Multi-select links are emptied entry by entry; single links are set to null.
 */
function clearLinkField(target, fieldId) {
    try {
        var field = target[fieldId];
        if (field === null || field === undefined) return;
        if (typeof field.remove === 'function') {
            var list = toList(field);
            for (var i = list.length - 1; i >= 0; i--) field.remove(list[i]);
        } else {
            target[fieldId] = null;
        }
    } catch (e) {
        println("Notice: could not clear " + fieldId + ": " + e.message);
    }
}

/**
 * Clear a list field (e.g. user pick lists). Tries the plain [] assignment first and
 * falls back to clearLinkField() if the field turns out to be an item link.
 */
function clearListField(target, fieldId) {
    try {
        if (target[fieldId] === undefined) return;
        target[fieldId] = [];
    } catch (e) {
        clearLinkField(target, fieldId);
    }
}

/** Call a Change Management Library function if it exists; log (not swallow) any error. */
function callIfDefined(fnName, args) {
    var fn = LIB[fnName];
    if (!fn) return;
    try {
        fn.apply(null, args || []);
    } catch (e) {
        println("Notice: " + fnName + " failed: " + e.message);
    }
}

/** Current user as "Last, First" (the format used by the approver fields). */
function getCurrentUserName() {
    try {
        if (typeof getUserName === 'function') return getUserName();
        var usr = Security.loadUser(userID);
        return usr.lastName + ", " + usr.firstName;
    } catch (e) {
        println("Notice: could not resolve current user: " + e.message);
        return null;
    }
}

function sameUser(fieldValue, name) {
    if (fieldValue === null || fieldValue === undefined) return false;
    return String(fieldValue) === String(name);
}

/** Normalize a field value (null, scalar, array or Fusion collection) to a plain array. */
function toList(value) {
    var out = [];
    if (value === null || value === undefined) return out;
    if (typeof value === 'string' || typeof value.length !== 'number') {
        out.push(value);
        return out;
    }
    for (var i = 0; i < value.length; i++) out.push(value[i]);
    return out;
}

function idOf(obj) {
    if (obj === null || obj === undefined) return null;
    if (obj.dmsID !== undefined && obj.dmsID !== null) return obj.dmsID;
    if (obj.descriptor && obj.descriptor.dmsID !== undefined) return obj.descriptor.dmsID;
    return null;
}

function describe(obj) {
    try {
        if (obj && obj.descriptor && obj.descriptor.descriptor) return obj.descriptor.descriptor;
        var id = idOf(obj);
        return id !== null ? String(id) : "(new item)";
    } catch (e) {
        return "(unknown)";
    }
}

/**
 * Add a reference to a link field without overwriting existing entries.
 * Tries, in order: collection.add(), assigning the item, assigning an array of items.
 */
function linkReference(target, fieldId, ref) {
    var field = null;
    try { field = target[fieldId]; } catch (eRead) {}

    // Already linked?
    var existing = toList(field);
    for (var i = 0; i < existing.length; i++) {
        if (idOf(existing[i]) !== null && idOf(existing[i]) === idOf(ref)) return true;
    }

    if (field && typeof field.add === 'function') {
        try { field.add(ref); return true; } catch (eAdd) {
            println("Notice: " + fieldId + ".add failed: " + eAdd.message);
        }
    }

    try { target[fieldId] = ref; return true; } catch (eSingle) {
        println("Notice: assigning " + fieldId + " as item failed: " + eSingle.message);
    }

    try {
        target[fieldId] = existing.concat([ref]);
        return true;
    } catch (eArr) {
        println("Warning: could not link " + fieldId + ": " + eArr.message);
    }
    return false;
}

function assignCoordinatorSafe() {
    try {
        if (toList(item.COORDINATOR).length === 0) {
            var me = getCurrentUserName();
            if (me) item.COORDINATOR = me;
        }
    } catch (e) {
        println("Notice: could not assign COORDINATOR: " + e.message);
    }
}

function saveApprovalSafe(approvedByField, remainingField) {
    var me = getCurrentUserName();
    if (!me) return;

    try {
        var approved = toList(item[approvedByField]);
        if (approved.indexOf(me) === -1) item[approvedByField].add(me);

        var remaining = toList(item[remainingField]);
        if (remaining.indexOf(me) !== -1) item[remainingField].remove(me);
    } catch (e) {
        println("Warning: could not record approval for " + me + ": " + e.message);
    }
}

function saveDateSafe(fieldID) {
    try { if (item[fieldID] !== undefined) item[fieldID] = new Date(); } catch (e) {}
}

function setKPISafe(fieldID, value) {
    try { if (item[fieldID] !== undefined && item[fieldID] !== value) item[fieldID] = value; } catch (e) {}
}

function setKPIProblemReportSafe() {
    try {
        if (item.BASED_ON_PROBLEM_REPORT !== undefined) {
            var v = (item.PROBLEM_REPORT === null || item.PROBLEM_REPORT === undefined) ? "No" : "Yes";
            if (item.BASED_ON_PROBLEM_REPORT !== v) item.BASED_ON_PROBLEM_REPORT = v;
        }
    } catch (e) {}
}

function setKPIRoundCountSafe(roundType) {
    try {
        if (roundType === 'CCB' && item.CCB_REVIEW_ROUNDS !== undefined) {
            item.CCB_REVIEW_ROUNDS = (item.CCB_REVIEW_ROUNDS || 0) + 1;
        }
    } catch (e) {}
}

function resetFieldSafe(fieldID) {
    try { if (item[fieldID] !== undefined) item[fieldID] = null; } catch (e) {}
}