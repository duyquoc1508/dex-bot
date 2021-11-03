import axios, { AxiosResponse } from 'axios';
import * as dotenv from 'dotenv';
import path from 'path';
import Web3 from 'web3';
dotenv.config();

const ORDER_TYPE = {
  BUY: 'BUY',
  SELL: 'SELL'
};

class ToTheMoonService {
  private watchingList: string[] = [];
  private web3: Web3;
  private abi = require(path.join(__dirname, '../pancakeswap.abi.json'));
  private pancakeContractAddress = process.env.PANCAKE_SWAP_CONTRACT_ADDRESS;
  private bscRpcUrl =
    process.env.BLOCKCHAIN_RPC_URL || 'https://data-seed-prebsc-1-s1.binance.org:8545/';
  private pancakeSwapContract: any;
  constructor(watchingList: string[]) {
    this.watchingList = watchingList;
    this.web3 = new Web3(this.bscRpcUrl);
    this.pancakeSwapContract = new this.web3.eth.Contract(this.abi, this.pancakeContractAddress);
  }

  async getAllTokenPriceInWatchingList() {
    try {
      const ps1: any[] = [];
      this.watchingList.forEach((token) => {
        ps1.push(this.getTokenPrice(token));
      });
      const rs1 = await Promise.all(ps1);
      return rs1 || false;
    } catch (error) {
      return false;
    }
  }

  async getTokenPrice(tokenAddress: string): Promise<any> {
    try {
      const getPriceUrl: string = `${process.env.PANCAKE_API_URL}/${tokenAddress}`;
      const result: AxiosResponse = await axios.get(getPriceUrl);
      if (result.status !== 200) {
        return false;
      }
      return result.data;
    } catch (error) {
      console.log(`Error > ${error}`);
      return false;
    }
  }

  async swap(fromTokenAddress: string, toTokenAddress: string, amount: number): Promise<any> {
    // const factory = contractInstance.methods.factory().call();
    const factory = this.pancakeSwapContract.methods.factory().encodeABI();
    // TODO:
  }
}

// const abi = require(path.join(__dirname, '../diem.json'));
// const diemContractAddress = process.env.DIEM_CONTRACT_ADDRESS;
// const contractInstance = new web3.eth.Contract(abi, diemContractAddress);
// console.log(contractInstance)

const main = async () => {
  try {
    const orderBooks = [
      {
        symbol: 'PSB',
        type: ORDER_TYPE.SELL,
        price: 1.3, // greater than this price,
        contractAddress: '0x36bfbb1d5b3c9b336f3d64976599b6020ca805f1',
        amount: 100 // amount
      },
      {
        symbol: 'MONO',
        type: ORDER_TYPE.BUY,
        price: 0.11, // less than this price
        contractAddress: '0xd4099a517f2fbe8a730d2ecaad1d0824b75e084a',
        amount: 100
      }
    ];
    const watchingList: string[] = orderBooks.map((order) => order.contractAddress);
    const services = new ToTheMoonService(watchingList);
    /** check contract address in order books */
    const isValidTokenPrice = await services.getAllTokenPriceInWatchingList();
    if (
      !isValidTokenPrice ||
      isValidTokenPrice.some((tokenPrice) => !tokenPrice || !tokenPrice.data.price)
    ) {
      console.error('Có gì đó sai sai >>> Kiểm tra lại địa chỉ contract các token');
      throw Error('Get token price failed');
    }
    const USDT_CONTRACT_ADDRESS =
      process.env.USDT_CONTRACT_ADDRESS || '0x55d398326f99059ff775485246999027b3197955';

    setInterval(async () => {
      console.log('======================================================================');
      console.log(`Get token price at: ${new Date()}`);
      const listTokenPrice = await services.getAllTokenPriceInWatchingList();
      console.log(listTokenPrice);
      if (!listTokenPrice || listTokenPrice.length < 1) {
        throw Error('Get token price failed');
      }
      const mappingSymbolToTokenPrice = listTokenPrice.reduce((acc, cur) => {
        acc[cur.data.symbol] = Number(cur.data.price);
        return acc;
      }, {});
      // console.log(`currentPrice >>> ${tokenPrice.data.price}`);
      // console.log(`orderPrice >>> ${orderBooks.price}`);
      orderBooks.forEach((order) => {
        const currentPrice = mappingSymbolToTokenPrice[order.symbol];
        if (!currentPrice) return;
        if (order.type === ORDER_TYPE.BUY && currentPrice < order.price) {
          // TODO: swap
          // services.swap(order.contractAddress, USDT_CONTRACT_ADDRESS, order.amount);
          // console.log(`Bought at ${new Date()} with price ${tokenPrice.data.price}`);
          console.log(`🚀 Buy ${order.symbol} now 
Order price: ${order.price}
Current price: ${currentPrice}`);
        } else if (order.type === ORDER_TYPE.SELL && currentPrice > order.price) {
          // TODO: swap
          // services.swap(USDT_CONTRACT_ADDRESS, order.contractAddress, order.amount);
          // console.log(`Sold at ${new Date()} with price ${tokenPrice.data.price}`);
          console.log(`🚀 Sell ${order.symbol} now 
Order price: ${order.price}
Current price: ${currentPrice}`);
        }
      });
    }, 5000);
  } catch (error) {
    console.error(error);
  }
};

main();
