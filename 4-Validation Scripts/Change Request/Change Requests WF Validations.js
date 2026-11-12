/** ****************************************************************************
    Copyright © 2026, FTI Technologies Inc.  All rights reserved.

    Script Name:                Change Requests WF Validations.js
    Script type:                Validation
    Original Code By/Company:   FTI
    Creation Date:              11/03/2026
    Description:                Validates Change Request workflow transitions.

    Imports:                    Change Management Library

    Revisions:  10/04/2026      NM 1.01 - Initial
**************************************************************************** **/

// This script is part of the CHANGE MANAGEMENT Template available in the Template Library
// Updated validation script for Change Requests

var msg = [];

switch(customTransID) {
    
    case 'SUBMIT_FOR_REVIEW':
        // Enforces selection of a template; comment out if you want to bypass template selection
        if (item.CHANGE_TEMPLATE === null || item.CHANGE_TEMPLATE === undefined) {
            msg.push("A change template has to be selected in properties tab before proceeding");
        }
        
        // Ensure Coordinator is assigned to prevent workflow lock at INITIATE_CO
        if (!item.COORDINATOR || item.COORDINATOR === '' || (typeof item.COORDINATOR === 'object' && !item.COORDINATOR.id && !item.COORDINATOR.dmsID)) {
            msg.push("A Coordinator must be assigned before proceeding.");
        }
        break;
        
    case 'SUBMIT_TO_CCB':
    case 'INITIATE_CO_SKIP_CCB':
        // Review & Impact Analysis Section Validation (Manual Form Fields)
        var disciplines = [
            { name: 'Engineering',  req: item.REQUIRED_1,  done: item.REVIEW_COMPLETED_1 },
            { name: 'Procurement',  req: item.REQUIRED_2,  done: item.REVIEW_COMPLETED_2 },
            { name: 'Operations',   req: item.REQUIRED_3,  done: item.REVIEW_COMPLETED_3 },
            { name: 'Material',     req: item.REQUIRED_4,  done: item.REVIEW_COMPLETED_4 },
            { name: 'Quality',      req: item.REQUIRED_5,  done: item.REVIEW_COMPLETED_5 },
            { name: 'Service',      req: item.REQUIRED_6,  done: item.REVIEW_COMPLETED_6 }
        ];

        for (var d = 0; d < disciplines.length; d++) {
            var dept = disciplines[d];
            if (dept.req === 'Yes' && dept.done !== 'Yes') {
                msg.push('Review & Impact Analysis incomplete: ' + dept.name + ' must be marked "Review Completed = Yes" before submitting to CCB.');
            }
        }

        // Ensure Coordinator is assigned to prevent workflow lock at INITIATE_CO
        if (!item.COORDINATOR || item.COORDINATOR === '' || (typeof item.COORDINATOR === 'object' && !item.COORDINATOR.id && !item.COORDINATOR.dmsID)) {
            msg.push("A Coordinator must be assigned before proceeding.");
        }
        break;
        
    case 'INITIATE_CO':
        // Ensure Coordinator does not initiate CO before all CCB approvers have voted
        if (item.REMAINING_APPROVERS && item.REMAINING_APPROVERS.length > 0) {
            msg.push("Cannot initiate Change Order: All CCB approvers must approve before initiating the CO.");
        }
        break;
        
    case 'RETURN_TO_CR_REVIEW':
        validateCOCancelled();
        break;        
}

returnValue(msg);


/**
 * Validates the linked Change Order status without spawning duplicate records
 */
function validateCOStatus() {
    if(item.CHANGE_ORDER !== null && item.CHANGE_ORDER !== undefined) {
        var status = null;

        // Check directly on item.CHANGE_ORDER first, then fallback to descriptor if present
        if(item.CHANGE_ORDER.workflowState) {
            status = item.CHANGE_ORDER.workflowState;
        } else if(item.CHANGE_ORDER.descriptor && item.CHANGE_ORDER.descriptor.workflowState) {
            status = item.CHANGE_ORDER.descriptor.workflowState;
        }

        if(status && status !== "Preparation" && status !== "Perform Change" && status !== "Results Review") {
            msg.push("Selected Change Order is not in a valid status.");
        }
    }
}


/**
 * Verifies the related Change Order is cancelled
 */
function validateCOCancelled() {
    if(item.CHANGE_ORDER === null || item.CHANGE_ORDER === undefined) return;

    var stateCancelled = "Cancelled";
    var status = null;

    if(item.CHANGE_ORDER.workflowState) {
        status = item.CHANGE_ORDER.workflowState;
    } else if(item.CHANGE_ORDER.descriptor && item.CHANGE_ORDER.descriptor.workflowState) {
        status = item.CHANGE_ORDER.descriptor.workflowState;
    }

    if(status && status !== stateCancelled) {
        msg.push("This action is only allowed if the related Change Order has been cancelled.");
    }
}