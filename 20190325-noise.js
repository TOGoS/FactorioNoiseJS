const RandomGenerator = require('./20190305-noise-reproduction.js').default;
const fs = require('fs');

function readFile(file, options) {
    if (options === void 0) { options = {}; }
    return new Promise(function (resolve, reject) {
        fs.readFile(file, options, function (err, content) {
            if (err)
                reject(err);
            else
                resolve(content);
        });
    });
}
function readFileToString(file, options) {
    if (options === void 0) { options = {}; }
    var trueOptions = {
        encoding: options.encoding || "utf8",
        flag: options.flag
    };
    return readFile(file, trueOptions).then(function (content) {
        // Shouldn't happen, since we're not allowing encoding to be specified, but just in case we screw up:
        if (typeof content != 'string')
            return Promise.reject(new Error("File not read as a string!"));
        // Supposedly Buffer acts as a Uint8Array, so we can just return it.
        return Promise.resolve(content);
    });
}

function randomShuffle(container, generator)
{
	if( container.length == 0 ) return;
	for( let i=container.length-1; i > 0; --i ) {
		let j = generator.nextIntBetween(0, i+1);
		let temp = container[i];
		container[i] = container[j];
		container[j] = temp;
	}
}

function makeBasisNoiseFunction(spec) {
	let p1 = [], p2 = [], p3 = [];
	let gradients = [];
	for( let i = 0; i < 256; ++i ) {
		p1[i] = p2[i] = p3[i] = i;
		let angle = Math.PI * i / 128;
		gradients[i] = [4.2 * Math.cos(angle), 4.2 * Math.sin(angle)];
	}
	
	let seed1 = spec.seed1;
	let shuffleRng = RandomGenerator.forSeed(spec.seed0);
	
	randomShuffle(p1, shuffleRng);
	randomShuffle(p2, shuffleRng);
	randomShuffle(p3, shuffleRng);
	randomShuffle(gradients, shuffleRng);

	function gradient(x, y) {
		let rowHash = p1[seed1] ^ p2[y & 0xFF];
		let hash = p3[x & 0xFF] ^ rowHash;
		//console.log("Gradient for "+x+","+y+": rowHash:"+rowHash+" hash:"+hash+": "+JSON.stringify(gradients[hash]));
		return gradients[hash];
	}

	function cube(x) {
		return x*x*x;
	}

	const cornerOffsets = [[0,0], [1,0], [0,1], [1,1]];

	return function(x, y) {
		let gridX = Math.floor(x), xx = x - gridX;
		let gridY = Math.floor(y), yy = y - gridY;
		let gradients = cornerOffsets.map( off => {
			return gradient(gridX+off[0], gridY+off[1]);
		});
		return cornerOffsets.map( (off,j) => {
			let xxShifted = xx - off[0], yyShifted = yy - off[1];
			let distanceSquared = xxShifted * xxShifted + yyShifted * yyShifted;
			let surflet = cube(1 - Math.min(distanceSquared, 1));
			let term = surflet * (gradients[j][0] * xxShifted + gradients[j][1] * yyShifted)
			return term;
		}).reduce( (a,b) => a+b );
	}
}

/** Returns a multiplier to apply to amplitude between octaves
 * when working from smallest to largest in order to end up with
 * the desired amplitude */
function modifiedAmplitude(amplitude, octaves, persistence) {
	if( persistence == 1 ) return amplitude / Math.sqrt(octaves);
	if( persistence == 0 ) return amplitude;
	let p2 = persistence * persistence;
	return amplitude * Math.sqrt( (p2 - 1) / (Math.pow(p2, octaves) - 1) );
}

function makeMultioctaveNoiseFunction(spec) {
	let basisNoise = makeBasisNoiseFunction(spec);
	let intOctaves = Math.ceil(spec.octaveCount);
	let invPersistence = 1 / spec.persistence;
	return function(x,y) {
		// Start at the smallest scale octave (largest inputScale) and work outwards.
		// When there's a fractional octave, we actually start at an even smaller scale
		// (which means a slightly higher inputScale).
		let octaveInputScale = 2 ** (intOctaves - spec.octaveCount);
		let octaveAmplitude = modifiedAmplitude(1, intOctaves, invPersistence);
		let result = 0;
		//console.log(`x:${x} y:${y} octaves:${spec.octaveCount} intOctaves:${intOctaves} octaveInputScale:${octaveInputScale} octaveAmplitude:${octaveAmplitude} invPersistence:${invPersistence}`);
		for( let i=0; i<intOctaves; ++i ) {
			result += octaveAmplitude * basisNoise(x * octaveInputScale + i * 17.17, y * octaveInputScale);
			//console.log(`octave:${i} x1:${x * octaveInputScale + i * 17.17} y1:${y * octaveInputScale} octaveInputScale:${octaveInputScale} octaveAmplitude:${octaveAmplitude} result:${result}`);
			octaveInputScale *= 0.5;
			octaveAmplitude *= invPersistence;
		}
		return result;
	}
}

function makeNoiseFunction(spec) {
	if( spec.functionName == 'FactorioBasisNoise' ) {
		return makeBasisNoiseFunction(spec);
	} else {
		return makeMultioctaveNoiseFunction(spec);
	}
}

function caseInfo(testCase) {
	let bling = {};
	for( let k in testCase ) if(k != 'samples') bling[k] = testCase[k];
	return bling;
}

function logMismatch(testCase, sample, result) {
	throw new Error("Mismatched result for "+JSON.stringify(caseInfo(testCase))+" sample "+JSON.stringify(sample)+": "+result+" != "+sample.value);
}

function errorRatio(expected, actual) {
	return Math.abs(expected - actual) / Math.max(expected, actual);
}

function runTest(testCase) {
	const maxDeviation =
		testCase.functionName == 'FactorioBasisNoise' ? 0.00002 :
		testCase.octaveCount == Math.floor(testCase.octaveCount) ? 0.0005 :
		0.005; // Factorio 0.17 uses a sloppy approximation of 2**x when calculating fractional octaves
	let noiseFunction = makeNoiseFunction(testCase);
	let sampleCount = 0;
	let totalDeviation = 0;
	for( let s in testCase.samples ) {
		let sample = testCase.samples[s];
		let result = noiseFunction(sample.x, sample.y);
		let deviation = Math.abs(sample.value - result);
		if( deviation > maxDeviation ) {
			logMismatch(testCase, sample, result);
		}
		totalDeviation += deviation;
		++sampleCount;
	}
	//console.log("Case passed: "+JSON.stringify(caseInfo(testCase)));
	return { sampleCount, totalDeviation };
}

//let rng = RandomGenerator.forSeed(1234);
//let rn0 = rng.nextInt();
//console.log("First rng(1234).nextInt() = "+rn0);
//console.log(`(${rn0} % (256 - 0)) + 256 = ${(rn0 % (256 - 0)) + 0}`);
//
//rng = RandomGenerator.forSeed(1234);
//console.log("First rng(1234).nextIntBetween(0, 256) = "+rng.nextIntBetween(0,256));

rng = RandomGenerator.forSeed(1234);
let rn = rng.nextIntBetween(0, 256);
if( rn != 23 ) {
	throw new Error("rng(1234).nextIntBetween(0,256) should have returned 23, but got "+rn);
}

readFileToString('./20190325-noise-test-vectors.json').then( testCaseJson => {
	return JSON.parse(testCaseJson);
}).then( testCases => {
	let caseCount = 0;
	let sampleCount = 0;
	let totalDeviation = 0;
	for( let v in testCases ) {
		let res = runTest(testCases[v]);
		caseCount += 1;
		sampleCount += res.sampleCount;
		totalDeviation += res.totalDeviation;
	}
	console.log("Ran "+caseCount+" different functions over "+sampleCount+" samples; average deviation = "+(totalDeviation/sampleCount));
}).catch( err => {
	console.error(err);
	process.exit(1);
});
