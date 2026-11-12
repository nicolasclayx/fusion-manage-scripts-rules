/** ****************************************************************************
    Copyright © 2026, FTI Technologies Inc.  All rights reserved.
      
    Script Name:                isCONotRequired
    Script type:                Action
    Original Code By/Company:   FTI
    Creation Date:              10/02/2026
    Description:                This script bypasses creating a Change Order (CO) and moves the Change Request to Completed.
    Imports:                    Change Management Library

    Revisions:  10/02/2026  1.00 Initial
**************************************************************************** **/
// Script Type: Condition
// Name: isCONotRequired

var coRequiredValue = '';

if (item !== null && item.CO_REQUIRED !== undefined && item.CO_REQUIRED !== null) {
    coRequiredValue = item.CO_REQUIRED.toString();
}

if (coRequiredValue === 'No' || coRequiredValue === 'NO') {
    returnValue = true;
} else {
    returnValue = false;
}