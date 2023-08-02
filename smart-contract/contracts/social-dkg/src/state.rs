use std::fmt::Display;

use cosmwasm_schema::cw_serde;
use cosmwasm_std::{Addr, Binary, Uint256};
use cw_storage_plus::{Deque, Item, Map};

#[cw_serde]
pub struct Config {
    pub members: Vec<Member>,
    pub total: u8,
    pub owner: Addr,
    pub expected_key_num: Uint256,
    pub deadline_time: u64,
    pub dealers: u8,
}

#[cw_serde]
pub struct Member {
    pub index: u8,
    pub pub_key: Binary,
    pub address: Addr,
    pub end_point: String,
}

#[cw_serde]
pub struct MemberShare {
    pub index: u8,
    pub rows: Option<Vec<Binary>>,
    pub commitments: Option<Vec<Binary>>,
    pub pk_share: Option<Binary>,
}

#[cw_serde]
pub enum RoundStatus {
    WaitForDealer = 1,
    WaitForRows,
    WaitForAssigment,
    Assigned,
}

impl Display for RoundStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        match self {
            RoundStatus::WaitForDealer {} => {
                write!(f, "WaitForDealer")
            }
            RoundStatus::WaitForRows {} => {
                write!(f, "WaitForRows")
            }
            RoundStatus::WaitForAssigment {} => {
                write!(f, "WaitForAssigment")
            }
            RoundStatus::Assigned {} => {
                write!(f, "Assigned")
            }
        }
    }
}

#[cw_serde]
pub struct RoundInfo {
    pub round_status: RoundStatus,
    pub members_shares: Option<Vec<MemberShare>>,
    pub deadline: u64,
}

pub const VERIFIERS: Map<&str, String> = Map::new("verifiers");
pub const KEY_POOL: Deque<Uint256> = Deque::new("key_pool");
// Map (app_verifier + verifier_id) =< round
pub const KEY_MAP: Map<(&str, &str), Uint256> = Map::new("key_map");
pub const WORKING_ROUND: Item<Uint256> = Item::new("current_round");
pub const ROUND_INFO: Map<&str, RoundInfo> = Map::new("round_info");
pub const CONFIG: Item<Config> = Item::new("config");
