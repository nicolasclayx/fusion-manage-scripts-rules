/** ****************************************************************************
    Copyright © 2024, D3 Technologies Inc.  All rights reserved.
      
    Script Name:                Change Requests WF Conditions
    Script type:                Conditions
    Original Code By/Company:   Autodesk
    Creation Date:              03/31/2021
    Description:                This script is provided by CHANGE MANAGEMENT available in the Template Library
                            
    Imports:                    Change Management Library
                                
    Revisions:  03/27/2025     1.00 - ForgeFlow Integration

**************************************************************************** **/

var access = false;

switch(customTransID) {
    
    case 'INITIATE_CO_SKIP_CCB':
        if(item.REQUIRED_APPROVERS.length === 0) {
            if(item.ADDITIONAL_APPROVERS.length === 0) {
                access = true;
            }
        }
        break;
        
    case 'SUBMIT_TO_CCB':
        if((item.REQUIRED_APPROVERS.length > 0) || (item.ADDITIONAL_APPROVERS.length > 0)) {
            access = true;
        }
        break;
    
}

returnValue(access);