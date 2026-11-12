/** ****************************************************************************
    Copyright © 2025, D3 Technologies Inc.  All rights reserved.
    
    Script Name:                Change Requests onCreate
    Script type:                Action
    Original Code By/Company:   D3 Technologies
    Creation Date:              05/06/2025
    Description:                Performs actions during onCreate

    Imports:                    

    Revisions:  05/06/2025      JMP 1.00 - Initial
**************************************************************************** **/

//Populate Number with next sequential value (CR-xxxxxx)
var seq = new Sequencer('CR', 1, 1);//create sequencer based on date, starting at zero, and increasing by 1 each time
var LENGTH = 6;//update for sequential value length
var padding = 0;//set padding value to 0
var nextNum = seq.nextValue();//get next value in current sequence
var sequenceValue = (Array(LENGTH).join(padding) + nextNum).slice(-1*LENGTH);//create sequential number

item.NUMBER = 'CR-' + sequenceValue;//concatentate prefix and sequential number

