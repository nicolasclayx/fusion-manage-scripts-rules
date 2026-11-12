/** ****************************************************************************
    Copyright © 2026, FTI Technologies Inc.  All rights reserved.
      
    Script Name:                Change Management Library
    Script type:                Library
    Original Code By/Company:   Autodesk
    Creation Date:              Oct 07, 2026
    Description:                This script is provided by CHANGE MANAGEMENT available in the Template Library
                       
    Imports:                    Global Tenant Variables
                                getUserName
                                
    Revisions:  10/07/2026 Initial
**************************************************************************** **/

// This script is provided by CHANGE MANAGEMENT available in the Template Library
// Last Modification Date : A Oct 07, 2026

var workspaceCAPA   = "WS_CORRECTIVE_PREVENTATIVE_ACTIONS";         // Provide workpace name of CAPA to initiate followup proceses from Problem Reports. Otherwise leave blank.
var linkCAPA        = "PROBLEM_REPORT";                             // Provide FieldID of link from CAPA to Problem Report
var fieldsCAPA      = ["TITLE", "DESCRIPTION"];                     // Provide list of fields to be copied from Problem Report to CAPA
var sites           = ['Lyon', 'Birmingham', 'Mannheim', 'Mexico', 'Beijing'];  // Manufacturing sites to simulate ERP data retrieval of produciton orders

var fieldIdMakeBuy  = 'MAKE_OR_BUY';       // Field to be used for Affected Items update
var fieldIdUnitCost = 'UNIT_COST';         // Field to be used for Affected Items update with simulation of Stock value
var fieldIdEstCost  = 'ESTIMATED_COST';    // Field to be used for Affected Items update with simulation of Stock value (if unit cost is not defined, this field will be used instead)
var transCRSubmit   = 'SUBMIT_FOR_REVIEW'; // ID of transition to be performed when triggering a CR from a PR to initiate its processing
var stateTaskCancelled = 'Cancelled';         // Status name of Change Tasks when being cancelled
var stateCOCancelled   = 'Cancelled';         // Status name of Change Order when being cancelled (enables return of CR to review)

var tenant = globals.TenantName;

var transitionsTaskCancellation = [
    // When change processes get cancelled, the status of related change tasks will be compared against this list
    // if a matching status name is found, the defined workflow transition will be performed
    { state : 'Planned' , transition : 'CANCEL_1' },
    { state : 'Assigned', transition : 'CANCEL_2' },
    { state : 'In Work' , transition : 'CANCEL_3' },
    { state : 'Review'  , transition : 'CANCEL_4' },
    { state : 'On Hold' , transition : 'CANCEL_5' }
];


/* Empty function being invoked by Change Order valildation script before submittig to CCB
   Please add your business logic here */
function validateAffectedItems() {

    // If certain conditions are not valid, add the given message to the array msg like this:
    // msg.push('Some items are missing attachments');

}


/* Get ERP details for each affected item */
function updateStockSuppliesOrders() {
    
    // This function generates random demo data to validate the given feature
    // It should be replaced with a real ERP connection for production environments.

    for(var i = 0; i < item.workflowItems.length; i++) {
        
        var managedItem = item.workflowItems[i];
        var relatedItem = item.workflowItems[i].item;
        var makeOrBuy   = (relatedItem[fieldIdMakeBuy] === null) ? '' : relatedItem[fieldIdMakeBuy];
        var hasSupplies = ((relatedItem.PENDING_PACKAGES !== null) && (relatedItem.PENDING_PACKAGES.length > 0));

        var hasStock    = (Math.random() > 0.5);
        var hasPO       = (Math.random() > 0.5);
																									
																												
        
        managedItem.MAKE_OR_BUY         = makeOrBuy;
        managedItem.PENDING_SUPPLIES    = hasSupplies;
        managedItem.LAST_UPDATE_BY_ERP  = new Date();

        if(relatedItem.descriptor.revisionList.length === 1) {
            hasStock = false;
            hasPO    = false;
        }        

        if(hasStock) {
            
            var unitCost = relatedItem[fieldIdUnitCost];
            var stockQty = Math.random() * 100;
                stockQty = Math.round(stockQty) * 100;
            
            managedItem.STOCK_QUANTITY = stockQty;
            
            if(unitCost === null) unitCost = relatedItem[fieldIdEstCost];
            if(unitCost !== null) managedItem.STOCK_VALUE = stockQty * unitCost;
            
        } else {
            
            managedItem.STOCK_QUANTITY = 0;
            managedItem.STOCK_VALUE    = 0;
            
        }

        if(hasPO) {
            
            var poQty   = Math.random() * 100;
            var offset  = Math.floor(Math.random() * 90);
            var date    = new Date();
            var orders  = [];
            
            date.setDate(date.getDate() + offset);
            poQty = Math.round(poQty) * 100;
            
            managedItem.PENDING_POS         = true;
            managedItem.NEXT_PO_QUANTITY    = poQty;
            managedItem.NEXT_PO_DATE        = date;

            if(sites.length === 0) {

                managedItem.PO_DATA = [];

            } else {

                var site = Math.floor(Math.random() * sites.length);
							   
							  
									 
						   
			   
            
                orders.push({
                    id     : 'PO' + Math.floor(Math.random() * 100000),
                    qty    : poQty,
                    date   : date,
                    site   : sites[site],
                    action : ''
                });
                
                addProductionOrder(orders, sites, offset);
                managedItem.PO_DATA = JSON.stringify(orders);

            }
            
        } else {
            
            managedItem.PENDING_POS         = false;
            managedItem.NEXT_PO_QUANTITY    = null;
            managedItem.NEXT_PO_DATE        = null;
            managedItem.PO_DATA             = [];
            
        }
		
    }
    
}
function addProductionOrder(orders, sites, offsetBase) {
    
    var hasPO = (Math.random() > 0.5);
    
    if(hasPO) {
        
        var poQty   = Math.random() * 100;
        var offset  = Math.floor(Math.random() * 90) + offsetBase;
        var date    = new Date();
        var site    = Math.floor(Math.random() * sites.length);
            
        poQty = Math.round(poQty) * 100;
        date.setDate(date.getDate() + offset);
        
        orders.push({
            id     : 'PO' + Math.floor(Math.random() * 100000),
            qty    : poQty,
            date   : date,
            site   : sites[site],
            action : ''
        });
        
        addProductionOrder(orders, sites, offset);
        
    }
    
}


/* Clear item details fields */
function resetField(fieldId) {
    
    if(item[fieldId] !== null) item[fieldId] = null;
    
}


/* Copy affected item selected in item details tab to list of affected items */
function setAffectedItems() {

    var affectedItem = item.AFFECTED_ITEM;

    // Check if affectedItem or its descriptor is null or undefined
    if (!affectedItem || !affectedItem.descriptor) return;
    if (item.workflowItems.length > 0) return;

    // Check if descriptor.dvi exists before checking .working
    if (affectedItem.descriptor.dvi && affectedItem.descriptor.dvi.working) {

        item.workflowItems.addItem({ RELATED: affectedItem });

    } else if (affectedItem.descriptor.revisionList) {

        for (var i in affectedItem.descriptor.revisionList) {
            var itemRevision = affectedItem.descriptor.revisionList[i];
            if (itemRevision && itemRevision.working) {
                var workingItem = loadItem(itemRevision.dmsID);
                if (workingItem) {
                    item.workflowItems.addItem({ RELATED: workingItem });
                }
                return;
            }
        }

    }
}


/* Create, update or delete defined milestone */
function setMilestone(name, event, date, offset, threshold, progress, deleteIfEmpty) {
    
    var milestoneIndex  = -1;
    var offsetSat       = (date === null) ? 2 : 2;
    var offsetSun       = (date === null) ? 1 : 1;
    var targetDate      = new Date();
    
    if(         date !== null) { targetDate = date; } else if(offset !== null) { targetDate.setDate(targetDate.getDate() + offset); } 
    if(        event === null) event         = "ENTER";
    if(    threshold === null) threshold     = 0;
    if(deleteIfEmpty === null) deleteIfEmpty = true;
    
    var day = targetDate.getDay();
    
         if(day === 0) targetDate.setDate(targetDate.getDate() + offsetSun);
    else if(day === 6) targetDate.setDate(targetDate.getDate() + offsetSat);

    for(var i = 0; i < item.milestones.length; i++) {
        if(item.milestones[i].workflowStateName == name) {
            if(item.milestones[i].milestoneType == event) {
                milestoneIndex = i;
                break;
            }
        }
    }
    
    if(deleteIfEmpty) {
        if (date === null) {
            if (offset === null) {
                if(milestoneIndex > -1) {
                    item.milestones.splice(milestoneIndex, 1);
                }
                return;
            }
        }
    }

    if(milestoneIndex == -1) {
        
		var milestone = item.addMilestone();
		    milestone.setWorkflowState(name);
		    milestone.milestoneType = event;
		    milestone.milestoneDate = targetDate;
		    milestone.warnThreshold = threshold;
            milestone.progress      = progress;
        
    } else {
        
        item.milestones[milestoneIndex].milestoneDate = targetDate;
        item.milestones[milestoneIndex].progress = progress;
        
    }
    
}


/* Save current date in defined field */
function saveDate(field) {
    
    if(item[field] === null) item[field] = new Date();
    
}


// Set responsibilities based on selected approval list template
function setCoordinator(fieldIdSource, setOwner) {
    
    if(item.CHANGE_TEMPLATE === null) item.COORDINATOR = null;
    else if(item.CHANGE_TEMPLATE[fieldIdSource] === null) item.COORDINATOR = null;
    else if(item.COORDINATOR !== item.CHANGE_TEMPLATE[fieldIdSource]) {
     
        var coordinator     = item.CHANGE_TEMPLATE[fieldIdSource];
        
        item.COORDINATOR = coordinator;
        
        if(setOwner) {
        
            var userSelected    = coordinator.split(",");
    	    var lastName        = userSelected[0].trim();
    	    var firstName       = userSelected[1].trim();
            var user            = Security.searchUsers({lastName:lastName, firstName:firstName}); 
    		            
    	    if(user !== null) {
    	        var userId = user[0].id;
    	        if(item.master.owner.id !== userId) {
    	            item.master.owner = Security.loadUser(userId);
    	        }
    	    }
     
        }
        
    }
    
}


// Sync user pick list with user list define in change template
function setUserList(fieldSource, fieldTarget) {

    if(item.CHANGE_TEMPLATE === null) {
        
        item[fieldTarget] = [];
        
    } else {

        var source = item.CHANGE_TEMPLATE[fieldSource];

        for(var i = 0; i < source.length; i++) {
        
            var sourceUser = source[i];
            var add       = true;
            
            for(var j = 0; j < item[fieldTarget].length; j++) {
                var targetUser = item[fieldTarget][j];
                if(sourceUser === targetUser) {
                    add = false;
                    continue;
                }
            }
                
            if(add) item[fieldTarget].add(sourceUser);
            
        }
        
        if(source.length !== item[fieldTarget].length) cleanupUsersList(source, fieldTarget);
    
    }
    
}
function cleanupUsersList(source, fieldTarget) {
    
    for(var i =  item[fieldTarget].length - 1; i >= 0; i--) {
            
        var targetUser = item[fieldTarget][i];
        var remove   = true;
        
        for(var j = 0; j < source.length; j++) {
            var sourceUser = source[j];
            if(targetUser === sourceUser) {
                remove = false;
                continue;
            }
        }
            
        if(remove) item[fieldTarget].remove(item[fieldTarget][i]);
        
    }
    
}


// Set remaining approvers baesed on required & additional approvers
function setRemainingApprovers(fieldRequiredApprovers, fieldRemainingApprovers) {
    
    var approvers = [];
    
    for(var j = 0; j < item[fieldRequiredApprovers].length; j++) {
        
        var required = item[fieldRequiredApprovers][j];
        if(approvers.indexOf(required) === -1) approvers.push(required);
        
    }
    
    syncUserList(approvers, fieldRemainingApprovers);
    
}
function syncUserList(source, fieldTarget) {

    for(var i = 0; i < source.length; i++) {
        item[fieldTarget].add(source[i]);
    }
    
}
// Set remaining approvers baesed on required & additional approvers
function setRemainingApproversECO(fieldRequiredApprovers, fieldRemainingApprovers, fieldAdditionalApprovers) {
    
    var approvers = [];
    
    for(var j = 0; j < item[fieldRequiredApprovers].length; j++) {
        
        var required = item[fieldRequiredApprovers][j];
        if(approvers.indexOf(required) === -1) approvers.push(required);
        
    }
    
    if (fieldAdditionalApprovers) {
        for(var k = 0; k < item[fieldAdditionalApprovers].length; k++) {
        
            var requiredAddl = item[fieldAdditionalApprovers][k];
            if(approvers.indexOf(requiredAddl) === -1) approvers.push(requiredAddl);
        }
    }
    
    syncUserList(approvers, fieldRemainingApprovers);
    
}

function syncUserList(source, fieldTarget) {

    for(var i = 0; i < source.length; i++) {
        item[fieldTarget].add(source[i]);
    }
    
}


// once reaching CCB review, increase counter
function setKPIRoundCount(state) {
    
    if (state === 'CCB'){
        var current = (item.CCB_REVIEW_ROUNDS === null) ? 0 : item.CCB_REVIEW_ROUNDS;
        item.CCB_REVIEW_ROUNDS = current + 1;
    } else {
        var current = (item.EIC_REVIEW_ROUNDS === null) ? 0 : item.EIC_REVIEW_ROUNDS;
        item.EIC_REVIEW_ROUNDS = current + 1;
    }
    
}


// Upon approval/rejection, save username in approved by and remove it from remaining approvers
function saveApproval(fieldApprovedBy, fieldRemainingApprovers) {
    
    var userName = getUserName();
    
    item[fieldApprovedBy].add(userName);
    item[fieldRemainingApprovers].remove(userName);
    
}

// // Upon rejection, save username in rejected by and remove it from remaining approvers
// function saveRejection(fieldRejectedBy, fieldRemainingApprovers) {
    
//     var userName = getUserName();
    
//     item[fieldRejectedBy] = userName;
//     item[fieldRemainingApprovers].remove(userName);
    
// }


// Copy grid from selected change template to current process
function copyTaskTemplate(process) {
    
    var source = item.CHANGE_TEMPLATE;
    
    if(source === null) return;
    
    if(source !== item.COPIED_TASKS_FROM_TEMPLATE) {
        
        item.grid.clear();
        
        for(var i = 0; i < source.grid.length; i++) {
            
            var rowRef = source.grid[i];
            
            if(rowRef.PROCESS === process) {
            
                var rowNew = item.grid.addRow();
                
                var columnsRef = Object.keys(rowRef);
                var columnsNew = Object.keys(rowNew);
                
                for(var j = 0; j < columnsRef.length; j++) {
                
                    var columnRef = columnsRef[j];
            
                    for(var k = 0; k < columnsNew.length; k++) {
                        
                        var columnNew = columnsNew[k];
                
                        if(columnRef == columnNew)  rowNew[columnNew] = rowRef[columnRef];
                        
                    }
                    
                }
                
            }
        
        }
        
        item.COPIED_TASKS_FROM_TEMPLATE = source.descriptor.descriptor;
    
    }
    
}


// Check if tasks have been defined (correctly)
function validateTasksPlanning() {
    
    var result = [];
    
    if(item.grid.length === 0) {
        result.push("Change tasks must be defined in Tasks Planning tab first");
    } else {
        for(var i = 0; i < item.grid.length; i++) {
            if(item.grid[i].ASSIGNEE === null) {
                result.push("Assignee is required for all entries in tab Task Planning");
                break;
            } else if(item.grid[i].TARGET_COMPLETION_DATE === null) {
                result.push("Target Completion Date is required for all entries in tab Task Planning");
                break;
            }
            
        }        
    }
    
    return result;
}


// Check if tasks have been defined in planning but not executed yet
function validateTasksPlanningEmpty() {
    
    var result = [];
    
    if(item.grid.length > 0 ) result.push("There are entries in 'Task Planning' tab, please perform 'Initiate Tasks' transition to start these tasks");
    
    return result;
    
}


// Initiate change tasks based on grid entries
function initiateChangeTasks(fieldParent) {
    
    var countPending = 0;
    var effortPlanned = (item.TOTAL_EFFORT_PLANNED === null) ? 0 : item.TOTAL_EFFORT_PLANNED;
    
    for(var i = 0; i < item.grid.length; i++) {
        
        var row = item.grid[i];
        var elemTask = row.TASK
        
        if(elemTask === null) {
        
            elemTask = createItem("WS_CHANGE_TASKS");
            elemTask[fieldParent] = item;
            elemTask.TITLE = row.TITLE;
            elemTask.DESCRIPTION = row.DESCRIPTION;
            elemTask.TARGET_START_DATE = row.TARGET_START_DATE;
            elemTask.TARGET_COMPLETION_DATE = row.TARGET_COMPLETION_DATE;
            elemTask.TARGET_EFFORT = row.TARGET_EFFORT;
            elemTask.ASSIGNEE = row.ASSIGNEE;
            elemTask.REVIEWER = row.REVIEWER;
            elemTask.ENGINEERING_ACTIVITY = (row.ENGINEERING_ACTIVITY) ? 'Yes' : 'No';
            elemTask.PRIORITY = row.PRIORITY;

            if(row.TARGET_START_DATE === null) {
                row.TARGET_START_DATE = new Date();
                elemTask.TARGET_START_DATE = new Date();
            } else {
                elemTask.TARGET_START_DATE = row.TARGET_START_DATE;
            }
            
            row.TASK = elemTask;
            item.project.addTask(elemTask);
            
            if(row.TARGET_EFFORT !== null) effortPlanned += row.TARGET_EFFORT;
            
        } else {
            
            updateTaskField(elemTask, row, "TITLE");
            updateTaskField(elemTask, row, "DESCRIPTION");
            updateTaskField(elemTask, row, "TARGET_START_DATE");
            updateTaskField(elemTask, row, "TARGET_COMPLETION_DATE");
            updateTaskField(elemTask, row, "ASSIGNEE");
            updateTaskField(elemTask, row, "REVIEWER");
            updateTaskField(elemTask, row, "PRIORITY");

            var engineeringActivity = (row.ENGINEERING_ACTIVITY) ? 'Yes' : 'No';

            if(elemTask.ENGINEERING_ACTIVITY !== engineeringActivity) elemTask.ENGINEERING_ACTIVITY = engineeringActivity;

            if(elemTask.TARGET_EFFORT !== row.TARGET_EFFORT) {
                if(row.TARGET_EFFORT !== null) effortPlanned += row.TARGET_EFFORT;
                if(elemTask.TARGET_EFFORT !== null) effortPlanned -= elemTask.TARGET_EFFORT;
                elemTask.TARGET_EFFORT = row.TARGET_EFFORT;
            }
            
        }
        
        
        elemTask.COMMENT = item.workflowActions[0].comments;
        countPending++;
        
    }
    
    item.PENDING_TASKS_COUNT = countPending;
    item.TOTAL_TASKS_COUNT = item.project.children.length;
    
    if(item.TOTAL_EFFORT_PLANNED !== effortPlanned) item.TOTAL_EFFORT_PLANNED = effortPlanned;
    
}
function updateTaskField(elemTask, row, fieldID) {
    
    if(elemTask[fieldID] !== row[fieldID]) elemTask[fieldID] = row[fieldID];
    
}


// Transition to next status if all approvals are complete
function autoTransition(fieldIdUsers, transition, comment) {
    if(item[fieldIdUsers].length === 1) {
        item.performWorkflowTransitionByCustomID(transition, comment);
    }
}


// Transition preceding process upon completion
function transitionPrecedingProcess(fieldId, status, transition, comments) {
    
    var process = item[fieldId];
    
    if(process === null) return;
    
    if(process.descriptor.workflowState !== status) return;
    
    process.performWorkflowTransitionByCustomID(transition, comments);
    
}
function transitionPrecedingProcesses(fieldId, status, transition, comments) {
    
    var processes = item[fieldId];
    
    for(var i = 0; i < processes.length; i++) {
    
        var process = processes[i];
        if(process.descriptor.workflowState === status) {
            process.performWorkflowTransitionByCustomID(transition, comments);
        }
        
    }
    
}


/* ----------------------------------------------------------------------------------------------------
    Create follow up process, link each other and copy attributes
    - workspace          : ID of workspace in which new process needs to be created
    - linkBack           : ID of field in new workspaces to link back to current item
    - linkNext           : ID of field in current workspaces to link to new item
    - copyMatchingFields : toggle to copy values of fields having same field id (true/false)
    - copyManagedItems   : toggle to copy list of managed items to new object (true/false)
    ---------------------------------------------------------------------------------------------------- */
function createFollowUpProcess(workspace, linkBack, linkNext, copyFields, copyManagedItems) {
    
    var followUp = (linkNext !== null) ? item[linkNext] : null;
    
    if(followUp !== null) {
        
        followUp[linkBack].add(item);
        
    } else {
    
        followUp = createItem(workspace);
        
        if(linkBack !== null) followUp[linkBack] = item;
        if(linkNext !== null) item[linkNext] = followUp;
        
        var copyFieldIDs = copyFields.split(",");
        
        for(var i = 0; i < copyFieldIDs.length; i++) {
            followUp[copyFieldIDs[i]] = item[copyFieldIDs[i]];
        }
        
        if(copyManagedItems !== null) {
            if(copyManagedItems) {
                for(var j = 0; j < item.workflowItems.length; j++) {
                    var workflowItem = item.workflowItems[j].item;
                    followUp.workflowItems.addItem({RELATED:workflowItem});
                }
            }
        }
    
    }
    
    return followUp;
    
}


/* ----------------------------------------------------------------------------------------------------
    Remove given existing milestones
   ---------------------------------------------------------------------------------------------------- */
function removeMilestones(name) {
    
    for(var i = item.milestones.length - 1; i >= 0; i--) {
        if(item.milestones[i].workflowStateName === name) {
            item.milestones.splice(i, 1);
        }
    }
}


/* ----------------------------------------------------------------------------------------------------
    Remove all existing milestones
   ---------------------------------------------------------------------------------------------------- */
function clearMilestones() {
    
    for(var i = 0; i < item.milestones.length; i++) {
        item.milestones.splice(i, 1);
    } 
    
}


/* ----------------------------------------------------------------------------------------------------
    Capture workflow comment in paragraph field to save feedback in thread
    - field : Paragraph field to capture discussion thread
    - append : Append transition details (true) or save last transistion details only (false)
    ---------------------------------------------------------------------------------------------------- */
function appendToThread(field, append) {
    
    if(item.workflowActions[0].transition.fromState === null) return;
    if(item.workflowActions[0].comments === null) return;
    if(item.workflowActions[0].comments === "") return;
    
    var comment = item.workflowActions[0].comments;
    var date    = new Date();
    var thread  = "<p>";
    
    thread += "<span style='font-size:0.8em;font-style:italic;color:#ffa600;white-space:nowrap;'>";
    thread += item.workflowActions[0].transition.fromState.shortName + " &gt; " + item.workflowActions[0].transition.toState.shortName;
    thread += "</span>";
    thread += "<br>";
   
    if(comment !== null) {
        if(comment !== "") {
            thread += comment + "<br>";
        }
    }
    
    thread += "<span style='font-size:0.8em;font-style:italic;color:#999;white-space:nowrap;'>";
    thread += getUserName() + " (" + date.toDateString() + ")";
    thread += "</span>";
    thread += "</p>";
            
    if(append) {
        if(item[field] !== null) thread += item[field];
    }
            
    item[field] = thread;
    
}


/* ----------------------------------------------------------------------------------------------------
    Upon process / task cancellation save details
    ---------------------------------------------------------------------------------------------------- */
function saveCancellationDetails() {

    item.CANCELLED_IN_STATUS    = item.workflowActions[0].transition.fromState.shortName;
    item.CANCELLED_BY           = getUserName();
    item.CANCELLATION_DATE      = new Date();
    item.CANCELLATION_COMMENTS  = item.workflowActions[0].comments;

}


/* ----------------------------------------------------------------------------------------------------
    Upon process cancellation also cancel all change tasks being in progress
    ---------------------------------------------------------------------------------------------------- */
function cancelChangeTasks() {

    var listTasks = [];
    var listNames = [];
    var listTo    = [];

    for(var iTask = 0; iTask < item.project.children.length; iTask++) {

        var elemTask = item.project.children[iTask].target;

        if(elemTask !== null) {

            var stateTask = elemTask.descriptor.workflowState;
            
            for(var index in transitionsTaskCancellation) {
                if(transitionsTaskCancellation[index].state === stateTask) {
                    elemTask.CANCELLED_BY_PROCESS = true;
                    elemTask.performWorkflowTransitionByCustomID(transitionsTaskCancellation[index].transition, 'Cancelled by cancellation of ' + item.descriptor.descriptor);
                    listTasks.push(elemTask.descriptor.descriptor);
                    if(elemTask.ASSIGNEE !== null) { if(!listNames.includes(elemTask.ASSIGNEE)) listNames.push(elemTask.ASSIGNEE); }
                    if(elemTask.REVIEWER !== null) { if(!listNames.includes(elemTask.REVIEWER)) listNames.push(elemTask.REVIEWER); }
                    break;
                }
            }

        }

    }

    if(customTransID === 'CANCEL_1') return;

    var userName    = getUserName();
    var body        = '<a href="https://' + tenant + '.autodeskplm360.net/plm/workspaces/' + workspaceID + '/items/itemDetails?view=full&tab=details&mode=view&itemId=urn%60adsk,plm%60tenant,workspace,item%60' + tenant.toUpperCase() + ',' + workspaceID + ',' + dmsID + '&cached=false">' + item.descriptor.descriptor + '</a> got cancelled by ' + userName;
    
    if(item.workflowActions[0].comments !== '') body += ' with following comments:<br/><br/>' + item.workflowActions[0].comments;
    
    if(listTasks.length > 0) {
        body += '<p>The following Change Tasks got cancelled by this action as well:</p>'
        body += '<ul>'
        for(var iTask = 0; iTask < listTasks.length; iTask++) body += '<li>' + listTasks[iTask] + '</li>';
        body += '</ul>'
    }

    for(var iName = 0; iName < listNames; iName++) {

        var name        = listNames[iName].split(", ");
        var userInfo    = Security.searchUsers({lastName:name[0], firstName:name[1]}); 
        var user        = Security.loadUser(userInfo[0].id);

        listTo.push(user.email)

    }

    var footer  = '<br/><br/><hr style="border: 1px solid #bbb;">';
        footer += '<span style="color:#bbb;">';
        footer += 'This mail has been generated automatically. Please do not respond to this mail.<br/>';
        footer += 'In case of questions, please get in touch with ';
        footer += '<a href="mailto:' + item.master.owner.email + '?subject=' + item.descriptor.descriptor + '">' + item.master.owner.email + '</a>';
        footer += '</span>';
    
	var email           = new Email();
	    email.to        = listTo.toString();
	    email.cc        = item.master.owner.email;
		email.subject   = item.descriptor.descriptor + ' got cancelled';
		email.body      = body + footer;
        email.send();
    
}


/* Get current user's name */
function getUserName() {
    var usr = Security.loadUser(userID);
    return usr.lastName + ", " + usr.firstName;
}

function validateGroup(){
    

     switch(true){
        case Security.inGroup(userID, 'CCB - Procurement'):
            return 'CCB - Procurement';
            break;
            
        case Security.inGroup(userID, 'CCB - Operations'):
            return 'CCB - Operations';
            break;
            
        case Security.inGroup(userID, 'CCB - Quality'):
            return 'CCB - Quality';
            break;
            
        case Security.inGroup(userID, 'CCB - Materials'):
            return 'CCB - Materials';
            break;
            
        
    }
}

function updateChangeApprovers(approversToUpdate){
    //populate approvers based on security groups
    var ccbApproversGroupsArray = ['CCB - Operations', 'CCB - Materials', 'CCB - Procurement', 'CCB - Quality'];
    var ccbApproversFields = [item.REQUIRED_APPROVERS_MANUFACTURING, item.REQUIRED_APPROVERS_MATERIALS, item.REQUIRED_APPROVERS_PROCUREMENT, item.REQUIRED_APPROVERS_QUALITY];
    
    //populate approvers only if/for group passed
    if (approversToUpdate) {
        var k = ccbApproversGroupsArray.findIndex(group => group.toLowerCase().includes(approversToUpdate.toLowerCase()));
        if (k !== -1) {
            var ccbApprovers = Security.listUsersInGroup(ccbApproversGroupsArray[k]);
            for (var userID in ccbApprovers) {
                ccbApproversFields[k].add(getUserNameDefined(ccbApprovers[userID]));
            }
        }
        return;
    }
    
    //default populate all groups when specific group not passed
    for(var i in ccbApproversGroupsArray) {
        ccbApproversFields[i].clear();
        var ccbApprovers = Security.listUsersInGroup(ccbApproversGroupsArray[i]);
        for (var userID in ccbApprovers) {
            ccbApproversFields[i].add(getUserNameDefined(ccbApprovers[userID]));
        }
    }
}

function removeUsersWhoDontBelongToCcbGroups(groupName, approversField) {
    var listOfUsers = '';
    var groupUsers = Security.listUsersInGroup(groupName);
    for (var i in groupUsers) {
        listOfUsers += getUserNameDefined(groupUsers[i]);
    }
    for (var j in approversField) {
        if (listOfUsers.indexOf(approversField[j]) == -1) {
            approversField.remove(approversField[j]); 
        }
    }
}

function removeCcbApprovers(area) {
    if (item[area + '_REVIEW_OF_CHANGE_COMPLETE'] === "NA") {
        item['REQUIRED_APPROVERS_' + area].clear();
        item['REMAINING_APPROVERS_' + area].clear();
    }
}

function updateCcbApprovers(area) {
    //add remaining approvers if they haven't approved aleady
    for (var i=0; i < item['REQUIRED_APPROVERS_' + area].length; i++) {
        var user = item['REQUIRED_APPROVERS_' + area][i];
        if (item['REMAINING_APPROVERS_' + area].indexOf(user) === -1 && item['APPROVED_BY_' + area].indexOf(user) === -1) {
            item['REMAINING_APPROVERS_' + area].add(user);
        }
    }
    for (var i=0; i < item['ADDITIONAL_APPROVERS_' + area].length; i++) {
        var user = item['ADDITIONAL_APPROVERS_' + area][i];
        if (item['REMAINING_APPROVERS_' + area].indexOf(user) === -1 && item['APPROVED_BY_' + area].indexOf(user) === -1) {
            item['REMAINING_APPROVERS_' + area].add(user);
        }
    }    
    //remove remaining approvers who don't belong
    for (var i=0; i < item['REMAINING_APPROVERS_' + area].length; i++) {
        var user = item['REMAINING_APPROVERS_' + area][i];
        if ((item['REQUIRED_APPROVERS_' + area].indexOf(user) === -1) && (item['ADDITIONAL_APPROVERS_' + area].indexOf(user) === -1)) {
            item['REMAINING_APPROVERS_' + area].remove(user);
        }
    }
}

function getEmailUsersAllByName(userNamePassed){
    var userName = userNamePassed; // Get the user
    var name        = userName.split(", ");
    var userInfo    = Security.searchUsers({lastName:name[0], firstName:name[1]}); 
    return userInfo[0].email; //return email of user in question
}

function lengthOfCcbApprovers() {   // Moved to CM Library
    var lengthOfApprovers = 0;
    lengthOfApprovers += item.REMAINING_APPROVERS_PROCUREMENT.length += item.REMAINING_APPROVERS_MANUFACTURING.length += item.REMAINING_APPROVERS_MATERIALS.length += item.REMAINING_APPROVERS_QUALITY.length;
    return lengthOfApprovers;
}

function sendForFinalApproval() {   // moved to CM Library
    setRemainingApproversECO("REQUIRED_APPROVERS_FINAL", "REMAINING_APPROVERS_FINAL", "ADDITIONAL_APPROVERS_FINAL");
    saveDate("FINAL_APPROVAL_START_DATE");
    var priorReject = false;
    if (item.CCB_FEEDBACK_PROCUREMENT !== null){
        if (!item.HISTORY_CCB_FEEDBACK_PROCUREMENT) {
            item.HISTORY_CCB_FEEDBACK_PROCUREMENT = item.CCB_FEEDBACK_PROCUREMENT;
        } else {
            item.HISTORY_CCB_FEEDBACK_PROCUREMENT += '; ' + item.CCB_FEEDBACK_PROCUREMENT;
        }
        item.CCB_FEEDBACK_PROCUREMENT = null;
        priorReject = true;
    } 
    if (item.CCB_FEEDBACK_MANUFACTURING !== null){
        if (!item.HISTORY_CCB_FEEDBACK_MANUFACTURING) {
            item.HISTORY_CCB_FEEDBACK_MANUFACTURING = item.CCB_FEEDBACK_MANUFACTURING;
        } else {
            item.HISTORY_CCB_FEEDBACK_MANUFACTURING += '; ' + item.CCB_FEEDBACK_MANUFACTURING;
        }
        item.CCB_FEEDBACK_MANUFACTURING = null;
        priorReject = true;
    }
    if (item.CCB_FEEDBACK_MATERIALS !== null){
        if (!item.HISTORY_CCB_FEEDBACK_MATERIALS) {
            item.HISTORY_CCB_FEEDBACK_MATERIALS = item.CCB_FEEDBACK_MATERIALS;
        } else {
            item.HISTORY_CCB_FEEDBACK_MATERIALS += '; ' + item.CCB_FEEDBACK_MATERIALS;
        }
        item.CCB_FEEDBACK_MATERIALS = null;
        priorReject = true;
    }
    if (item.CCB_FEEDBACK_QUALITY !== null){
        if (!item.HISTORY_CCB_FEEDBACK_QUALITY) {
            item.HISTORY_CCB_FEEDBACK_QUALITY = item.CCB_FEEDBACK_QUALITY;
        } else {
            item.HISTORY_CCB_FEEDBACK_QUALITY += '; ' + item.CCB_FEEDBACK_QUALITY;
        }
        item.CCB_FEEDBACK_QUALITY = null;
        priorReject = true;
    }
    if (priorReject) item.REJECTED_BY_FINAL_APPROVAL.clear();
    setKPIRoundCount('CCB');
    item.STEP = 4;
}
