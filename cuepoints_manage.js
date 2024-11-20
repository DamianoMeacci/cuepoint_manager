/*
cuepoints-manager_public_v2.0 script (2024/11/20)
Developped in Ableton Live 12.0.25 and Max 8.6.5
*/

autowatch = 1;
outlets = 4;

/*CONSTANTS
in js (interprete di js in Max non è definito const!!!
*/

var FUNCTION_CALL_INTERVALL_ms = 20;
var DEBUG = 0;

// Live API observers and listener

var myobserver;
var o_name = new Array();
var o_time = new Array();

var prev = -1; //variable to control observer array change needs

var listener;


// external objects name and data
// if the objects don't exist the js create this objects

var umenuName = "umenu_cues"; // umenu "scripting name" - the umenu is used to select the active cue
var umenuName2 = "umenu_cues2"; // umenu "scripting name" - the umenu is used for jump function
var dictName = "dict_cues"; // dict name - the dict is used to save the data in Live session 
/*
dict_cue structure:
key cuepoint_name+cuepoint_id
data: cuepoint_name, flag_state, cuepoint_id, cuepoint_index, cuepoint_position_in_beat

*/

if (jsarguments.length == 3) {
	umenuName = jsarguments[1];
	umenuName2 = jsarguments[1]+"2";
	dictName = jsarguments[2];
}

var rect_patch = [150, 200, 100, 22];
var rect_presentation = [100, 100, 100, 22];
var rect_patch2 = [170, 220, 100, 22];
var rect_presentation2 = [120, 120, 100, 22];
var drect_patch = [111, 508, 100, 22];
var drect_presentation = [111, 508, 100, 22];

var obj; //link to umenu (initialized in init function)
var obj2; //link to umenu2 (initialized in init function)

var dict_active_cues; //dict (initialized in init function)

var int_changed = 1; // variable used to avoid feedback with umenu

var checkInit = 1; // this variable define if a added locator is active (1) or inactive (0) cue
declareattribute("checkInit");

var dataA = new Array(); // main data storage
/*
 data #		value
   0		cuepoint name
   1		active cuepoint flag [0, 1]
   2		cuepoint id
   3		cuepoint index
   4		cuepoint position in beat
*/

var next_cue = "none"; // means thats there isn't a new cue!!!
var current_cue = " ";
var jumpA = new Array(); //jump array

var raw_cuepoints = new Array();
/*
 data #		value
   0		cuepoint name
   1		cuepoint id
   2		cuepoint index
   3		cuepoint position in beat
*/

var gocallback = 1; // variable used to suspend the callback functions during initialization

var tsk = new Task(ScenesChange_delayed, this);
var tsk_array = new Array();

var tsk_upd_array = new Task(UpdateArrayElements_delayed, this);

var task_active_cues = new Task(no_cue_feedback, this);

var current_beat_observer;
var current_beat;

var cursorStart = 0;

var transportBC = 0;

var last_jump;

var playAPI;

function init() {  //ATTENTION: THIS FUNCTION MUST BE CALLED ONLY ONE TIME

	dpost("INIT");
	
	obj = this.patcher.getnamed(umenuName);
    obj["setcheck"]();
    obj2 = this.patcher.getnamed(umenuName2);
    dict_active_cues = new Dict(dictName);
	
	obj["setcheck"]();
	
	dpost("DICT: " + dict_active_cues.name);
	dpost("Names of existing dictionaries: " + dict_active_cues.getnames());
	
    gocallback = 0;
	
	playAPI = new LiveAPI("live_set"); // transport API

    load_dict(); //it's initialize dataA array if dict exist

    myobserver = new LiveAPI(CuepointChange, "live_set");
    myobserver.property = "cue_points";

	current_beat_observer = new LiveAPI(Timeprint, "live_set");
	current_beat_observer.property = "current_song_time";

    listener = new ParameterListener(umenuName, valuechanged);
    
    gocallback = 1;

    update();
    
}
	
function CuepointChange(arg) { //callback function for cue_points observer
	tsk.cancel();
	tsk_array = new Array();
	for (var i=0; i<arg.length; i++){
		tsk_array[i] = arg[i];
	}
	tsk.schedule(FUNCTION_CALL_INTERVALL_ms);
}

function ScenesChange_delayed() { //callback function for scenes observer. This function is called only one time also if there are more changes.	
	var ids = new Array();
	var i;
	var j;
	
	if (gocallback) {
	    outlet(1, "bang");

	    //if exist remove the first element to align the external call with internal call from init function
	    if (tsk_array[0] == "cue_points") {
	        tsk_array.shift();
	    }

	    raw_cuepoints = new Array();

	    if (tsk_array.length > 1) {
	        j = 0;
	        for (i = 1; i < tsk_array.length; i = i + 2) {
	            ids.push(tsk_array[i]);
	            l_name = new LiveAPI("live_set cue_points " + j);
	            raw_cuepoints.push([l_name.get("time"), l_name.get("name"), ids[j], j]);
	            j++;
	        }
	        sort_raw_cuepoints();
	        observer_build(ids);
	    }
	    UpdateArrayElements();
	}
}

function TimeNameChange(arg) { //callback function for cue_points name and time observers
    var ids = new Array();
    var cueID = new Array();
    var i;
    var j;

    if (gocallback) {
        outlet(1, "bang");

        var temp = new LiveAPI("live_set");
        var cues = temp.get("cue_points");
        for (var i = 1; i < cues.length; i = i + 2) {
            cueID.push(cues[i]);
        }

        raw_cuepoints = new Array();

        if (cueID.length > 0) {
            j = 0;
            for (i = 0; i < cueID.length; i++) {
                ids.push(cueID[i]);
                var l_name = new LiveAPI("live_set cue_points " + j);
                raw_cuepoints.push([l_name.get("time"), l_name.get("name"), ids[j], j]);
                j++;
            }
            sort_raw_cuepoints();
        }

        UpdateArrayElements();
    }
}

function sort_raw_cuepoints() { // sort the array using the time value
	//the output array don't contain the time value
	var temp = new Array();
	var index;
	var i = 0;
	while (raw_cuepoints.length) {
		index = 0;
		for (i=0; i<raw_cuepoints.length-1; i++) {
			if (raw_cuepoints[index][0]-raw_cuepoints[i+1][0]>0) {index = i + 1;}
		}
		temp.push([raw_cuepoints[index][1], raw_cuepoints[index][2], raw_cuepoints[index][3], raw_cuepoints[index][0]]);
		raw_cuepoints.splice(index, 1); // delete index element
	}
	raw_cuepoints = temp;
}

function UpdateArrayElements(){
	tsk_upd_array.cancel();
	tsk_upd_array.schedule(FUNCTION_CALL_INTERVALL_ms);
}

function UpdateArrayElements_delayed(){ //it's function rebuild dataA array using cuepoints

    var oldArray = dataA;
	dataA = new Array();
	var i;
	var j;
	var id;

	/*
		crea gli elementi partendo da raw_cuepoints.
			se lo stesso id è presente in dataA (oldArray) prendi il valore di stato da questo array.
			se non è presente inseriscilo e imposta il valore di stato al valore di default.
	*/
	
	for (i = 0; i < raw_cuepoints.length; i++) {

	    id = findid(oldArray, raw_cuepoints[i][1]);

	    if (id == -1) {
	        dataA.push([raw_cuepoints[i][0], checkInit, raw_cuepoints[i][1], raw_cuepoints[i][2], raw_cuepoints[i][3]]);
	    } else {
	        dataA.push([raw_cuepoints[i][0], oldArray[id][1], raw_cuepoints[i][1], raw_cuepoints[i][2], raw_cuepoints[i][3]]);
	        oldArray.splice(id, 1);
	    }
	}

	update_dict();
	update_menu();
	update_menu2();

	next_cue = find_next_cue(-1);
	current_cue = " ";
	display_next_cue();

}

function findid(oldArray, find){
	var id = -1;
	
	for (i=0; i< oldArray.length; i++) {
		if (oldArray[i][2] == find) {
			id = i;
			break;
		}
	}
	return(id);
}

function valuechanged(menu)
{
	task_active_cues.cancel();
	if (!int_changed) {
		dpost("valuechanged ON");
		if (cursorStart) {
			outlet(3, "interface_start_from_cursor", 0);
			cursorStart = 0;
			current_cue = " ";
			next_cue = find_next_cue_beat();
			display_next_cue();
		}
		dataA[menu.value][1] = (dataA[menu.value][1] ? 0 : 1);
		
		obj["checkitem"](menu.value, dataA[menu.value][1]);
		update_dict();
		update_menu2();
		next_cue = find_next_cue(-1);
		current_cue = " ";
		display_next_cue();
		int_changed = 1;
		task_active_cues.schedule(FUNCTION_CALL_INTERVALL_ms);
	} else {
		dpost("valuechanged OFF");
		int_changed = 0;
	}
}

function no_cue_feedback() {
	dpost("no_cue_feedback");
	int_changed = 0;
}

function observer_build(arg) { //observer for cue_points name and time

    gocallback = 0;
    if (arg.length) {

        var nids = arg.length;

        if (prev > nids) {

            o_time.length = 0;
            o_name.length = 0;

        }

        prev = nids;

        for (i = 0; i < nids; i++) {
            
            o_time[i] = new LiveAPI(TimeNameChange, "id "+arg[i]);
            o_time[i].id = "id";
            o_time[i].property = "time";
            
            o_name[i] = new LiveAPI(TimeNameChange, "id "+arg[i]);
            o_name[i].id = "id";
            o_name[i].property = "name";
        }
    }
    gocallback = 1;
}

function update() {
    var temp = new LiveAPI("live_set");
	CuepointChange(temp.get("cue_points"));
}

function update_dict() {
	dpost("UPDATE_DICT");
	dict_active_cues.clear();
	stampa();
	dpost("DICT: " + dict_active_cues.name);
	for (var i=0; i<dataA.length; i++) {
		dpost("key: "+dataA[i][0]+dataA[i][2]+" "+dataA[i][0]+" "+dataA[i][1]+" "+dataA[i][2]+" "+dataA[i][3]+" "+dataA[i][4]);
		dict_active_cues.set((dataA[i][0]+dataA[i][2]).toString(), dataA[i][0].toString(), dataA[i][1], dataA[i][2], dataA[i][3], dataA[i][4]);
	}
}

function update_menu() {
	obj.clear();
	for (var i=0; i<dataA.length; i++) {
		obj["append"](dataA[i][0]);
		if(dataA[i][1]) { 
			obj["checkitem"](i, 1);
			int_changed = 1;
		};
	}
}

function update_menu2() {
	obj2.clear();
	jumpA = new Array();
	for (var i=0; i<dataA.length; i++) {
		if(dataA[i][1]) { 
			obj2["append"](dataA[i][0]);
			jumpA.push(i);
		};
	}
}

function load_dict(){ 
	var keys = new Array();
	var temp;
	
	dataA = new Array();
	
	keys = dict_active_cues.getkeys();
	
	dpost("keys " +keys);

	if (keys === null) {
	    post("NO DATA IN DICT\n");
		return -1;
	}
		
	for (var i = 0; i < keys.length; i++){
		temp = dict_active_cues.get(keys[i]);
		dataA.push([temp[0], temp[1], temp[2], temp[3]], temp[4]); //cuepoint_name, flag_state, cuepoint_id, cuepoint_index, cuepoint_position_in_beat
	}

}

//Live transport functions

function sync() {
	if(playAPI.get("is_playing") == 1) {
		outlet(3, "position", current_beat); // to broadcast
		outlet(3, "sync_find_next_cue_beat"); // to broadcast
		outlet(3, "sync_play"); // to broadcast
	} else if(cursorStart) {
		outlet(3, "position", current_beat); // to broadcast
		outlet(3, "sync_find_next_cue_beat_pause"); // to broadcast
	} else {
		outlet(3, "sync_jump", next_cue); // to broadcast
	}

}

function sync_play() {
	playAPI.call("start_playing");
}

function sync_find_next_cue_beat() {
	next_cue = find_next_cue_beat();
	current_cue = "sync";
	display_next_cue();
}

function sync_find_next_cue_beat_pause() {
	if(playAPI.get("is_playing") == 1) {
		playAPI.call("stop_playing");
	}
	cursorStart = 1;
	display_next_cue();
}

function sync_jump(arg) {
	next_cue = arg;
	current_cue = " ";
	display_next_cue();
}

function transport_broadcast(a) {
	if (a) {
		transportBC = 1;
	} else {
		transportBC = 0;
	}
}

function goto_next(){
	if (transportBC) {
		outlet(3, "goto_next"); // to broadcast
	}
	next_cue = find_next_cue(next_cue);
	current_cue = " ";
	if (next_cue != "none" ){
		var jumpAPI = new LiveAPI("live_set cue_points " + dataA[next_cue][3]);
		jumpAPI.call("jump");
	}
	stop();
	display_next_cue();
}

function goto_prev(){
	if (transportBC) {
		outlet(3, "goto_prev"); // to broadcast
	}
	next_cue = find_prev_cue(next_cue);
	current_cue = " ";
	if (next_cue != "none" ) {
		var jumpAPI = new LiveAPI("live_set cue_points " + dataA[next_cue][3]);
		jumpAPI.call("jump");
	}
	stop();
	display_next_cue();
}

function jump_cue(arg) {
	outlet(3, "jump_cue", arg); // to broadcast
	stop();
	var jumpAPI = new LiveAPI("live_set cue_points " + dataA[(jumpA[arg])][3]);
	jumpAPI.call("jump");
	next_cue = jumpA[arg];
	current_cue = " ";
	display_next_cue();
}

function GO(){
	if (transportBC) {
		outlet(3, "GO"); // to broadcast
	}		
	if (cursorStart) {
		outlet(3, "interface_start_from_cursor", 0);
		cursorStart = 0;
		if(playAPI.get("is_playing") == 0) {
			playAPI.call("start_playing");
		}
		dpost("current_beat: "+current_beat);
		next_cue = find_next_cue_beat();
		current_cue = "from cursor";
		display_next_cue();
	} else if (next_cue != "none") {
		var jumpAPI = new LiveAPI("live_set cue_points " + dataA[next_cue][3]);
		jumpAPI.call("jump");
		if(playAPI.get("is_playing") == 0) {
			playAPI.call("start_playing");
		}
		next_cue = find_next_cue(next_cue);
		display_next_cue();
	}
}

function stop(){
	if (transportBC) {
		outlet(3, "stop"); // to broadcast
	}
	
	if(playAPI.get("is_playing") == 1) {
		playAPI.call("stop_playing");
	}
	if (cursorStart) {
		outlet(3, "interface_start_from_cursor", 0);
		cursorStart = 0;
		current_cue = " ";
		next_cue = find_next_cue_beat();
		display_next_cue();
	}
}

function pause(){
	dpost("pause");
	
	if(playAPI.get("is_playing") == 1) {
		playAPI.call("stop_playing");
		if (transportBC) {
			outlet(3, "pause"); // to broadcast
		}
		outlet(3, "interface_start_from_cursor", 1);
		start_from_cursor(1);
	}
}

function find_next_cue(pos){
	var next = "none";
	for (var i=pos+1; i<dataA.length; i++) {
		if (dataA[i][1] == 1) {
			next = i;
			break;
		}
	}
	return (next);
}

function find_prev_cue(pos){
	var prev = pos;
	if (prev === "none" && dataA.length != 0) {
		for (var i=dataA.length-1; i>=0; i--) {
			if (dataA[i][1] == 1) {
				prev = i;
				break;
			}
		}
	} else {
		for (var i=pos-1; i>=0; i--) {
			if (dataA[i][1] == 1) {
				prev = i;
				break;
			}
		}
	}
	return (prev);
}

function display_next_cue(){
	if (next_cue === "none") {
		outlet(0,"next", "none");
		outlet(0,"current", current_cue);
		outlet(2, -1);
	} else if (cursorStart == 1) {
		outlet(0,"next", "next from cursor");
		outlet(0,"current", " ");
		outlet(2, -1);
	} else {
		outlet(0, "next", dataA[(next_cue)][0]);
		outlet(0, "current", current_cue);
		outlet(2, dataA[(next_cue)][2]);
		current_cue = dataA[(next_cue)][0];
	}
}

function start_from_cursor(a) {
	
	if (a) {
		if(playAPI.get("is_playing") == 1) {
			playAPI.call("stop_playing");
		}
		cursorStart = 1;
		display_next_cue();
		outlet(3, "start_from_cursor", 1); // to broadcast
		outlet(3, "position", current_beat); // to broadcast
		position(current_beat);
	} else {
		cursorStart = 0;
		next_cue = find_next_cue(-1);
		current_cue = " ";
		display_next_cue();
		outlet(3, "start_from_cursor", 0); // to broadcast
	}
}

function Timeprint(arg){
	current_beat = arg[1];
	/*if (cursorStart) {
		outlet(3, "position", current_beat);
		var set_position = new LiveAPI("live_set");
		set_position.set("start_time", current_beat);
	}*/
}

function position(arg) {
	current_beat = arg;
	var set_position = new LiveAPI("live_set");
	set_position.set("start_time", current_beat);
}

function find_next_cue_beat(){
	for (var i=0; i<dataA.length; i++) {
		if (dataA[i][4]>current_beat && dataA[i][1]){
			return(i);
		}
	}
	return("none");
}

//DEBUG FUNCTIONS

function dpost(s) {
	if (DEBUG) {
		post(s, "\n");
	}
}
function stampa() { // print dataA array
	if (DEBUG) {
		for (var i=0; i<dataA.length; i++) {
			for (var j=0; j<dataA[i].length; j++) {
				post(dataA[i][j], " ");
			}
			post("\n");
			dpost(dict_active_cues.get(dataA[i][0]));
		}
	}
}