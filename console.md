inpage.js:1 MetaMask encountered an error setting the global Ethereum provider - this is likely due to another Ethereum wallet extension also setting the global Ethereum provider: TypeError: Cannot set property ethereum of #<Window> which has only a getter
at a (inpage.js:1:146243)
at r.initializeProvider (inpage.js:1:146014)
at Object.<anonymous> (inpage.js:1:2308)
at Object.<anonymous> (inpage.js:1:6316)
at 2.../../shared/modules/provider-injection (inpage.js:1:6329)
at i (inpage.js:1:254)
at e (inpage.js:1:412)
at inpage.js:1:429
a @ inpage.js:1
r.initializeProvider @ inpage.js:1
(anonymous) @ inpage.js:1
(anonymous) @ inpage.js:1
2.../../shared/modules/provider-injection @ inpage.js:1
i @ inpage.js:1
e @ inpage.js:1
(anonymous) @ inpage.js:1
scanProgress.ts:58 [Scan Progress] Creating scan checkpoints table...
content_script.js:4080 🚀 Initializing Moat Chrome Extension...
content_script.js:4083 🔧 Moat: Initializing project connection...
content_script.js:90 🔧 Moat: Initializing TaskStore and MarkdownGenerator utilities...
content_script.js:91 🔧 Moat: window.MoatTaskStore available: true
content_script.js:92 🔧 Moat: window.MoatMarkdownGenerator available: true
content_script.js:93 🔧 Moat: window.directoryHandle available: false
content_script.js:105 ⚠️ Moat: TaskStore created but not initialized (no directory handle)
content_script.js:108 🔧 Moat: TaskStore instance: TaskStore {tasks: Array(0), directoryHandle: null}
content_script.js:122 ✅ Moat: MarkdownGenerator initialized successfully
content_script.js:123 🔧 Moat: MarkdownGenerator functions: (8) ['generateMarkdownFromTasks', 'rebuildMarkdownFromJson', 'rebuildMarkdownFile', 'writeMarkdownToFile', 'generateTaskStats', 'statusToCheckbox', 'truncateComment', 'sortTasksByTimestamp']
content_script.js:133 🔧 Moat: Exposing initialized instances to global window...
content_script.js:136 🔧 Moat: Global exposure complete - window.taskStore: true
content_script.js:137 🔧 Moat: Global exposure complete - window.markdownGenerator: true
content_script.js:4125 Moat Chrome Extension loaded (AG-UI disabled)
content_script.js:4090 ⚠️ Falling back to legacy system
content_script.js:621 🚀 Moat: Initializing project with persistence system...
moat.js:286 🔧 ConnectionManager: Initialized
moat.js:3404 Moat: Setting up event listeners...
moat.js:3791 Moat: Initializing, document.readyState: interactive
moat.js:3801 Moat: Document already loaded, initializing moat immediately...
persistence.js:32 ✅ Moat Persistence: IndexedDB initialized successfully
persistence.js:111 ℹ️ Moat Persistence: No stored handle found for: project_http://localhost:3001
persistence.js:298 ℹ️ Moat Persistence: No stored connection found
content_script.js:691 ℹ️ Moat: Persistence restoration failed: No stored connection
content_script.js:706 🔄 Moat: Checking localStorage for legacy connections...
content_script.js:741 🔧 Moat: No valid connections found - user must connect
content_script.js:746 🔧 Moat: Dispatching not-connected event (no path)
moat.js:3453 🔧 Moat: Received project-connected event: {status: 'not-connected', source: 'no-connection-found', eventSignature: 'not-connected-no-path-no-connection-found', timestamp: 1767648823902}
moat.js:525 🔧 ConnectionManager: Processing connection event: {status: 'not-connected', source: 'no-connection-found', eventSignature: 'not-connected-no-path-no-connection-found', timestamp: 1767648823902}
moat.js:391 🔧 ConnectionManager: Setting disconnected state
moat.js:3477 🔧 Moat: Processing disconnection event...
moat.js:2118 Moat: Initializing content visibility, connection state: {status: 'not-connected', path: null, directoryHandle: null, isVerifying: false, isConnected: false, …}
content_script.js:143 🔧 Moat: Initialization attempt 1/3
content_script.js:90 🔧 Moat: Initializing TaskStore and MarkdownGenerator utilities...
content_script.js:91 🔧 Moat: window.MoatTaskStore available: true
content_script.js:92 🔧 Moat: window.MoatMarkdownGenerator available: true
content_script.js:93 🔧 Moat: window.directoryHandle available: false
content_script.js:105 ⚠️ Moat: TaskStore created but not initialized (no directory handle)
content_script.js:108 🔧 Moat: TaskStore instance: TaskStore {tasks: Array(0), directoryHandle: null}
content_script.js:122 ✅ Moat: MarkdownGenerator initialized successfully
content_script.js:123 🔧 Moat: MarkdownGenerator functions: (8) ['generateMarkdownFromTasks', 'rebuildMarkdownFromJson', 'rebuildMarkdownFile', 'writeMarkdownToFile', 'generateTaskStats', 'statusToCheckbox', 'truncateComment', 'sortTasksByTimestamp']
content_script.js:133 🔧 Moat: Exposing initialized instances to global window...
content_script.js:136 🔧 Moat: Global exposure complete - window.taskStore: true
content_script.js:137 🔧 Moat: Global exposure complete - window.markdownGenerator: true
content_script.js:149 ✅ Moat: All utilities initialized successfully
content_script.js:154 🔧 Moat: Instances exposed to global window during retry
content_script.js:610 Moat: Extension loaded successfully
content_script.js:621 🚀 Moat: Initializing project with persistence system...
content_script.js:4106 ✅ Moat extension initialized
content_script.js:4107 🔧 Moat: To connect to project, press Cmd+Shift+P or run setupProject()
persistence.js:111 ℹ️ Moat Persistence: No stored handle found for: project_http://localhost:3001
persistence.js:298 ℹ️ Moat Persistence: No stored connection found
content_script.js:691 ℹ️ Moat: Persistence restoration failed: No stored connection
content_script.js:706 🔄 Moat: Checking localStorage for legacy connections...
content_script.js:741 🔧 Moat: No valid connections found - user must connect
content_script.js:746 🔧 Moat: Dispatching not-connected event (no path)
favicon.ico:1 GET http://localhost:3001/favicon.ico 404 (Not Found)
moat.js:2128 Moat: Starting moat initialization...
moat.js:2037 Moat: Theme initialized to light
moat.js:1061 ✅ Moat: Google Fonts injected from moat.js (defensive check)
moat.js:1071 Moat: createMoat called, creating sidebar element...
moat.js:1075 Moat: Element created with class: float-moat
moat.js:1198 Moat: Sidebar element added to DOM
moat.js:3926 🌊 Moat: Animation system reset
moat.js:2118 Moat: Initializing content visibility, connection state: {status: 'not-connected', path: null, directoryHandle: null, isVerifying: false, isConnected: false, …}
moat.js:2631 Moat: Rendering empty sidebar
moat.js:1272 Moat: Event listeners attached
moat.js:2051 Moat: Logo updated for light theme
moat.js:2142 🔧 Moat: Waiting for content script to restore connection...
moat.js:2051 Moat: Logo updated for light theme
moat.js:2246 🔧 Moat: Updating UI with connection state: {status: 'not-connected', path: null, directoryHandle: null, isVerifying: false, isConnected: false, …}
moat.js:2254 🔧 Moat: Found DOM elements: {indicator: true, label: true, chevron: true, divider: true, button: true}
moat.js:2270 🔧 Moat: Set label text to: Disconnected
moat.js:2276 🔧 Moat: Set tooltip to: Click to connect to project
moat.js:2284 🔧 Moat: UI update complete
moat.js:2149 🔧 Moat: Starting connection verification with proper timing...
moat.js:2289 🔧 Moat: Verifying initial connection...
moat.js:414 🔧 ConnectionManager: Starting connection verification
moat.js:372 🔧 ConnectionManager: State updated: {status: 'not-connected', path: null, directoryHandle: null, isVerifying: true, isConnected: false, …}
moat.js:2246 🔧 Moat: Updating UI with connection state: {status: 'not-connected', path: null, directoryHandle: null, isVerifying: true, isConnected: false, …}
moat.js:2254 🔧 Moat: Found DOM elements: {indicator: true, label: true, chevron: true, divider: true, button: true}
moat.js:2270 🔧 Moat: Set label text to: Disconnected
moat.js:2276 🔧 Moat: Set tooltip to: Click to connect to project
moat.js:2284 🔧 Moat: UI update complete
moat.js:2118 Moat: Initializing content visibility, connection state: {status: 'not-connected', path: null, directoryHandle: null, isVerifying: true, isConnected: false, …}
moat.js:2631 Moat: Rendering empty sidebar
moat.js:420 🔧 ConnectionManager: No directory handle, checking for restoration
moat.js:461 🔧 ConnectionManager: Attempting to restore connection
persistence.js:111 ℹ️ Moat Persistence: No stored handle found for: project_http://localhost:3001
persistence.js:298 ℹ️ Moat Persistence: No stored connection found
moat.js:391 🔧 ConnectionManager: Setting disconnected state
moat.js:372 🔧 ConnectionManager: State updated: {status: 'not-connected', path: null, directoryHandle: null, isVerifying: false, isConnected: false, …}
moat.js:2246 🔧 Moat: Updating UI with connection state: {status: 'not-connected', path: null, directoryHandle: null, isVerifying: false, isConnected: false, …}
moat.js:2254 🔧 Moat: Found DOM elements: {indicator: true, label: true, chevron: true, divider: true, button: true}
moat.js:2270 🔧 Moat: Set label text to: Disconnected
moat.js:2276 🔧 Moat: Set tooltip to: Click to connect to project
moat.js:2284 🔧 Moat: UI update complete
moat.js:2118 Moat: Initializing content visibility, connection state: {status: 'not-connected', path: null, directoryHandle: null, isVerifying: false, isConnected: false, …}
moat.js:2631 Moat: Rendering empty sidebar
moat.js:2294 🔧 Moat: Connection verification complete: {status: 'not-connected', path: null, directoryHandle: null, isVerifying: false, isConnected: false, …}
moat.js:2305 ❌ Moat: No valid connection found
moat.js:2105 Moat: Restoring visibility state from localStorage: null
moat.js:2111 Moat: Moat will remain hidden based on saved state
moat.js:2181 Moat: DOM monitoring started
moat.js:2158 Moat: Moat initialization complete
moat.js:973 🔔 Notification request: Press C to make a comment info content-script
moat.js:798 🔔 Header Notification: Press C to make a comment info content-script
moat.js:858 🔔 Processing header notification: Press C to make a comment info content-script
discoverFactories.ts:538
🔧 Factory Discovery utilities loaded! Available commands:

- discoverFactories() - Scan blockchain for ALL DEX factories
- discoverFactoriesWithCheckpoint() - Scan with checkpointing support
- verifyFactory(address) - Check if address is a valid factory
- getFactoryName(address) - Get factory name from contract

discoverFactories.ts:490 === Starting Comprehensive Factory Discovery (with Checkpointing) ===

discoverFactories.ts:344 [Factory Discovery] Starting comprehensive factory scan with checkpointing...
discoverFactories.ts:361 [Factory Discovery] Starting with 4 known factories
discoverFactories.ts:372 [Factory Discovery] Fetching events for ChewySwap...
discoverFactories.ts:377 [Factory Discovery] API Response for ChewySwap: {message: 'No logs found', result: Array(0), status: '0'}
discoverFactories.ts:372 [Factory Discovery] Fetching events for QuickSwap...
discoverFactories.ts:377 [Factory Discovery] API Response for QuickSwap: {message: 'No logs found', result: Array(0), status: '0'}
discoverFactories.ts:372 [Factory Discovery] Fetching events for KibbleSwap...
discoverFactories.ts:377 [Factory Discovery] API Response for KibbleSwap: {message: 'No logs found', result: Array(0), status: '0'}
discoverFactories.ts:372 [Factory Discovery] Fetching events for DogeSwap...
discoverFactories.ts:377 [Factory Discovery] API Response for DogeSwap: {message: 'No logs found', result: Array(0), status: '0'}
discoverFactories.ts:438 [Factory Discovery] Scan complete!
discoverFactories.ts:439
discoverFactories.ts:507 No factories discovered!
runFactoryDiscoveryWithCheckpoint @ discoverFactories.ts:507
await in runFactoryDiscoveryWithCheckpoint
phase1FactoryDiscovery @ comprehensiveScanner.ts:53
await in phase1FactoryDiscovery
runComprehensiveScan @ comprehensiveScanner.ts:259
await in runComprehensiveScan
window.startScan @ comprehensive-scanner.html:459
onclick @ comprehensive-scanner.html:287
db.ts:1033 [DB] Failed to get active discovered factories: TypeError: Cannot read properties of undefined (reading 'where')
at getActiveDiscoveredFactories (db.ts:1031:24)
at phase2LPScanning (comprehensiveScanner.ts:89:27)
at runComprehensiveScan (comprehensiveScanner.ts:265:34)
at async window.startScan (comprehensive-scanner.html:459:24)
getActiveDiscoveredFactories @ db.ts:1033
phase2LPScanning @ comprehensiveScanner.ts:89
runComprehensiveScan @ comprehensiveScanner.ts:265
await in runComprehensiveScan
window.startScan @ comprehensive-scanner.html:459
onclick @ comprehensive-scanner.html:287
