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

---

### Option A: Chạy Local (Hardhat Node)

#### 1. Clone và cài dependencies

```bash
git clone <repo_url>
cd Voting_Dapp

# Root (Hardhat + contract tools)
npm install

# Frontend
cd frontend && npm install && cd ..

# Backend
cd backend && npm install && cd ..
```

#### 2. Tạo file môi trường

```bash
# Sao chép các file example
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Mở `backend/.env` và điền:
```env
DATABASE_URL="file:./dev.db"
RPC_URL=http://127.0.0.1:8545
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
CONTRACT_ADDRESS=       # ← điền sau bước 4
PORT=3001
JWT_SECRET=your_jwt_secret_key_min_32_chars
ADMIN_API_KEY=your_admin_api_key
ADMIN_WALLET=0x_your_metamask_wallet_address
```

> **Lưu ý:** `PRIVATE_KEY` ở trên là account #0 mặc định của Hardhat local, chỉ dùng cho development. Không dùng key này trên testnet/mainnet.

#### 3. Khởi tạo database

```bash
cd backend
npx prisma generate
npx prisma db push
cd ..
```

#### 4. Chạy Hardhat local node

```bash
# Terminal 1 — giữ terminal này chạy
npx hardhat node
```

#### 5. Deploy smart contract

```bash
# Terminal 2
npx hardhat run scripts/deploy.ts --network localhost
```

Output sẽ hiển thị contract address:
```
✅ VotingSystem deployed to: 0x8A791620dd6260079BF849Dc5567aDC3F2FdC318
```

#### 6. Điền CONTRACT_ADDRESS vào .env

Cập nhật `backend/.env`:
```env
CONTRACT_ADDRESS=0x8A791620dd6260079BF849Dc5567aDC3F2FdC318
```

Cập nhật `frontend/.env`:
```env
VITE_CONTRACT_ADDRESS=0x8A791620dd6260079BF849Dc5567aDC3F2FdC318
VITE_BACKEND_URL=http://localhost:3001
VITE_ADMIN_API_KEY=your_admin_api_key   # khớp với ADMIN_API_KEY trong backend/.env
```

#### 7. Seed demo data

```bash
cd backend && npm run seed
```

> Seed sẽ tạo 3 elections với candidates demo và đồng bộ lên blockchain.

#### 8. Khởi động backend và frontend

```bash
# Terminal 3 — Backend
cd backend && npm run dev

# Terminal 4 — Frontend
cd frontend && npm run dev
```

Truy cập: [http://localhost:5173](http://localhost:5173)

---

### Option B: Chạy trên Oasis Sapphire Testnet

Oasis Sapphire là EVM-compatible blockchain với phí gas thấp và tốc độ nhanh.

#### 1. Clone và cài dependencies

```bash
git clone <repo_url>
cd Voting_Dapp

npm install
cd frontend && npm install && cd ..
cd backend && npm install && cd ..
```

#### 2. Thiết lập ví và lấy TEST token

- Tạo ví mới hoặc import ví vào MetaMask
- Vào [Oasis Sapphire Faucet](https://faucet.testnet.sapphire.oasis.io) để lấy TEST token
- Lưu lại địa chỉ ví (0x...) và private key

#### 3. Tạo file môi trường

```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Mở `.env` (root) và điền:
```env
# Private key KHÔNG có tiền tố 0x
SAPPHIRE_PRIVATE_KEY=your_wallet_private_key_without_0x_prefix
```

Mở `backend/.env` và điền:
```env
DATABASE_URL="file:./dev.db"
RPC_URL=https://testnet.sapphire.oasis.io
PRIVATE_KEY=0x_your_wallet_private_key_with_0x_prefix   # ← CÓ tiền tố 0x
CONTRACT_ADDRESS=       # ← điền sau bước 5
PORT=3001
JWT_SECRET=your_jwt_secret_key_min_32_chars
ADMIN_API_KEY=your_admin_api_key
ADMIN_WALLET=0x_your_metamask_wallet_address

# Tuỳ chọn — bỏ trống để dùng mock mode (OTP log ra console)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your@gmail.com
SMTP_PASS=your_16_char_app_password
MAIL_FROM=your@gmail.com
```

> **Lưu ý:** Root `.env` dùng `SAPPHIRE_PRIVATE_KEY` (không có `0x`) cho Hardhat deploy.  
> `backend/.env` dùng `PRIVATE_KEY` (có `0x`) cho backend whitelist on-chain.  
> Hai biến này trỏ cùng một ví nhưng format khác nhau.

#### 4. Khởi tạo database

```bash
cd backend
npx prisma generate
npx prisma db push
cd ..
```

#### 5. Deploy smart contract lên Sapphire Testnet

```bash
npx hardhat run scripts/deploy.ts --network sapphireTestnet
```

Output:
```
✅ VotingSystem deployed to: 0x...
```

#### 6. Điền CONTRACT_ADDRESS vào .env

Cập nhật `backend/.env`:
```env
CONTRACT_ADDRESS=0x_địa_chỉ_từ_bước_5
```

Cập nhật `frontend/.env`:
```env
VITE_CONTRACT_ADDRESS=0x_địa_chỉ_từ_bước_5
VITE_BACKEND_URL=http://localhost:3001
VITE_ADMIN_API_KEY=your_admin_api_key   # khớp với ADMIN_API_KEY trong backend/.env
```

#### 7. Seed demo data

```bash
cd backend && npm run seed
```

#### 8. Thêm Sapphire Testnet vào MetaMask

| Setting | Value |
|---------|-------|
| Network Name | Oasis Sapphire Testnet |
| RPC URL | https://testnet.sapphire.oasis.io |
| Chain ID | 23202 |
| Currency Symbol | TEST |

#### 9. Khởi động backend và frontend

```bash
# Terminal 1 — Backend
cd backend && npm run dev

# Terminal 2 — Frontend
cd frontend && npm run dev
```

Truy cập: [http://localhost:5173](http://localhost:5173)

---

## Luồng Bỏ Phiếu

```
1. Đăng ký / Đăng nhập với email và password
2. Kết nối MetaMask (tự động chuyển sang đúng network)
3. Xác minh email OTP → ví được whitelist on-chain tự động
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
| `createElection()` | Owner | Tạo cuộc bầu chọn mới |
| `addCandidate(electionId)` | Owner | Thêm ứng viên (trước khi start) |
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

### Admin (cần header `x-admin-key: ADMIN_API_KEY`)

| Method | Endpoint | Mô tả |
|--------|---------|--------|
| GET | `/api/admin/users` | Danh sách users (paginated) |
| PATCH | `/api/admin/users/:id` | Ban/unban user |
| GET | `/api/admin/elections` | Danh sách elections |
| POST | `/api/admin/elections` | Tạo election mới |
| PATCH | `/api/admin/elections/:id` | Cập nhật thông tin election |
| DELETE | `/api/admin/elections/:id` | Xoá election (chưa active) |
| POST | `/api/admin/elections/:id/candidates` | Thêm ứng viên |
| DELETE | `/api/admin/elections/:id/candidates/:cid` | Ẩn ứng viên |
| POST | `/api/admin/elections/:id/push-to-chain` | Đẩy election draft lên chain và start |
| POST | `/api/admin/elections/:id/sync-candidates` | Retry sync ứng viên chưa on-chain |
| POST | `/api/admin/elections/:id/start` | Bắt đầu election (đã on-chain) |
| POST | `/api/admin/elections/:id/end` | Kết thúc election |
| GET | `/api/admin/logs` | Xem audit logs |

### Health

```bash
GET /health
```

```json
{
  "status": "ok",
  "database": "sqlite",
  "contract": "0x...",
  "mailer": "smtp | mock"
}
```

---

## Networks

| Network | RPC URL | Chain ID | Mô tả |
|---------|--------|---------|-------|
| localhost | http://127.0.0.1:8545 | 31337 | Hardhat local node |
| sapphireTestnet | https://testnet.sapphire.oasis.io | 23202 | Oasis Sapphire Testnet |

Để deploy lên network khác, sử dụng:
```bash
npx hardhat run scripts/deploy.ts --network <network_name>
```

---

## Cấu Trúc Thư Mục

```
Voting_Dapp/
├── contracts/VotingSystem.sol        # Smart contract chính
├── test/VotingSystem.ts              # Contract tests (Mocha + Chai)
├── scripts/deploy.ts                 # Deploy contract
├── .env.example                      # Template biến môi trường cho Hardhat
├── frontend/
│   ├── src/
│   │   ├── App.tsx                   # React app (routing + UI)
│   │   ├── context/                  # Auth context
│   │   ├── components/               # UI components
│   │   ├── pages/                    # Pages (Home, Vote, Results, Admin, Profile)
│   │   ├── hooks/                    # Custom hooks
│   │   ├── services/                 # API and wallet services
│   │   └── types/                    # TypeScript types
│   ├── .env.example                  # Template biến môi trường frontend
│   └── .env                          # VITE_CONTRACT_ADDRESS, VITE_BACKEND_URL (không commit)
├── backend/
│   ├── src/
│   │   ├── lib/                      # JWT, wallet, nonce helpers
│   │   ├── middleware/               # Auth middleware
│   │   ├── routes/                   # API routes (auth, user, admin)
│   │   └── types/                    # TypeScript types
│   ├── prisma/
│   │   ├── schema.prisma             # Database schema
│   │   ├── migrations/               # Prisma migrations
│   │   └── seed.ts                   # Demo data seeder
│   ├── .env.example                  # Template biến môi trường backend
│   └── .env                          # DB, RPC, PRIVATE_KEY, JWT_SECRET (không commit)
├── hardhat.config.ts
├── package.json
└── README.md
```

---

## Lưu Ý Bảo Mật

- **Không commit** file `.env` — chỉ commit `.env.example`
- **Private key** dùng để whitelist on-chain — chỉ nên là account có đủ TEST token để trả gas
- **Root `.env`** (`SAPPHIRE_PRIVATE_KEY`) và **`backend/.env`** (`PRIVATE_KEY`) trỏ cùng một ví nhưng format khác nhau (không có/có `0x`)
- **JWT_SECRET** — chuỗi ngẫu nhiên >= 32 ký tự: `openssl rand -hex 32`
- **ADMIN_API_KEY** — không expose ra client; frontend dùng qua biến `VITE_ADMIN_API_KEY`
- **ADMIN_WALLET** — địa chỉ ví (public address) được cấp quyền admin trong app
- **Gmail SMTP** — dùng App Password (16 ký tự), không dùng mật khẩu tài khoản Google
- **HTTPS** — dùng HTTPS cho backend ở môi trường production
- **Rate limiting** — thêm rate limiting cho `/api/auth/send-otp` khi deploy production
