# Changelog
Notable and breaking changed and additions to the SDK.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) (*does not apply to alpha development*).

## [0.0.40-alpha] - 2024-07-03

### Changed
- **BREAKING** Major internal session management refactor
- - Sessions now rely on the serialized `DIDSession` format, simplifying management and compatibility with other Ceramic ecosystem apps
- - `serializedSession` as a new option for `connectUser` to pass a serialized session string
- - `OrbisConnectResult` is rebuilt on the fly from the parsed serialized session
- - `orbis.serializedSession` can be used to retrieve a serialized active session (ie. to be used with `localStorage`)
- - `KeyDidSession` now serializes to base64 and stores the DID alongside the seed
- - Migration has been built into `isUserConnected` so sessions created and stored before `0.0.40-alpha` *should* work and will be converted to the new format
- - Multiple types refactored or renamed, this includes `OrbisConnectResult`
- - `metadata.publicKey` removed from the Tezos provider (`metadata.address` remains)

## [0.0.20-alpha] - 2024-02-11

### Changed
- **BREAKING** Updated function signature of `select.orderBy` (now matches other `SELECT` methods that accept multiple values - optionally)

## [version] - YYYY-MM-DD

### Added
- New features

### Changed
- Changes to existing functionality

### Fixed
- Bug fixed

### Removed
- Removed features

### Deprecated
- Deprecated features

### Security
- Vulnerabilities changes