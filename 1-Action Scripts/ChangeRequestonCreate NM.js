/** ****************************************************************************
    Copyright © 2026, FTI Technologies Inc.  All rights reserved.

    Script Name:                Change Requests onCreate
    Script type:                Action
    Original Code By/Company:   FTI
    Creation Date:              10/02/2026
    Description:                Performs actions during onCreate.

    Imports:                    

    Revisions:  10/02/2026      NM 1.01 - Initial
**************************************************************************** **/
var seq = new Sequencer('CR', 1, 1);
var LENGTH = 6;
var nextNum = seq.nextValue();

// Create a string of 6 zeros ('000000') using Array(LENGTH + 1)
var padding = Array(LENGTH + 1).join('0'); 

// Combine zeros with number and slice the last 6 digits
var sequenceValue = (padding + nextNum).slice(-LENGTH);

item.NUMBER = 'CR-' + sequenceValue;