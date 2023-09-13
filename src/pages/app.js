import { useWalletClient, useContractRead } from 'wagmi'
import { getContract, waitForTransaction } from '@wagmi/core'

import { useEffect, useState, useRef, useMemo } from 'react';
import { Web3Button, Web3NetworkSwitch } from '@web3modal/react'
import ERC20ABI from './abis/erc20.json'
import POWMintProtocol from './abis/POWMintProtocol.json'
import DepositFI from './abis/DepositFI.json'
import config from './config.json'
import dynamic from 'next/dynamic'
import { BuyActionWindow, DepositActionWindow } from './ActionWindow';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import NoSsr from '../components/NoSsr'
import { EthereumClient, w3mConnectors, w3mProvider } from '@web3modal/ethereum'
import { Web3Modal } from '@web3modal/react'
import { configureChains, createConfig, WagmiConfig } from 'wagmi'
import { arbitrum, mainnet, polygon,polygonZkEvm } from 'wagmi/chains'


const DepositABI = DepositFI.abi;
const MintABI = POWMintProtocol.abi;


const Modal = dynamic(
  () => import('./Modal'),
  { ssr: false }
)
const { chainConfigs } = config;
function numberWithCommas(x) {
  var parts = x.toString().split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join(".");
}
const getSwapLink = (chainConfig) => {
  if (chainConfig.usdc && chainConfig.coin) {
    return `https://app.uniswap.org/#/swap?exactField=input&inputCurrency=${chainConfig.usdc}&outputCurrency=${chainConfig.coin}`
  } else {
    return 'https://app.uniswap.org/#/swap';
  }


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
const add = (a, b) => {
  if (a === undefined || a === null) {
    return b;
  }
  if (b === undefined || b === null) {
    return a;
  }
  return a + b;
}
function nFormatter(num, digits) {
  const lookup = [
    { value: 1, symbol: "" },
    { value: 1e3, symbol: "k" },
    { value: 1e6, symbol: "M" },
    { value: 1e9, symbol: "G" },
    { value: 1e12, symbol: "T" },
    { value: 1e15, symbol: "P" },
    { value: 1e18, symbol: "E" }
  ];
  const rx = /\.0+$|(\.[0-9]*[1-9])0+$/;
  var item = lookup.slice().reverse().find(function (item) {
    return num >= item.value;
  });
  return item ? (num / item.value).toFixed(digits).replace(rx, "$1") + item.symbol : "0";
}
const MAX_INT = 2n ** 256n - 1n;
const ToastID = 'NEX_MINT_NOTIF';

function App() {
  const client = useWalletClient();
  const walletClient = client.data || {};
  const { account = {}, chain = {} } = walletClient;
  const { address } = account;
  const { id } = chain;
  const chainConfig = chainConfigs["" + id] || {};
  const { data: cashBalance } = useContractRead({
    address: chainConfig.coin,
    abi: ERC20ABI,
    functionName: 'balanceOf',
    args: [address],
  });
  const { data: depositBalance } = useContractRead({
    address: chainConfig.depositFI,
    abi: DepositABI,
    functionName: 'balanceOf',
    args: [address],
  });
  const { data: interestRate } = useContractRead({
    address: chainConfig.depositFI,
    abi: DepositABI,
    functionName: 'getInterestRate',
  });
  const { data: mintParams } = useContractRead({
    address: chainConfig.mintContract,
    abi: MintABI,
    functionName: 'getMintParams'
  });
  const [action, setAction] = useState('');
  const [isMint, setIsMint] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [nounce, blockNumberV, supplyV, level] = mintParams || [];
  let levelStr = '-';
  if (level !== undefined && level !== null) {
    levelStr = nFormatter(Number(level), 0);
  }
  const setActionOnClick = action => () => {
    setAction(action);
  }
  const onClose = () => {
    setAction('');
  }
  const addToMetamask = (token, addr) => async () => {
    await walletClient.watchAsset({
      type: 'ERC20',
      options: {
        address: addr,
        symbol: token,
        decimals: 6
      }
    })
  };
  const mintContract = useMemo(() => {
    return getContract({
      address: chainConfig.mintContract,
      abi: MintABI,
      walletClient: walletClient
    });
  }, [chainConfig.mintContract, walletClient]);
  const workerRef = useRef();
  const refreshMintParams = async () => {
    if (workerRef.current) {
      const mintParams = await mintContract.read.getMintParams();
      const [nounce, blockNumberV, supplyV, level] = mintParams;
      const payload = {
        nounce,
        blockNumberV,
        supplyV,
        mintFor: address,
        cursor: cursor,
        bar: MAX_INT / level,
        enabled: true
      }
      workerRef.current.postMessage(payload);
      setIsMint(true);

      toast.info('Start mining', { toastId: ToastID, updateId: ToastID });
    } else {
      toast.error('WebWorker not ready,unable to mine!', { toastId: ToastID, updateId: ToastID });
    }
  }
  const toggleMint = () => {
    if (!workerRef.current) {
      toast.error('WebWorker not ready,unable to mine!', { toastId: ToastID, updateId: ToastID });
      return;
    }
    setIsMint(!isMint);
    if (isMint) {
      workerRef.current.postMessage({ enabled: false });
      toast.info('Mining stopped', { toastId: ToastID, updateId: ToastID });
    } else {
      refreshMintParams();
    }
  }

  useEffect(() => {
    if (!address) {
      return;
    }
    workerRef.current = new Worker(new URL('./worker.js', import.meta.url));
    const handleEvent = async (event) => {
      try {
        console.log('WebWorker Response', event, address);
        const { data } = event;
        if (data.nounce !== undefined) {
          const mintCheck = await mintContract.read.checkMint([address, data.nounce]);
          if (mintCheck) {
            toast.info('We got a success hit, let\'s submit on chain!', { toastId: ToastID, updateId: ToastID });
            const tx = await mintContract.write.mintFor([address, data.nounce]);
            await waitForTransaction({
              confirmations: 1,
              hash: tx.hash || tx,
            });
            toast.success('Mine successfully! Check your wallet for balance. Now start mining next batch', { toastId: ToastID, updateId: ToastID });
          }
          refreshMintParams();
        } else if (data.cursor !== undefined) {
          setCursor(data.cursor);
        }
      } catch (e) {
        const message = e.shortMessage || e.message;
        toast.error('Transaction failed: ' + message, { toastId: ToastID, updateId: ToastID });
        console.log('e', e.shortMessage, e);
        setIsMint(false);
      }
    }
    workerRef.current.onmessage = event=>{
      handleEvent(event);
    }
    return () => {
      workerRef.current?.terminate()
    }
  }, [address])

  const onOpenHomePage=()=>{
    window.open('https://nexus.zdex.tech');
  }
  return (
    <>
      <div className="mobile">
        <div className="header">
          <Web3Button />
          <Web3NetworkSwitch />
        </div>
        <div className="content">
          <div className="total">
            <div className="label">Total balance</div>
            <div className="value">{formatNumber(add(cashBalance, depositBalance), 6, 2)}</div>
            <div className="balance" onClick={onOpenHomePage}>NEX</div>
          </div>
          <div className="cards">
            <div className="card green">
              <div className="item">
                <div className="label container">
                  <div>Cash</div>
                </div>
                <div className="value">{formatNumber(cashBalance, 6, 2)}</div>
              </div>
              <div className='hflex'>
                <div className='flex1'></div>
                <div className='btn-text' onClick={setActionOnClick('buy')}>Mint</div>
                <a className='btn-text' href={getSwapLink(chainConfig)} target='blank'>Swap</a>
                <div className='btn-text' onClick={addToMetamask('NEX', chainConfig.coin)}>Wallet</div>
              </div>
            </div>
            <div className="card magenta">
              <div className="item">
                <div className="label container">
                  <div>Deposit</div>
                </div>
                <div className="value">{formatNumber(depositBalance, 6, 2)}</div>
              </div>
              <div className="balance">
                <div className="arrow-up">
                  <i className="fas fa-arrow-up"></i>
                </div>
                <div className="value">APY: {formatNumber(interestRate, 2, 2)}%</div>
              </div>
              <div className='hflex'>
                <div className='flex1'></div>
                <div className='btn-text' onClick={setActionOnClick('deposit')}>Deposit</div>
                <div className='btn-text' onClick={setActionOnClick('withdraw')}>Withdraw</div>
                <div className='btn-text' onClick={addToMetamask('depoNEX', chainConfig.depositFI)}>Wallet</div>
              </div>
            </div>
            <div className={!isMint?'mint card gray':"card gray"}>
              <div className="item">
                <div className="label container">
                  <div>MINING Reward</div>
                </div>
                <div className="value">100 NEX</div>
              </div>
              <div className="balance">
                <div className="value">{isMint ? `mining ${nFormatter(cursor, 1)}/${levelStr}` : `level: ${levelStr}`}</div>
              </div>
              <div className='hflex'>
                <div className='flex1'></div>
                {isMint && <div className="lds-spinner"><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div></div>}
                <div className='btn-text' onClick={toggleMint}>{isMint ? 'STOP MINING' : 'START MINING'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Modal open={!!action} onClose={onClose}>
        {action === 'buy' && <BuyActionWindow action={action} onClose={onClose} chainConfig={chainConfig} walletClient={walletClient} address={address} />}
        {['deposit', 'withdraw'].includes(action) && <DepositActionWindow onClose={onClose} action={action} chainConfig={chainConfig} walletClient={walletClient} address={address} r={formatNumber(interestRate, 2, 2)} />}
      </Modal>
      <ToastContainer
        position="top-center"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
    </>
  )
}

const chains = [mainnet, arbitrum]
const projectId = process.env.WALLETCONNECT_PROJECT_ID

const { publicClient } = configureChains(chains, [w3mProvider({ projectId })])
const wagmiConfig = createConfig({
  autoConnect: true,
  connectors: w3mConnectors({ projectId, chains }),
  publicClient
})
const ethereumClient = new EthereumClient(wagmiConfig, chains)

const AppWrapper = ()=>{
return <NoSsr>
<WagmiConfig config={wagmiConfig}>
  <App />
  <Web3Modal projectId={projectId} ethereumClient={ethereumClient} />
</WagmiConfig>
</NoSsr>;
}
export default AppWrapper;
