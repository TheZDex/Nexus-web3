import { useEffect, useState } from 'react';
import { getContract,waitForTransaction } from '@wagmi/core'
import { useContractRead } from 'wagmi'
import SalesContract from './abis/SalesContract.json'
import DepositFI from './abis/DepositFI.json'
import ERC20ABI from './abis/erc20.json'
import {toast} from 'react-toastify';
import config from './config.json'
const { priceFeed } = config;
const TEXT = {
  'EN': {
    title: {
      'buy': 'Mint NEX directly',
      'deposit': 'Deposit NEX and earn interest',
      'withdraw': 'Withdraw deposit NEX',
    }
  }
}

const SalesContractABI = SalesContract.abi;
const DepositABI = DepositFI.abi;
const ToastID='NEX_NOTIF';
function numberWithCommas(x) {
  var parts = x.toString().split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join(".");
}
const formatNumber = (value, decimalPlace, displayDecimal) => {
  if (value === undefined || value === null) {
    return '-'
  }
  let value1;
  if (decimalPlace >= displayDecimal + 1) {
    const division = 10n ** window.BigInt(decimalPlace - displayDecimal - 1);
    value1 = Number(value / division) / (10 ** (displayDecimal + 1));
  } else {
    value1 = Number(value) / (10 ** decimalPlace);
  }

  return numberWithCommas(value1.toFixed(displayDecimal));
}
export const BuyActionWindow = ({ action, onClose, chainConfig,walletClient,address, lan = 'EN' }) => {
  const [amount, setAmount] = useState(null);
  const [token, setToken] = useState(chainConfig?.coins[0].name);
  const [price,setPrice] = useState(null);
  const [nexAmt,setNexAmt] = useState(null);
  const tokenConfig = chainConfig?.coins.filter(c=>c.name===token)[0];
  let amt=amount;
  if(amount===null || amount===undefined) {
    amt = tokenConfig?.defaultAmt;
  }
  useEffect(()=>{
    if(!priceFeed[token]){
      setPrice(1);
    }else{
      async function getPrice(){
        const res=await fetch(priceFeed[token]);
        const json=await res.json();
        setPrice(json.result.index_price);
      }
      getPrice();
    }
  },[token]);
  useEffect(()=>{
    if(price){
      let nextAmount=amt*price/0.9;
      setNexAmt(Math.floor(nextAmount*100)/100);
    }else{
      setNexAmt(null);
    }
  },[amt,price]);

  const onTokenChange=(e)=>{
    setToken(e.target.value);
  }
  const onAmountChange=(e)=>{
    if(!e.target.value){
      setAmount(null);
    }else{
      setAmount(Number(e.target.value));
    }
  }
  const [tokenBalance,setTokenBalance]=useState(null);
  useEffect(()=>{
    const ercContract = getContract({
      address: tokenConfig.address,
      abi: ERC20ABI,
      walletClient:walletClient
    });
    async function getBalance(){
      const tokenBalance = await ercContract.read.balanceOf([address]);
      setTokenBalance(tokenBalance);
    };
    getBalance();
  },[tokenConfig,address]);
  const tryPurchase = async () => {
    
    if(amt<=0){
      toast.error('Amount is negative!',{toastId:ToastID,updateId:ToastID});
      return;
    }
    
    const wei = window.BigInt(amt* 10 ** tokenConfig.decimals);
    const salesContractAddress = chainConfig?.salesContract;
    const ercContract = getContract({
      address: tokenConfig.address,
      abi: ERC20ABI,
      walletClient:walletClient
    });
    const allowance = await ercContract.read.allowance([address, salesContractAddress]);
    console.log('allowance', allowance);
    if(allowance<wei){
      toast.info('Approving transaction of '+amt+' '+token,{toastId:ToastID,updateId:ToastID});
      const tx=await ercContract.write.approve([salesContractAddress, wei]);
      await waitForTransaction({
        confirmations: 1,
        hash: tx.hash||tx,
      });
      console.log('tx', tx);
      debugger;
    }
    const salesContract = getContract({
      address: salesContractAddress,
      abi: SalesContractABI,
      walletClient:walletClient
    });
    toast.info('Transact to purchase NEX with '+amt+' '+token,{toastId:ToastID,updateId:ToastID});
    const tx=await salesContract.write.fund([tokenConfig.address, wei,3000]);
    console.log('tx', tx);
    await waitForTransaction({
      confirmations: 1,
      hash: tx.hash||tx,
    });
    toast.success('Transact completed, check your wallet ballance of NEX',{toastId:ToastID,updateId:ToastID});
    debugger;
  }
  const purchase = async () => {
    try{
      await tryPurchase();
    }catch(e){
      const message=e.shortMessage||e.message;
      toast.error('Transaction failed: '+message,{toastId:ToastID,updateId:ToastID});
      console.log('e',e.shortMessage, e);
    }
  }
  return (<div>
    <div className="bg-gray-100  rounded-lg p-8 flex flex-col md:ml-auto w-full mt-10 md:mt-0">
      <h2 className="text-gray-900 text-lg font-medium title-font mb-5">{TEXT[lan].title[action]}</h2>
      <div className="relative mb-4 flex">
        <input type="number" value={amt} onChange={onAmountChange} name="amount" className="w-8/12 bg-white rounded border border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 text-base outline-none text-gray-700 py-1 px-3 leading-8 transition-colors duration-200 ease-in-out"/>
        <select value={token} onChange={onTokenChange} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-4/12 p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500">
          {chainConfig?.coins.map(c=><option value={c.name} key={c.name}>{c.name}</option>)}
        </select>
      </div>
      <div className="relative">
        <label className="leading-7">Available {formatNumber(tokenBalance,tokenConfig?.decimals,tokenConfig?.displayDecimals)} {token}</label>
      </div>
      <div className="relative mb-4">
        <label className="leading-7">You receive {nexAmt?numberWithCommas(nexAmt):'-'} NEX</label>
      </div>
      <div className='text-sm'>Receive 11% more NEX! Promotion ends 2023-12-31</div>
      <div className='text-sm'>Final amount is subject to market slippage</div>
      <div className="flex space-x-4 mt-5">
        <div className="flex-1"></div>
        <button className="bg-indigo-200 border-0 py-2 px-8 focus:outline-none hover:bg-indigo-600 hover:text-white rounded text-sm" onClick={onClose}>Cancel</button>
        <button onClick={purchase} className="text-white bg-indigo-500 border-0 py-2 px-8 focus:outline-none hover:bg-indigo-600 rounded text-sm">Confirm</button>
      </div>
    </div>
  </div>
  );
}

export const DepositActionWindow = ({ action, onClose, chainConfig,walletClient,address,r, lan = 'EN' }) => {
  const [amount, setAmount] = useState(null);
  const [all,setAll]=useState(false);
  const isDeposit=action==='deposit';
  const { data: balance } = useContractRead({
    address: isDeposit?chainConfig.coin:chainConfig.depositFI,
    abi: ERC20ABI,
    functionName: 'balanceOf',
    args: [address],
  });
  const balanceNumber=Math.floor(Number(balance)/(10**4))/100;
  const exceedBalance=amount>balanceNumber;
  const onAmountChange=(e)=>{
    if(e.target.value===''){
      setAmount(null);
    }else{
      let value=Number(e.target.value);
      value=Math.max(0,value);
      setAmount(value);
    }
  };
  const onAllChange=(e)=>{
    const checked=e.target.checked;
    setAll(checked);
    if(checked){
      setAmount(balanceNumber);
    }
  }
  const tryAction=async()=>{
    const depositeContract = getContract({
      address: chainConfig.depositFI,
      abi: DepositABI,
      walletClient:walletClient
    });
    let tx;
    if(isDeposit){
      const amountWei=window.BigInt(amount*10**6);
      const ercContract = getContract({
        address: chainConfig.coin,
        abi: ERC20ABI,
        walletClient:walletClient
      });
      const allowance = await ercContract.read.allowance([address, chainConfig.depositFI]);
      console.log('allowance', allowance);
      if(allowance<amountWei){
        toast.info('Approving transaction of '+amount+' NEX',{toastId:ToastID,updateId:ToastID});
        tx=await ercContract.write.approve([chainConfig.depositFI, amountWei]);
        await waitForTransaction({
          confirmations: 1,
          hash: tx.hash||tx,
        });
        console.log('tx', tx);
      }
      toast.info('Deposit '+amount+' NEX',{toastId:ToastID,updateId:ToastID});
      tx=await depositeContract.write.deposit([amountWei]);
    }else{
      if(!all){
        const amountWei=window.BigInt(amount*10**6);
        toast.info('Withdraw '+amount+' NEX',{toastId:ToastID,updateId:ToastID});
        tx=await depositeContract.write.withdraw([amountWei]);
      }else{
        toast.info('Withdraw all deposit NEX ('+amount+')',{toastId:ToastID,updateId:ToastID});
        tx=await depositeContract.write.withdrawAll();
      }
    }
    console.log('tx', tx);
    await waitForTransaction({
      confirmations: 1,
      hash: tx.hash||tx,
    });
    toast.success('Transact completed, check your wallet ballance of NEX and depoNEX',{toastId:ToastID,updateId:ToastID});
  }
  const onAction=async()=>{
    try{
      await tryAction();
    }catch(e){
      const message=e.shortMessage||e.message;
      toast.error('Transaction failed: '+message,{toastId:ToastID,updateId:ToastID});
      console.log('e',e.shortMessage, e);
    }

  };

  return (<div>
    <div className="bg-gray-100  rounded-lg p-8 flex flex-col md:ml-auto min-w-[500px] mt-10 md:mt-0">
      <h2 className="text-gray-900 text-lg font-medium title-font mb-5">{TEXT[lan].title[action]}</h2>
      <div className="relative mb-4 flex">
        <input type="number" value={all?balanceNumber:amount} onChange={onAmountChange} className="w-8/12 bg-white rounded border border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 text-base outline-none text-gray-700 py-1 px-3 leading-8 transition-colors duration-200 ease-in-out"/>
        <div  className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-4/12 p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500">
          {isDeposit?'NEX':'depoNex'}
        </div>
      </div>
      <div className="relative mb-4 flex">
        <input checked={all} onChange={onAllChange} id='checkbox-all' type="checkbox" value="" class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"/>
        <label htmlFor='checkbox-all' class="ml-2 text-sm font-medium text-gray-900 dark:text-gray-300">Use MAX balance</label>
      </div>
      
      <div className="relative mb-4">
        {exceedBalance && <div className="leading-10 text-red-500">Insufficient Balance</div>}  
        <div className="leading-7">Available {balanceNumber} {isDeposit?'NEX':'depoNex'}</div>
        <div className="leading-7">Current interest rate APY is {r}%</div>
      </div>
      <div className="flex space-x-4 mt-5">
        <div className="flex-1"></div>
        <button className="bg-indigo-200 border-0 py-2 px-8 focus:outline-none hover:bg-indigo-600 hover:text-white rounded text-sm" onClick={onClose}>Cancel</button>
        <button disabled={exceedBalance} onClick={onAction} className="text-white disabled:opacity-50 bg-indigo-500 border-0 py-2 px-8 focus:outline-none hover:bg-indigo-600 rounded text-sm disabled">Confirm</button>
      </div>
    </div>
  </div>
  );
}

export default BuyActionWindow;