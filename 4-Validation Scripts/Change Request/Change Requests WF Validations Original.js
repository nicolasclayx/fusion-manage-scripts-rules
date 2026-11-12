// This script is part of the CHANGE MANAGEMENT Template available in the Template Library
// last modification date: Feb 17, 2023

var msg = [];

switch(customTransID) {
    
    case 'SUBMIT_FOR_REVIEW':
        if(item.CHANGE_TEMPLATE === null) msg.push("A change template has to be selected in properties tab before proceeding");
        break;
        
    case 'UPDATE_TASKS':
    case 'INITIATE_TASKS':
        msg = validateTasksPlanning();
        break;
        
    case 'INITIATE_CO_SKIP_CCB':
    case 'SUBMIT_TO_CCB':
        msg = validateTasksPlanningEmpty();
        validateCOStatus();
        break;
        
    case 'RETURN_TO_CR_REVIEW':
        validateCOCancelled();
        break;        
    
}

returnValue(msg);


function validateCOStatus() {
    
    if(item.CHANGE_ORDER === null) {
        
        var elemCO = createItem("WS_CHANGE_ORDERS");
        
        for(var j = 0; j < item.workflowItems.length; j++) {
            var workflowItem = item.workflowItems[j].item;
            try {
                elemCO.workflowItems.addItem({RELATED:workflowItem});
            } catch(error) {
                msg.push('Affected Item ' + workflowItem.descriptor.descriptor + ' is connected to a Change Order already');
            }
        }
    
    
    } else {
        
        var status = item.CHANGE_ORDER.descriptor.workflowState;
        
        if(status !== "Preparation") {
            if(status !== "Perform Change") {
                if(status !== "Results Review") {
                    msg.push("Selected Change Order is not in a valid status");
                }
            }
        }
        
    }
    
}

function validateCOCancelled() {

    if(item.CHANGE_ORDER === null) return;

    if(item.CHANGE_ORDER.descriptor.workflowState !== stateCOCancelled) msg.push('This action is only allowed if the related Change Order has been cancelled');

}