/** ****************************************************************************
    Copyright © 2025, D3 Technologies Inc.  All rights reserved.
      
    Script Name:                Change Requests WF Actions
    Script type:                Action
    Original Code By/Company:   Autodesk
    Creation Date:              09/27/2023
    Description:                This script is provided by CHANGE MANAGEMENT available in the Template Library
                            
    Imports:                    Change Management Library
                                
    Revisions:  05/06/2025  1.00 JMP  added CANCEL_# & RETURN_TO_CR_REVIEW transitions
                
**************************************************************************** **/
// This script is part of the CHANGE MANAGEMENT Template available in the Template Library
// Last Modification Date : 27. September, 2023

switch(customTransID) {
    
    case 'START':
        reset();
        item.STEP = 1;
        break;
        
    case 'CANCEL_1':
    case 'CANCEL_2':
    case 'CANCEL_3':
        saveCancellationDetails();
        cancelChangeTasks();
        item.RESULT = "Cancelled";
        item.STEP = 0;
        break;

    case 'UPDATE_AFFECTED_ITEMS_1':
    case 'UPDATE_AFFECTED_ITEMS_2':
        updateStockSuppliesOrders();
        break;

    case 'SUBMIT_FOR_REVIEW':
        saveDate("SUBMITTAL_DATE");
        setKPIProblemReport();
        copyTaskTemplate("Change Request");
        setAffectedItems();
        item.STEP = 2;
        break;

    case 'REJECT_REQUEST':
        saveDate("REJECTION_DATE");
        item.RESULT = "Rejected";
        break;
        
    case 'INITIATE_TASKS':
    case 'UPDATE_TASKS':
        initiateChangeTasks("CHANGE_REQUEST");
        break;
        
    case 'INITIATE_CO_SKIP_CCB':
        saveDate("APPROVAL_DATE");
        setKPI("CCB_REVIEW_SKIPPED", "Yes");
        item.RESULT = "Approved";
        initCO();
        item.STEP = 4;
        break;
        
case 'SUBMIT_TO_CCB':
        setKPI("CCB_REVIEW_SKIPPED", "No");
        setKPIRoundCount('CCB');
        
        // Clear previous approval status & votes upon submission to CCB
        item.APPROVED_BY = [];
        item.RESULT = null;
        
        setRemainingApprovers("REQUIRED_APPROVERS", "ADDITIONAL_APPROVERS", "REMAINING_APPROVERS");
        
        // Deduplicate REMAINING_APPROVERS array
        if (item.REMAINING_APPROVERS && item.REMAINING_APPROVERS.length > 0) {
            var uniqueApprovers = [];
            for (var i = 0; i < item.REMAINING_APPROVERS.length; i++) {
                var app = item.REMAINING_APPROVERS[i];
                var exists = false;
                for (var j = 0; j < uniqueApprovers.length; j++) {
                    if (uniqueApprovers[j] === app) {
                        exists = true;
                        break;
                    }
                }
                if (!exists) uniqueApprovers.push(app);
            }
            item.REMAINING_APPROVERS = uniqueApprovers;
        }
        
        item.STEP = 3;
        break;
    
    case 'APPROVE':
        saveApproval("APPROVED_BY", "REMAINING_APPROVERS");
        autoTransition("REMAINING_APPROVERS", "FINAL_APPROVAL", "CCB approval done");
        if(item.REMAINING_APPROVERS.length === 1) {
            saveDate("APPROVAL_DATE");
            item.RESULT = "Approved";
            item.STEP = 4;
            initCO();
        }
        break;

    case 'REJECT_RETURN':
        item.APPROVED_BY = [];
        item.REMAINING_APPROVERS = [];
        item.STEP = 2;
        break;
        
    case 'CO_COMPLETED':
        saveDate("COMPLETION_DATE");
        transitionPrecedingProcess("PROBLEM_REPORT", "CR In Progress", "CR_COMPLETED", "Change Request completed");
        item.STEP = 5;
        break;
        
    case 'RETURN_TO_CR_REVIEW':
        returnFromCO();
        item.STEP = 2;
        break;        
    
}

// reset relevant fields upon creation (/cloning)
function reset() {
    
    item.grid.clear();
    
    var pr = item.PROBLEM_REPORT;
    
    if(pr !== null) {
        if(pr.CHANGE_REQUEST !== item) {
            resetField("PROBLEM_REPORT");
        }
    }
    
    resetField("DESIGN_REVIEW");
    resetField("CAPA");
    
    resetField("PENDING_TASKS_COUNT");
    resetField("TOTAL_TASKS_COUNT");
    
    item.REQUIRED_APPROVERS = [];
    item.APPROVED_BY = [];
    item.REMAINING_APPROVERS = [];
    
    resetField("CHANGE_ORDER");
    
    resetField("SUBMITTAL_DATE");
    resetField("APPROVAL_DATE");
    resetField("COMPLETION_DATE");
    resetField("CANCELLATION_DATE");  
    resetField("REJECTION_DATE");  
    
    resetField("TASKS_INITIATED");
    resetField("CCB_REVIEW_SKIPPED");
    resetField("BASED_ON_PROBLEM_REPORT");
    resetField("CCB_REVIEW_ROUNDS");
    resetField("RESULT");
    
    resetField("COPIED_TASKS_FROM_TEMPLATE");
    
    resetField('CANCELLED_IN_STATUS');  
    resetField('CANCELLED_BY');  
    resetField('CANCELLATION_DATE');  
    resetField('CANCELLATION_COMMENTS');  

    if(item.STEP !== null) {
        resetField("DESIGN_REVIEW");
        resetField("CAPA");
        resetField("CHANGE_ORDER");
    }    
    
}


// various functions to set KPIs of Change Requests
function setKPI(fieldID, value) {
    if(item[fieldID] !== value) item[fieldID] = value;
}
function setKPIProblemReport() {
    
    var basedOnPR = (item.PROBLEM_REPORT === null) ? "No" : "Yes";
    if(item.BASED_ON_PROBLEM_REPORT !== basedOnPR) item.BASED_ON_PROBLEM_REPORT = basedOnPR;
    
}


// create & connect Change Order if no Change Order has been selected
function initCO() {
    
    var fieldsCommon = "TITLE,DESCRIPTION,CHANGE_TEMPLATE,PRIORITY,CHANGE_REASON,CHANGE_REASON_CODE,AFFECTED_PRODUCT,AFFECTED_ITEM,AFFECTED_QUANTITY,RISKS,ROOT_CAUSE,ROOT_CAUSE_CODE,SUPPLIER_INVOLVED,CUSTOMER_IMPACTED,CUSTOMER_APPROVAL_REQUIRED";
    var fieldsToCopy = fieldsCommon.split(",");
    var elemCO       = item.CHANGE_ORDER;
    var effort       = getTotalEffort();
    
    if(item.CHANGE_ORDER === null) {
        
        elemCO = createItem("WS_CHANGE_ORDERS");
        elemCO.CHANGE_REQUESTS = [item];
        elemCO.TOTAL_EFFORT_OF_CRS = effort;
        //elemCO.CHANGE_TEMPLATE = item.CHANGE_TEMPLATE;
        
        for(var i = 0; i < fieldsToCopy.length; i++) {
            elemCO[fieldsToCopy[i]] = item[fieldsToCopy[i]];
        }
        
        for(var j = 0; j < item.workflowItems.length; j++) {
            var workflowItem = item.workflowItems[j].item;
            elemCO.workflowItems.addItem({RELATED:workflowItem});
        }
        
        item.CHANGE_ORDER = elemCO;
        
    } else {
        
        elemCO.CHANGE_REQUESTS.add(item);
        elemCO.TOTAL_EFFORT_OF_CRS = elemCO.TOTAL_EFFORT_OF_CRS + effort;
        
    }
    
    item.project.addTask(elemCO);
    
}
function getTotalEffort() {
    
    var result = 0;
    
    if(item.EFFORT_1 !== null) result += item.EFFORT_1;
    if(item.EFFORT_2 !== null) result += item.EFFORT_2;
    if(item.EFFORT_3 !== null) result += item.EFFORT_3;
    if(item.EFFORT_4 !== null) result += item.EFFORT_4;
    if(item.EFFORT_5 !== null) result += item.EFFORT_5;
    
    return result;
    
}

function returnFromCO() {

    item.APPROVAL_DATE       = null;
    item.APPROVED_BY         = [];
    item.REMAINING_APPROVERS = [];
    item.CHANGE_ORDER        = null;
    item.RESULT              = null;

}