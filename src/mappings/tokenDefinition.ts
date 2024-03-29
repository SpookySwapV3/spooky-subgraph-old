import {
  Address,
  BigInt,
} from "@graphprotocol/graph-ts"

// Initialize a Token Definition with the attributes
export class TokenDefinition {
  address : Address
  symbol: string
  name: string
  decimals: BigInt

  // Initialize a Token Definition with its attributes
  constructor(address: Address, symbol: string, name: string, decimals: BigInt) {
    this.address = address
    this.symbol = symbol
    this.name = name
    this.decimals = decimals
  }

  // Get all tokens with a static defintion
  // static getStaticDefinitions(): Array<TokenDefinition> {
  //   const staticDefinitions: Array<TokenDefinition> = 
  //   [
  //     {
  //       address: Address.fromString('0x21be370d5312f44cb42ce377bc9b8a0cef1a4c83'),
  //       symbol: 'WFTM',
  //       name: 'Wrapped Fantom',
  //       decimals: BigInt.fromI32(18)
  //     }
  //   ]

  //   return staticDefinitions
  // }

  // Helper for hardcoded tokens
  // Compiler shits the bed when trying to compiled getStaticDefinitions so I removed it
  static fromAddress(tokenAddress: Address) : TokenDefinition | null {
    // If not found, return null
    return null
  }

}