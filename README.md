This repo provides some JavaScript code that implements
Factorio's random number generator, basis noise function, and multioctave noise function.

- Run the RNG tests: ```node 20190305-noise-reproduction.js```
- Run the noise function tests: ```node 20190325-noise.js```

Factorio uses 32-bit floats and some shortcuts for its noise generation,
so the test vectors actually include a bit of error,
which is higher for multioctave noise and higher yet
for multioctave noise with fractional octaves.

Sorry about the nonsensical script names.
