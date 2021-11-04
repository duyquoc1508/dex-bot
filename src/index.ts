import axios, { AxiosResponse } from 'axios';
import path from 'path';
import Web3 from 'web3';
import TelegramBot from 'node-telegram-bot-api';
import 'dotenv/config';

const ORDER_TYPE: any = {
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

  async swap(
    fromTokenAddress: string,
    toTokenAddress: string,
    amount: number,
    currentPrice: number
  ): Promise<any> {
    const amountIn: number = amount;
    const amountOutMin: number = amount * currentPrice * 0.95; // min amount receive
    const path: string[] = [fromTokenAddress];
    const to: string = toTokenAddress;
    const deadline: Date = new Date();
    const swapPayload = this.pancakeSwapContract.methods.swapExactTokensForTokens(
      amountIn,
      amountOutMin,
      path,
      to,
      deadline
    );
    const encodedABI = swapPayload.encodeABI();
    // TODO:
  }
}

const getMsgFormatted = (order: Order, currentPrice: number): string => {
  const poocoinTokenPrice = `${process.env.POOCOIN_URL}/${order.contractAddress}`;
  return `🚀 *${ORDER_TYPE[order.type]}* [#${order.symbol}](${poocoinTokenPrice}) now 
  Order price: ${order.price} $
  Current price: ${currentPrice} $
  Limit: ${order.amount}
  Time: ${new Date()}`;
};

interface Order {
  symbol: string;
  contractAddress: string;
  type: string;
  price: number;
  amount: number;
}

// const abi = require(path.join(__dirname, '../diem.json'));
// const diemContractAddress = process.env.DIEM_CONTRACT_ADDRESS;
// const contractInstance = new web3.eth.Contract(abi, diemContractAddress);
// console.log(contractInstance)

const main = async () => {
  const token = `${process.env.TELEGRAM_BOT_TOKEN}`;
  const groupChatId = `${process.env.GROUP_CHAT_ID}`;
  const telegramBot: TelegramBot = new TelegramBot(token, { polling: true });
  try {
    const orderBooks: Order[] = [
      {
        symbol: 'PSB',
        type: ORDER_TYPE.SELL,
        price: 0.7, // greater than this price,
        contractAddress: '0x36bfbb1d5b3c9b336f3d64976599b6020ca805f1',
        amount: 100 // amount
      },
      {
        symbol: 'MONO',
        type: ORDER_TYPE.BUY,
        price: 0.2, // less than this price
        contractAddress: '0xd4099a517f2fbe8a730d2ecaad1d0824b75e084a',
        amount: 100
      }
    ];
    const watchingList: string[] = orderBooks.map((order) => order.contractAddress);
    const services: ToTheMoonService = new ToTheMoonService(watchingList);
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
    let i = 1;
    const myInterval = setInterval(async () => {
      console.log('interval time', i);
      i++;
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
      for (let i = orderBooks.length - 1; i >= 0; i--) {
        const order: Order = orderBooks[i];
        const currentPrice: number = mappingSymbolToTokenPrice[order.symbol];
        if (!currentPrice) return;
        if (order.type === ORDER_TYPE.BUY && currentPrice < order.price) {
          // TODO: swap
          // services.swap(order.contractAddress, USDT_CONTRACT_ADDRESS, order.amount);
          // console.log(`Bought at ${new Date()} with price ${tokenPrice.data.price}`);
          console.log(`🚀 Buy ${order.symbol} now 
Order price: ${order.price}
Current price: ${currentPrice}`);
          telegramBot.sendMessage(groupChatId, getMsgFormatted(order, currentPrice), {
            parse_mode: 'Markdown'
          });
          orderBooks.splice(i, 1);
        } else if (order.type === ORDER_TYPE.SELL && currentPrice > order.price) {
          // TODO: swap
          // services.swap(USDT_CONTRACT_ADDRESS, order.contractAddress, order.amount);
          // console.log(`Sold at ${new Date()} with price ${tokenPrice.data.price}`);
          console.log(`🚀 Sell ${order.symbol} now 
Order price: ${order.price}
Current price: ${currentPrice}`);
          telegramBot.sendMessage(groupChatId, getMsgFormatted(order, currentPrice), {
            parse_mode: 'Markdown'
          });
          orderBooks.splice(i, 1);
        }
      }

      if (orderBooks.length === 0) {
        clearInterval(myInterval);
      }
      console.log(orderBooks);
    }, 5000);
  } catch (error) {
    console.error(error);
  }
};

main();
