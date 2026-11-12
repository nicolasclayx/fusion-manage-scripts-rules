/** ****************************************************************************
    Copyright © 2026, FTI Technologies Inc.  All rights reserved.
      
    Script Name:                Change Requests WF Validations
    Script type:                Validation
    Description:                Validates Change Request workflow transitions.
**************************************************************************** **/

var msg = [];

switch(customTransID) {
    
    case 'SUBMIT_FOR_REVIEW':
        if(item.CHANGE_TEMPLATE === null) {
            msg.push("A change template has to be selected in properties tab before proceeding.");
        }
        break;
        
    case 'UPDATE_TASKS':
    case 'INITIATE_TASKS':
        if (typeof validateTasksPlanning === 'function') {
            var res = validateTasksPlanning();
            if (res && res.length) msg = msg.concat(res);
        }
        break;
        
    case 'INITIATE_CO_SKIP_CCB':
    case 'SUBMIT_TO_CCB':
    case 'FINAL_APPROVAL':
        if (typeof validateTasksPlanningEmpty === 'function') {
            var resEmpty = validateTasksPlanningEmpty();
            if (resEmpty && resEmpty.length) msg = msg.concat(resEmpty);
        }
        validateCOStatus();
        break;
        
    case 'RETURN_TO_CR_REVIEW':
    case 'REJECT_RETURN':
        validateCOCancelled();
        break;        
    
}

returnValue(msg);

function validateCOStatus() {
    
    // 1. If a Change Order is already connected, verify its workflow state
    if(item.CHANGE_ORDER !== null) {
        var status = (item.CHANGE_ORDER.descriptor) ? item.CHANGE_ORDER.descriptor.workflowState : null;
        if(status && status !== "Preparation" && status !== "Perform Change" && status !== "Results Review") {
            msg.push("Selected Change Order is not in a valid status.");
        }
        return;
    }
    
    // 2. Safely check if any affected item is already linked to another active Change Order
    if (item.workflowItems && item.workflowItems.length > 0) {
        for(var j = 0; j < item.workflowItems.length; j++) {
            var wfItem = item.workflowItems[j];
            if (wfItem && wfItem.item) {
                var affItem = wfItem.item;
                try {
                    if (affItem.CHANGE_ORDER && affItem.CHANGE_ORDER !== null) {
                        msg.push('Affected Item ' + affItem.descriptor.descriptor + ' is connected to another Change Order already.');
                    }
                } catch(e) {
                    // Ignore unpopulated link fields
                }
            }
        }
    }
}

function validateCOCancelled() {
    if(item.CHANGE_ORDER === null) return;
    var cancelledState = (typeof stateCOCancelled !== 'undefined') ? stateCOCancelled : 'Cancelled';
    var status = (item.CHANGE_ORDER.descriptor) ? item.CHANGE_ORDER.descriptor.workflowState : null;
    if(status && status !== cancelledState) {
        msg.push('This action is only allowed if the related Change Order has been cancelled.');
    }
}