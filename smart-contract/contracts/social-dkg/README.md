# SOCIAL-LOGIN-DKG

## Files

- `msg.rs`: Contains the definition of the contract messages and their associated structs.
- `state.rs`: Defines the contract state structs and other related types.

## Messages

The smart contract supports the following messages:

### InstantiateMsg

- `members`: An array of `MemberMsg` structs representing the members involved in the contract.
- `dealers`: A threshold value representing the minimum number of dealers required.
- `owner`: The address of the contract owner.
- `expected_key_num`: A `Uint256` value representing the expected number of keys.
- `deadline_time`: The deadline time for one round.

### ShareDealerMsg

- `rows`: An array of `Binary` objects representing rows.
- `commitments`: An array of `Binary` objects representing commitments.

### MemberMsg

- `pub_key`: A `Binary` object representing the public key.
- `address`: The address of the member.
- `end_point`: The endpoint associated with the member (enpoint of executor).

### ShareRowMsg

- `pk_share`: A `Binary` object representing the shared public key.

### ConfigMsg

- `members`: An optional `MemberMsg` object representing the contract members.
- `owner`: An optional string representing the contract owner.
- `dealers`: An optional value representing the number of dealers.
- `expected_key_num`: An optional `Uint256` value representing the expected number of keys.
- `deadline_time`: An optional value representing the deadline time for one round.

### AssignKeyMsg

- `sigs`: An array of `Binary` objects representing signatures.
- `pub_keys`: An array of `Binary` objects representing public keys.
- `verifier_id`: The identifier of the verifier.
- `verifier`: The verifier associated with the keys.

### ExecuteMsg

- `ShareDealer`: Submits commitments and rows. Contains a `ShareDealerMsg` object.
- `ShareRows`: Generates pk_share. Contains a `ShareRowMsg` object.
- `UpdateConfig`: Updates the contract configuration. Contains a `ConfigMsg` object.
- `AssignKey`: Assigns keys. Contains an `AssignKeyMsg` object.
- `UpdateVerifier`: Updates the verifier information. Contains a verifier string and a client ID string.
- `ResetCurrentRound`: Resets the current round.

### QueryMsg

The contract supports various query messages. Here are a few examples:

- `VerifierIdInfo`: Retrieves information about a specific verifier ID.
- `RoundInfo`: Retrieves information about a specific round.
- `RoundWorkingInfo`: Retrieves information about the current working round.
- `Config`: Retrieves the contract configuration.
- `TotalWaitToAssignRounds`: Retrieves the total number of rounds waiting to be assigned.
- `ClientId`: Retrieves the client ID for a specific verifier.
- `Verifiers`: Retrieves a list of verifiers.
- `ListVerifierIdByVerifier`: Retrieves a list of verifier IDs by verifier name.
- `DomainSeparator`: Retrieves the domain separator.

## State

The smart contract maintains the following state variables:

### Config

- `members`: An array of `Member` objects representing the contract members.
- `total`: The total number of members.
- `owner`: The address of the contract owner.
- `expected_key_num`: A `Uint256` value representing the expected number of keys.
- `deadline_time`: The deadline time for one round.
- `dealers`: The number of dealers.
