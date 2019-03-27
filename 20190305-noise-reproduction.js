let rngTestCases = [
	{"seed":100,"mode":"float","outputs":[0.010579408146440982818603515625,0.3281851415522396564483642578125,0.9268365795724093914031982421875,0.02624893351458013057708740234375,0.75399273377843201160430908203125,0.66439048689790070056915283203125]},
	{"seed":100,"mode":"integer","outputs":[45438212,1409544450,3980732798,112738311,3238374133,2853535413]},
	{"seed":200,"mode":"float","outputs":[0.010579408146440982818603515625,0.3281851415522396564483642578125,0.9268365795724093914031982421875,0.02624893351458013057708740234375,0.75399273377843201160430908203125,0.66439048689790070056915283203125]},
	{"seed":200,"mode":"integer","outputs":[45438212,1409544450,3980732798,112738311,3238374133,2853535413]},
	{"seed":400,"mode":"float","outputs":[0.01258999272249639034271240234375,0.56254100869409739971160888671875,0.556048437021672725677490234375,0.01928711053915321826934814453125,0.535262481309473514556884765625,0.69541108212433755397796630859375]},
	{"seed":400,"mode":"integer","outputs":[54073607,2416095235,2388209852,82837509,2298934852,2986767855]},
	{"seed":401,"mode":"float","outputs":[0.01258999272249639034271240234375,0.56254100869409739971160888671875,0.556048437021672725677490234375,0.01928711053915321826934814453125,0.535262481309473514556884765625,0.69541108212433755397796630859375]},
	{"seed":401,"mode":"integer","outputs":[54073607,2416095235,2388209852,82837509,2298934852,2986767855]},
	{"seed":500,"mode":"float","outputs":[0.0156154050491750240325927734375,0.95315653155557811260223388671875,0.24925593170337378978729248046875,0.022830964066088199615478515625,0.41808090289123356342315673828125,0.742552311159670352935791015625]},
	{"seed":500,"mode":"integer","outputs":[67067654,4093776131,1070546075,98058244,1795643805,3189237892]},
	{"seed":1234,"mode":"integer","outputs":[166554903]},
];

function RandomGenerator(seed1, seed2, seed3) {
	this.seed1 = seed1;
	this.seed2 = seed2;
	this.seed3 = seed3;
}
RandomGenerator.forSeed = function(seed) {
	if(seed < 341) seed = 341;
	return new RandomGenerator(seed, seed, seed);
}
RandomGenerator.prototype.nextInt = function() {
	// These numbers are all unsigned integers in C++
	// so they must be >>>ed instead of >>ed
	// in order to match that behavior in JavaScript.
	let a = (((this.seed1 << 13) ^ this.seed1) >>> 19);
	this.seed1 = (((this.seed1 & 4294967294) << 12) ^ a);
	let b = (((this.seed2 <<  2) ^ this.seed2) >>> 25);
	this.seed2 = (((this.seed2 & 4294967288) <<  4) ^ b);
	let c = (((this.seed3 <<  3) ^ this.seed3) >>> 11);
	this.seed3 = (((this.seed3 & 4294967280) << 17) ^ c);
	let result = this.seed1 ^ this.seed2 ^ this.seed3;
    //console.log(`a:${a} b:${b} c:${c} seed1:${this.seed1} seed2:${this.seed2} seed3:${this.seed3} result:${result}`);
	if( result < 0 ) result += 4294967296;
	return result;
}
RandomGenerator.prototype.nextIntBetween = function(min, max) {
	return (this.nextInt() % (max - min)) + min;
}
RandomGenerator.prototype.nextFloat = function() {
	return this.nextInt() * 2.3283064365386963e-10;
}

Object.defineProperty(exports, "__esModule", {
  value: true
});
module.exports = {
	RandomGenerator,
	"default": RandomGenerator,
}

if( require.main == module ) {
	function errorRatio(expected, actual) {
		return Math.abs(expected - actual) / Math.max(expected, actual);
	}
	
	const failuresExitCode = 2;
	
	let failureCount = 0;
	function logFailure(message) {
		console.error("Test failure: "+message);
		++failureCount;
		if( failureCount > 10 ) {
			console.error("Too many test failures; exiting");
			process.exit(failuresExitCode);
		}
	}
	
	function logMismatch(expected, actual, testCase) {
		logFailure("Expected "+expected+"; got "+actual+" for "+testCase);
	}
	
	//let maxErrorRatio = 1/1000000;
	let maxErrorRatio = 0;
		
	function testRng() {
		for( let c in rngTestCases ) {
			let testCase = rngTestCases[c];
			let rng = RandomGenerator.forSeed(testCase.seed);
			for( let o in testCase.outputs ) {
				let expectedValue = testCase.outputs[o];
				let actualValue = testCase.mode == "integer" ? rng.nextInt() : rng.nextFloat();
				if( errorRatio(expectedValue, actualValue) > maxErrorRatio ) {
					logMismatch(expectedValue, actualValue, `RNG(seed=${testCase.seed}), sample #${o}`);
				}
			}
		}
	}
	
	testRng();
	
	if( failureCount == 0 ) {
		console.log("All tests passed!");
	}
	process.exit(failureCount > 0 ? failuresExitCode : 0);
}
