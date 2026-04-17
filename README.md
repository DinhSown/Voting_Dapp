# Voting DApp - Hệ Thống Bỏ Phiếu Phi Tập Trung

Ứng dụng bỏ phiếu on-chain với xác thực email OTP và whitelist ví tự động. Người dùng xác minh danh tính qua email, được whitelist trên blockchain, sau đó bỏ phiếu trực tiếp qua MetaMask.

**Demo use case:** WeChoice Awards - bình chọn nhân vật/dự án nổi bật.

---

## Kiến Trúc

```
Frontend (React + Vite)
    │  MetaMask / Ethers.js (vote trực tiếp)
    │  Axios (gọi backend)
    ▼
Backend (Express + Prisma)
    │  Nodemailer (gửi OTP)
    │  Ethers.js (whitelist on-chain)
    ▼
Smart Contract (Solidity 0.8.20 trên Hardhat / Sepolia)
```

---

## Stack

| Lớp | Công Nghệ |
|-----|-----------|
| Smart Contract | Solidity 0.8.20, Hardhat 3.x |
| Contract Testing | Mocha + Chai |
| Frontend | React 19, Vite 8, Tailwind CSS 4 |
| Web3 | Ethers.js 6 |
| Backend | Express 5, TypeScript |
| Database | SQLite (Prisma + LibSQL) |
| Email | Nodemailer (SMTP / mock mode) |
| Wallet | MetaMask |

---

## Tính Năng

- **Multi-election** - Hỗ trợ nhiều cuộc bầu chọn song song
- **OTP Verification** - Xác thực email trước khi được phép bỏ phiếu
- **On-chain Whitelist** - Backend tự động whitelist ví sau khi xác minh OTP
- **Anti-double-vote** - Mỗi ví chỉ bỏ phiếu 1 lần/cuộc bầu chọn
- **Transparent Results** - Kết quả và lịch sử bỏ phiếu trên blockchain
- **Admin Dashboard** - Quản lý trạng thái hệ thống
- **Mock Email Mode** - Tự động log OTP ra console nếu chưa cấu hình SMTP

---

## Cài Đặt & Chạy

### Yêu cầu

- Node.js >= 18
- MetaMask extension
- (Tuỳ chọn) Tài khoản SMTP để gửi email thật

### 1. Cài dependencies

```bash
# Root (Hardhat + contract tools)
npm install

# Frontend
cd frontend && npm install

# Backend
cd backend && npm install
```

### 2. Khởi tạo database

```bash
cd backend
npx prisma generate
npx prisma db push
```

### 3. Chạy Hardhat local node

```bash
# Terminal 1 - chạy và giữ
npx hardhat node
```

### 4. Deploy smart contract

```bash
# Terminal 2
npx hardhat run scripts/deploy.ts --network localhost
```

Output sẽ hiển thị contract address, ví dụ:
```
Contract deployed to: 0x8A791620dd6260079BF849Dc5567aDC3F2FdC318
```

### 5. Cấu hình environment variables

**`frontend/.env`**
```env
VITE_CONTRACT_ADDRESS=0x<địa_chỉ_contract_từ_bước_4>
VITE_BACKEND_URL=http://localhost:3001
```

**`backend/.env`**
```env
DATABASE_URL="file:./dev.db"
RPC_URL=http://127.0.0.1:8545
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
CONTRACT_ADDRESS=0x<địa_chỉ_contract_từ_bước_4>
PORT=3001

# Tuỳ chọn - nếu không có sẽ dùng mock mode (log OTP ra console)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=your_app_password
MAIL_FROM=VotingDApp <your@gmail.com>
```

> **Lưu ý:** `PRIVATE_KEY` mặc định trên là account #0 của Hardhat local, chỉ dùng cho development. Không bao giờ dùng private key thật ở đây.

### 6. Khởi động backend và frontend

```bash
# Terminal 3 - Backend
cd backend && npm run dev

# Terminal 4 - Frontend
cd frontend && npm run dev
```

Truy cập: [http://localhost:5173](http://localhost:5173)

---

## Luồng Bỏ Phiếu

```
1. Kết nối MetaMask (tự động chuyển sang Hardhat network)
2. Nhập email → nhận OTP (6 số)
3. Nhập OTP → ví được whitelist on-chain tự động
4. Chọn ứng viên → ký transaction qua MetaMask → vote on-chain
```

Nếu chưa cấu hình SMTP, xem OTP trong terminal của backend:
```
[MOCK EMAIL] To: user@email.com | OTP: 123456
```

---

## Smart Contract

**File:** `contracts/VotingSystem.sol`

### Các hàm chính

| Hàm | Quyền | Mô tả |
|-----|-------|-------|
| `createElection(title)` | Owner | Tạo cuộc bầu chọn mới |
| `addCandidate(electionId, name)` | Owner | Thêm ứng viên (trước khi start) |
| `startElection(electionId)` | Owner | Bắt đầu (yêu cầu >= 2 ứng viên) |
| `endElection(electionId)` | Owner | Kết thúc bầu chọn |
| `whitelistEligibleWallet(electionId, wallet)` | Owner | Whitelist ví |
| `whitelistEligibleWallets(electionId, wallets[])` | Owner | Whitelist hàng loạt |
| `vote(electionId, candidateId)` | Whitelisted | Bỏ phiếu |
| `getWinner(electionId)` | Public | Xem người thắng |
| `getCandidates(electionId)` | Public | Danh sách ứng viên + số phiếu |
| `getVoterStatus(electionId, address)` | Public | Kiểm tra whitelist/đã vote |

### Chạy tests

```bash
npx hardhat test
```

8 test cases bao gồm: tạo election, thêm ứng viên, bắt đầu, whitelist, bỏ phiếu, chống double-vote, batch whitelist, kết thúc election.

---

## Backend API

Base URL: `http://localhost:3001`

### `POST /api/auth/send-otp`

Gửi OTP 6 số đến email (hiệu lực 5 phút).

```json
// Request
{ "email": "user@example.com" }

// Response
{ "message": "OTP đã được gửi", "deliveryMode": "smtp" | "mock" }
```

### `POST /api/auth/verify-otp`

Xác minh OTP và whitelist ví on-chain.

```json
// Request
{
  "email": "user@example.com",
  "otpCode": "123456",
  "walletAddress": "0x...",
  "electionId": 0
}

// Response
{ "message": "Xac minh thanh cong! Vi da duoc whitelist." }
```

### `GET /health`

```json
{
  "status": "ok",
  "database": "sqlite",
  "contract": "0x...",
  "mailer": "smtp" | "mock"
}
```

---

## Deploy lên Sepolia Testnet

```bash
# 1. Set private key an toàn
npx hardhat keystore set SEPOLIA_PRIVATE_KEY

# 2. Cấu hình hardhat.config.ts với Sepolia RPC URL

# 3. Deploy
npx hardhat ignition deploy --network sepolia ignition/modules/VotingSystem.ts

# 4. Cập nhật CONTRACT_ADDRESS trong cả hai .env files
```

---

## Cấu Trúc Thư Mục

```
Voting_Dapp/
├── contracts/VotingSystem.sol    # Smart contract chính
├── test/VotingSystem.ts          # Contract tests (Mocha + Chai)
├── scripts/deploy.ts             # Deploy + seed demo data
├── ignition/modules/             # Hardhat Ignition modules
├── artifacts/                    # Compiled artifacts (auto-generated)
├── frontend/
│   ├── src/App.tsx               # React app (routing + UI)
│   ├── src/service/wallet.js     # MetaMask helpers
│   └── .env                      # VITE_CONTRACT_ADDRESS, VITE_BACKEND_URL
├── backend/
│   ├── index.ts                  # Express server + API endpoints
│   ├── prisma/schema.prisma      # User, OtpSession, Log tables
│   └── .env                      # DB, RPC, PRIVATE_KEY, SMTP config
├── hardhat.config.ts
├── plan.md                       # Kế hoạch phát triển chi tiết
└── README.md
```

---

## Lưu Ý Bảo Mật

- Không commit file `.env` chứa private key thật
- `PRIVATE_KEY` trong backend dùng để whitelist on-chain - chỉ nên là một account có đủ ETH để trả gas, không phải toàn bộ treasury
- Thêm rate limiting cho `/api/auth/send-otp` khi deploy production
- Dùng HTTPS cho backend ở môi trường production
