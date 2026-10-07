## What's Changed

- Incorporated the required capture/decoder source into src/spiritvale and removed all kar-mi package dependencies.
- Corrected public build 25647861 channel decoding from RPC ID 35 to 38; obsolete IDs no longer supply channel context.
- Added opt-in Monitor all with raw PCAP, decoder/attribution traces, encounter markers, bounded health samples and ZIP export.
- Added offline recording analysis and reproducible public-build RPC inspection.
- Added capture/recording regressions for filtering, restarts, limits, storage failures and malformed PCAP.
