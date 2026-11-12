/** ****************************************************************************
    Copyright © 2025, D3 Technologies Inc.  All rights reserved.
      
    Script Name:                Change Orders WF Validations
    Script type:                Validation
    Original Code By/Company:   Team D3
    Creation Date:              06/04/2025
    Description:                
                            
    Imports:                    Change Management Library
                                
    Revisions:  06/04/2025  1.00 Change Orders Enhancements
                07/09/2025  1.01 JB added Designer checklist item
                12/22/2025  1.02 JMP Phase II enhancements 
                01/07/2026  MW 1.05 Phase II updates cont.
                07/08/2026  JP 1.06 Phase II con't - check that item.ACTION_NEEDED empty
**************************************************************************** **/

var msg = [];

if (item.ACTION_NEEDED) msg.push('Resolve all duplicate appover messages in the Action Needed field before proceeding.');

switch(customTransID) {
    case 'INITIATE_TASKS': //Send to Design Node
        break;
    
    case 'TASKS_COMPLETED':  //Send to EIC Review
        if(!item.INTEGRATION_VAULT_READY_FOR_REVIEW){
            msg.push('All Vault items need to be moved to For Review state to move ECO forward.');
        }
        checkFields(item.CAD_DRAWINGS_UPDATED, item.WHERE_USED_COMPLETE, item.STOCK_DISPOSITION_COMPLETE, item.EFFECTIVITY_OF_CHANGE_COMPLETE, item.SET_AFFECTED_ITEMS_TO_IN_REVIEW);
        for (var i in item.workflowItems) {
            if (!item.workflowItems[i].lifecycle) msg.push('All Affected Items must have a Lifecycle selection.');
            break;
        }
        break;
        
    case 'SUBMIT_TO_CCB':
        checkFields(item.ENGINEERING_REVIEW_OF_CHANGE_COMPLETE);
        break;
        
    case 'RETURN_TO_CCB':
        if((item.PROCUREMENT_REVIEW_OF_CHANGE_COMPLETE === 'Yes' && !item.CCB_FEEDBACK_PROCUREMENT) || (item.MANUFACTURING_REVIEW_OF_CHANGE_COMPLETE === 'Yes' && !item.CCB_FEEDBACK_MANUFACTURING) || 
            (item.MATERIALS_REVIEW_OF_CHANGE_COMPLETE === 'Yes' && !item.CCB_FEEDBACK_MATERIALS) || (item.QUALITY_REVIEW_OF_CHANGE_COMPLETE === 'Yes' && !item.CCB_FEEDBACK_QUALITY)) {
                msg.push('All Required CCB Final Approval Feedback boxes must be populated. Feedback boxes for groups marked "NA" need not be populated.');
        }
        break;
        
    case 'PROCUREMENT_REJECT':    
    case 'PROCUREMENT_APPROVE':
        checkFields(item.PROCUREMENT_REVIEW_OF_CHANGE_COMPLETE);
        break;

    case 'OPERATIONS_REJECT':        
    case 'OPERATIONS_APPROVE':
        checkFields(item.MANUFACTURING_REVIEW_OF_CHANGE_COMPLETE);
        break;
        
    case 'MATERIALS_REJECT':        
    case 'MATERIALS_APPROVE':
        checkFields(item.MATERIALS_REVIEW_OF_CHANGE_COMPLETE);
        break;

    case 'QUALITY_REJECT':        
    case 'QUALITY_APPROVE':
        checkFields(item.QUALITY_REVIEW_OF_CHANGE_COMPLETE);
        break;
        
    case 'CANCEL_1':
    case 'CANCEL_2':
    case 'CANCEL_3':  
        if(!item.VAULT_ITEMS_UPDATED_CANCELLATION){
            msg.push('Vault Items Updated for Change Order Cancellation box must be checked to move forward.');
        }
        
}

returnValue(msg);

// Verify the approver has filled their required checklist
function checkFields(){
    for (var i = 0; i < arguments.length; i++){
        if(arguments[i] === "No"){
            msg.push("Please fill out your checklist prior to approval.");
            break;
        }
    }
}
