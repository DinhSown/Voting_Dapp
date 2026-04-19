# Voting DApp - Hệ Thống Bỏ Phiếu Phi Tập Trung

DApp bỏ phiếu on-chain với xác thực email OTP, tích hợp MetaMask và admin dashboard. Người dùng xác minh danh tính qua email, được whitelist trên blockchain, sau đó bỏ phiếu trực tiếp qua ví MetaMask.

---

## Kiến Trúc

```
Frontend (React + Vite + Tailwind CSS 4)
    │  MetaMask / Ethers.js (vote trực tiếp)
    │  Axios (gọi backend)
    ▼
Backend (Express + TypeScript + Prisma)
    │  JWT authentication
    │  Nodemailer (gửi OTP)
    │  Ethers.js (whitelist on-chain)
    ▼
Smart Contract (Solidity 0.8.20 trên Hardhat / Oasis Sapphire)
```

---

## Stack

| Lớp | Công Nghệ |
|-----|-----------|
| Smart Contract | Solidity 0.8.20, Hardhat 3.x |
| Frontend | React 19, Vite 8, Tailwind CSS 4 |
| Web3 | Ethers.js 6 |
| Backend | Express 5, TypeScript |
| Database | SQLite (Prisma + LibSQL) |
| Auth | JWT, Email OTP |
| Wallet | MetaMask |

---

## Tính Năng

- **Multi-election** - Hỗ trợ nhiều cuộc bầu chọn song song
- **JWT Authentication** - Đăng nhập với email/password
- **OTP Verification** - Xác thực email trước khi được phép bỏ phiếu
- **On-chain Whitelist** - Backend tự động whitelist ví sau khi xác minh OTP
- **Anti-double-vote** - Mỗi ví chỉ bỏ phiếu 1 lần/cuộc bầu chọn
- **Transparent Results** - Kết quả và lịch sử bỏ phiếu trên blockchain
- **Admin Dashboard** - Quản lý users và elections
- **Profile Page** - Xem thông tin và lịch sử bỏ phiếu
- **Mock Email Mode** - Tự động log OTP ra console nếu chưa cấu hình SMTP

---

## Cài Đặt & Chạy

### Yêu cầu

- Node.js >= 18
- MetaMask extension
- (Tuỳ chọn) Tài khoản SMTP để gửi email thật

### Option A: Chạy Local (Hardhat Node)

#### 1. Cài dependencies

```bash
# Root (Hardhat + contract tools)
npm install

# Frontend
cd frontend && npm install

# Backend
cd backend && npm install
```

#### 2. Khởi tạo database

```bash
cd backend
npx prisma generate
npx prisma db push
npm run seed
```

#### 3. Chạy Hardhat local node

```bash
# Terminal 1 - chạy và giữ
npx hardhat node
```

#### 4. Deploy smart contract

```bash
# Terminal 2
npx hardhat run scripts/deploy.ts --network localhost
```

Output sẽ hiển thị contract address, ví dụ:
```
Contract deployed to: 0x8A791620dd6260079BF849Dc5567aDC3F2FdC318
```

#### 5. Cấu hình environment variables

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
JWT_SECRET=your_jwt_secret_key_min_32_chars
ADMIN_API_KEY=your_admin_api_key

# Tuỳ chọn - nếu không có sẽ dùng mock mode (log OTP ra console)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=your_app_password
MAIL_FROM=VotingDApp <your@gmail.com>
```

> **Lưu ý:** `PRIVATE_KEY` mặc định trên là account #0 của Hardhat local, chỉ dùng cho development.

#### 6. Khởi động backend và frontend

```bash
# Terminal 3 - Backend
cd backend && npm run dev

# Terminal 4 - Frontend
cd frontend && npm run dev
```

Truy cập: [http://localhost:5173](http://localhost:5173)

---

### Option B: Chạy trên Oasis Sapphire Testnet

Oasis Sapphire là EVM-compatible blockchain với phí gas thấp và tốc độ nhanh.

#### 1. Cài dependencies

```bash
# Root
npm install

# Frontend
cd frontend && npm install

# Backend
cd backend && npm install
```

#### 2. Thiết lập ví và lấy TEST token

- Tạo ví mới hoặc import ví vào MetaMask
- Lấy địa chỉ ví (0x...)
- Vào [Oasis Sapphire Faucet](https://faucet.testnet.sapphire.oasis.io) để lấy TEST token

#### 3. Khởi tạo database

```bash
cd backend
npx prisma generate
npx prisma db push
npm run seed
```

#### 4. Lưu private key vào Hardhat keystore

```bash
# Thay YOUR_PRIVATE_KEY bằng private key của ví (không có 0x prefix)
npx hardhat keystore store
# Nhập private key khi được hỏi
# Đặt alias: sapphire-test
```

#### 5. Deploy smart contract lên Sapphire Testnet

```bash
npx hardhat run scripts/deploy.ts --network sapphireTestnet
```

Output:
```
Contract deployed to: 0x...
```

#### 6. Cấu hình environment variables

**`frontend/.env`**
```env
VITE_CONTRACT_ADDRESS=0x<địa_chỉ_contract_từ_bước_5>
VITE_BACKEND_URL=http://localhost:3001
```

**`backend/.env`**
```env
DATABASE_URL="file:./dev.db"
RPC_URL=https://testnet.sapphire.oasis.io
PRIVATE_KEY=0x<private_key_của_ví>
CONTRACT_ADDRESS=0x<địa_chỉ_contract_từ_bước_5>
PORT=3001
JWT_SECRET=your_jwt_secret_key_min_32_chars
ADMIN_API_KEY=your_admin_api_key

# Tuỳ chọn
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=your_app_password
MAIL_FROM=VotingDApp <your@gmail.com>
```

#### 7. Thêm Sapphire Testnet vào MetaMask

| Setting | Value |
|---------|-------|
| Network Name | Oasis Sapphire Testnet |
| RPC URL | https://testnet.sapphire.oasis.io |
| Chain ID | 23202 |
| Currency Symbol | TEST |

#### 8. Khởi động backend và frontend

```bash
# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Frontend
cd frontend && npm run dev
```

Truy cập: [http://localhost:5173](http://localhost:5173)

---

## Luồng Bỏ Phiếu

```
1. Đăng ký / Đăng nhập với email và password
2. (Tuỳ chọn) OTP Verification cho tài khoản
3. Kết nối MetaMask (tự động chuyển sang Hardhat network)
4. Xác minh OTP (nếu chưa xác minh) → ví được whitelist on-chain tự động
5. Chọn ứng viên → ký transaction qua MetaMask → vote on-chain
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

### Testing trên Sapphire Testnet

Để test contract trực tiếp trên Oasis Sapphire:

```bash
# Whitelist một ví
npx hardhat run scripts/whitelist.ts --network sapphireTestnet

# Kiểm tra trạng thái ví
npx hardhat run scripts/check-status.ts --network sapphireTestnet
```

---

## Backend API

Base URL: `http://localhost:3001`

### Authentication

| Method | Endpoint | Mô tả |
|--------|---------|--------|
| POST | `/api/auth/register` | Đăng ký tài khoản |
| POST | `/api/auth/login` | Đăng nhập, nhận JWT |
| POST | `/api/auth/send-otp` | Gửi OTP đến email |
| POST | `/api/auth/verify-otp` | Xác minh OTP và whitelist ví |

### User

| Method | Endpoint | Mô tả |
|--------|---------|--------|
| GET | `/api/user/me` | Lấy thông tin user hiện tại |
| GET | `/api/user/votes` | Lịch sử bỏ phiếu |

### Admin (cần ADMIN_API_KEY header)

| Method | Endpoint | Mô tả |
|--------|---------|--------|
| GET | `/api/admin/users` | Danh sách users (paginated) |
| GET | `/api/admin/elections` | Danh sách elections |
| POST | `/api/admin/elections` | Tạo election mới |
| POST | `/api/admin/elections/:id/candidates` | Thêm ứng viên |
| POST | `/api/admin/elections/:id/start` | Bắt đầu election |
| POST | `/api/admin/elections/:id/end` | Kết thúc election |

### Health

```bash
GET /health
```

```json
{
  "status": "ok",
  "database": "sqlite",
  "contract": "0x...",
  "mailer": "smtp" | "mock"
}
```

---

## Networks

| Network | RPC URL | Chain ID | Mô tả |
|---------|--------|---------|-------|
| localhost | http://127.0.0.1:8545 | 31337 | Hardhat local node |
| sapphireTestnet | https://testnet.sapphire.oasis.io | 23202 | Oasis Sapphire Testnet |
| sepolia | https://ethereum-sepolia-rpc.public node.com | 11155111 | Ethereum Sepolia (chưa hỗ trợ) |

Để deploy lên network khác, sử dụng:
```bash
npx hardhat run scripts/deploy.ts --network <network_name>
```

---

## Cấu Trúc Thư Mục

```
Voting_Dapp/
├── contracts/VotingSystem.sol    # Smart contract chính
├── test/VotingSystem.ts          # Contract tests (Mocha + Chai)
├── scripts/deploy.ts             # Deploy + seed demo data
├── ignition/modules/              # Hardhat Ignition modules
├── artifacts/                     # Compiled artifacts (auto-generated)
├── frontend/
│   ├── src/
│   │   ├── App.tsx               # React app (routing + UI)
│   │   ├── context/              # Auth context
│   │   ├── components/           # UI components
│   │   ├── pages/               # Pages (Home, Vote, Results, Admin, Profile)
│   │   ├── pages/admin/           # Admin sub-pages
│   │   ├── hooks/               # Custom hooks
│   │   ├── services/            # API and wallet services
│   │   └── types/               # TypeScript types
│   └── .env                     # VITE_CONTRACT_ADDRESS, VITE_BACKEND_URL
├── backend/
│   ├── src/
│   │   ├── lib/                 # JWT, wallet, nonce helpers
│   │   ├── middleware/         # Auth middleware
│   │   ├── routes/             # API routes (auth, user, admin)
│   │   └── types/              # TypeScript types
│   ├── prisma/
│   │   ├── schema.prisma       # Database schema
│   │   └── migrations/        # Prisma migrations
│   └── .env                    # DB, RPC, PRIVATE_KEY, JWT_SECRET
├── hardhat.config.ts
├── package.json
└── README.md
```

---

## Lưu Ý Bảo Mật

- **Không commit** file `.env` chứa private key thật
- **Private key** dùng để whitelist on-chain - chỉ nên là một account có đủ TEST token để trả gas, không phải toàn bộ treasury
- **Hardhat keystore** - Nên dùng `npx hardhat keystore store` để lưu private key an toàn thay vì lưu trong .env
- **Rate limiting** - Thêm rate limiting cho `/api/auth/send-otp` khi deploy production
- **HTTPS** - Dùng HTTPS cho backend ở môi trường production
- **JWT_SECRET** - Nên dài và phức tạp (>= 32 ký tự)
- **ADMIN_API_KEY** - Nên được bảo vệ cẩn thận, không expose ra client