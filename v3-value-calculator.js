require('dotenv').config()
const Web3 = require('web3')
const fs = require('fs')
const TickMath = require("@uniswap/v3-sdk").TickMath
const SqrtPriceMath = require("@uniswap/v3-sdk").SqrtPriceMath
const JSBI = require("jsbi")
const request = require('request')

// V3 工廠合約地址
const UniswapV3FactoryAddress = "0x1F98431c8aD98523631AE4a59f267346ea31F984" 
// V3 工廠合約ABI
const UniswapV3FactoryABI = "./node_modules/@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json"

// V3 流動池合約地址
const poolAddress = "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8" 
// V3 流動池合約ABI
const IUniswapV3PoolABI = "./node_modules/@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json"

// V3 部位NFT合約地址
const positionNFT_addr = `0xC36442b4a4522E871399CD717aBDD847Ab11FE88`
// V3 流動池合約ABI
const IpositionNFTV3ABI = "./node_modules/@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json"

const rpcEndpoint = `https://mainnet.infura.io/v3/${process.env.infura_id}`
const web3 = new Web3(new Web3.providers.HttpProvider(rpcEndpoint))



const readJsonFileAsync = async (path) => {
  return new Promise((resolve, reject) => {
    fs.readFile(path, 'utf8', async (err, data) => {
      if (err) {
          console.error(err)
          reject(`read error`)
      }
      resolve(data)
    })
  })
}

const toFix = (i)=>{
  var str='';
  do{
    let a = i%10;
    i=Math.trunc(i/10);
    str = a+str;
  }while(i>0)
  return str;
}

const fetch_abi_from_addr = async (addr) => {
  return new Promise(async (resolve, reject) => {
    
    const url = `https://api.etherscan.io/api?module=contract&action=getsourcecode&address=${addr}&apikey=${process.env.etherscan_api_key}`
    request(url ,{}, async (err, res, body) => {
        if (err) { return console.log(err) }
        if(res.statusCode === 200){
          let resj = await JSON.parse(res.body)
          if(`Proxy` in resj.result[0]){
            if(resj.result[0][`Proxy`] === `1`){
              console.log(`upgrade contract from${addr} to ${resj.result[0][`Implementation`]}`)
              let url2 = `https://api.etherscan.io/api?module=contract&action=getsourcecode&address=${resj.result[0][`Implementation`]}&apikey=${process.env.etherscan_api_key}`
              request(url2 ,{}, async (err, res, body) => {
                if (err) { return console.log(err) }
                if(res.statusCode === 200){
                  let resj = await JSON.parse(res.body)
                  let abij = await JSON.parse(resj.result[0].ABI)
                  resolve({address:addr,ABI:abij})
                }
              })
            }else{
              let abij = await JSON.parse(resj.result[0].ABI)
              resolve({address:addr,ABI:abij})
            }
          }
        }
    })
  })
}

const fetch_curr_price_from_addr = async (addr) => {
  return new Promise(async (resolve, reject) => {
    
    const url = `https://api.coingecko.com/api/v3/coins/ethereum/contract/${addr}`
    request(url ,{}, async (err, res, body) => {
        if (err) { return console.log(err) }
        if(res.statusCode === 200){
          let resj = await JSON.parse(res.body)
          resolve(resj.market_data.current_price.usd)
        }
    })
  })
}


var MAX_UINT128 = toFix(Math.pow(2,127)-1)

const calc_protfolio_report_uniswapV3 = async (addr) => {
  var posiNFTJson = null
  let positionNftABI_data = await readJsonFileAsync(IpositionNFTV3ABI)
  posiNFTJson = await JSON.parse(positionNftABI_data)
  
  // 部位資訊是從 NFT 來的，上面有紀錄這個擁有者是誰
  const positionNFT = new web3.eth.Contract(posiNFTJson.abi, positionNFT_addr)
  let balanceCnt = await positionNFT.methods.balanceOf(addr).call({from:addr})
  let indexes = Array.from({length: parseInt(balanceCnt) }, (_, i) => i )
  

  let position_total = 0
  // 循環目前手上部位
  for(id of indexes){
    let tokenId = await positionNFT.methods.tokenOfOwnerByIndex(addr,id).call({from:addr})
    let PositionDetails = await positionNFT.methods.positions(parseInt(tokenId)).call({from:addr})
    console.log(PositionDetails);

    //#region 獲取 已領取手續費
    
    
    let V3PositionFees = await positionNFT.methods['collect((uint256,address,uint128,uint128))']({
      tokenId:parseInt(tokenId),
      recipient:addr,
      amount0Max:MAX_UINT128,
      amount1Max:MAX_UINT128
    }).call({from:addr})
    
    // 獲取已領取手續費的小數位
    let upgraded_token0 = await fetch_abi_from_addr(PositionDetails.token0)
    const contract_token0 = new web3.eth.Contract(upgraded_token0.ABI,upgraded_token0.address)

    let upgraded_token1 = await fetch_abi_from_addr(PositionDetails.token1)
    const contract_token1 = new web3.eth.Contract(upgraded_token1.ABI,upgraded_token1.address)
    
    let decimal_token0 = await contract_token0.methods.decimals().call()
    let decimal_token1 = await contract_token1.methods.decimals().call()

    let unclaimedFeeSz0 = parseFloat(V3PositionFees["0"]) / 10**(parseInt(decimal_token0))
    let unclaimedFeeSz1 = parseFloat(V3PositionFees["1"]) / 10**(parseInt(decimal_token1))
    let price_token0 = await fetch_curr_price_from_addr(upgraded_token0.address)
    let price_token1 = await fetch_curr_price_from_addr(upgraded_token1.address)

    // 從當前未領取手續費*幣價獲得尚未領取手續費(美金計價)
    let unclaimedFeeUSD0 = unclaimedFeeSz0 * price_token0
    let unclaimedFeeUSD1 = unclaimedFeeSz1 * price_token1
    
    //#endregion

    //#region  獲取當前提供的流動性資產總價值

    // 從部位的手續費和幣種詢問 Factory 獲取流動池子地址
    let V3Factory_data = await readJsonFileAsync(UniswapV3FactoryABI)
    let V3FactoryJson = await JSON.parse(V3Factory_data)
    const contract_factory = new web3.eth.Contract(V3FactoryJson.abi,UniswapV3FactoryAddress)
    let poolAddr = await contract_factory.methods[`getPool(address,address,uint24)`](PositionDetails.token0,PositionDetails.token1,PositionDetails.fee).call({from:addr})
    let pool_abi_data = await readJsonFileAsync(IUniswapV3PoolABI)
    let poolJson = await JSON.parse(pool_abi_data)
    let contract_pool = new web3.eth.Contract(poolJson.abi,poolAddr)

    // 從流動池合約拿取當前池的 tick 數值(sqrtPriceX96)
    let cur_pool_status = await contract_pool.methods[`slot0`]().call({from:addr})
    let sqrtPriceX96 = JSBI.BigInt(cur_pool_status.sqrtPriceX96)
    let poolTick = JSBI.BigInt(cur_pool_status.tick)
    let myTick_lower = parseInt(PositionDetails.tickLower)
    let myTick_upper = parseInt(PositionDetails.tickUpper)
    let my_liquidity = JSBI.BigInt(PositionDetails.liquidity)

    // 從當前的 sqrt price (pool tick)，反推現在兩個貨幣對的數量比值
    // 貨幣對 0 數量 -> amount0 (算法從 uniswap-interface 專案抄來的)
    // v3-sdk.cjs.development.js line 2381
    let amount0 = 0
    if (poolTick < myTick_lower) {
      amount0 = SqrtPriceMath.getAmount0Delta(TickMath.getSqrtRatioAtTick(myTick_lower), TickMath.getSqrtRatioAtTick(myTick_upper), my_liquidity, false)
    } else if (poolTick < myTick_upper) {
      amount0 = SqrtPriceMath.getAmount0Delta(sqrtPriceX96, TickMath.getSqrtRatioAtTick(myTick_upper), my_liquidity, false)
    }

    let amount1 = 0
    if (poolTick < myTick_lower) {
      amount1 = 0
    } else if (poolTick < myTick_upper) {
      amount1 = SqrtPriceMath.getAmount1Delta(TickMath.getSqrtRatioAtTick(myTick_lower), sqrtPriceX96, my_liquidity, false)
    } else {
      amount1 = SqrtPriceMath.getAmount1Delta(TickMath.getSqrtRatioAtTick(myTick_lower), TickMath.getSqrtRatioAtTick(myTick_upper), my_liquidity, false)
    }

    // 目前顆數 * 幣價
    let position_0 = Number(amount0) / 10**(parseInt(decimal_token0)) * price_token0
    let position_1 = Number(amount1) / 10**(parseInt(decimal_token1)) * price_token1

    //#endregion
    
    position_total = (position_0+position_1+unclaimedFeeUSD0+unclaimedFeeUSD1).toFixed(2)
    console.log(position_total)
  }
  return position_total
}

module.exports = {
    calc_protfolio_report_uniswapV3
}

