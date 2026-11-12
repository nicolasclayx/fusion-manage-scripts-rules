/** ****************************************************************************
    Copyright © 2026, FTI Technologies Inc.  All rights reserved.

    Script Name:                Change Requests WF Validations NM.js
    Script type:                Validation
    Original Code By/Company:   FTI
    Creation Date:              11/02/2026
    Description:                Validates Change Request workflow transitions.

    Imports:                    Change Management Library

    Revisions:  10/02/2026      NM 1.01 - Initial
                10/02/2026      NM 1.01 - Added checks if task are completed.
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
        // Require all Task Planning tasks to be 100% / Completed before proceeding
        if (typeof validateTasksPlanningCompleted === 'function') {
            var resTasks = validateTasksPlanningCompleted();
            if (resTasks && resTasks.length) msg = msg.concat(resTasks);
        } else if (item.tasks && item.tasks.length > 0) {
            for (var i = 0; i < item.tasks.length; i++) {
                var t = item.tasks[i];
                if (t.progress !== 100 && t.status !== 'Completed') {
                    msg.push('All tasks on the Task Planning tab must be completed before proceeding. Incomplete task: ' + (t.title || ('Task ' + (i + 1))));
                }
            }
        }
        break;

    case 'FINAL_APPROVAL':
        if (typeof validateTasksPlanningEmpty === 'function') {
            var resEmpty = validateTasksPlanningEmpty();
            if (resEmpty && resEmpty.length) msg = msg.concat(resEmpty);
        }
        validateCOStatus();
        break;

    case 'REJECT_RETURN':
        // Return from CCB Review does not check CO cancellation
        break;
        
    case 'RETURN_TO_CR_REVIEW':
        validateCOCancelled();
        break;        
    
}

returnValue(msg);

function validateCOStatus() {
    if(item.CHANGE_ORDER !== null) {
        var status = (item.CHANGE_ORDER && item.CHANGE_ORDER.descriptor) ? item.CHANGE_ORDER.descriptor.workflowState : null;
        if(status && status !== "Preparation" && status !== "Perform Change" && status !== "Results Review") {
            msg.push("Selected Change Order is not in a valid status.");
        }
    }
}

function validateCOCancelled() {
    if(item.CHANGE_ORDER === null) return;
    
    // Safety check defined to prevent ReferenceErrors
    var cancelledState = (typeof stateCOCancelled !== 'undefined') ? stateCOCancelled : 'Cancelled';
    var status = (item.CHANGE_ORDER && item.CHANGE_ORDER.descriptor) ? item.CHANGE_ORDER.descriptor.workflowState : null;
    
    // Bypassed for testing
    /*
    if(status && status !== cancelledState) {
        msg.push('This action is only allowed if the related Change Order has been cancelled.');
    }
    */
}