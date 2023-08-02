use cosmwasm_schema::{cw_serde, QueryResponses};
use cosmwasm_std::{Binary, Uint256};

use crate::{state::MemberShare, ContractError};

#[cw_serde]
pub struct InstantiateMsg {
    pub members: Vec<MemberMsg>,
    // thresh_hold for dealer & rows
    pub dealers: u8,
    pub owner: String,
    pub expected_key_num: Uint256,
    pub deadline_time: u64,
}

impl InstantiateMsg {
    pub fn validate(&mut self) -> Result<Self, ContractError> {
        let total = self.members.len();

        if total < self.dealers as usize {
            return Err(ContractError::InvalidDealerThreshold {});
        }

        self.members.sort_by(|a, b| a.address.cmp(&b.address));
        self.members.dedup_by_key(|a| a.address.clone());

        if total != self.members.len() {
            return Err(ContractError::DuplicateMember {});
        }

        Ok(self.to_owned())
    }
}

#[cw_serde]
pub struct ShareDealerMsg {
    pub rows: Vec<Binary>,
    pub commitments: Vec<Binary>,
}

#[cw_serde]
pub struct MemberMsg {
    pub pub_key: Binary,
    pub address: String,
    pub end_point: String,
}
#[cw_serde]
pub struct ShareRowMsg {
    pub pk_share: Binary,
}

#[cw_serde]
pub struct ConfigMsg {
    pub members: Option<MemberMsg>,
    pub owner: Option<String>,
    pub dealers: Option<u8>,
    pub expected_key_num: Option<Uint256>,
    pub deadline_time: Option<u64>,
}

#[cw_serde]
pub struct AssignKeyMsg {
    pub sigs: Vec<Binary>,
    pub pub_keys: Vec<Binary>,
    pub verifier_id: String,
    pub verifier: String,
}

#[cw_serde]
pub enum ExecuteMsg {
    // submit commitments and rows
    ShareDealer { share: ShareDealerMsg },
    // generates pk_share
    ShareRows { share: ShareRowMsg },
    // update config of contract
    UpdateConfig { config: ConfigMsg },
    AssignKey(AssignKeyMsg),
    UpdateVerifier { verifier: String, client_id: String },
    ResetCurrentRound {},
}

#[cw_serde]
#[derive(QueryResponses)]
pub enum QueryMsg {
    #[returns(RoundInfoResponse)]
    VerifierIdInfo {
        verifier_id: String,
        verifier: String,
    },
    #[returns(RoundInfoResponse)]
    RoundInfo { round: Uint256 },
    #[returns(RoundInfoResponse)]
    RoundWorkingInfo {},
    #[returns(String)]
    WorkingRoundIndex {},
    #[returns(bool)]
    VerifyMember {
        msg: Binary,
        pub_keys: Vec<Binary>,
        sigs: Vec<Binary>,
    },
    #[returns(ConfigResponse)]
    Config {},
    #[returns(u32)]
    TotalWaitToAssignRounds {},
    #[returns(String)]
    ClientId { verifier: String },
    #[returns(VerifiersResponse)]
    Verifiers {
        start_after: Option<String>,
        limit: Option<u32>,
    },
    #[returns(ListVerifierIdResponse)]
    ListVerifierIdByVerifier {
        verifier: String,
        start_after: Option<String>,
        limit: Option<u32>,
    },
    #[returns(Binary)]
    DomainSeparator {},
}

#[cw_serde]
pub struct Verifier {
    pub verifier: String,
    pub client_id: String,
}

#[cw_serde]
pub struct VerifiersResponse {
    pub verifiers: Vec<Verifier>,
}

#[cw_serde]
pub struct ListVerifierIdResponse {
    pub verifier: String,
    pub list_verifier_id: Vec<String>,
}

#[cw_serde]
pub struct ConfigResponse {
    pub members: Vec<MemberMsg>,
    pub total: u8,
    pub dealer: u8,
    pub owner: String,
    pub expected_key_num: Uint256,
}

#[cw_serde]
pub struct RoundInfoResponse {
    pub round_id: Uint256,
    pub round_status: u8,
    pub members_shares: Option<Vec<MemberShare>>,
    pub deadline: u64,
}
