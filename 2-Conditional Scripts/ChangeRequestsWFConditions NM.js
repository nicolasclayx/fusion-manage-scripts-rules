/** ****************************************************************************
    Copyright © 2024, D3 Technologies Inc.  All rights reserved.
      
    Script Name:                Change Requests WF Conditions
    Script type:                Conditions
    Original Code By/Company:   Autodesk
    Creation Date:              11/05/2026
    Description:                This script is provided by CHANGE MANAGEMENT available in the Template Library
                            
    Imports:                    Change Management Library
                                
    Revisions:  03/27/2025     1.00 - Initial - NM

**************************************************************************** **/

var access = false;

// Defensive check to safely retrieve array lengths even if fields are null/empty
var reqCount = (item.REQUIRED_APPROVERS && item.REQUIRED_APPROVERS.length) ? item.REQUIRED_APPROVERS.length : 0;
var addCount = (item.ADDITIONAL_APPROVERS && item.ADDITIONAL_APPROVERS.length) ? item.ADDITIONAL_APPROVERS.length : 0;
var hasApprovers = (reqCount > 0 || addCount > 0);

switch(customTransID) {
    
    case 'INITIATE_CO_SKIP_CCB':
        // Only allow skipping CCB if NO approvers are defined
        if (!hasApprovers) {
            access = true;
        }
        break;
        
    case 'SUBMIT_TO_CCB':
        // Only allow submitting to CCB if at least ONE approver is assigned
        if (hasApprovers) {
            access = true;
        }
        break;
        
    default:
        // By default, do not block other transitions that might reference this script
        access = true;
        break;
}

returnValue(access);