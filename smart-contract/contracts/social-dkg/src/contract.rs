#[cfg(not(feature = "library"))]
use cosmwasm_std::entry_point;
use cosmwasm_std::{
    to_binary, Addr, Binary, Deps, DepsMut, Env, MessageInfo, Order,
    Response, StdError, StdResult, Uint256,
};
use cw2::set_contract_version;
use cw_storage_plus::Bound;
use std::collections::HashSet;

use crate::error::ContractError;
use crate::helpers::{calc_limit, is_expired, keccak_256};
use crate::msg::{
    AssignKeyMsg, ConfigMsg, ConfigResponse, ExecuteMsg,
    InstantiateMsg, ListVerifierIdResponse, MemberMsg, QueryMsg,
    RoundInfoResponse, ShareDealerMsg, ShareRowMsg, Verifier,
    VerifiersResponse,
};
use crate::state::{
    Config, Member, MemberShare, RoundInfo, RoundStatus, CONFIG,
    KEY_MAP, KEY_POOL, ROUND_INFO, VERIFIERS, WORKING_ROUND,
};

// version info for migration info
const CONTRACT_NAME: &str = env!("CARGO_PKG_NAME");
const CONTRACT_VERSION: &str = env!("CARGO_PKG_VERSION");

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn instantiate(
    _deps: DepsMut,
    _env: Env,
    _info: MessageInfo,
    mut _msg: InstantiateMsg,
) -> Result<Response, ContractError> {
    set_contract_version(
        _deps.storage,
        CONTRACT_NAME,
        CONTRACT_VERSION,
    )?;

    let members: StdResult<Vec<Member>> = _msg
        .members
        .into_iter()
        .enumerate()
        .map(|(i, member)| -> StdResult<Member> {
            Ok(Member {
                index: i as u8,
                pub_key: member.pub_key,
                address: _deps.api.addr_validate(&member.address)?,
                end_point: member.end_point,
            })
        })
        .collect();

    let members = members?;

    let config = Config {
        members: members.clone(),
        total: members.len() as u8,
        owner: _deps.api.addr_validate(&_msg.owner)?,
        dealers: _msg.dealers,
        expected_key_num: _msg.expected_key_num,
        deadline_time: _msg.deadline_time,
    };

    WORKING_ROUND.save(_deps.storage, &Uint256::from_u128(1))?;
    CONFIG.save(_deps.storage, &config)?;

    Ok(Response::default())
}

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn execute(
    _deps: DepsMut,
    _env: Env,
    _info: MessageInfo,
    _msg: ExecuteMsg,
) -> Result<Response, ContractError> {
    match _msg {
        ExecuteMsg::ShareDealer { share } => {
            execute_share_dealer(_deps, _env, _info, share)
        }
        ExecuteMsg::ShareRows { share } => {
            execute_share_row(_deps, _env, _info, share)
        }
        ExecuteMsg::UpdateConfig { config } => {
            execute_update_config(_deps, _info, config)
        }
        ExecuteMsg::AssignKey(msg) => {
            execute_assign_key(_deps, _env, msg)
        }
        ExecuteMsg::UpdateVerifier {
            verifier,
            client_id,
        } => {
            execute_update_verifier(_deps, _info, verifier, client_id)
        }
        ExecuteMsg::ResetCurrentRound {} => {
            execute_reset_current_round(_deps, _env, _info)
        }
    }
}

pub fn query_member_position(
    _deps: Deps,
    sender: &Addr,
) -> Result<u8, ContractError> {
    match CONFIG
        .load(_deps.storage)?
        .members
        .into_iter()
        .position(|member| member.address == *sender)
    {
        Some(x) => Ok(x as u8),
        None => Err(ContractError::Unauthorized {}),
    }
}

pub fn execute_share_dealer(
    _deps: DepsMut,
    _env: Env,
    _info: MessageInfo,
    share: ShareDealerMsg,
) -> Result<Response, ContractError> {
    let round = WORKING_ROUND.load(_deps.storage)?;

    if is_expired(_deps.as_ref(), _env.clone(), round)? {
        return Err(ContractError::ExpiredRound {});
    }

    let index = query_member_position(_deps.as_ref(), &_info.sender)?;

    let config = CONFIG.load(_deps.as_ref().storage)?;
    let dealers = config.dealers;

    let update_round = |old_state: Option<RoundInfo>| -> Result<
        RoundInfo,
        ContractError,
    > {
        let member_share = MemberShare {
            index,
            rows: Some(share.rows),
            commitments: Some(share.commitments),
            pk_share: None,
        };

        match old_state {
            Some(mut info) => match info.round_status {
                RoundStatus::WaitForDealer => match info.members_shares {
                    Some(mut mem_shares) => {
                        mem_shares = match mem_shares.iter_mut().find(|s| s.index == index) {
                            Some(_) => {
                                return Err(ContractError::DuplicateMember);
                            }
                            None => {
                                mem_shares.push(member_share);
                                mem_shares
                            }
                        };
                        if dealers <= mem_shares.len() as u8 {
                            info.round_status = RoundStatus::WaitForRows;
                        }
                        info.members_shares = Some(mem_shares);
                        Ok(info)
                    }
                    None => Err(ContractError::InvalidRowThreshold {}),
                },
                _ => Err(ContractError::WrongStatus(format!(
                    "current_status:{0}",
                    info.round_status
                ))),
            },

            None => Ok(RoundInfo {
                round_status: RoundStatus::WaitForDealer,
                members_shares: Some(vec![member_share]),
                deadline: _env.block.height + config.deadline_time
            }),
        }
    };

    ROUND_INFO.update(
        _deps.storage,
        &round.to_string(),
        update_round,
    )?;

    Ok(Response::new()
        .add_attribute("action", "share_dealer")
        .add_attribute("sender", _info.sender))
}

pub fn execute_share_row(
    _deps: DepsMut,
    _env: Env,
    _info: MessageInfo,
    share: ShareRowMsg,
) -> Result<Response, ContractError> {
    let round = WORKING_ROUND.load(_deps.storage)?;

    if is_expired(_deps.as_ref(), _env, round)? {
        return Err(ContractError::ExpiredRound {});
    }

    let index = query_member_position(_deps.as_ref(), &_info.sender)?;

    let round_info =
        ROUND_INFO.load(_deps.storage, &round.to_string())?;

    if round_info.round_status != RoundStatus::WaitForRows {
        return Err(ContractError::WrongStatus(format!(
            "current_status:{0}",
            round_info.round_status
        )));
    }

    let update_row = |old_round_info: Option<RoundInfo>| -> Result<
        RoundInfo,
        ContractError,
    > {
        let round_info: RoundInfo = match old_round_info {
            Some(info) => match info.members_shares {
                Some(mut members) => match members
                    .iter_mut()
                    .find(|m| m.index == index)
                {
                    Some(mut x) => {
                        x.pk_share = Some(share.pk_share);
                        RoundInfo {
                            round_status: info.round_status,
                            members_shares: Some(members),
                            deadline: info.deadline
                        }
                    }
                    None => {
                        members.push(MemberShare {
                            index,
                            rows: None,
                            commitments: None,
                            pk_share: Some(share.pk_share),
                        });
                        RoundInfo {
                            round_status: info.round_status,
                            members_shares: Some(members),
                            deadline:info.deadline
                        }
                    }
                },
                None => {
                    return Err(
                        ContractError::Unauthorized {},
                    )
                }
            },
            None => {
                return Err(ContractError::Unauthorized {})
            }
        };

        Ok(round_info)
    };

    let round_info = ROUND_INFO.update(
        _deps.storage,
        &round.to_string(),
        update_row,
    )?;

    let num_pk_share = round_info
        .members_shares
        .as_ref()
        .unwrap()
        .iter()
        .filter(|m| m.pk_share.is_some())
        .count();

    if num_pk_share as u8 == CONFIG.load(_deps.storage)?.total {
        KEY_POOL.push_back(_deps.storage, &round)?;

        WORKING_ROUND.update(
            _deps.storage,
            |prev| -> Result<Uint256, StdError> {
                prev.checked_add(Uint256::from_u128(1))
                    .map_err(|err| StdError::Overflow { source: err })
            },
        )?;

        ROUND_INFO.update(
            _deps.storage,
            &round.to_string(),
            |old_state| match old_state {
                None => Err(ContractError::Unauthorized {}),
                Some(mut x) => {
                    x.round_status = RoundStatus::WaitForAssigment;
                    Ok(x)
                }
            },
        )?;
    }

    Ok(Response::new()
        .add_attribute("action", "share_row")
        .add_attribute("sender", &_info.sender))
}

pub fn execute_update_config(
    _deps: DepsMut,
    _info: MessageInfo,
    msg: ConfigMsg,
) -> Result<Response, ContractError> {
    let config = CONFIG.load(_deps.storage)?;
    if _info.sender != config.owner {
        return Err(ContractError::Unauthorized {});
    }
    // impl when change members in future
    let new_config = Config {
        members: config.members,
        total: config.total,
        owner: _deps.api.addr_validate(
            &msg.owner.unwrap_or_else(|| config.owner.to_string()),
        )?,
        dealers: msg.dealers.unwrap_or(config.dealers),
        expected_key_num: msg
            .expected_key_num
            .unwrap_or(config.expected_key_num),
        deadline_time: msg
            .deadline_time
            .unwrap_or(config.deadline_time),
    };

    CONFIG.save(_deps.storage, &new_config)?;

    Ok(Response::new()
        .add_attribute("action", "update_config")
        .add_attribute("sender", _info.sender))
}

pub fn execute_assign_key(
    _deps: DepsMut,
    _env: Env,
    msg: AssignKeyMsg,
) -> Result<Response, ContractError> {
    VERIFIERS.load(_deps.storage, &msg.verifier).map_err(|_| {
        ContractError::NotWhitelisted(msg.verifier.clone())
    })?;

    let domain_separator =
        query_domain_separator(_deps.as_ref(), _env).to_base64();

    let hash1 =
        keccak_256((domain_separator + &msg.verifier).as_bytes());

    let hash = keccak_256(
        (Binary(hash1.to_vec()).to_base64() + &msg.verifier_id)
            .as_bytes(),
    );

    if !query_verify_member(
        _deps.as_ref(),
        Binary::from(&hash),
        msg.pub_keys,
        msg.sigs,
    )? {
        return Err(ContractError::Unauthorized {});
    }

    let first_round = KEY_POOL.pop_front(_deps.storage)?;

    match first_round {
        Some(round) => {
            ROUND_INFO.update(
                _deps.storage,
                &round.to_string(),
                |prev| -> Result<RoundInfo, ContractError> {
                    match prev {
                        Some(mut round_info) => {
                            round_info.round_status =
                                RoundStatus::Assigned;
                            Ok(round_info)
                        }
                        None => Err(ContractError::PoolEmpty),
                    }
                },
            )?;
            KEY_MAP.update(
                _deps.storage,
                (&msg.verifier, &msg.verifier_id),
                |old_round: Option<Uint256>| match old_round {
                    Some(_) => Err(ContractError::InvalidAssigned),
                    None => Ok(round),
                },
            )?;
        }
        None => return Err(ContractError::PoolEmpty),
    }

    Ok(Response::new()
        .add_attribute("action", "assign_key")
        .add_attribute("verify_id", &msg.verifier_id)
        .add_attribute("verifier", &msg.verifier)
        .add_attribute("round", first_round.unwrap().to_string()))
}

pub fn execute_update_verifier(
    _deps: DepsMut,
    _info: MessageInfo,
    verifier: String,
    client_id: String,
) -> Result<Response, ContractError> {
    let owner = CONFIG.load(_deps.storage)?.owner;

    if owner != _info.sender {
        return Err(ContractError::Unauthorized {});
    }

    VERIFIERS.save(_deps.storage, &verifier, &client_id)?;
    Ok(Response::new()
        .add_attribute("action", "update_verifier")
        .add_attribute("verifier", &verifier)
        .add_attribute("client_id", &client_id))
}

pub fn execute_reset_current_round(
    _deps: DepsMut,
    _env: Env,
    _info: MessageInfo,
) -> Result<Response, ContractError> {
    query_member_position(_deps.as_ref(), &_info.sender)?;

    let round_info = query_working_round_info(_deps.as_ref())?;
    let current_round = WORKING_ROUND.load(_deps.storage)?;
    let is_expired = round_info.deadline < _env.block.height;
    let true_status = round_info.round_status
        == RoundStatus::WaitForDealer as u8
        || round_info.round_status == RoundStatus::WaitForRows as u8;

    if is_expired && true_status {
        ROUND_INFO.remove(_deps.storage, &current_round.to_string())
    } else {
        return Err(ContractError::Unauthorized {});
    }

    Ok(Response::new()
        .add_attribute("action", "reset_current_round")
        .add_attribute("round", &current_round.to_string()))
}

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn query(
    _deps: Deps,
    _env: Env,
    _msg: QueryMsg,
) -> StdResult<Binary> {
    match _msg {
        QueryMsg::RoundInfo { round } => {
            to_binary(&query_round_info(_deps, round)?)
        }
        QueryMsg::RoundWorkingInfo {} => {
            to_binary(&query_working_round_info(_deps)?)
        }
        QueryMsg::Config {} => query_config(_deps),
        QueryMsg::VerifyMember {
            msg,
            pub_keys,
            sigs,
        } => to_binary(&query_verify_member(
            _deps, msg, pub_keys, sigs,
        )?),
        QueryMsg::VerifierIdInfo {
            verifier_id,
            verifier,
        } => to_binary(&query_verifier_id(
            _deps,
            verifier_id,
            verifier,
        )?),
        QueryMsg::WorkingRoundIndex {} => {
            to_binary(&WORKING_ROUND.load(_deps.storage)?)
        }
        QueryMsg::TotalWaitToAssignRounds {} => {
            to_binary(&KEY_POOL.len(_deps.storage)?)
        }
        QueryMsg::ClientId { verifier } => {
            to_binary(&VERIFIERS.load(_deps.storage, &verifier)?)
        }
        QueryMsg::DomainSeparator {} => {
            to_binary(&query_domain_separator(_deps, _env))
        }
        QueryMsg::Verifiers { start_after, limit } => {
            to_binary(&query_verifiers(_deps, start_after, limit)?)
        }
        QueryMsg::ListVerifierIdByVerifier {
            verifier,
            start_after,
            limit,
        } => to_binary(&query_list_verifier_id(
            _deps,
            verifier,
            start_after,
            limit,
        )?),
    }
}

pub fn query_verifier_id(
    _deps: Deps,
    verifier_id: String,
    verifier: String,
) -> Result<RoundInfoResponse, StdError> {
    let round =
        KEY_MAP.load(_deps.storage, (&verifier, &verifier_id))?;
    query_round_info(_deps, round)
}

pub fn query_round_info(
    _deps: Deps,
    round: Uint256,
) -> Result<RoundInfoResponse, StdError> {
    let round_info =
        ROUND_INFO.load(_deps.storage, &round.to_string())?;

    let round_response = RoundInfoResponse {
        round_id: round,
        round_status: round_info.round_status as u8,
        members_shares: round_info.members_shares,
        deadline: round_info.deadline,
    };

    Ok(round_response)
}

pub fn query_working_round_info(
    _deps: Deps,
) -> Result<RoundInfoResponse, StdError> {
    query_round_info(_deps, WORKING_ROUND.load(_deps.storage)?)
}

pub fn query_config(_deps: Deps) -> StdResult<Binary> {
    let config = CONFIG.load(_deps.storage)?;
    to_binary(&ConfigResponse {
        members: config
            .members
            .into_iter()
            .map(|member| MemberMsg {
                pub_key: member.pub_key,
                address: member.address.to_string(),
                end_point: member.end_point,
            })
            .collect(),
        total: config.total,
        dealer: config.dealers,
        owner: config.owner.to_string(),
        expected_key_num: config.expected_key_num,
    })
}

pub fn query_verify_member(
    _deps: Deps,
    msg: Binary,
    pub_keys: Vec<Binary>,
    sigs: Vec<Binary>,
) -> Result<bool, StdError> {
    let config = CONFIG.load(_deps.storage)?;
    let dealers = config.dealers as usize;

    if sigs.len() < dealers {
        return Ok(false);
    }

    let user_pubkey: HashSet<Binary> =
        config.members.into_iter().map(|m| m.pub_key).collect();
    //
    let mut couple_sig_and_valid_pubkey: Vec<(Binary, Binary)> = sigs
        .into_iter()
        .zip(pub_keys.into_iter())
        .filter(|(_s, p)| user_pubkey.contains(p))
        .collect();

    couple_sig_and_valid_pubkey.sort_by(|a, b| a.1.cmp(&b.1));
    couple_sig_and_valid_pubkey.dedup();

    if couple_sig_and_valid_pubkey.len() < dealers {
        return Ok(false);
    }

    let mut validate: usize = 0;

    for (sig, pk) in couple_sig_and_valid_pubkey.into_iter() {
        match _deps.api.secp256k1_verify(
            msg.as_slice(),
            sig.as_slice(),
            pk.as_slice(),
        ) {
            Ok(m) => {
                if m {
                    validate += 1;
                }
            }
            Err(err) => {
                return Err(StdError::VerificationErr { source: err })
            }
        }
    }

    if validate < dealers {
        return Ok(false);
    }

    Ok(true)
}

pub fn query_domain_separator(_deps: Deps, _env: Env) -> Binary {
    let domain_separator =
        _env.block.chain_id + &_env.contract.address.into_string();
    let hash = keccak_256(domain_separator.as_bytes());
    Binary::from(hash)
}

pub fn query_verifiers(
    _deps: Deps,
    start_after: Option<String>,
    limit: Option<u32>,
) -> StdResult<VerifiersResponse> {
    let limit = calc_limit(limit);

    let start = start_after.map(|s| Bound::ExclusiveRaw(s.into()));

    let verifiers = VERIFIERS
        .range(_deps.storage, start, None, Order::Ascending)
        .take(limit)
        .map(|item| {
            item.map(|(verifier, client_id)| Verifier {
                verifier,
                client_id,
            })
        })
        .collect::<StdResult<Vec<_>>>()?;

    Ok(VerifiersResponse { verifiers })
}

pub fn query_list_verifier_id(
    _deps: Deps,
    verifier: String,
    start_after: Option<String>,
    limit: Option<u32>,
) -> StdResult<ListVerifierIdResponse> {
    let limit = calc_limit(limit);
    let start = start_after.map(|s| Bound::ExclusiveRaw(s.into()));

    let list_verifier_id = KEY_MAP
        .prefix(&verifier)
        .range(_deps.storage, start, None, Order::Ascending)
        .take(limit)
        .map(|item| item.map(|(verifier_id, _)| verifier_id))
        .collect::<StdResult<Vec<_>>>()?;

    Ok(ListVerifierIdResponse {
        verifier,
        list_verifier_id,
    })
}

#[cfg(test)]
mod tests {}
