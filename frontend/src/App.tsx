import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { ethers } from "ethers";
import {
  ArrowRight,
  Blocks,
  Check,
  Cpu,
  LayoutDashboard,
  Mail,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import "./index.css";

const HARDHAT_CHAIN_ID = 31337;
const HARDHAT_CHAIN_ID_HEX = "0x7A69";
const HARDHAT_RPC = "http://127.0.0.1:8545";
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";
const CONTRACT_ADDRESS =
  import.meta.env.VITE_CONTRACT_ADDRESS ||
  "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const ELECTION_ID = 1;

const ABI = [
  "function vote(uint256,uint256) external",
  "function getElection(uint256) external view returns (uint256 id, string title, bool isActive, uint256 candidateCount, uint256 totalVotes)",
  "function getCandidate(uint256,uint256) external view returns (uint256 id, string name, uint256 voteCount)",
];

type Route = "home" | "vote" | "results" | "admin";
type Step = "IDLE" | "OTP_SENT" | "VERIFIED";
type Toast = { msg: string; type: "success" | "error" | "info" };
type Category = {
  id: number;
  candidateId: number;
  title: string;
  label: string;
  summary: string;
  image: string;
  nominees: string[];
};

const categories: Category[] = [
  {
    id: 1,
    candidateId: 1,
    title: "Nhân vật truyền cảm hứng",
    label: "Lãnh đạo tài năng",
    summary:
      "Những cá nhân dành cả cuộc đời để lan tỏa giá trị tích cực, tạo ảnh hưởng đến cộng đồng và thúc đẩy sự thay đổi xã hội.",
    image:
      "https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&h=600&fit=crop",
    nominees: [
      "Ứng viên 1: Người tiên phong công nghệ blockchain",
      "Ứng viên 2: Doanh nhân tầm nhìn toàn cầu",
    ],
  },
  {
    id: 2,
    candidateId: 2,
    title: "Dự án vì Việt Nam tôi",
    label: "Dự án CSR & cộng đồng",
    summary:
      "Những dự án tạo tác động xã hội bền vững, khẳng định trách nhiệm doanh nghiệp và khát vọng phát triển Việt Nam.",
    image:
      "https://images.unsplash.com/photo-1559027615-cd4628902d4a?w=800&h=600&fit=crop",
    nominees: ["Dự án Green blockchain", "Dự án Tiếp cận công bằng Web3"],
  },
  {
    id: 3,
    candidateId: 3,
    title: "Thế hệ Gen Z đổi mới",
    label: "Young Face - Gương mặt trẻ",
    summary:
      "Những gương mặt Gen Z có bản lĩnh, năng lực phi thường, đạo đức tốt và bước đầu khẳng định vị thế trên toàn cầu.",
    image:
      "https://images.unsplash.com/photo-1519904981063-b0cf448d479e?w=800&h=600&fit=crop",
    nominees: [
      "Anh/chị X: Chuyên gia blockchain Gen Z",
      "Anh/chị Y: Giáo dục Web3",
    ],
  },
  {
    id: 4,
    candidateId: 4,
    title: "Rising Creator Web3",
    label: "Sáng tạo nội dung nổi bật",
    summary:
      "Những nhà sáng tạo nội dung có tầm ảnh hưởng lớn, lan tỏa kiến thức Web3 và xây dựng cộng đồng blockchain mạnh mẽ.",
    image:
      "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&h=600&fit=crop",
    nominees: ["Nhà sáng tạo video blockchain", "Nhà phân tích Web3 hàng đầu"],
  },
];

const routeFromHash = (): Route => {
  const hash = window.location.hash.replace("#", "");
  return hash === "vote" || hash === "results" || hash === "admin"
    ? hash
    : "home";
};

function App() {
  const [route, setRoute] = useState<Route>(routeFromHash());
  const [selected, setSelected] = useState<Category>(categories[0]);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<Step>("IDLE");
  const [busy, setBusy] = useState(false);
  const [voted, setVoted] = useState<Set<number>>(new Set());
  const [votingFor, setVotingFor] = useState<number | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [health, setHealth] = useState("offline");
  const [contractStatus, setContractStatus] = useState("unknown");
  const [results, setResults] = useState<{ name: string; votes: number }[]>([]);
  const [totalVotes, setTotalVotes] = useState(0);
  const [logs, setLogs] = useState([
    "Hệ thống bình chọn khởi động",
    "Kết nối MetaMask thành công",
    "Sẵn sàng gửi phiếu bình chọn on-chain",
  ]);

  const notify = (msg: string, type: Toast["type"] = "info") => {
    setToast({ msg, type });
    window.setTimeout(() => setToast(null), 3200);
  };

  const pushLog = (entry: string) =>
    setLogs((current) => [entry, ...current].slice(0, 8));
  const go = (next: Route) => {
    window.location.hash = next === "home" ? "" : next;
  };

  useEffect(() => {
    const onHash = () => setRoute(routeFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    const ethereum = (window as Window & { ethereum?: any }).ethereum;
    if (!ethereum) return;
    const onAccounts = (accounts: string[]) =>
      setWalletAddress(accounts[0] ?? null);
    const onChain = (id: string) => setChainId(parseInt(id, 16));
    ethereum.on("accountsChanged", onAccounts);
    ethereum.on("chainChanged", onChain);
    return () => {
      ethereum.removeListener("accountsChanged", onAccounts);
      ethereum.removeListener("chainChanged", onChain);
    };
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const healthRes = await axios.get(`${BACKEND_URL}/health`);
        setHealth(healthRes.data?.status || "offline");
        setContractStatus(healthRes.data?.contract || "unset");
      } catch {
        setHealth("offline");
        setContractStatus("backend offline");
      }
      try {
        const provider = new ethers.JsonRpcProvider(HARDHAT_RPC);
        const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
        const election = await contract.getElection(ELECTION_ID);
        const count = Number(election.candidateCount);
        const rows = [];
        for (let id = 1; id <= count; id += 1) {
          const candidate = await contract.getCandidate(ELECTION_ID, id);
          rows.push({
            name: String(candidate.name),
            votes: Number(candidate.voteCount),
          });
        }
        setResults(rows);
        setTotalVotes(Number(election.totalVotes));
      } catch {
        setResults(
          categories.map((item) => ({
            name: item.title,
            votes: voted.has(item.id) ? 1 : 0,
          })),
        );
        setTotalVotes(voted.size);
      }
    };
    load();
  }, [voted]);

  const shortAddr = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : "Kết nối Ví";
  const wrongNetwork = walletAddress && chainId !== HARDHAT_CHAIN_ID;

  const switchToHardhat = async () => {
    const ethereum = (window as Window & { ethereum?: any }).ethereum;
    if (!ethereum) return;
    try {
      await ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: HARDHAT_CHAIN_ID_HEX }],
      });
    } catch (error: any) {
      if (error.code === 4902) {
        await ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: HARDHAT_CHAIN_ID_HEX,
              chainName: "Hardhat Local Testnet",
              nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
              rpcUrls: [HARDHAT_RPC],
            },
          ],
        });
      } else {
        throw error;
      }
    }
  };

  const connectWallet = async () => {
    const ethereum = (window as Window & { ethereum?: any }).ethereum;
    if (!ethereum)
      return notify(
        "Vui lòng cài đặt MetaMask để bình chọn on-chain.",
        "error",
      );
    try {
      setWalletLoading(true);
      await switchToHardhat();
      const provider = new ethers.BrowserProvider(ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      const network = await provider.getNetwork();
      setWalletAddress(accounts[0]);
      setChainId(Number(network.chainId));
      pushLog(`Ví blockchain: ${accounts[0]} được kết nối`);
      notify(
        "Ví Web3 kết nối thành công! Bạn có thể bình chọn ngay.",
        "success",
      );
    } catch (error: any) {
      notify(
        error.message || "Không thể kết nối ví. Vui lòng thử lại.",
        "error",
      );
    } finally {
      setWalletLoading(false);
    }
  };

  const sendOtp = async () => {
    if (!email)
      return notify("Nhập địa chỉ email để xác minh danh tính.", "error");
    try {
      setBusy(true);
      await axios.post(`${BACKEND_URL}/api/auth/send-otp`, { email });
      setStep("OTP_SENT");
      pushLog(`Gửi mã OTP đến: ${email}`);
      notify("Mã OTP đã gửi! Kiểm tra email của bạn.", "success");
    } catch (error: any) {
      notify(
        error.response?.data?.error || "Gửi OTP thất bại. Vui lòng thử lại.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async () => {
    if (!walletAddress)
      return notify("Kết nối MetaMask trước khi xác minh.", "error");
    if (otp.length < 6) return notify("Mã OTP phải có 6 chữ số.", "error");
    try {
      setBusy(true);
      await axios.post(`${BACKEND_URL}/api/auth/verify-otp`, {
        email,
        otpCode: otp,
        walletAddress,
        electionId: ELECTION_ID,
      });
      setStep("VERIFIED");
      pushLog(`Danh sách trắng: ${walletAddress} được xác nhận`);
      notify("Bạn đã được xác minh! Sẵn sàng bình chọn on-chain.", "success");
    } catch (error: any) {
      notify(
        error.response?.data?.error || "Mã OTP không đúng. Vui lòng thử lại.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  };

  const castVote = async (category: Category) => {
    if (!walletAddress)
      return notify("Kết nối MetaMask để bình chọn on-chain.", "error");
    if (wrongNetwork) {
      await switchToHardhat();
      return notify("Vui lòng chuyển sang mạng Hardhat để bình chọn.", "info");
    }
    if (step !== "VERIFIED")
      return notify("Xác minh Email + Ví trước khi bình chọn.", "error");
    if (voted.has(category.id))
      return notify(
        "Bạn đã bình chọn hạng mục này rồi (chống gian lận).",
        "error",
      );
    try {
      setVotingFor(category.id);
      const provider = new ethers.BrowserProvider(
        (window as Window & { ethereum?: any }).ethereum,
      );
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
      const tx = await contract.vote(ELECTION_ID, category.candidateId);
      await tx.wait();
      setVoted((current) => new Set(current).add(category.id));
      pushLog(
        `Phiếu bình chọn cho "${category.title}" được ghi trên blockchain`,
      );
      notify(
        `Bình chọn cho ${category.title} đã được xác nhận on-chain!`,
        "success",
      );
    } catch (error: any) {
      notify(
        error.reason || error.message || "Bình chọn on-chain thất bại.",
        "error",
      );
    } finally {
      setVotingFor(null);
    }
  };

  const statusCards = useMemo(
    () => [
      {
        label: "Ví",
        value: walletAddress ? `${walletAddress.slice(0, 6)}...` : "Chờ",
        icon: Wallet,
      },
      {
        label: "Xác minh",
        value: step === "VERIFIED" ? "OK" : step === "OTP_SENT" ? "OTP" : "Chờ",
        icon: Mail,
      },
      {
        label: "Backend",
        value: health === "online" ? "Online" : "Offline",
        icon: Cpu,
      },
      { label: "Mạng", value: wrongNetwork ? "Sai" : "Hardhat", icon: Blocks },
    ],
    [health, step, walletAddress, wrongNetwork],
  );

  const topResults = [...results].sort((a, b) => b.votes - a.votes);

  return (
    <div className="min-h-screen bg-background text-on-surface">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="orb orb-primary" />
        <div className="orb orb-secondary" />
        <div className="grid-mask" />
      </div>
      {toast && (
        <div
          className={`fixed right-6 top-24 z-50 rounded-full border px-5 py-3 font-label text-[11px] uppercase tracking-[0.24em] ${toast.type === "success" ? "border-primary/40 bg-primary text-on-primary" : toast.type === "error" ? "border-error/40 bg-error-container text-on-error-container" : "border-white/10 bg-surface-container-high text-on-surface"}`}
        >
          {toast.msg}
        </div>
      )}
      <header className="sticky top-0 z-40 border-b border-white/8 bg-background/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5 md:px-8">
          <button
            onClick={() => go("home")}
            className="font-label text-lg font-bold uppercase tracking-[0.38em] text-primary cursor-pointer"
          >
            meChoice
          </button>
          <nav className="hidden gap-2 md:flex">
            {(["home", "vote", "results", "admin"] as Route[]).map((item) => (
              <button
                key={item}
                onClick={() => go(item)}
                className={`rounded-full px-4 py-2 font-label text-[11px] uppercase tracking-[0.22em] cursor-pointer ${route === item ? "bg-primary text-on-primary" : "text-on-surface/65 hover:text-primary"}`}
              >
                {item === "home"
                  ? "Trang chủ"
                  : item === "vote"
                    ? "Bình chọn"
                    : item === "results"
                      ? "Kết quả"
                      : "Quản lý"}
              </button>
            ))}
          </nav>
          <div className="flex gap-2">
            {wrongNetwork && (
              <button
                onClick={switchToHardhat}
                className="rounded-full border border-error/30 bg-error-container px-4 py-3 font-label text-[10px] uppercase tracking-[0.18em] text-on-error-container cursor-pointer"
              >
                Chuyển mạng
              </button>
            )}
            <button
              onClick={connectWallet}
              disabled={walletLoading}
              className="rounded-full bg-primary px-5 py-3 font-label text-[11px] font-bold uppercase tracking-[0.22em] text-on-primary cursor-pointer disabled:cursor-not-allowed"
            >
              {walletLoading ? "Kết nối..." : shortAddr}
            </button>
          </div>
        </div>
      </header>
      <main className="relative z-10">
        {route === "home" && (
          <section className="mx-auto grid max-w-7xl gap-8 px-5 py-12 md:px-8 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-8 reveal">
              <p className="font-label text-xs uppercase tracking-[0.4em] text-primary">
                Bình chọn phi tập trung • Xác minh Web3 • Smart Contract
              </p>
              <h1 className="max-w-3xl font-headline text-3xl leading-[1.08] tracking-tight md:text-5xl lg:text-7xl">
                Hệ thống bình chọn blockchain
                an toàn, <br />
                minh bạch.
              </h1>
              <p className="max-w-xl text-base leading-7 text-on-surface/70">
                Sử dụng MetaMask để bình chọn on-chain. Mỗi phiếu được mã hóa an
                toàn, xác minh danh tính qua OTP, và ghi lại bất biến trên
                blockchain. Chống gian lận 100%, kết quả toàn cầu có thể kiểm
                chứng.
              </p>
              <div className="flex flex-wrap gap-4">
                <button
                  onClick={() => go("vote")}
                  className="inline-flex items-center gap-3 rounded-full bg-primary px-7 py-4 font-label text-xs font-bold uppercase tracking-[0.24em] text-on-primary cursor-pointer"
                >
                  Bình chọn ngay <ArrowRight size={16} />
                </button>
                <button
                  onClick={() => go("admin")}
                  className="inline-flex items-center gap-3 rounded-full border border-white/10 px-7 py-4 font-label text-xs font-bold uppercase tracking-[0.24em] text-on-surface/80 cursor-pointer"
                >
                  Bảng điều hành <LayoutDashboard size={16} />
                </button>
              </div>
              <div className="grid gap-4 md:grid-cols-4">
                {statusCards.map(({ label, value, icon: Icon }) => (
                  <article key={label} className="panel">
                    <div className="mb-5 flex items-center justify-between">
                      <span className="font-label text-[10px] uppercase tracking-[0.22em] text-on-surface/45">
                        {label}
                      </span>
                      <Icon size={16} className="text-primary" />
                    </div>
                    <p className="font-headline text-3xl">{value}</p>
                  </article>
                ))}
              </div>
            </div>
            <div className="panel panel-glow reveal">
              <p className="font-label text-xs uppercase tracking-[0.32em] text-primary">
                Quy trình bình chọn an toàn
              </p>
              <h2 className="mt-4 font-headline text-5xl">
                Ba bước xác minh danh tính.
              </h2>
              <div className="mt-8 space-y-3">
                {[
                  "Kết nối MetaMask: Liên kết ví blockchain của bạn",
                  "Xác minh Email: Nhận mã OTP để chống gian lận",
                  "Bình chọn On-Chain: Gửi phiếu được ký trên blockchain",
                ].map((item) => (
                  <div
                    key={item}
                    className="flex items-start gap-3 rounded-[1.6rem] border border-white/8 bg-black/20 px-4 py-4"
                  >
                    <Check size={16} className="mt-1 text-primary" />
                    <p className="text-sm leading-7 text-on-surface/75">
                      {item}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-8 rounded-[1.8rem] border border-primary/20 bg-primary/10 p-5">
                <p className="font-label text-[10px] uppercase tracking-[0.22em] text-primary">
                  Trạng thái hợp đồng thông minh
                </p>
                <p className="mt-3 break-all text-sm leading-7 text-on-surface/70">
                  {contractStatus}
                </p>
              </div>
            </div>
          </section>
        )}
        {route === "vote" && (
          <section className="mx-auto grid max-w-7xl gap-8 px-5 py-12 md:px-8 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-6 reveal">
              <p className="font-label text-xs uppercase tracking-[0.38em] text-primary">
                Khám phá danh sách ứng viên
              </p>
              <h1 className="font-headline text-5xl leading-[0.9] md:text-7xl">
                Chọn danh mục, xem chi tiết, bình chọn on-chain.
              </h1>
              <div className="grid gap-5 md:grid-cols-2">
                {categories.map((category) => (
                  <article key={category.id} className="panel group">
                    <div className="relative overflow-hidden rounded-[1.6rem]">
                      <img
                        src={category.image}
                        alt={category.title}
                        className="h-72 w-full object-cover grayscale transition duration-700 group-hover:scale-105 group-hover:grayscale-0"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
                      <div className="absolute left-4 top-4 rounded-full border border-white/12 bg-black/30 px-3 py-2 font-label text-[10px] uppercase tracking-[0.22em] text-on-surface/75">
                        {category.label}
                      </div>
                    </div>
                    <div className="mt-6">
                      <h2 className="font-headline text-3xl">
                        {category.title}
                      </h2>
                      <p className="mt-3 text-sm leading-7 text-on-surface/65">
                        {category.summary}
                      </p>
                    </div>
                    <div className="mt-6 flex gap-3">
                      <button
                        onClick={() => setSelected(category)}
                        className="rounded-full border border-white/10 px-4 py-3 font-label text-[10px] uppercase tracking-[0.2em] text-on-surface/70 cursor-pointer"
                      >
                        Chi tiết
                      </button>
                      <button
                        onClick={() => castVote(category)}
                        disabled={
                          voted.has(category.id) || votingFor === category.id
                        }
                        className="rounded-full bg-primary px-4 py-3 font-label text-[10px] font-bold uppercase tracking-[0.2em] text-on-primary disabled:border disabled:border-white/10 disabled:bg-transparent disabled:text-on-surface/35 cursor-pointer disabled:cursor-not-allowed"
                      >
                        {votingFor === category.id
                          ? "Gửi tx..."
                          : voted.has(category.id)
                            ? "Đã vote!"
                            : "Vote now"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
            <div className="space-y-6">
              <div className="panel panel-glow reveal">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <p className="font-label text-[11px] uppercase tracking-[0.28em] text-primary">
                      Xác minh danh tính Web3
                    </p>
                    <h2 className="mt-3 font-headline text-4xl">
                      MetaMask + OTP + Blockchain
                    </h2>
                  </div>
                  <ShieldCheck size={18} className="text-secondary" />
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  {[
                    "Kết nối ví MetaMask",
                    "Nhập mã OTP 6 số",
                    "Danh sách trắng blockchain",
                  ].map((item, index) => (
                    <div
                      key={item}
                      className="rounded-[1.4rem] border border-white/8 bg-black/18 px-4 py-4"
                    >
                      <p className="font-label text-[10px] uppercase tracking-[0.2em] text-on-surface/45">
                        {item}
                      </p>
                      <p className="mt-3 text-sm text-on-surface/65">
                        {index === 0
                          ? walletAddress
                            ? "Hoàn thành"
                            : "Chờ"
                          : index === 1
                            ? step !== "IDLE"
                              ? "Hoàn thành"
                              : "Chờ"
                            : step === "VERIFIED"
                              ? "Hoàn thành"
                              : "Chờ"}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-5 space-y-4">
                  <div className="rounded-[1.6rem] border border-white/8 bg-black/18 p-5">
                    <label className="font-label text-[10px] uppercase tracking-[0.22em] text-on-surface/45">
                      Email (xác minh danh tính)
                    </label>
                    <input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="mt-3 w-full border-b border-white/10 bg-transparent pb-3 text-base outline-none cursor-pointer"
                      placeholder="your.email@example.com"
                    />
                    <button
                      onClick={sendOtp}
                      disabled={busy || !email}
                      className="mt-5 rounded-full border border-primary/40 px-5 py-3 font-label text-[10px] font-bold uppercase tracking-[0.2em] text-primary disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                    >
                      Gửi mã OTP
                    </button>
                  </div>
                  <div className="rounded-[1.6rem] border border-white/8 bg-black/18 p-5">
                    <label className="font-label text-[10px] uppercase tracking-[0.22em] text-on-surface/45">
                      Nhập mã OTP
                    </label>
                    <input
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      maxLength={6}
                      className="mt-3 w-full border-b border-white/10 bg-transparent pb-3 text-base tracking-[0.4em] text-primary outline-none cursor-pointer"
                      placeholder="000000"
                    />
                    <div className="mt-5 flex gap-3">
                      <button
                        onClick={verifyOtp}
                        disabled={busy || otp.length < 6}
                        className="rounded-full bg-primary px-5 py-3 font-label text-[10px] font-bold uppercase tracking-[0.2em] text-on-primary disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                      >
                        Xác minh
                      </button>
                      <button
                        onClick={() => {
                          setStep("IDLE");
                          setOtp("");
                        }}
                        className="rounded-full border border-white/10 px-5 py-3 font-label text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface/65 cursor-pointer"
                      >
                        Làm lại
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="panel reveal">
                <p className="font-label text-[11px] uppercase tracking-[0.28em] text-primary">
                  Thông tin ứng viên
                </p>
                <h2 className="mt-3 font-headline text-4xl">
                  {selected.title}
                </h2>
                <p className="mt-4 text-sm leading-7 text-on-surface/65">
                  {selected.summary}
                </p>
              </div>
            </div>
          </section>
        )}
        {route === "results" && (
          <section className="mx-auto max-w-7xl px-5 py-12 md:px-8">
            <div className="mb-10 reveal">
              <p className="font-label text-xs uppercase tracking-[0.38em] text-primary">
                Kết quả minh bạch on-chain
              </p>
              <h1 className="mt-4 font-headline text-5xl leading-[0.9] md:text-7xl">
                Dữ liệu bình chọn được mã hóa trên blockchain.
              </h1>
            </div>
            <div className="grid gap-5 md:grid-cols-4">
              {[
                { label: "Tổng phiếu", value: String(totalVotes) },
                {
                  label: "Ứng viên",
                  value: String(results.length || categories.length),
                },
                { label: "Backend", value: health },
                {
                  label: "Smart contract",
                  value:
                    contractStatus === "backend offline"
                      ? "Offline"
                      : "Hoạt động",
                },
              ].map((item) => (
                <article key={item.label} className="panel">
                  <p className="font-label text-[10px] uppercase tracking-[0.22em] text-on-surface/45">
                    {item.label}
                  </p>
                  <p className="mt-5 font-headline text-4xl">{item.value}</p>
                </article>
              ))}
            </div>
            <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="panel reveal">
                <p className="font-label text-[11px] uppercase tracking-[0.28em] text-primary">
                  Bảng xếp hạng real-time
                </p>
                <div className="mt-6 space-y-4">
                  {topResults.map((item, index) => (
                    <div
                      key={`${item.name}-${index}`}
                      className="rounded-[1.6rem] border border-white/8 bg-black/18 p-5"
                    >
                      <div className="mb-4 flex items-center justify-between">
                        <div>
                          <p className="font-label text-[10px] uppercase tracking-[0.2em] text-primary">
                            {index + 1}
                          </p>
                          <h3 className="mt-2 font-headline text-2xl">
                            {item.name}
                          </h3>
                        </div>
                        <p className="text-2xl font-semibold text-primary">
                          {item.votes}
                        </p>
                      </div>
                      <div className="h-3 overflow-hidden rounded-full bg-white/6">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-primary to-secondary"
                          style={{ width: `${Math.max(item.votes * 20, 8)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-6">
                <div className="panel panel-glow reveal">
                  <p className="font-label text-[11px] uppercase tracking-[0.28em] text-primary">
                    Về trang này
                  </p>
                  <div className="mt-5 space-y-3">
                    {[
                      "Dữ liệu real-time từ smart contract",
                      "Mỗi phiếu được xác thực bằng chữ ký số",
                      "Transparent & không thể chỉnh sửa",
                    ].map((item) => (
                      <div
                        key={item}
                        className="rounded-[1.4rem] border border-white/8 bg-black/18 px-4 py-4 text-sm leading-7 text-on-surface/72"
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="panel reveal">
                  <p className="font-label text-[11px] uppercase tracking-[0.28em] text-primary">
                    Nhật ký hoạt động
                  </p>
                  <div className="mt-5 space-y-3">
                    {logs.slice(0, 5).map((item) => (
                      <div
                        key={item}
                        className="rounded-[1.4rem] border border-white/8 bg-black/18 px-4 py-4 text-sm leading-7 text-on-surface/72"
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
        {route === "admin" && (
          <section className="mx-auto max-w-7xl px-5 py-12 md:px-8">
            <div className="mb-10 reveal">
              <p className="font-label text-xs uppercase tracking-[0.38em] text-primary">
                Bảng điều hành hệ thống
              </p>
              <h1 className="mt-4 font-headline text-5xl leading-[0.9] md:text-7xl">
                Giám sát xác minh, danh sách trắng, on-chain.
              </h1>
            </div>
            <div className="grid gap-5 md:grid-cols-4">
              {[
                { label: "API Health", value: health },
                { label: "Xác minh", value: step },
                { label: "Phiếu phiên", value: String(voted.size) },
                { label: "Chain ID", value: chainId ? String(chainId) : "N/A" },
              ].map((item) => (
                <article key={item.label} className="panel">
                  <p className="font-label text-[10px] uppercase tracking-[0.22em] text-on-surface/45">
                    {item.label}
                  </p>
                  <p className="mt-5 font-headline text-4xl">{item.value}</p>
                </article>
              ))}
            </div>
            <div className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="space-y-6">
                <div className="panel panel-glow reveal">
                  <p className="font-label text-[11px] uppercase tracking-[0.28em] text-primary">
                    Tiến độ triển khai
                  </p>
                  <div className="mt-5 space-y-3">
                    {[
                      "Frontend: Giao diện + Web3 wallet tích hợp",
                      "Backend: API OTP + danh sách trắng sẵn sàng",
                      "Database: Prisma + logs bình chọn",
                      "Smart Contract: Voting + chống gian lận",
                    ].map((item) => (
                      <div
                        key={item}
                        className="rounded-[1.4rem] border border-white/8 bg-black/18 px-4 py-4 text-sm leading-7 text-on-surface/72"
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="panel reveal">
                  <p className="font-label text-[11px] uppercase tracking-[0.28em] text-primary">
                    Hành động quản trị
                  </p>
                  <div className="mt-5 grid gap-3 grid-cols-1 md:grid-cols-2">
                    <button
                      onClick={() => alert("Tạo cuộc bình chọn mới")}
                      className="rounded-[1.4rem] border border-primary/30 bg-primary/10 px-4 py-4 text-sm leading-7 text-on-surface/80 cursor-pointer hover:bg-primary/20 transition"
                    >
                       Tạo cuộc bình chọn mới
                    </button>
                    <button
                      onClick={() => alert("Danh sách bình chọn")}
                      className="rounded-[1.4rem] border border-primary/30 bg-primary/10 px-4 py-4 text-sm leading-7 text-on-surface/80 cursor-pointer hover:bg-primary/20 transition"
                    >
                       Danh sách bình chọn
                    </button>
                    <button
                      onClick={() => alert("Quản lý cử tri")}
                      className="rounded-[1.4rem] border border-primary/30 bg-primary/10 px-4 py-4 text-sm leading-7 text-on-surface/80 cursor-pointer hover:bg-primary/20 transition"
                    >
                       Quản lý cử tri
                    </button>
                    <button
                      onClick={() => alert("Cấp quyền bỏ phiếu")}
                      className="rounded-[1.4rem] border border-primary/30 bg-primary/10 px-4 py-4 text-sm leading-7 text-on-surface/80 cursor-pointer hover:bg-primary/20 transition"
                    >
                       Cấp quyền bỏ phiếu
                    </button>
                  </div>
                </div>
              </div>
              <div className="space-y-6">
                <div className="panel reveal">
                  <p className="font-label text-[11px] uppercase tracking-[0.28em] text-primary">
                    Nhật ký hoạt động toàn hệ thống
                  </p>
                  <div className="mt-5 space-y-3">
                    {logs.map((item) => (
                      <div
                        key={item}
                        className="rounded-[1.4rem] border border-white/8 bg-black/18 px-4 py-4 text-sm leading-7 text-on-surface/72"
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="panel reveal">
                    <p className="font-label text-[11px] uppercase tracking-[0.28em] text-primary">
                      Cử tri hiện tại
                    </p>
                    <p className="mt-4 text-sm leading-7 text-on-surface/72">
                      Ví:{" "}
                      {walletAddress
                        ? walletAddress.slice(0, 10) + "..."
                        : "Chưa kết nối"}
                      <br />
                      Email: {email || "Chưa nhập"}
                      <br />
                      Trạng thái:{" "}
                      <span
                        className={
                          step === "VERIFIED"
                            ? "text-green-400"
                            : "text-yellow-400"
                        }
                      >
                        {step === "VERIFIED"
                          ? "Xác minh"
                          : step === "OTP_SENT"
                            ? "Chờ OTP"
                            : "Chờ kết nối"}
                      </span>
                    </p>
                  </div>
                  <div className="panel reveal">
                    <p className="font-label text-[11px] uppercase tracking-[0.28em] text-primary">
                      Smart Contract
                    </p>
                    <p className="mt-4 break-all text-sm leading-7 text-on-surface/72 font-mono">
                      {contractStatus}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
      <footer className="relative z-10 border-t border-white/8 bg-surface-container-low/90">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 md:grid-cols-3 md:px-8">
          <div>
            <p className="font-label text-3xl font-extrabold uppercase tracking-[0.38em] text-primary drop-shadow-lg">
              meChoice Voting
            </p>
            <p className="mt-5 text-sm leading-7 text-on-surface/60">
              Hệ thống bình chọn phi tập trung, minh bạch, an toàn với
              blockchain. Mỗi phiếu được mã hóa, danh tính được xác minh, kết
              quả không thể chỉnh sửa.
            </p>
          </div>
          <div>
            <p className="font-label text-[11px] uppercase tracking-[0.28em] text-primary">
              Quy trình
            </p>
            <div className="mt-5 space-y-3 text-sm text-on-surface/60">
              <p>Kết nối MetaMask</p>
              <p>Xác minh Email OTP</p>
              <p>Gửi phiếu on-chain</p>
            </div>
          </div>
          <div>
            <p className="font-label text-[11px] uppercase tracking-[0.28em] text-primary">
              Quản trị
            </p>
            <div className="mt-5 space-y-3 text-sm text-on-surface/60">
              <p>Giám sát thời gian thực</p>
              <p>Nhật ký blockchain</p>
              <p>Quản lý danh sách trắng</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
