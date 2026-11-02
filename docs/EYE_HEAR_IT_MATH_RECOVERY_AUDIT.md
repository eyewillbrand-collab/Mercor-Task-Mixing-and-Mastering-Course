# EyE Hear It mathematical recovery audit (read-only source review)

Date: 2026-11-02
Source: private `eyewillbrand-collab/eye-hear-it-eh-eq`, default branch as inspected through GitHub. This document paraphrases general mathematical principles; **no private source files have been copied**.

## Confirmed in repository source
1. `tests/math/include/ehi/test/math/DspOracle.h`: independent, JUCE-free normalized biquad frequency-response oracle using complex arithmetic, dB magnitude, phase in radians/degrees; rejects nonfinite coefficients, invalid frequencies/sample rates and near-singular denominators.
2. `tests/math/DspOracleTests.cpp`: identity, scalar gain, one-sample delay phase, denominator sign convention and invalid-input tests.
3. `tests/coverage/include/ehi/test/coverage/CoverageSequences.h`: deterministic golden-ratio fractional sequence mapped logarithmically over frequency; 16 Fibonacci audio block sizes from 1 through 1597. Not cryptographic or random.
4. `tests/coverage/CoverageSequenceTests.cpp`: bounded/non-repeating sample checks, mapping endpoints and invalid ranges, Fibonacci monotonicity and limiting ratio.
5. `tests/unit/CMakeLists.txt`: references measured-response, golden-coverage and Fibonacci-block suites. Reference to a suite does not itself establish passing execution.

## Prior evidence, not freshly rerun
Historical development record reports 39/39 Release tests passed and zero audio-thread allocations. This audit did not independently rerun the native C++ build or establish current CI status. Previous precision thresholds were proposed/recorded, not independently re-certified here.

## Course translation policy
- Teach standard, independently derivable biquad response math, gain and phase, and measured-versus-predicted error.
- Use golden-ratio frequency sampling to diversify test coverage, not as a quality score or claim of psychoacoustic optimality.
- Use Fibonacci block sizes to test processing consistency, not as an audible musical property.
- Require actual captured audio and an independently specified measurement algorithm before awarding technical mixing/mastering KPI credit.
- Keep listening taste as a separate, rubric-based human assessment; never imply that a mathematically accurate filter is automatically a good mix.
- Do not publish private EyE Hear It DSP implementations, assets, or proprietary evaluation weights without explicit approval.

## Scope and gate
Read-only source inspection completed. Public course may implement **original educational math**, subject to independent tests. No change to private plugin. No merge into main until browser, CI and mathematical tests are independently verified.
