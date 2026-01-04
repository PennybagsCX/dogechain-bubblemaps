<div align="center">

![Dogechain BubbleMaps](https://img.shields.io/badge/Dogechain-BubbleMaps-purple)
![License: CC BY-NC 4.0](https://img.shields.io/badge/License-CC%20BY--NC%204.0-blue.svg)
![React](https://img.shields.io/badge/React-19.2.0-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8.2-blue)
![Production](https://img.shields.io/badge/Status-Production-success)

# Dogechain Bubblemaps 🐕

**Interactive Blockchain Visualization & On-Chain Intelligence Platform**

[Live Demo](https://dogechain-bubblemaps.vercel.app) • [Features](#-features) • [Quick Start](#-quick-start) • [Documentation](#-documentation)

---

**Explore token distributions, track whale movements, and analyze wallet connections on the Dogechain network with powerful D3.js visualization tools.**

</div>

---

## 🌟 Features

### Blockchain Visualization

- **🎨 Interactive Bubble Maps** - D3.js force-directed graph visualization
- **🔍 Wallet Scanner** - Multi-phase scanning (quick → deep analysis)
- **🐋 Whale Tracking** - Monitor large holder movements (>1% supply threshold)
- **🔗 Connection Mapping** - Visualize relationships between wallets
- **📊 Token Analysis** - Top holders, distribution charts, export capabilities

### Advanced Tools

- **⚡ Real-Time Data** - Live Dogechain Explorer API integration
- **🎯 Alert System** - Custom threshold-based notifications
- **💼 Wallet Connection** - MetaMask and Web3 wallet support
- **📱 Responsive Design** - Desktop, tablet, and mobile optimized
- **💾 Offline Support** - IndexedDB caching for offline access

### Production Features

- **🔒 Security Hardened** - CSP, rate limiting, input validation
- **⚡ Performance Optimized** - Code splitting, lazy loading, ~420KB bundle
- **♿ Accessible** - WCAG 2.1 AA compliant, keyboard navigation
- **🎨 Space Theme** - Dark mode UI with smooth animations
- **📊 Analytics Ready** - Sentry error tracking integration

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 20.x or higher
- **npm** package manager

### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/dogechain-bubblemaps.git
cd dogechain-bubblemaps

# Install dependencies
npm install

# Start development server
npm run dev

# Open browser to http://localhost:3000
```

### Build for Production

```bash
npm run build
npm run preview
```

---

## 🛠️ Tech Stack

**Frontend Framework**
- React 19.2.0 - UI framework
- TypeScript 5.8.2 - Type safety
- Vite 6.2.0 - Build tool

**Core Libraries**
- D3.js 7.9.0 - Data visualization
- Dexie 4.2.1 - IndexedDB wrapper
- Zod 4.3.4 - Input validation
- Tailwind CSS 4.1.18 - Styling

**Developer Tools**
- ESLint + Prettier - Code quality
- Vitest - Testing framework
- Husky - Git hooks
- TypeScript Strict Mode - Type safety

**Infrastructure**
- Vercel - Deployment platform
- GitHub Actions - CI/CD pipeline
- Sentry - Error tracking

---

## 📖 Documentation

- **[Deployment Guide](docs/DEPLOYMENT.md)** - Complete Vercel deployment instructions
- **[Security Guide](docs/SECURITY_GUIDE.md)** - Production security best practices
- **[AI Integration](docs/AI_INTEGRATION.md)** - Secure AI feature implementation
- **[Changelog](docs/CHANGELOG.md)** - Version history and updates

---

## 🔧 Configuration

### Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

**Required Variables:**

| Variable | Description | Default |
|----------|-------------|---------|
| `SENTRY_DSN` | Error tracking DSN | Optional |
| `NODE_ENV` | Environment mode | `development` |
| `FEATURE_AI_ENABLED` | Enable AI features | `false` |

**See [.env.example](.env.example)** for all available options.

---

## 🏗️ Project Structure

```
dogechain-bubblemaps/
├── src/
│   ├── components/      # React components
│   │   ├── App.tsx      # Main application
│   │   ├── BubbleMap.tsx # D3 visualization
│   │   └── ...
│   ├── services/        # API integration
│   │   ├── dataService.ts
│   │   └── db.ts
│   └── utils/           # Utilities
│       ├── validation.ts
│       └── rateLimit.ts
├── docs/                # Documentation
├── public/              # Static assets
└── .github/             # CI/CD workflows
```

---

## 🎯 Key Features Deep Dive

### Bubble Map Visualization

Powered by D3.js force-directed graphs:
- Interactive node positioning
- Color-coded by holding size
- Real-time physics simulation
- Zoom and pan capabilities
- Export to PNG/SVG

### Wallet Scanner

Multi-phase analysis:
1. **Quick Scan** - Basic balance and token info
2. **Deep Scan** - Full transaction history
3. **Connection Analysis** - Related wallets
4. **Risk Assessment** - Activity patterns

### Alert Dashboard

- Threshold-based notifications
- Real-time monitoring
- Historical alert log
- Custom alert rules

---

## 🔒 Security

### Production Security Features

✅ **Content Security Policy** - XSS prevention
✅ **HTTP Security Headers** - HSTS, X-Frame-Options, etc.
✅ **Input Validation** - Zod schemas on all inputs
✅ **Rate Limiting** - 60 requests/minute max
✅ **No Hardcoded Secrets** - Environment-based configuration
✅ **Error Tracking** - Sentry integration

### Security Best Practices

- API keys stored in Vercel environment variables
- `.env.local` excluded from Git
- Public repository safe (no secrets exposed)
- See [Security Guide](docs/SECURITY_GUIDE.md) for details

---

## 🚢 Deployment

### Quick Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/dogechain-bubblemaps)

1. Click the button above
2. Connect your GitHub account
3. Configure environment variables
4. Deploy!

**Or manually:**
```bash
npm run build
# Upload 'dist/' folder to hosting provider
```

See [Deployment Guide](docs/DEPLOYMENT.md) for detailed instructions.

---

## 📊 Performance

### Core Web Vitals

- **LCP** (Largest Contentful Paint): < 2.5s ✅
- **FID** (First Input Delay): < 100ms ✅
- **CLS** (Cumulative Layout Shift): < 0.1 ✅

### Bundle Size

- **Main Bundle**: ~369 KB (gzipped: ~110 KB)
- **Total Initial**: ~420 KB
- **Vendor Chunks**: 6 optimized chunks
- **Code Splitting**: Enabled

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📝 License

This project is licensed under the **Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)**.

**What you CAN do:**
- ✅ View, study, and learn from the code
- ✅ Use for personal projects and education
- ✅ Fork and modify for your own use
- ✅ Share with others (with attribution)

**What you CANNOT do:**
- ❌ Use for commercial purposes
- ❌ Sell the code or derivatives
- ❌ Use for commercial gain

See [LICENSE](LICENSE) file for details. For commercial use inquiries, please [contact the owner](https://github.com/PennybagsCX/dogechain-bubblemaps).

---

## 🙏 Acknowledgments

- **Dogechain Team** - For the excellent blockchain explorer API
- **D3.js Community** - Powerful visualization library
- **Vercel** - Amazing deployment platform
- **React Team** - Incredible UI framework

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/YOUR_USERNAME/dogechain-bubblemaps/issues)
- **Discussions**: [GitHub Discussions](https://github.com/YOUR_USERNAME/dogechain-bubblemaps/discussions)
- **Email**: your-email@example.com

---

<div align="center">

**Built with ❤️ for the Dogechain community**

[⭐ Star this repo](https://github.com/YOUR_USERNAME/dogechain-bubblemaps) • [🐛 Report a bug](https://github.com/YOUR_USERNAME/dogechain-bubblemaps/issues) • [💡 Suggest a feature](https://github.com/YOUR_USERNAME/dogechain-bubblemaps/issues)

</div>
