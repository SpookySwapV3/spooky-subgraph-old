/* eslint-disable prefer-const */
import { Pair, Token, Bundle } from '../types/schema'
import { BigDecimal, Address, BigInt, ethereum } from '@graphprotocol/graph-ts/index'
import { ZERO_BD, factoryContract, ADDRESS_ZERO, ONE_BD, UNTRACKED_PAIRS } from './helpers'

const WNATIVE_ADDRESS = '0x23181F21DEa5936e24163FFABa4Ea3B316B57f3C'
const USDT_T_WBTT = '0x418AFCD6D15fA51d59d6C7F7A5943eB04D5F21f0' // created block 26857087

export function getEthPriceInUSD(event: ethereum.Event): BigDecimal {
  // fetch eth prices for each stablecoin
  let usdtNativePair = Pair.load(USDT_T_WBTT) // usdc is token1
  if (usdtNativePair !== null) {
    return usdtNativePair.token1Price
  } else {
    return ZERO_BD
  }
}


// token where amounts should contribute to tracked volume and liquidity
let WHITELIST: string[] = [
  '0x23181F21DEa5936e24163FFABa4Ea3B316B57f3C', // WBTTC
  '0xAD9A21FF0c9d854cA8C1360AF28D4fcbDaC53B4F', // FTM_e
  '0x43559B1786C06d6B826e3cf9AA667eD8840f9106', // ADA_b
  '0x1249C65AfB11D179FFB3CE7D4eEDd1D9b98AD006', // ETH
  '0x17F235FD5974318E4E2a5e37919a209f7c37A6d1', // USDD_t
  '0xdB28719F7f938507dBfe4f0eAe55668903D34a15', // USDT_t
  '0xE887512ab8BC60BcC9224e1c3b5Be68E26048B8B', // USDT_e
  '0xAE17940943BA9440540940DB0F1877f101D39e8b', // USDC_e
  '0xCa424b845497f7204D9301bd13Ff87C0E2e86FCF', // USDC_b
  '0x9888221fE6B5A2ad4cE7266c7826D2AD74D40CcF', // WBTC__e
  '0xfd3b093aB6bD4F40810f19e5fF822ac8Cc7e3184', // LINK_e
  '0xEdf53026aeA60f8F75FcA25f8830b7e2d6200662', // TRX
  '0x185a4091027E2dB459a2433F85f894dC3013aeB5', // BNB
]

// minimum liquidity required to count towards tracked volume for pairs with small # of Lps
let MINIMUM_USD_THRESHOLD_NEW_PAIRS = BigDecimal.fromString('10000')

// minimum liquidity for price to get tracked
let MINIMUM_LIQUIDITY_THRESHOLD_ETH = BigDecimal.fromString('200')

/**
 * Search through graph to find derived Eth per token.
 * @todo update to be derived ETH (add stablecoin estimates)
 **/
export function findEthPerToken(token: Token): BigDecimal {
  if (token.id == WNATIVE_ADDRESS) {
    return ONE_BD
  }
  // loop through whitelist and check if paired with any
  for (let i = 0; i < WHITELIST.length; ++i) {
    let pairAddress = factoryContract.try_getPair(Address.fromString(token.id), Address.fromString(WHITELIST[i]))
    if (!pairAddress.reverted) {
      let pair = Pair.load(pairAddress.value.toHexString())
      if(!pair) continue
      if (pair.token0 == token.id && pair.reserveETH.gt(MINIMUM_LIQUIDITY_THRESHOLD_ETH)) {
        let token1 = Token.load(pair.token1)
        return pair.token1Price.times(token1!.derivedETH as BigDecimal) // return token1 per our token * Eth per token 1
      }
      if (pair.token1 == token.id && pair.reserveETH.gt(MINIMUM_LIQUIDITY_THRESHOLD_ETH)) {
        let token0 = Token.load(pair.token0)
        return pair.token0Price.times(token0!.derivedETH as BigDecimal) // return token0 per our token * ETH per token 0
      }
    }
  }
  return ZERO_BD // nothing was found return 0
}

/**
 * Accepts tokens and amounts, return tracked amount based on token whitelist
 * If one token on whitelist, return amount in that token converted to USD.
 * If both are, return average of two amounts
 * If neither is, return 0
 */
export function getTrackedVolumeUSD(
  tokenAmount0: BigDecimal,
  token0: Token,
  tokenAmount1: BigDecimal,
  token1: Token,
  pair: Pair
): BigDecimal {
  let bundle = Bundle.load('1')
  let price0 = token0.derivedETH!.times(bundle!.ethPrice)
  let price1 = token1.derivedETH!.times(bundle!.ethPrice)

  // dont count tracked volume on these pairs - usually rebass tokens
  if (UNTRACKED_PAIRS.includes(pair.id)) {
    return ZERO_BD
  }

  // if less than 5 LPs, require high minimum reserve amount amount or return 0
  if (pair.liquidityProviderCount.lt(BigInt.fromI32(5))) {
    let reserve0USD = pair.reserve0.times(price0)
    let reserve1USD = pair.reserve1.times(price1)
    if (WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
      if (reserve0USD.plus(reserve1USD).lt(MINIMUM_USD_THRESHOLD_NEW_PAIRS)) {
        return ZERO_BD
      }
    }
    if (WHITELIST.includes(token0.id) && !WHITELIST.includes(token1.id)) {
      if (reserve0USD.times(BigDecimal.fromString('2')).lt(MINIMUM_USD_THRESHOLD_NEW_PAIRS)) {
        return ZERO_BD
      }
    }
    if (!WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
      if (reserve1USD.times(BigDecimal.fromString('2')).lt(MINIMUM_USD_THRESHOLD_NEW_PAIRS)) {
        return ZERO_BD
      }
    }
  }

  // both are whitelist tokens, take average of both amounts
  if (WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    return tokenAmount0
      .times(price0)
      .plus(tokenAmount1.times(price1))
      .div(BigDecimal.fromString('2'))
  }

  // take full value of the whitelisted token amount
  if (WHITELIST.includes(token0.id) && !WHITELIST.includes(token1.id)) {
    return tokenAmount0.times(price0)
  }

  // take full value of the whitelisted token amount
  if (!WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    return tokenAmount1.times(price1)
  }

  // neither token is on white list, tracked volume is 0
  return ZERO_BD
}

/**
 * Accepts tokens and amounts, return tracked amount based on token whitelist
 * If one token on whitelist, return amount in that token converted to USD * 2.
 * If both are, return sum of two amounts
 * If neither is, return 0
 */
export function getTrackedLiquidityUSD(
  tokenAmount0: BigDecimal,
  token0: Token,
  tokenAmount1: BigDecimal,
  token1: Token
): BigDecimal {
  let bundle = Bundle.load('1')
  let price0 = token0.derivedETH!.times(bundle!.ethPrice)
  let price1 = token1.derivedETH!.times(bundle!.ethPrice)

  // both are whitelist tokens, take average of both amounts
  if (WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    return tokenAmount0.times(price0).plus(tokenAmount1.times(price1))
  }

  // take double value of the whitelisted token amount
  if (WHITELIST.includes(token0.id) && !WHITELIST.includes(token1.id)) {
    return tokenAmount0.times(price0).times(BigDecimal.fromString('2'))
  }

  // take double value of the whitelisted token amount
  if (!WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    return tokenAmount1.times(price1).times(BigDecimal.fromString('2'))
  }

  // neither token is on white list, tracked volume is 0
  return ZERO_BD
}
