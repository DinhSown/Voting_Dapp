import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { ethers } from 'ethers';
import { ArrowRight, Blocks, Check, Cpu, LayoutDashboard, Mail, ShieldCheck, Wallet } from 'lucide-react';
import './index.css';

const HARDHAT_CHAIN_ID = 31337;
const HARDHAT_CHAIN_ID_HEX = '0x7A69';
const HARDHAT_RPC = 'http://127.0.0.1:8545';
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || '0x5FbDB2315678afecb367f032d93F642f64180aa3';
const ELECTION_ID = 1;

const ABI = [
  'function vote(uint256,uint256) external',
  'function getElection(uint256) external view returns (uint256 id, string title, bool isActive, uint256 candidateCount, uint256 totalVotes)',
  'function getCandidate(uint256,uint256) external view returns (uint256 id, string name, uint256 voteCount)',
];

type Route = 'home' | 'vote' | 'results' | 'admin';
type Step = 'IDLE' | 'OTP_SENT' | 'VERIFIED';
type Toast = { msg: string; type: 'success' | 'error' | 'info' };
type Category = { id: number; candidateId: number; title: string; label: string; summary: string; image: string; nominees: string[] };

const categories: Category[] = [
  {
    id: 1,
    candidateId: 1,
    title: 'Nhan vat truyen cam hung',
    label: 'Inspiration',
    summary: 'Ton vinh nhung guong mat truyen cam hung va tao tac dong xa hoi.',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBlmFTG6kzrezYtMw39PsX3zglt6pml7t5td_bOicD8cHeWjnZc8dRtD9AUiBEN88e86wctCr-bAJ8j_iX5ZZfb1S6E_bkBNZLuT5oczZfmcxnGBaVKZHdxEYa3jWqIz8IU9ytn6SPe2lxVMyKflNMj_JVSHDuIwwpQiiS_0dnQODpoeVRxWlUvETFD6ok1oXFKRFcMyCmWULRzXc90pGYc6wDlN7dhbDF5Nlb0sbmhjyMuQQ8iFBDwoc7KdALiDMmzIykEfwhjhXjE',
    nominees: ['Mai An / Open Classroom', 'Khanh Linh / Community Builder'],
  },
  {
    id: 2,
    candidateId: 2,
    title: 'Du an vi cong dong',
    label: 'Community',
    summary: 'Nhom du an co tac dong xa hoi ro rang, minh bach va co kha nang mo rong.',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDssEXWOFJZcdzlxp28is5AzKtAKPPwryVB6ibFXD72SYUiScOIg7sc-fqERQIGn3sF0-blrL23RznWiI2gGwfheHNUOMzgGvTGgFxA7UfmXo3zTaHrhpYLUC-Ai17Mj-v9K_Rt3A9n97Ijf-5s8mnc06hg2WQZBARxBTViB-rXIYRgUgYuMVm66h9_kXrFm9nUAomqOzATH9o1tj-fDRNUdoUMqrlyHY6PRPQXyscaQKNBMQf8GIw4d0i_azi4ZyQPwCK2753NNew5',
    nominees: ['Green Route / Climate action', 'BridgeHub / Accessibility'],
  },
  {
    id: 3,
    candidateId: 3,
    title: 'GenZ tieu bieu',
    label: 'New Generation',
    summary: 'Nhung guong mat tre dai dien cho tinh than dam lam va co nang luc lan toa.',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBLfbyirMWeNcxb3U4UK_s0NDGOEJIX88nhYSAlRrQQ38um5p5qAJXOJtPSozEYN677xEkg9whOGhUCda6D5FQBZ4nbUt1rnQ8BeU1ocoHYzv6EbOVgPU_ef35I7r5XEhBiUGe-Mqd0DS9hehBAeO2WOCNLIPw6R-oysnLTPS7BTPBzfybaOErUViPCFEaBngzUjnWSenuGFOHt_llp_Q0tn7H-x50eZqnRX0Og-cnbbkMkrTJdNx0ytHinyYpERww4uR-cM0txrPUV',
    nominees: ['Bao Minh / Youth advocate', 'Le Vy / Product maker'],
  },
  {
    id: 4,
    candidateId: 4,
    title: 'Nghe si dot pha',
    label: 'Arts',
    summary: 'Ton vinh tac gia, nghe si va nha san xuat van hoa co cach tiep can moi.',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBIMNr-Pq52k1vn4-IBj1GdQRtlEUkveoEvFD61725r8WcXDmKW5CUQuS6TAOeGk6PatPrTmDaBzyDJNZZ3Lj4GNDva_BpFFigIonjr6f4cTGvI1sea4NT4vtfdiSoOrmsV65BGKx-qC76TBux7XJx6YUHjN9QCDMtkum_4BPAVb7pp5SIS5M0_iyKB1B6KgPRjrNhydFRRVdcbUq3RzLBVM3pEVx6cAxCHRDusKuXylzLZta2zDZhFTYCix05OM9GYsb_ADEx0ZYLa',
    nominees: ['Studio Nhan / Visual collective', 'Tran Kha / Performance artist'],
  },
];

const routeFromHash = (): Route => {
  const hash = window.location.hash.replace('#', '');
  return hash === 'vote' || hash === 'results' || hash === 'admin' ? hash : 'home';
};

function App() {
  const [route, setRoute] = useState<Route>(routeFromHash());
  const [selected, setSelected] = useState<Category>(categories[0]);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<Step>('IDLE');
  const [busy, setBusy] = useState(false);
  const [voted, setVoted] = useState<Set<number>>(new Set());
  const [votingFor, setVotingFor] = useState<number | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [health, setHealth] = useState('offline');
  const [contractStatus, setContractStatus] = useState('unknown');
  const [results, setResults] = useState<{ name: string; votes: number }[]>([]);
  const [totalVotes, setTotalVotes] = useState(0);
  const [logs, setLogs] = useState(['Frontend shell ready', 'OTP + whitelist flow wired', 'MetaMask voting flow active']);

  const notify = (msg: string, type: Toast['type'] = 'info') => {
    setToast({ msg, type });
    window.setTimeout(() => setToast(null), 3200);
  };

  const pushLog = (entry: string) => setLogs((current) => [entry, ...current].slice(0, 8));
  const go = (next: Route) => { window.location.hash = next === 'home' ? '' : next; };

  useEffect(() => {
    const onHash = () => setRoute(routeFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    const ethereum = (window as Window & { ethereum?: any }).ethereum;
    if (!ethereum) return;
    const onAccounts = (accounts: string[]) => setWalletAddress(accounts[0] ?? null);
    const onChain = (id: string) => setChainId(parseInt(id, 16));
    ethereum.on('accountsChanged', onAccounts);
    ethereum.on('chainChanged', onChain);
    return () => {
      ethereum.removeListener('accountsChanged', onAccounts);
      ethereum.removeListener('chainChanged', onChain);
    };
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const healthRes = await axios.get(`${BACKEND_URL}/health`);
        setHealth(healthRes.data?.status || 'offline');
        setContractStatus(healthRes.data?.contract || 'unset');
      } catch {
        setHealth('offline');
        setContractStatus('backend offline');
      }
      try {
        const provider = new ethers.JsonRpcProvider(HARDHAT_RPC);
        const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
        const election = await contract.getElection(ELECTION_ID);
        const count = Number(election.candidateCount);
        const rows = [];
        for (let id = 1; id <= count; id += 1) {
          const candidate = await contract.getCandidate(ELECTION_ID, id);
          rows.push({ name: String(candidate.name), votes: Number(candidate.voteCount) });
        }
        setResults(rows);
        setTotalVotes(Number(election.totalVotes));
      } catch {
        setResults(categories.map((item) => ({ name: item.title, votes: voted.has(item.id) ? 1 : 0 })));
        setTotalVotes(voted.size);
      }
    };
    load();
  }, [voted]);

  const shortAddr = walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'Connect Wallet';
  const wrongNetwork = walletAddress && chainId !== HARDHAT_CHAIN_ID;

  const switchToHardhat = async () => {
    const ethereum = (window as Window & { ethereum?: any }).ethereum;
    if (!ethereum) return;
    try {
      await ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: HARDHAT_CHAIN_ID_HEX }] });
    } catch (error: any) {
      if (error.code === 4902) {
        await ethereum.request({ method: 'wallet_addEthereumChain', params: [{ chainId: HARDHAT_CHAIN_ID_HEX, chainName: 'Hardhat Local', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: [HARDHAT_RPC] }] });
      } else {
        throw error;
      }
    }
  };

  const connectWallet = async () => {
    const ethereum = (window as Window & { ethereum?: any }).ethereum;
    if (!ethereum) return notify('Can cai MetaMask truoc.', 'error');
    try {
      setWalletLoading(true);
      await switchToHardhat();
      const provider = new ethers.BrowserProvider(ethereum);
      const accounts = await provider.send('eth_requestAccounts', []);
      const network = await provider.getNetwork();
      setWalletAddress(accounts[0]);
      setChainId(Number(network.chainId));
      pushLog(`Wallet connected: ${accounts[0]}`);
      notify('Da ket noi vi.', 'success');
    } catch (error: any) {
      notify(error.message || 'Khong the ket noi vi.', 'error');
    } finally {
      setWalletLoading(false);
    }
  };

  const sendOtp = async () => {
    if (!email) return notify('Nhap email truoc.', 'error');
    try {
      setBusy(true);
      await axios.post(`${BACKEND_URL}/api/auth/send-otp`, { email });
      setStep('OTP_SENT');
      pushLog(`OTP sent to ${email}`);
      notify('OTP da gui. Kiem tra terminal backend.', 'success');
    } catch (error: any) {
      notify(error.response?.data?.error || 'Gui OTP that bai.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async () => {
    if (!walletAddress) return notify('Can ket noi vi truoc.', 'error');
    if (otp.length < 6) return notify('Nhap OTP hop le.', 'error');
    try {
      setBusy(true);
      await axios.post(`${BACKEND_URL}/api/auth/verify-otp`, { email, otpCode: otp, walletAddress, electionId: ELECTION_ID });
      setStep('VERIFIED');
      pushLog(`Whitelisted ${walletAddress}`);
      notify('Xac minh thanh cong.', 'success');
    } catch (error: any) {
      notify(error.response?.data?.error || 'OTP khong hop le.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const castVote = async (category: Category) => {
    if (!walletAddress) return notify('Can ket noi MetaMask.', 'error');
    if (wrongNetwork) {
      await switchToHardhat();
      return notify('Da yeu cau chuyen network.', 'info');
    }
    if (step !== 'VERIFIED') return notify('Can verify email + whitelist truoc.', 'error');
    if (voted.has(category.id)) return notify('Ban da vote hang muc nay.', 'error');
    try {
      setVotingFor(category.id);
      const provider = new ethers.BrowserProvider((window as Window & { ethereum?: any }).ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
      const tx = await contract.vote(ELECTION_ID, category.candidateId);
      await tx.wait();
      setVoted((current) => new Set(current).add(category.id));
      pushLog(`Vote confirmed for ${category.title}`);
      notify(`Da vote cho ${category.title}.`, 'success');
    } catch (error: any) {
      notify(error.reason || error.message || 'Vote that bai.', 'error');
    } finally {
      setVotingFor(null);
    }
  };

  const statusCards = useMemo(() => [
    { label: 'Wallet', value: walletAddress ? 'Connected' : 'Waiting', icon: Wallet },
    { label: 'Verification', value: step, icon: Mail },
    { label: 'Backend', value: health, icon: Cpu },
    { label: 'Chain', value: wrongNetwork ? 'Wrong network' : 'Hardhat local', icon: Blocks },
  ], [health, step, walletAddress, wrongNetwork]);

  const topResults = [...results].sort((a, b) => b.votes - a.votes);

  return (
    <div className="min-h-screen bg-background text-on-surface">
      <div className="pointer-events-none fixed inset-0 overflow-hidden"><div className="orb orb-primary" /><div className="orb orb-secondary" /><div className="grid-mask" /></div>
      {toast && <div className={`fixed right-6 top-24 z-50 rounded-full border px-5 py-3 font-label text-[11px] uppercase tracking-[0.24em] ${toast.type === 'success' ? 'border-primary/40 bg-primary text-on-primary' : toast.type === 'error' ? 'border-error/40 bg-error-container text-on-error-container' : 'border-white/10 bg-surface-container-high text-on-surface'}`}>{toast.msg}</div>}
      <header className="sticky top-0 z-40 border-b border-white/8 bg-background/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5 md:px-8">
          <button onClick={() => go('home')} className="font-label text-lg font-bold uppercase tracking-[0.38em] text-primary">WECHOICE</button>
          <nav className="hidden gap-2 md:flex">{(['home', 'vote', 'results', 'admin'] as Route[]).map((item) => <button key={item} onClick={() => go(item)} className={`rounded-full px-4 py-2 font-label text-[11px] uppercase tracking-[0.22em] ${route === item ? 'bg-primary text-on-primary' : 'text-on-surface/65 hover:text-primary'}`}>{item}</button>)}</nav>
          <div className="flex gap-2">{wrongNetwork && <button onClick={switchToHardhat} className="rounded-full border border-error/30 bg-error-container px-4 py-3 font-label text-[10px] uppercase tracking-[0.18em] text-on-error-container">Switch</button>}<button onClick={connectWallet} disabled={walletLoading} className="rounded-full bg-primary px-5 py-3 font-label text-[11px] font-bold uppercase tracking-[0.22em] text-on-primary">{walletLoading ? 'Connecting' : shortAddr}</button></div>
        </div>
      </header>
      <main className="relative z-10">
        {route === 'home' && <section className="mx-auto grid max-w-7xl gap-8 px-5 py-12 md:px-8 lg:grid-cols-[1.1fr_0.9fr]"><div className="space-y-8 reveal"><p className="font-label text-xs uppercase tracking-[0.4em] text-primary">Voting + admin + MetaMask shell</p><h1 className="font-headline text-6xl leading-[0.88] md:text-8xl">Frontend cho voting dApp da du cac man chinh.</h1><p className="max-w-2xl text-base leading-8 text-on-surface/70">Toi da thiet ke va code them cac trang FE can thiet cho flow ban dang lam: landing, voting explorer, wallet + OTP whitelist, results transparency, va admin dashboard.</p><div className="flex flex-wrap gap-4"><button onClick={() => go('vote')} className="inline-flex items-center gap-3 rounded-full bg-primary px-7 py-4 font-label text-xs font-bold uppercase tracking-[0.24em] text-on-primary">Open Vote <ArrowRight size={16} /></button><button onClick={() => go('admin')} className="inline-flex items-center gap-3 rounded-full border border-white/10 px-7 py-4 font-label text-xs font-bold uppercase tracking-[0.24em] text-on-surface/80">Open Admin <LayoutDashboard size={16} /></button></div><div className="grid gap-4 md:grid-cols-4">{statusCards.map(({ label, value, icon: Icon }) => <article key={label} className="panel"><div className="mb-5 flex items-center justify-between"><span className="font-label text-[10px] uppercase tracking-[0.22em] text-on-surface/45">{label}</span><Icon size={16} className="text-primary" /></div><p className="font-headline text-3xl">{value}</p></article>)}</div></div><div className="panel panel-glow reveal"><p className="font-label text-xs uppercase tracking-[0.32em] text-primary">Suggested split</p><h2 className="mt-4 font-headline text-5xl">Team co the chia viec ro ngay bay gio.</h2><div className="mt-8 space-y-3">{['FE: vote UI + admin + MetaMask', 'BE: email OTP + admin API + whitelist trigger', 'DB: users + otp + metadata + logs', 'DApp: contract vote + anti-double-vote + whitelist'].map((item) => <div key={item} className="flex items-start gap-3 rounded-[1.6rem] border border-white/8 bg-black/20 px-4 py-4"><Check size={16} className="mt-1 text-primary" /><p className="text-sm leading-7 text-on-surface/75">{item}</p></div>)}</div><div className="mt-8 rounded-[1.8rem] border border-primary/20 bg-primary/10 p-5"><p className="font-label text-[10px] uppercase tracking-[0.22em] text-primary">Backend contract</p><p className="mt-3 break-all text-sm leading-7 text-on-surface/70">{contractStatus}</p></div></div></section>}
        {route === 'vote' && <section className="mx-auto grid max-w-7xl gap-8 px-5 py-12 md:px-8 lg:grid-cols-[1.05fr_0.95fr]"><div className="space-y-6 reveal"><p className="font-label text-xs uppercase tracking-[0.38em] text-primary">Voting Explorer</p><h1 className="font-headline text-5xl leading-[0.9] md:text-7xl">Chon hang muc, xem nominee, roi vote on-chain.</h1><div className="grid gap-5 md:grid-cols-2">{categories.map((category) => <article key={category.id} className="panel group"><div className="relative overflow-hidden rounded-[1.6rem]"><img src={category.image} alt={category.title} className="h-72 w-full object-cover grayscale transition duration-700 group-hover:scale-105 group-hover:grayscale-0" /><div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" /><div className="absolute left-4 top-4 rounded-full border border-white/12 bg-black/30 px-3 py-2 font-label text-[10px] uppercase tracking-[0.22em] text-on-surface/75">{category.label}</div></div><div className="mt-6"><h2 className="font-headline text-3xl">{category.title}</h2><p className="mt-3 text-sm leading-7 text-on-surface/65">{category.summary}</p></div><div className="mt-6 flex gap-3"><button onClick={() => setSelected(category)} className="rounded-full border border-white/10 px-4 py-3 font-label text-[10px] uppercase tracking-[0.2em] text-on-surface/70">Detail</button><button onClick={() => castVote(category)} disabled={voted.has(category.id) || votingFor === category.id} className="rounded-full bg-primary px-4 py-3 font-label text-[10px] font-bold uppercase tracking-[0.2em] text-on-primary disabled:border disabled:border-white/10 disabled:bg-transparent disabled:text-on-surface/35">{votingFor === category.id ? 'Processing' : voted.has(category.id) ? 'Voted' : 'Vote now'}</button></div></article>)}</div></div><div className="space-y-6"><div className="panel panel-glow reveal"><div className="mb-6 flex items-center justify-between"><div><p className="font-label text-[11px] uppercase tracking-[0.28em] text-primary">Verification Center</p><h2 className="mt-3 font-headline text-4xl">Wallet + OTP whitelist</h2></div><ShieldCheck size={18} className="text-secondary" /></div><div className="grid gap-3 md:grid-cols-3">{['Connect wallet', 'Receive OTP', 'Whitelist voter'].map((item, index) => <div key={item} className="rounded-[1.4rem] border border-white/8 bg-black/18 px-4 py-4"><p className="font-label text-[10px] uppercase tracking-[0.2em] text-on-surface/45">{item}</p><p className="mt-3 text-sm text-on-surface/65">{index === 0 ? (walletAddress ? 'Done' : 'Pending') : index === 1 ? (step !== 'IDLE' ? 'Done' : 'Pending') : (step === 'VERIFIED' ? 'Done' : 'Pending')}</p></div>)}</div><div className="mt-5 space-y-4"><div className="rounded-[1.6rem] border border-white/8 bg-black/18 p-5"><label className="font-label text-[10px] uppercase tracking-[0.22em] text-on-surface/45">Email</label><input value={email} onChange={(e) => setEmail(e.target.value)} className="mt-3 w-full border-b border-white/10 bg-transparent pb-3 text-base outline-none" placeholder="ban@example.com" /><button onClick={sendOtp} disabled={busy || !email} className="mt-5 rounded-full border border-primary/40 px-5 py-3 font-label text-[10px] font-bold uppercase tracking-[0.2em] text-primary disabled:opacity-40">Send OTP</button></div><div className="rounded-[1.6rem] border border-white/8 bg-black/18 p-5"><label className="font-label text-[10px] uppercase tracking-[0.22em] text-on-surface/45">OTP</label><input value={otp} onChange={(e) => setOtp(e.target.value)} maxLength={6} className="mt-3 w-full border-b border-white/10 bg-transparent pb-3 text-base tracking-[0.4em] text-primary outline-none" placeholder="123456" /><div className="mt-5 flex gap-3"><button onClick={verifyOtp} disabled={busy || otp.length < 6} className="rounded-full bg-primary px-5 py-3 font-label text-[10px] font-bold uppercase tracking-[0.2em] text-on-primary disabled:opacity-40">Verify</button><button onClick={() => { setStep('IDLE'); setOtp(''); }} className="rounded-full border border-white/10 px-5 py-3 font-label text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface/65">Reset</button></div></div></div></div><div className="panel reveal"><p className="font-label text-[11px] uppercase tracking-[0.28em] text-primary">Nominee Detail</p><h2 className="mt-3 font-headline text-4xl">{selected.title}</h2><p className="mt-4 text-sm leading-7 text-on-surface/65">{selected.summary}</p><div className="mt-6 space-y-3">{selected.nominees.map((name) => <div key={name} className="rounded-[1.4rem] border border-white/8 bg-black/18 px-4 py-4 text-sm text-on-surface/75">{name}</div>)}</div></div></div></section>}
        {route === 'results' && <section className="mx-auto max-w-7xl px-5 py-12 md:px-8"><div className="mb-10 reveal"><p className="font-label text-xs uppercase tracking-[0.38em] text-primary">Transparency</p><h1 className="mt-4 font-headline text-5xl leading-[0.9] md:text-7xl">Ket qua on-chain va bang xep hang.</h1></div><div className="grid gap-5 md:grid-cols-4">{[{ label: 'Total votes', value: String(totalVotes) }, { label: 'Candidates', value: String(results.length || categories.length) }, { label: 'Backend', value: health }, { label: 'Contract', value: contractStatus === 'backend offline' ? 'offline' : 'ready' }].map((item) => <article key={item.label} className="panel"><p className="font-label text-[10px] uppercase tracking-[0.22em] text-on-surface/45">{item.label}</p><p className="mt-5 font-headline text-4xl">{item.value}</p></article>)}</div><div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]"><div className="panel reveal"><p className="font-label text-[11px] uppercase tracking-[0.28em] text-primary">Leaderboard</p><div className="mt-6 space-y-4">{topResults.map((item, index) => <div key={`${item.name}-${index}`} className="rounded-[1.6rem] border border-white/8 bg-black/18 p-5"><div className="mb-4 flex items-center justify-between"><div><p className="font-label text-[10px] uppercase tracking-[0.2em] text-primary">#{index + 1}</p><h3 className="mt-2 font-headline text-2xl">{item.name}</h3></div><p className="text-2xl font-semibold text-primary">{item.votes}</p></div><div className="h-3 overflow-hidden rounded-full bg-white/6"><div className="h-full rounded-full bg-gradient-to-r from-primary to-secondary" style={{ width: `${Math.max(item.votes * 20, 8)}%` }} /></div></div>)}</div></div><div className="space-y-6"><div className="panel panel-glow reveal"><p className="font-label text-[11px] uppercase tracking-[0.28em] text-primary">Why this page</p><div className="mt-5 space-y-3">{['Cho demo tinh minh bach', 'Doc duoc tong phieu tu contract neu san sang', 'Fallback duoc neu local session moi chi co FE'].map((item) => <div key={item} className="rounded-[1.4rem] border border-white/8 bg-black/18 px-4 py-4 text-sm leading-7 text-on-surface/72">{item}</div>)}</div></div><div className="panel reveal"><p className="font-label text-[11px] uppercase tracking-[0.28em] text-primary">Recent logs</p><div className="mt-5 space-y-3">{logs.slice(0, 5).map((item) => <div key={item} className="rounded-[1.4rem] border border-white/8 bg-black/18 px-4 py-4 text-sm leading-7 text-on-surface/72">{item}</div>)}</div></div></div></div></section>}
        {route === 'admin' && <section className="mx-auto max-w-7xl px-5 py-12 md:px-8"><div className="mb-10 reveal"><p className="font-label text-xs uppercase tracking-[0.38em] text-primary">Admin Dashboard</p><h1 className="mt-4 font-headline text-5xl leading-[0.9] md:text-7xl">Monitor OTP, whitelist, va readiness.</h1></div><div className="grid gap-5 md:grid-cols-4">{[{ label: 'API health', value: health }, { label: 'Whitelist state', value: step }, { label: 'Session votes', value: String(voted.size) }, { label: 'Chain id', value: chainId ? String(chainId) : 'N/A' }].map((item) => <article key={item.label} className="panel"><p className="font-label text-[10px] uppercase tracking-[0.22em] text-on-surface/45">{item.label}</p><p className="mt-5 font-headline text-4xl">{item.value}</p></article>)}</div><div className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]"><div className="space-y-6"><div className="panel panel-glow reveal"><p className="font-label text-[11px] uppercase tracking-[0.28em] text-primary">Delivery board</p><div className="mt-5 space-y-3">{['FE: implemented all key screens', 'BE: health + OTP verify live', 'DB: users + otp + logs in Prisma', 'DApp: vote flow integrated'].map((item) => <div key={item} className="rounded-[1.4rem] border border-white/8 bg-black/18 px-4 py-4 text-sm leading-7 text-on-surface/72">{item}</div>)}</div></div><div className="panel reveal"><p className="font-label text-[11px] uppercase tracking-[0.28em] text-primary">Checklist</p><div className="mt-5 space-y-3">{['Set frontend .env contract address', 'Run backend localhost:3001', 'Deploy contract on Hardhat', 'Bo sung admin list APIs cho users/logs'].map((item) => <div key={item} className="rounded-[1.4rem] border border-white/8 bg-black/18 px-4 py-4 text-sm leading-7 text-on-surface/72">{item}</div>)}</div></div></div><div className="space-y-6"><div className="panel reveal"><p className="font-label text-[11px] uppercase tracking-[0.28em] text-primary">Activity logs</p><div className="mt-5 space-y-3">{logs.map((item) => <div key={item} className="rounded-[1.4rem] border border-white/8 bg-black/18 px-4 py-4 text-sm leading-7 text-on-surface/72">{item}</div>)}</div></div><div className="grid gap-5 md:grid-cols-2"><div className="panel reveal"><p className="font-label text-[11px] uppercase tracking-[0.28em] text-primary">Current voter</p><p className="mt-4 text-sm leading-7 text-on-surface/72">Wallet: {walletAddress || 'none'}<br />Email: {email || 'none'}<br />Step: {step}</p></div><div className="panel reveal"><p className="font-label text-[11px] uppercase tracking-[0.28em] text-primary">Contract</p><p className="mt-4 break-all text-sm leading-7 text-on-surface/72">{contractStatus}</p></div></div></div></div></section>}
      </main>
      <footer className="relative z-10 border-t border-white/8 bg-surface-container-low/90"><div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 md:grid-cols-3 md:px-8"><div><p className="font-label text-lg font-bold uppercase tracking-[0.38em] text-primary">WECHOICE</p><p className="mt-5 text-sm leading-7 text-on-surface/60">Landing, vote, results va admin da duoc scaffold de team tiep tuc noi backend va smart contract.</p></div><div><p className="font-label text-[11px] uppercase tracking-[0.28em] text-primary">Flows</p><div className="mt-5 space-y-3 text-sm text-on-surface/60"><p>Wallet connect</p><p>OTP whitelist</p><p>Vote execution</p></div></div><div><p className="font-label text-[11px] uppercase tracking-[0.28em] text-primary">Admin</p><div className="mt-5 space-y-3 text-sm text-on-surface/60"><p>Health monitor</p><p>Logs</p><p>Checklist</p></div></div></div></footer>
    </div>
  );
}

export default App;
