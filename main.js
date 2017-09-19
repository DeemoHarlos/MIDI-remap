const fs = require('fs')
const midi = require('midi-file')
const leftpad = require('left-pad')
const argv = require('minimist')(process.argv.slice(2));

function loadMidi(fileName){
	// Read MIDI file into a buffer
	var input = fs.readFileSync(fileName)
	// Parse it into an intermediate representation
	// This will take any array-like object.  It just needs to support .length, .slice, and the [] indexed element getter.
	// Buffers do that, so do native JS arrays, typed arrays, etc.
	return midi.parseMidi(input)
}

function exportMidi(fileName,midiObject){
	// Turn the intermediate representation back into raw bytes
	var output = midi.writeMidi(midiObject)
	// Note that the output is simply an array of byte values.  writeFileSync wants a buffer, so this will convert accordingly.
	// Using native Javascript arrays makes the code portable to the browser or non-node environments
	var outputBuffer = new Buffer(output)

	// Write to a new MIDI file.  it should match the original
	fs.writeFileSync(fileName, outputBuffer)
}

function remove(a,i){
	if(i < a.length-1 ) a[i+1].deltaTime += a[i].deltaTime
	a.splice(i,1)
}

function insertAfter(a,i,t){
	if(a[i+1]){
		t.deltaTime = a[i+1].deltaTime
		a[i+1].deltaTime = 0
	}
	else t.deltaTime = 240
	a.splice(i+1,0,t)
}

function str(a,b){ // convert value to constant length of string
	return leftpad(a === undefined ? '' : a, b)
}

function oct(a){ return Math.floor(a/12) - 1 || '' }

function pitch(a){
	switch(a%12){
		case 0: return 'C ';break
		case 1: return 'Db';break
		case 2: return 'D ';break
		case 3: return 'Eb';break
		case 4: return 'E ';break
		case 5: return 'F ';break
		case 6: return 'F#';break
		case 7: return 'G ';break
		case 8: return 'Ab';break
		case 9: return 'A ';break
		case 10: return 'Bb';break
		case 11: return 'B ';break
		default: return '  '
	}
}

// options
var options = {
	midiFile: '',
	trackNum: 0,
	tempo: {
		fix: false,
		src: 60,
		tar: 160,
	},
	blankBeat: 0,
	output: ""
}

//help text
if(argv.h){
	console.log("Command line usage:")
	console.log("node [midi file path] [options] [value] [options] [value]...")
	console.log("options:")
	console.log("-o\tOutput filname. ( default: [filename]_remap.mid )")
	console.log("-t\tSet trackNum. ( default: 0 )")
	console.log("-f -f\tFix tempo. Plaese specify two integers. ( default: 0,0 )")
	console.log("-b\tSet blank beat number. ( default: 0 )")
	return
}

// process arguments
if(!argv._[0])
	throw "Empty filename! Please specify a midi file."
if(argv._[0].substr(-4,4) != ".mid")
	throw "Invailable file format! Please specify a midi file."
options.midiFile = argv._[0]
options.output = argv.o || options.midiFile.replace(/\.([^\.]*)$/,"_remap.mid")
options.blankBeat = argv.b || 0
if(argv.t){
	if (typeof(argv.t) == "number" && argv.t % 1 == 0)
		options.trackNum = argv.t || 0
	else throw "Argument t must be an integer!"
}
if(argv.f){
	if (argv.f.length == 2){
		options.tempo.fix = true
		options.tempo.src = argv.f[0]
		options.tempo.tar = argv.f[1]
	}
	else throw "Argument f must be array of length two!"
}


var data = loadMidi(options.midiFile)
var track = data.tracks[options.trackNum]

// fix the tempo and remove beginning blank
// data.header.ticksPerBeat = 768
track[0].deltaTime = 0
var blankBeatSet = false
for(var i = 0;track[i].type != 'noteOn';i++){
	track[i+1].deltaTime = 0;
	if (track[i].type == 'setTempo'){
		if(options.tempo.fix)
			track[i].microsecondsPerBeat = 
				Math.round(track[0].microsecondsPerBeat * options.tempo.src / options.tempo.tar)
		if(options.blankBeat && !blankBeatSet){
			track[i+1] = data.header.ticksPerBeat * options.blankBeat
			blankBeatSet = true
		}
	}
}

// mapping deltaTime to the correct tempo
if(options.tempo.fix){
	for (e of track){
		e.deltaTime = Math.round(e.deltaTime * options.tempo.tar / options.tempo.src)
	}
}

// remove noteOff events
for (var i = 0;i<track.length;i++){
	if(track[i].type == 'noteOff'){
		remove(track,i)
		i--
	}
}
// insert new noteOff events
for (var i = 0;i<track.length;i++){
	var chord = []
	if(track[i].type == 'noteOn'){
		chord.push(Object.assign({},track[i]))
		while(true){
			i++
			if(track[i].type == 'noteOn' && track[i].deltaTime == 0){
				chord.push(Object.assign({},track[i]))
			}
			else {
				i--
				break
			}
		}
		for(e of chord){
			e.type = 'noteOff'
			e.velocity = 0
			insertAfter(track,i,e)
			i++
		}
		chord = []
	}
}

/*
// output event log to file
var eventStr = ''
eventStr += "T     | type              | Note | vel \n"
eventStr += "===== | ================= | ==== | ====\n"
for (e of track){
	var row = `${leftpad(e.deltaTime, 5)} | `+
		`${str(e.type, 17)} | `+
		`${pitch(e.noteNumber)}${str(oct(e.noteNumber), 2)} | `+
		`${str(e.velocity, 4)}`
	eventStr += row + '\n'
	//if (!/note(On|Off)/.test(e.type)) console.log(e)
}
fs.writeFileSync('events.txt',eventStr)
*/


// Export the final data to new midi file
exportMidi(options.output,data)