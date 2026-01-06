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
react-dom_client.js?v=f9e8fe88:20103 Download the React DevTools for a better development experience: https://react.dev/link/react-devtools
searchAnalytics.ts:386 [Analytics] Initialized with session: bca774acb64828ab2eb6471423b62100
sentry.config.ts:86 Sentry not initialized: Development mode
TokenSearchInput.tsx:29 [Token Search] Worker initialized successfully
?token=0xa6d7137af64280e3eb8715ab6766740984dd35e7&type=TOKEN&view=analysis:1 Access to fetch at 'https://dogechain-bubblemaps-api.vercel.app/api/trending?type=ALL&limit=20&cache=true' from origin 'http://localhost:3000' has been blocked by CORS policy: The 'Access-Control-Allow-Origin' header has a value 'https://www.dogechain-bubblemaps.xyz' that is not equal to the supplied origin. Have the server send the header with a valid value.
trendingService.ts:89  GET https://dogechain-bubblemaps-api.vercel.app/api/trending?type=ALL&limit=20&cache=true net::ERR_FAILED 200 (OK)
getTrendingAssets @ trendingService.ts:89
fetchServerTrending @ App.tsx:379
(anonymous) @ App.tsx:399
react_stack_bottom_frame @ react-dom_client.js?v=f9e8fe88:18567
runWithFiberInDEV @ react-dom_client.js?v=f9e8fe88:997
commitHookEffectListMount @ react-dom_client.js?v=f9e8fe88:9411
commitHookPassiveMountEffects @ react-dom_client.js?v=f9e8fe88:9465
commitPassiveMountOnFiber @ react-dom_client.js?v=f9e8fe88:11040
recursivelyTraversePassiveMountEffects @ react-dom_client.js?v=f9e8fe88:11010
commitPassiveMountOnFiber @ react-dom_client.js?v=f9e8fe88:11055
recursivelyTraversePassiveMountEffects @ react-dom_client.js?v=f9e8fe88:11010
commitPassiveMountOnFiber @ react-dom_client.js?v=f9e8fe88:11201
recursivelyTraversePassiveMountEffects @ react-dom_client.js?v=f9e8fe88:11010
commitPassiveMountOnFiber @ react-dom_client.js?v=f9e8fe88:11066
flushPassiveEffects @ react-dom_client.js?v=f9e8fe88:13150
(anonymous) @ react-dom_client.js?v=f9e8fe88:12776
performWorkUntilDeadline @ react-dom_client.js?v=f9e8fe88:36
<App>
exports.jsxDEV @ react_jsx-dev-runtime.js?v=f9e8fe88:247
(anonymous) @ index.tsx:20
trendingService.ts:113 [Trending] Server fetch failed, falling back to local trending: TypeError: Failed to fetch
    at getTrendingAssets (trendingService.ts:89:28)
    at fetchServerTrending (App.tsx:379:38)
    at App.tsx:399:5
    at Object.react_stack_bottom_frame (react-dom_client.js?v=f9e8fe88:18567:20)
    at runWithFiberInDEV (react-dom_client.js?v=f9e8fe88:997:72)
    at commitHookEffectListMount (react-dom_client.js?v=f9e8fe88:9411:163)
    at commitHookPassiveMountEffects (react-dom_client.js?v=f9e8fe88:9465:60)
    at commitPassiveMountOnFiber (react-dom_client.js?v=f9e8fe88:11040:29)
    at recursivelyTraversePassiveMountEffects (react-dom_client.js?v=f9e8fe88:11010:13)
    at commitPassiveMountOnFiber (react-dom_client.js?v=f9e8fe88:11055:13)
getTrendingAssets @ trendingService.ts:113
await in getTrendingAssets
fetchServerTrending @ App.tsx:379
(anonymous) @ App.tsx:399
react_stack_bottom_frame @ react-dom_client.js?v=f9e8fe88:18567
runWithFiberInDEV @ react-dom_client.js?v=f9e8fe88:997
commitHookEffectListMount @ react-dom_client.js?v=f9e8fe88:9411
commitHookPassiveMountEffects @ react-dom_client.js?v=f9e8fe88:9465
commitPassiveMountOnFiber @ react-dom_client.js?v=f9e8fe88:11040
recursivelyTraversePassiveMountEffects @ react-dom_client.js?v=f9e8fe88:11010
commitPassiveMountOnFiber @ react-dom_client.js?v=f9e8fe88:11055
recursivelyTraversePassiveMountEffects @ react-dom_client.js?v=f9e8fe88:11010
commitPassiveMountOnFiber @ react-dom_client.js?v=f9e8fe88:11201
recursivelyTraversePassiveMountEffects @ react-dom_client.js?v=f9e8fe88:11010
commitPassiveMountOnFiber @ react-dom_client.js?v=f9e8fe88:11066
flushPassiveEffects @ react-dom_client.js?v=f9e8fe88:13150
(anonymous) @ react-dom_client.js?v=f9e8fe88:12776
performWorkUntilDeadline @ react-dom_client.js?v=f9e8fe88:36
<App>
exports.jsxDEV @ react_jsx-dev-runtime.js?v=f9e8fe88:247
(anonymous) @ index.tsx:20
script.debug.js:1 [Vercel Web Analytics] Debug mode is enabled by default in development. No requests will be sent to the server.
script.debug.js:1 [Vercel Web Analytics] [pageview] http://localhost:3000/?token=0xa6d7137af64280e3eb8715ab6766740984dd35e7&type=TOKEN&view=analysis {o: 'http://localhost:3000/?token=0xa6d7137af64280e3eb8715ab6766740984dd35e7&type=TOKEN&view=analysis', sv: '0.1.3', sdkn: '@vercel/analytics/react', sdkv: '1.6.1', ts: 1767737188193, …}
?token=0xa6d7137af64280e3eb8715ab6766740984dd35e7&type=TOKEN&view=analysis:1 Access to fetch at 'https://dogechain-bubblemaps-api.vercel.app/api/trending?type=ALL&limit=20&cache=true' from origin 'http://localhost:3000' has been blocked by CORS policy: The 'Access-Control-Allow-Origin' header has a value 'https://www.dogechain-bubblemaps.xyz' that is not equal to the supplied origin. Have the server send the header with a valid value.
trendingService.ts:89  GET https://dogechain-bubblemaps-api.vercel.app/api/trending?type=ALL&limit=20&cache=true net::ERR_FAILED 200 (OK)
getTrendingAssets @ trendingService.ts:89
fetchServerTrending @ App.tsx:379
(anonymous) @ App.tsx:399
react_stack_bottom_frame @ react-dom_client.js?v=f9e8fe88:18567
runWithFiberInDEV @ react-dom_client.js?v=f9e8fe88:997
commitHookEffectListMount @ react-dom_client.js?v=f9e8fe88:9411
commitHookPassiveMountEffects @ react-dom_client.js?v=f9e8fe88:9465
reconnectPassiveEffects @ react-dom_client.js?v=f9e8fe88:11273
recursivelyTraverseReconnectPassiveEffects @ react-dom_client.js?v=f9e8fe88:11240
reconnectPassiveEffects @ react-dom_client.js?v=f9e8fe88:11317
recursivelyTraverseReconnectPassiveEffects @ react-dom_client.js?v=f9e8fe88:11240
reconnectPassiveEffects @ react-dom_client.js?v=f9e8fe88:11317
doubleInvokeEffectsOnFiber @ react-dom_client.js?v=f9e8fe88:13339
runWithFiberInDEV @ react-dom_client.js?v=f9e8fe88:997
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom_client.js?v=f9e8fe88:13312
commitDoubleInvokeEffectsInDEV @ react-dom_client.js?v=f9e8fe88:13347
flushPassiveEffects @ react-dom_client.js?v=f9e8fe88:13157
(anonymous) @ react-dom_client.js?v=f9e8fe88:12776
performWorkUntilDeadline @ react-dom_client.js?v=f9e8fe88:36
<App>
exports.jsxDEV @ react_jsx-dev-runtime.js?v=f9e8fe88:247
(anonymous) @ index.tsx:20
trendingService.ts:113 [Trending] Server fetch failed, falling back to local trending: TypeError: Failed to fetch
    at getTrendingAssets (trendingService.ts:89:28)
    at fetchServerTrending (App.tsx:379:38)
    at App.tsx:399:5
    at Object.react_stack_bottom_frame (react-dom_client.js?v=f9e8fe88:18567:20)
    at runWithFiberInDEV (react-dom_client.js?v=f9e8fe88:997:72)
    at commitHookEffectListMount (react-dom_client.js?v=f9e8fe88:9411:163)
    at commitHookPassiveMountEffects (react-dom_client.js?v=f9e8fe88:9465:60)
    at reconnectPassiveEffects (react-dom_client.js?v=f9e8fe88:11273:13)
    at recursivelyTraverseReconnectPassiveEffects (react-dom_client.js?v=f9e8fe88:11240:11)
    at reconnectPassiveEffects (react-dom_client.js?v=f9e8fe88:11317:13)
getTrendingAssets @ trendingService.ts:113
await in getTrendingAssets
fetchServerTrending @ App.tsx:379
(anonymous) @ App.tsx:399
react_stack_bottom_frame @ react-dom_client.js?v=f9e8fe88:18567
runWithFiberInDEV @ react-dom_client.js?v=f9e8fe88:997
commitHookEffectListMount @ react-dom_client.js?v=f9e8fe88:9411
commitHookPassiveMountEffects @ react-dom_client.js?v=f9e8fe88:9465
reconnectPassiveEffects @ react-dom_client.js?v=f9e8fe88:11273
recursivelyTraverseReconnectPassiveEffects @ react-dom_client.js?v=f9e8fe88:11240
reconnectPassiveEffects @ react-dom_client.js?v=f9e8fe88:11317
recursivelyTraverseReconnectPassiveEffects @ react-dom_client.js?v=f9e8fe88:11240
reconnectPassiveEffects @ react-dom_client.js?v=f9e8fe88:11317
doubleInvokeEffectsOnFiber @ react-dom_client.js?v=f9e8fe88:13339
runWithFiberInDEV @ react-dom_client.js?v=f9e8fe88:997
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom_client.js?v=f9e8fe88:13312
commitDoubleInvokeEffectsInDEV @ react-dom_client.js?v=f9e8fe88:13347
flushPassiveEffects @ react-dom_client.js?v=f9e8fe88:13157
(anonymous) @ react-dom_client.js?v=f9e8fe88:12776
performWorkUntilDeadline @ react-dom_client.js?v=f9e8fe88:36
<App>
exports.jsxDEV @ react_jsx-dev-runtime.js?v=f9e8fe88:247
(anonymous) @ index.tsx:20
tokenSearchService.ts:238 [Token Search] Initializing search index...
tokenSearchService.ts:238 [Token Search] Initializing search index...
tokenSearchService.ts:245 [Token Search] Index already populated with 122 tokens
tokenSearchService.ts:245 [Token Search] Index already populated with 122 tokens
dataService.ts:513 [LP Detection] ===== fetchTokenHolders called for FUCKPEPE =====
App.tsx:2308 ReferenceError: Cannot access 'getNodeColor' before initialization
    at BubbleMap (BubbleMap.tsx:81:41)
    at Object.react_stack_bottom_frame (react-dom_client.js?v=f9e8fe88:18509:20)
    at renderWithHooks (react-dom_client.js?v=f9e8fe88:5654:24)
    at updateFunctionComponent (react-dom_client.js?v=f9e8fe88:7475:21)
    at beginWork (react-dom_client.js?v=f9e8fe88:8525:20)
    at runWithFiberInDEV (react-dom_client.js?v=f9e8fe88:997:72)
    at performUnitOfWork (react-dom_client.js?v=f9e8fe88:12561:98)
    at workLoopSync (react-dom_client.js?v=f9e8fe88:12424:43)
    at renderRootSync (react-dom_client.js?v=f9e8fe88:12408:13)
    at performWorkOnRoot (react-dom_client.js?v=f9e8fe88:11827:37)

The above error occurred in the <BubbleMap> component.

React will try to recreate this component tree from scratch using the error boundary you provided, ErrorBoundary.

defaultOnCaughtError @ react-dom_client.js?v=f9e8fe88:7001
logCaughtError @ react-dom_client.js?v=f9e8fe88:7033
runWithFiberInDEV @ react-dom_client.js?v=f9e8fe88:997
inst.componentDidCatch.update.callback @ react-dom_client.js?v=f9e8fe88:7078
callCallback @ react-dom_client.js?v=f9e8fe88:5491
commitCallbacks @ react-dom_client.js?v=f9e8fe88:5503
runWithFiberInDEV @ react-dom_client.js?v=f9e8fe88:997
commitClassCallbacks @ react-dom_client.js?v=f9e8fe88:9490
commitLayoutEffectOnFiber @ react-dom_client.js?v=f9e8fe88:9958
recursivelyTraverseLayoutEffects @ react-dom_client.js?v=f9e8fe88:10792
commitLayoutEffectOnFiber @ react-dom_client.js?v=f9e8fe88:10074
recursivelyTraverseLayoutEffects @ react-dom_client.js?v=f9e8fe88:10792
commitLayoutEffectOnFiber @ react-dom_client.js?v=f9e8fe88:9963
flushLayoutEffects @ react-dom_client.js?v=f9e8fe88:12924
commitRoot @ react-dom_client.js?v=f9e8fe88:12803
commitRootWhenReady @ react-dom_client.js?v=f9e8fe88:12016
performWorkOnRoot @ react-dom_client.js?v=f9e8fe88:11950
performWorkOnRootViaSchedulerTask @ react-dom_client.js?v=f9e8fe88:13505
performWorkUntilDeadline @ react-dom_client.js?v=f9e8fe88:36
<BubbleMap>
exports.jsxDEV @ react_jsx-dev-runtime.js?v=f9e8fe88:247
App @ App.tsx:2308
react_stack_bottom_frame @ react-dom_client.js?v=f9e8fe88:18509
renderWithHooksAgain @ react-dom_client.js?v=f9e8fe88:5729
renderWithHooks @ react-dom_client.js?v=f9e8fe88:5665
updateFunctionComponent @ react-dom_client.js?v=f9e8fe88:7475
beginWork @ react-dom_client.js?v=f9e8fe88:8525
runWithFiberInDEV @ react-dom_client.js?v=f9e8fe88:997
performUnitOfWork @ react-dom_client.js?v=f9e8fe88:12561
workLoopSync @ react-dom_client.js?v=f9e8fe88:12424
renderRootSync @ react-dom_client.js?v=f9e8fe88:12408
performWorkOnRoot @ react-dom_client.js?v=f9e8fe88:11827
performWorkOnRootViaSchedulerTask @ react-dom_client.js?v=f9e8fe88:13505
performWorkUntilDeadline @ react-dom_client.js?v=f9e8fe88:36
<App>
exports.jsxDEV @ react_jsx-dev-runtime.js?v=f9e8fe88:247
(anonymous) @ index.tsx:20
ErrorBoundary.tsx:25 Uncaught error: ReferenceError: Cannot access 'getNodeColor' before initialization
    at BubbleMap (BubbleMap.tsx:81:41)
    at Object.react_stack_bottom_frame (react-dom_client.js?v=f9e8fe88:18509:20)
    at renderWithHooks (react-dom_client.js?v=f9e8fe88:5654:24)
    at updateFunctionComponent (react-dom_client.js?v=f9e8fe88:7475:21)
    at beginWork (react-dom_client.js?v=f9e8fe88:8525:20)
    at runWithFiberInDEV (react-dom_client.js?v=f9e8fe88:997:72)
    at performUnitOfWork (react-dom_client.js?v=f9e8fe88:12561:98)
    at workLoopSync (react-dom_client.js?v=f9e8fe88:12424:43)
    at renderRootSync (react-dom_client.js?v=f9e8fe88:12408:13)
    at performWorkOnRoot (react-dom_client.js?v=f9e8fe88:11827:37) {componentStack: '\n    at BubbleMap (http://localhost:3000/component…/localhost:3000/components/ErrorBoundary.tsx:7:5)'}
componentDidCatch @ ErrorBoundary.tsx:25
react_stack_bottom_frame @ react-dom_client.js?v=f9e8fe88:18547
inst.componentDidCatch.update.callback @ react-dom_client.js?v=f9e8fe88:7086
callCallback @ react-dom_client.js?v=f9e8fe88:5491
commitCallbacks @ react-dom_client.js?v=f9e8fe88:5503
runWithFiberInDEV @ react-dom_client.js?v=f9e8fe88:997
commitClassCallbacks @ react-dom_client.js?v=f9e8fe88:9490
commitLayoutEffectOnFiber @ react-dom_client.js?v=f9e8fe88:9958
recursivelyTraverseLayoutEffects @ react-dom_client.js?v=f9e8fe88:10792
commitLayoutEffectOnFiber @ react-dom_client.js?v=f9e8fe88:10074
recursivelyTraverseLayoutEffects @ react-dom_client.js?v=f9e8fe88:10792
commitLayoutEffectOnFiber @ react-dom_client.js?v=f9e8fe88:9963
flushLayoutEffects @ react-dom_client.js?v=f9e8fe88:12924
commitRoot @ react-dom_client.js?v=f9e8fe88:12803
commitRootWhenReady @ react-dom_client.js?v=f9e8fe88:12016
performWorkOnRoot @ react-dom_client.js?v=f9e8fe88:11950
performWorkOnRootViaSchedulerTask @ react-dom_client.js?v=f9e8fe88:13505
performWorkUntilDeadline @ react-dom_client.js?v=f9e8fe88:36
<ErrorBoundary>
exports.jsxDEV @ react_jsx-dev-runtime.js?v=f9e8fe88:247
(anonymous) @ index.tsx:19
dataService.ts:513 [LP Detection] ===== fetchTokenHolders called for FUCKPEPE =====
?token=0xa6d7137af64280e3eb8715ab6766740984dd35e7&type=TOKEN&view=analysis:1 Access to fetch at 'https://dogechain-bubblemaps-api.vercel.app/api/trending/log' from origin 'http://localhost:3000' has been blocked by CORS policy: Response to preflight request doesn't pass access control check: The 'Access-Control-Allow-Origin' header has a value 'https://www.dogechain-bubblemaps.xyz' that is not equal to the supplied origin. Have the server send the header with a valid value.
trendingService.ts:46  POST https://dogechain-bubblemaps-api.vercel.app/api/trending/log net::ERR_FAILED
logSearchQuery @ trendingService.ts:46
handleSearch @ App.tsx:877
await in handleSearch
(anonymous) @ App.tsx:996
react_stack_bottom_frame @ react-dom_client.js?v=f9e8fe88:18567
runWithFiberInDEV @ react-dom_client.js?v=f9e8fe88:997
commitHookEffectListMount @ react-dom_client.js?v=f9e8fe88:9411
commitHookPassiveMountEffects @ react-dom_client.js?v=f9e8fe88:9465
commitPassiveMountOnFiber @ react-dom_client.js?v=f9e8fe88:11040
recursivelyTraversePassiveMountEffects @ react-dom_client.js?v=f9e8fe88:11010
commitPassiveMountOnFiber @ react-dom_client.js?v=f9e8fe88:11055
recursivelyTraversePassiveMountEffects @ react-dom_client.js?v=f9e8fe88:11010
commitPassiveMountOnFiber @ react-dom_client.js?v=f9e8fe88:11201
recursivelyTraversePassiveMountEffects @ react-dom_client.js?v=f9e8fe88:11010
commitPassiveMountOnFiber @ react-dom_client.js?v=f9e8fe88:11066
flushPassiveEffects @ react-dom_client.js?v=f9e8fe88:13150
(anonymous) @ react-dom_client.js?v=f9e8fe88:12776
performWorkUntilDeadline @ react-dom_client.js?v=f9e8fe88:36
<App>
exports.jsxDEV @ react_jsx-dev-runtime.js?v=f9e8fe88:247
(anonymous) @ index.tsx:20
trendingService.ts:70 [Trending] Error logging search: TypeError: Failed to fetch
    at logSearchQuery (trendingService.ts:46:28)
    at handleSearch (App.tsx:877:7)
logSearchQuery @ trendingService.ts:70
await in logSearchQuery
handleSearch @ App.tsx:877
await in handleSearch
(anonymous) @ App.tsx:996
react_stack_bottom_frame @ react-dom_client.js?v=f9e8fe88:18567
runWithFiberInDEV @ react-dom_client.js?v=f9e8fe88:997
commitHookEffectListMount @ react-dom_client.js?v=f9e8fe88:9411
commitHookPassiveMountEffects @ react-dom_client.js?v=f9e8fe88:9465
commitPassiveMountOnFiber @ react-dom_client.js?v=f9e8fe88:11040
recursivelyTraversePassiveMountEffects @ react-dom_client.js?v=f9e8fe88:11010
commitPassiveMountOnFiber @ react-dom_client.js?v=f9e8fe88:11055
recursivelyTraversePassiveMountEffects @ react-dom_client.js?v=f9e8fe88:11010
commitPassiveMountOnFiber @ react-dom_client.js?v=f9e8fe88:11201
recursivelyTraversePassiveMountEffects @ react-dom_client.js?v=f9e8fe88:11010
commitPassiveMountOnFiber @ react-dom_client.js?v=f9e8fe88:11066
flushPassiveEffects @ react-dom_client.js?v=f9e8fe88:13150
(anonymous) @ react-dom_client.js?v=f9e8fe88:12776
performWorkUntilDeadline @ react-dom_client.js?v=f9e8fe88:36
<App>
exports.jsxDEV @ react_jsx-dev-runtime.js?v=f9e8fe88:247
(anonymous) @ index.tsx:20
?token=0xa6d7137af64280e3eb8715ab6766740984dd35e7&type=TOKEN&view=analysis:1 Access to fetch at 'https://dogechain-bubblemaps-api.vercel.app/api/trending/log' from origin 'http://localhost:3000' has been blocked by CORS policy: Response to preflight request doesn't pass access control check: The 'Access-Control-Allow-Origin' header has a value 'https://www.dogechain-bubblemaps.xyz' that is not equal to the supplied origin. Have the server send the header with a valid value.
trendingService.ts:46  POST https://dogechain-bubblemaps-api.vercel.app/api/trending/log net::ERR_FAILED
logSearchQuery @ trendingService.ts:46
handleSearch @ App.tsx:877
await in handleSearch
(anonymous) @ App.tsx:996
react_stack_bottom_frame @ react-dom_client.js?v=f9e8fe88:18567
runWithFiberInDEV @ react-dom_client.js?v=f9e8fe88:997
commitHookEffectListMount @ react-dom_client.js?v=f9e8fe88:9411
commitHookPassiveMountEffects @ react-dom_client.js?v=f9e8fe88:9465
reconnectPassiveEffects @ react-dom_client.js?v=f9e8fe88:11273
recursivelyTraverseReconnectPassiveEffects @ react-dom_client.js?v=f9e8fe88:11240
reconnectPassiveEffects @ react-dom_client.js?v=f9e8fe88:11317
recursivelyTraverseReconnectPassiveEffects @ react-dom_client.js?v=f9e8fe88:11240
reconnectPassiveEffects @ react-dom_client.js?v=f9e8fe88:11317
doubleInvokeEffectsOnFiber @ react-dom_client.js?v=f9e8fe88:13339
runWithFiberInDEV @ react-dom_client.js?v=f9e8fe88:997
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom_client.js?v=f9e8fe88:13312
commitDoubleInvokeEffectsInDEV @ react-dom_client.js?v=f9e8fe88:13347
flushPassiveEffects @ react-dom_client.js?v=f9e8fe88:13157
(anonymous) @ react-dom_client.js?v=f9e8fe88:12776
performWorkUntilDeadline @ react-dom_client.js?v=f9e8fe88:36
<App>
exports.jsxDEV @ react_jsx-dev-runtime.js?v=f9e8fe88:247
(anonymous) @ index.tsx:20
trendingService.ts:70 [Trending] Error logging search: TypeError: Failed to fetch
    at logSearchQuery (trendingService.ts:46:28)
    at handleSearch (App.tsx:877:7)
logSearchQuery @ trendingService.ts:70
await in logSearchQuery
handleSearch @ App.tsx:877
await in handleSearch
(anonymous) @ App.tsx:996
react_stack_bottom_frame @ react-dom_client.js?v=f9e8fe88:18567
runWithFiberInDEV @ react-dom_client.js?v=f9e8fe88:997
commitHookEffectListMount @ react-dom_client.js?v=f9e8fe88:9411
commitHookPassiveMountEffects @ react-dom_client.js?v=f9e8fe88:9465
reconnectPassiveEffects @ react-dom_client.js?v=f9e8fe88:11273
recursivelyTraverseReconnectPassiveEffects @ react-dom_client.js?v=f9e8fe88:11240
reconnectPassiveEffects @ react-dom_client.js?v=f9e8fe88:11317
recursivelyTraverseReconnectPassiveEffects @ react-dom_client.js?v=f9e8fe88:11240
reconnectPassiveEffects @ react-dom_client.js?v=f9e8fe88:11317
doubleInvokeEffectsOnFiber @ react-dom_client.js?v=f9e8fe88:13339
runWithFiberInDEV @ react-dom_client.js?v=f9e8fe88:997
recursivelyTraverseAndDoubleInvokeEffectsInDEV @ react-dom_client.js?v=f9e8fe88:13312
commitDoubleInvokeEffectsInDEV @ react-dom_client.js?v=f9e8fe88:13347
flushPassiveEffects @ react-dom_client.js?v=f9e8fe88:13157
(anonymous) @ react-dom_client.js?v=f9e8fe88:12776
performWorkUntilDeadline @ react-dom_client.js?v=f9e8fe88:36
<App>
exports.jsxDEV @ react_jsx-dev-runtime.js?v=f9e8fe88:247
(anonymous) @ index.tsx:20
dataService.ts:313 [LP Detection] Checking holder: 0xd4a085bf7d6eb423d9c304dfe6104d5df35b8ebc
dataService.ts:313 [LP Detection] Checking holder: 0x1c5176eb4a36b0a452231d858f08c4b9f8cdb747
dataService.ts:313 [LP Detection] Checking holder: 0x6b091ec6c77ebafac15ff88f34c89a4b0b032791
dataService.ts:313 [LP Detection] Checking holder: 0xc99586f31162e1118fd1d9a5efb4bf206bcbee92
dataService.ts:313 [LP Detection] Checking holder: 0x4f8b27d3b52bc37ba55831e894f8f0aded48189e
dataService.ts:313 [LP Detection] Checking holder: 0x97fef2ec997c4ed862e85d2c72416333f95496a3
dataService.ts:313 [LP Detection] Checking holder: 0x9c2f161c306cce103b442c993f2bb43098bd0161
dataService.ts:313 [LP Detection] Checking holder: 0x39be7870752834972269de945a1e61318d7f1dc1
dataService.ts:313 [LP Detection] Checking holder: 0xc6acee4e9cbca7603dd8b72d36a5301e1f59bf0f
dataService.ts:313 [LP Detection] Checking holder: 0x94e9c1dec01956416a710d3e72133beddeb84012
dataService.ts:313 [LP Detection] Checking holder: 0x51ef25f6bdfcde75aba7a7c8e7b0e8954df739f7
dataService.ts:313 [LP Detection] Checking holder: 0x2e909729016eb1013a197e05210e35ce4435abc4
dataService.ts:313 [LP Detection] Checking holder: 0x45fdab3008e8f85afa683b3dae84e73074e4b788
dataService.ts:313 [LP Detection] Checking holder: 0x1eb311e6f0ba79f703f6792e86b4c752210c9c71
dataService.ts:313 [LP Detection] Checking holder: 0xf67206a12e8b01751b21ccb75144e052d883a63b
dataService.ts:313 [LP Detection] Checking holder: 0x206710759f9c6ad87490a131ab31255b38a423eb
dataService.ts:313 [LP Detection] Checking holder: 0x524ffc273240722273eb9bbf27873074629b63a7
dataService.ts:313 [LP Detection] Checking holder: 0x56ce632320b8af872b9ef5b94c4a483a63f1ee26
dataService.ts:313 [LP Detection] Checking holder: 0x2ecb2608e07963236e184b3e109d619f5a794a11
dataService.ts:313 [LP Detection] Checking holder: 0x28bcee44db549d78951b97f759eb86572e5ebcd4
dataService.ts:313 [LP Detection] Checking holder: 0x467a896b0ce13dbec109effd15a9bbd222558d0f
dataService.ts:313 [LP Detection] Checking holder: 0x4f8b27d3b52bc37ba55831e894f8f0aded48189e
dataService.ts:313 [LP Detection] Checking holder: 0x36d790301a18138b0c78c90f2a116ca11e8e7d73
dataService.ts:313 [LP Detection] Checking holder: 0x524ffc273240722273eb9bbf27873074629b63a7
dataService.ts:313 [LP Detection] Checking holder: 0x73bbc753765a27f71ac0fb1d1ed7aecbafb316f3
dataService.ts:313 [LP Detection] Checking holder: 0x206710759f9c6ad87490a131ab31255b38a423eb
dataService.ts:313 [LP Detection] Checking holder: 0x56ce632320b8af872b9ef5b94c4a483a63f1ee26
dataService.ts:313 [LP Detection] Checking holder: 0x9ed1acdc0165222b0953aaf711f2d56da0c4b18d
dataService.ts:313 [LP Detection] Checking holder: 0x9bad4cca2435339e7b3dcb1941fb835cc53c6bbb
dataService.ts:313 [LP Detection] Checking holder: 0x13629314348649ed8794b6a1c4372f4c46a7fa6e
dataService.ts:313 [LP Detection] Checking holder: 0x80de4fd177a1f9c34dcce96449c75408c30fb61c
dataService.ts:313 [LP Detection] Checking holder: 0x81ab9606a43e6726e6426e38085f1c4aae5f1226
dataService.ts:313 [LP Detection] Checking holder: 0x59fb56e2f26e4c14d17f44225402982e73075205
dataService.ts:313 [LP Detection] Checking holder: 0x16e24af3a9a6ab709e8ef31f8b2ee303e51f0307
dataService.ts:313 [LP Detection] Checking holder: 0xa23d0b843a1b617776700c002c8872e032cc7533
dataService.ts:313 [LP Detection] Checking holder: 0xb02a4a98405daa4199e816136ea414b2207cfda4
dataService.ts:313 [LP Detection] Checking holder: 0x61716ffa65f4f0f72e19eae45a9ff32c59615fae
dataService.ts:313 [LP Detection] Checking holder: 0x40d0e7702b5786222bb9c2708e8af5bff7f16c26
dataService.ts:313 [LP Detection] Checking holder: 0x13629314348649ed8794b6a1c4372f4c46a7fa6e
dataService.ts:313 [LP Detection] Checking holder: 0xc31c3666043ca65dfd78ce5d2bde550ec7b99ed2
dataService.ts:313 [LP Detection] Checking holder: 0xe1e3c86f94a4c28f3650947a6cd3027dca26a54f
dataService.ts:313 [LP Detection] Checking holder: 0xac52f7ac7078e9d00df8042ea8e258ad53076e3b
dataService.ts:313 [LP Detection] Checking holder: 0x9ed1acdc0165222b0953aaf711f2d56da0c4b18d
dataService.ts:313 [LP Detection] Checking holder: 0x70ef85807523536a2565a0e6cfb932ed975ccfe4
dataService.ts:313 [LP Detection] Checking holder: 0x2c3311bbf93300a199eb7ae6777ab24fc651e946
dataService.ts:313 [LP Detection] Checking holder: 0x4d8f4bbc422e7d8510b77df45fa8f3eddcd0eba8
dataService.ts:313 [LP Detection] Checking holder: 0x95e343297bf06616a43511a345294f7fac2ce7b9
dataService.ts:313 [LP Detection] Checking holder: 0xf9dafaf418ee86a110a6949a89f3168ac1dd291e
dataService.ts:313 [LP Detection] Checking holder: 0x9bad4cca2435339e7b3dcb1941fb835cc53c6bbb
dataService.ts:313 [LP Detection] Checking holder: 0x1a7bb7eacf0cf1ce093c35bcc6866fa9fb60ba06
dataService.ts:313 [LP Detection] Checking holder: 0x68c67f07619d7b016212411317ca23ecdefd99c9
dataService.ts:313 [LP Detection] Checking holder: 0xdca31b979661e5752afd4b878f4f301b2cbefe58
dataService.ts:313 [LP Detection] Checking holder: 0xc961349113118b964f66feb0b8d8754699d861f1
dataService.ts:313 [LP Detection] Checking holder: 0x6b9f24eff9afaaa8101e18766ea74a73d425f3c0
dataService.ts:313 [LP Detection] Checking holder: 0x1187a507096932197fa6ea44b66bf8736337947c
dataService.ts:313 [LP Detection] Checking holder: 0x51ef25f6bdfcde75aba7a7c8e7b0e8954df739f7
dataService.ts:313 [LP Detection] Checking holder: 0x97fef2ec997c4ed862e85d2c72416333f95496a3
dataService.ts:313 [LP Detection] Checking holder: 0xa9cc702eb220abef183c95b311ddfd41aee1efa7
dataService.ts:313 [LP Detection] Checking holder: 0x22f4194f6706e70abaa14ab352d0baa6c7ced24a
dataService.ts:313 [LP Detection] Checking holder: 0x2e909729016eb1013a197e05210e35ce4435abc4
dataService.ts:313 [LP Detection] Checking holder: 0x0684e49cbc62c57ffbfd133aaff7f53d5d356944
dataService.ts:313 [LP Detection] Checking holder: 0x16e24af3a9a6ab709e8ef31f8b2ee303e51f0307
dataService.ts:313 [LP Detection] Checking holder: 0xa9cc702eb220abef183c95b311ddfd41aee1efa7
dataService.ts:313 [LP Detection] Checking holder: 0x5e147de08414ea91f9b5432662e4952ef729a06e
dataService.ts:313 [LP Detection] Checking holder: 0x7be8bd7226533e7c73199cd7244f92188e23323b
dataService.ts:313 [LP Detection] Checking holder: 0x0608037fd563fa0d159adb934ffc9035df56fb88
dataService.ts:313 [LP Detection] Checking holder: 0x1a7bb7eacf0cf1ce093c35bcc6866fa9fb60ba06
dataService.ts:313 [LP Detection] Checking holder: 0x73b56aa56b35a9eb062ebb0e187fe0f2603dbd25
dataService.ts:313 [LP Detection] Checking holder: 0xff3dae5a61f57498f98261574a19e334a55bd48a
dataService.ts:313 [LP Detection] Checking holder: 0x73b56aa56b35a9eb062ebb0e187fe0f2603dbd25
dataService.ts:313 [LP Detection] Checking holder: 0x39be7870752834972269de945a1e61318d7f1dc1
dataService.ts:313 [LP Detection] Checking holder: 0x33b2c1b566cce029eb17f2281012e14a4e600e40
dataService.ts:313 [LP Detection] Checking holder: 0xc99586f31162e1118fd1d9a5efb4bf206bcbee92
dataService.ts:313 [LP Detection] Checking holder: 0x4d8f4bbc422e7d8510b77df45fa8f3eddcd0eba8
dataService.ts:313 [LP Detection] Checking holder: 0x962db7eb0e2b911cb42ea4abfd75c02c04a2fc94
dataService.ts:313 [LP Detection] Checking holder: 0x8efd5d0a5240637d1ae34a0f8646c366a199dd94
dataService.ts:313 [LP Detection] Checking holder: 0x2c3311bbf93300a199eb7ae6777ab24fc651e946
dataService.ts:313 [LP Detection] Checking holder: 0xfe06e0ae440bc0bb6afbbd71e4d2287b591169d3
dataService.ts:313 [LP Detection] Checking holder: 0x962db7eb0e2b911cb42ea4abfd75c02c04a2fc94
dataService.ts:313 [LP Detection] Checking holder: 0x2b7cfa28270317396848981e7caa1aaf5a9939c2
dataService.ts:313 [LP Detection] Checking holder: 0xb5ca724cf2680c24226fad2a37b71cb342373b7e
dataService.ts:313 [LP Detection] Checking holder: 0x80de4fd177a1f9c34dcce96449c75408c30fb61c
dataService.ts:313 [LP Detection] Checking holder: 0x7664c437c6629c3e41971e5d2d080c3d5eb2d875
dataService.ts:313 [LP Detection] Checking holder: 0xdf223a269ce2a5b6845a0ef4a92ecc4fdae69dd5
dataService.ts:313 [LP Detection] Checking holder: 0xfeb60aa24400f45574002007366c68762477daee
dataService.ts:313 [LP Detection] Checking holder: 0x7262c973e6b8c550e75e1c5ad87e371592d01aee
dataService.ts:313 [LP Detection] Checking holder: 0x692782fc3e405c89b9b423183993b7c72cab3470
dataService.ts:313 [LP Detection] Checking holder: 0x513786f9f620425dca3623bc3583d9fe095d1ecb
dataService.ts:313 [LP Detection] Checking holder: 0x1904d4baf16d58a8ebe99db44854e888f94763d8
dataService.ts:313 [LP Detection] Checking holder: 0x45fdab3008e8f85afa683b3dae84e73074e4b788
dataService.ts:313 [LP Detection] Checking holder: 0xa86de09c366626f1d0ffb0e7a85173e94e7bc7ed
dataService.ts:313 [LP Detection] Checking holder: 0x59fb56e2f26e4c14d17f44225402982e73075205
dataService.ts:313 [LP Detection] Checking holder: 0x33b2c1b566cce029eb17f2281012e14a4e600e40
dataService.ts:313 [LP Detection] Checking holder: 0x73bbc753765a27f71ac0fb1d1ed7aecbafb316f3
dataService.ts:313 [LP Detection] Checking holder: 0x8231f5d54870e69d26c6dc604a367a0c728262b9
dataService.ts:313 [LP Detection] Checking holder: 0xa86de09c366626f1d0ffb0e7a85173e94e7bc7ed
dataService.ts:313 [LP Detection] Checking holder: 0xa12bdcb79e7d54e21209e0380ba7354457092934
dataService.ts:313 [LP Detection] Checking holder: 0x467a896b0ce13dbec109effd15a9bbd222558d0f
dataService.ts:313 [LP Detection] Checking holder: 0xc6acee4e9cbca7603dd8b72d36a5301e1f59bf0f
dataService.ts:313 [LP Detection] Checking holder: 0x54a62bb1953573d6cfb3468aebf4c1e5320e26ad
dataService.ts:313 [LP Detection] Checking holder: 0xff138dabd420690d0f8530cd9b359ee73c0606cd
dataService.ts:313 [LP Detection] Checking holder: 0x9c2f161c306cce103b442c993f2bb43098bd0161
dataService.ts:313 [LP Detection] Checking holder: 0x1bb9847f4f76e37cd18bb916286746c9e848125f
dataService.ts:313 [LP Detection] Checking holder: 0xbb9b9b2a4ec98d27726c05f11b86dd90981f182e
dataService.ts:313 [LP Detection] Checking holder: 0x10c35f160ccf7f650199fb9b59c80f9ea6d8d005
dataService.ts:313 [LP Detection] Checking holder: 0xb5ca724cf2680c24226fad2a37b71cb342373b7e
dataService.ts:313 [LP Detection] Checking holder: 0x56563f3c49da8fda97940c99ea8c14be4ecf3f8f
dataService.ts:313 [LP Detection] Checking holder: 0x47c1468eb8ce76e50484b6bcdf2275238787d9de
dataService.ts:313 [LP Detection] Checking holder: 0xedd5e266ea99e5808f8c3c67b82b8a08c20411e9
dataService.ts:313 [LP Detection] Checking holder: 0xd4a085bf7d6eb423d9c304dfe6104d5df35b8ebc
dataService.ts:313 [LP Detection] Checking holder: 0x2544a0d4a881d5c5d7f4c212ef178b362ad6fc16
dataService.ts:313 [LP Detection] Checking holder: 0xdca31b979661e5752afd4b878f4f301b2cbefe58
dataService.ts:313 [LP Detection] Checking holder: 0x513786f9f620425dca3623bc3583d9fe095d1ecb
dataService.ts:313 [LP Detection] Checking holder: 0x70ef85807523536a2565a0e6cfb932ed975ccfe4
dataService.ts:313 [LP Detection] Checking holder: 0xd31d96be6a2414600fdba03e11f43833a362dd53
dataService.ts:313 [LP Detection] Checking holder: 0x9fe9922150ba499a0db94e53a0897a8f65bba289
dataService.ts:313 [LP Detection] Checking holder: 0xae5e6a9998b031b3898535849baedb82225233e4
dataService.ts:313 [LP Detection] Checking holder: 0xe1e3c86f94a4c28f3650947a6cd3027dca26a54f
dataService.ts:313 [LP Detection] Checking holder: 0x7c5f4dfcbe4d6a3e3dfbb5bfeb3ef9e6bf16aad7
dataService.ts:313 [LP Detection] Checking holder: 0x7262c973e6b8c550e75e1c5ad87e371592d01aee
dataService.ts:313 [LP Detection] Checking holder: 0x1bb9847f4f76e37cd18bb916286746c9e848125f
dataService.ts:313 [LP Detection] Checking holder: 0xf67206a12e8b01751b21ccb75144e052d883a63b
dataService.ts:313 [LP Detection] Checking holder: 0x2544a0d4a881d5c5d7f4c212ef178b362ad6fc16
dataService.ts:313 [LP Detection] Checking holder: 0x28bcee44db549d78951b97f759eb86572e5ebcd4
dataService.ts:313 [LP Detection] Checking holder: 0x40d0e7702b5786222bb9c2708e8af5bff7f16c26
dataService.ts:313 [LP Detection] Checking holder: 0xd2b8ea2f32effd8a1371051805fe4cf58bd56623
dataService.ts:313 [LP Detection] Checking holder: 0x61716ffa65f4f0f72e19eae45a9ff32c59615fae
dataService.ts:313 [LP Detection] Checking holder: 0xdf223a269ce2a5b6845a0ef4a92ecc4fdae69dd5
dataService.ts:313 [LP Detection] Checking holder: 0x744cf9668ae90115ed0c1bc112c6bc8f9f4fe877
dataService.ts:313 [LP Detection] Checking holder: 0xe5c99e2c4e3b45a375c13844c93440aa5d2b12bb
dataService.ts:313 [LP Detection] Checking holder: 0x10c35f160ccf7f650199fb9b59c80f9ea6d8d005
dataService.ts:313 [LP Detection] Checking holder: 0xfe06e0ae440bc0bb6afbbd71e4d2287b591169d3
dataService.ts:313 [LP Detection] Checking holder: 0x92f457c4c051feceab44a3b5241232843d5659fd
dataService.ts:313 [LP Detection] Checking holder: 0xae5e6a9998b031b3898535849baedb82225233e4
dataService.ts:313 [LP Detection] Checking holder: 0xda5faaac36345d52e65a4a8bc26dc4058415bfe5
dataService.ts:313 [LP Detection] Checking holder: 0x0608037fd563fa0d159adb934ffc9035df56fb88
dataService.ts:313 [LP Detection] Checking holder: 0xa21739fa05b019c16d324e6750c3c2f0b2f95d58
dataService.ts:313 [LP Detection] Checking holder: 0x0684e49cbc62c57ffbfd133aaff7f53d5d356944
dataService.ts:313 [LP Detection] Checking holder: 0x56563f3c49da8fda97940c99ea8c14be4ecf3f8f
dataService.ts:313 [LP Detection] Checking holder: 0x0c530a7bd7f3263f93b985f0aa9393959d6fdf46
dataService.ts:313 [LP Detection] Checking holder: 0xc961349113118b964f66feb0b8d8754699d861f1
dataService.ts:313 [LP Detection] Checking holder: 0xd2b8ea2f32effd8a1371051805fe4cf58bd56623
dataService.ts:313 [LP Detection] Checking holder: 0x5e147de08414ea91f9b5432662e4952ef729a06e
dataService.ts:313 [LP Detection] Checking holder: 0x19b3e86d70a99d24c748ecbc473818c0d50dc7ba
dataService.ts:313 [LP Detection] Checking holder: 0x6b091ec6c77ebafac15ff88f34c89a4b0b032791
dataService.ts:313 [LP Detection] Checking holder: 0xdb617a3167462c66f3950c8715a65c774403d5f4
dataService.ts:313 [LP Detection] Checking holder: 0x47c1468eb8ce76e50484b6bcdf2275238787d9de
dataService.ts:313 [LP Detection] Checking holder: 0xda5faaac36345d52e65a4a8bc26dc4058415bfe5
dataService.ts:313 [LP Detection] Checking holder: 0x7664c437c6629c3e41971e5d2d080c3d5eb2d875
dataService.ts:313 [LP Detection] Checking holder: 0xfeb60aa24400f45574002007366c68762477daee
dataService.ts:313 [LP Detection] Checking holder: 0xedd5e266ea99e5808f8c3c67b82b8a08c20411e9
dataService.ts:313 [LP Detection] Checking holder: 0xbb9b9b2a4ec98d27726c05f11b86dd90981f182e
dataService.ts:313 [LP Detection] Checking holder: 0x19b3e86d70a99d24c748ecbc473818c0d50dc7ba
dataService.ts:313 [LP Detection] Checking holder: 0x65e378b12846543d94ae82229c9f032b15c1cb06
dataService.ts:313 [LP Detection] Checking holder: 0x1eb311e6f0ba79f703f6792e86b4c752210c9c71
dataService.ts:313 [LP Detection] Checking holder: 0xe59082534743d2afdd820d71c0a481f4840b5989
dataService.ts:313 [LP Detection] Checking holder: 0xa21739fa05b019c16d324e6750c3c2f0b2f95d58
dataService.ts:313 [LP Detection] Checking holder: 0x744cf9668ae90115ed0c1bc112c6bc8f9f4fe877
dataService.ts:313 [LP Detection] Checking holder: 0x7c5f4dfcbe4d6a3e3dfbb5bfeb3ef9e6bf16aad7
dataService.ts:313 [LP Detection] Checking holder: 0x9fe9922150ba499a0db94e53a0897a8f65bba289
dataService.ts:313 [LP Detection] Checking holder: 0x33c876509194625c8c2033dbf24edd3a15e9f1e5
dataService.ts:313 [LP Detection] Checking holder: 0xaaf89059e933e16990a83f19fde4a1f0c531459b
dataService.ts:313 [LP Detection] Checking holder: 0x1187a507096932197fa6ea44b66bf8736337947c
dataService.ts:313 [LP Detection] Checking holder: 0xdb617a3167462c66f3950c8715a65c774403d5f4
dataService.ts:313 [LP Detection] Checking holder: 0xf9dafaf418ee86a110a6949a89f3168ac1dd291e
dataService.ts:313 [LP Detection] Checking holder: 0x33c876509194625c8c2033dbf24edd3a15e9f1e5
dataService.ts:313 [LP Detection] Checking holder: 0xa23d0b843a1b617776700c002c8872e032cc7533
dataService.ts:313 [LP Detection] Checking holder: 0xa12bdcb79e7d54e21209e0380ba7354457092934
dataService.ts:313 [LP Detection] Checking holder: 0x2ecb2608e07963236e184b3e109d619f5a794a11
dataService.ts:313 [LP Detection] Checking holder: 0x8231f5d54870e69d26c6dc604a367a0c728262b9
dataService.ts:313 [LP Detection] Checking holder: 0x0c530a7bd7f3263f93b985f0aa9393959d6fdf46
dataService.ts:313 [LP Detection] Checking holder: 0x1c5176eb4a36b0a452231d858f08c4b9f8cdb747
dataService.ts:313 [LP Detection] Checking holder: 0xc31c3666043ca65dfd78ce5d2bde550ec7b99ed2
dataService.ts:313 [LP Detection] Checking holder: 0xff3dae5a61f57498f98261574a19e334a55bd48a
dataService.ts:313 [LP Detection] Checking holder: 0x95e343297bf06616a43511a345294f7fac2ce7b9
dataService.ts:313 [LP Detection] Checking holder: 0x1904d4baf16d58a8ebe99db44854e888f94763d8
dataService.ts:313 [LP Detection] Checking holder: 0x22f4194f6706e70abaa14ab352d0baa6c7ced24a
dataService.ts:313 [LP Detection] Checking holder: 0xd31d96be6a2414600fdba03e11f43833a362dd53
dataService.ts:313 [LP Detection] Checking holder: 0x65e378b12846543d94ae82229c9f032b15c1cb06
dataService.ts:313 [LP Detection] Checking holder: 0x6b9f24eff9afaaa8101e18766ea74a73d425f3c0
dataService.ts:313 [LP Detection] Checking holder: 0xaaf89059e933e16990a83f19fde4a1f0c531459b
dataService.ts:313 [LP Detection] Checking holder: 0xac52f7ac7078e9d00df8042ea8e258ad53076e3b
dataService.ts:313 [LP Detection] Checking holder: 0x54a62bb1953573d6cfb3468aebf4c1e5320e26ad
dataService.ts:313 [LP Detection] Checking holder: 0x94e9c1dec01956416a710d3e72133beddeb84012
dataService.ts:313 [LP Detection] Checking holder: 0xe5c99e2c4e3b45a375c13844c93440aa5d2b12bb
dataService.ts:313 [LP Detection] Checking holder: 0x68c67f07619d7b016212411317ca23ecdefd99c9
dataService.ts:313 [LP Detection] Checking holder: 0xff138dabd420690d0f8530cd9b359ee73c0606cd
dataService.ts:313 [LP Detection] Checking holder: 0x7be8bd7226533e7c73199cd7244f92188e23323b
dataService.ts:313 [LP Detection] Checking holder: 0x2b7cfa28270317396848981e7caa1aaf5a9939c2
dataService.ts:313 [LP Detection] Checking holder: 0x692782fc3e405c89b9b423183993b7c72cab3470
dataService.ts:313 [LP Detection] Checking holder: 0xe59082534743d2afdd820d71c0a481f4840b5989
dataService.ts:313 [LP Detection] Checking holder: 0x81ab9606a43e6726e6426e38085f1c4aae5f1226
dataService.ts:313 [LP Detection] Checking holder: 0xb02a4a98405daa4199e816136ea414b2207cfda4
dataService.ts:313 [LP Detection] Checking holder: 0x92f457c4c051feceab44a3b5241232843d5659fd
dataService.ts:313 [LP Detection] Checking holder: 0x36d790301a18138b0c78c90f2a116ca11e8e7d73
dataService.ts:301 [LP Detection] Token 0xa6d7137af64280e3eb8715ab6766740984dd35e7: Found 1 LP pairs in database:
dataService.ts:306 [LP Detection]   - LP Pair: 0x1db15ee831d96663d214dabe73fd672e60aede06 (DogeSwap) [0xa6d7137af64280e3eb8715ab6766740984dd35e7 / 0xb1e3cae0d278358b37035c668cbe5bf4d3137ce0]
dataService.ts:313 [LP Detection] Checking holder: 0x8efd5d0a5240637d1ae34a0f8646c366a199dd94
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0xd4a085bf7d6eb423d9c304dfe6104d5df35b8ebc
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x1c5176eb4a36b0a452231d858f08c4b9f8cdb747
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x6b091ec6c77ebafac15ff88f34c89a4b0b032791
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0xc99586f31162e1118fd1d9a5efb4bf206bcbee92
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x4f8b27d3b52bc37ba55831e894f8f0aded48189e
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x97fef2ec997c4ed862e85d2c72416333f95496a3
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x9c2f161c306cce103b442c993f2bb43098bd0161
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x39be7870752834972269de945a1e61318d7f1dc1
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0xc6acee4e9cbca7603dd8b72d36a5301e1f59bf0f
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x94e9c1dec01956416a710d3e72133beddeb84012
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x51ef25f6bdfcde75aba7a7c8e7b0e8954df739f7
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x2e909729016eb1013a197e05210e35ce4435abc4
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x45fdab3008e8f85afa683b3dae84e73074e4b788
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x1eb311e6f0ba79f703f6792e86b4c752210c9c71
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0xf67206a12e8b01751b21ccb75144e052d883a63b
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x206710759f9c6ad87490a131ab31255b38a423eb
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x524ffc273240722273eb9bbf27873074629b63a7
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x56ce632320b8af872b9ef5b94c4a483a63f1ee26
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x2ecb2608e07963236e184b3e109d619f5a794a11
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x28bcee44db549d78951b97f759eb86572e5ebcd4
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x467a896b0ce13dbec109effd15a9bbd222558d0f
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x4f8b27d3b52bc37ba55831e894f8f0aded48189e
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x36d790301a18138b0c78c90f2a116ca11e8e7d73
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x524ffc273240722273eb9bbf27873074629b63a7
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x73bbc753765a27f71ac0fb1d1ed7aecbafb316f3
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x206710759f9c6ad87490a131ab31255b38a423eb
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x56ce632320b8af872b9ef5b94c4a483a63f1ee26
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x9ed1acdc0165222b0953aaf711f2d56da0c4b18d
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x9bad4cca2435339e7b3dcb1941fb835cc53c6bbb
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x13629314348649ed8794b6a1c4372f4c46a7fa6e
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x80de4fd177a1f9c34dcce96449c75408c30fb61c
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x81ab9606a43e6726e6426e38085f1c4aae5f1226
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x59fb56e2f26e4c14d17f44225402982e73075205
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x16e24af3a9a6ab709e8ef31f8b2ee303e51f0307
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0xa23d0b843a1b617776700c002c8872e032cc7533
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0xb02a4a98405daa4199e816136ea414b2207cfda4
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x61716ffa65f4f0f72e19eae45a9ff32c59615fae
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x40d0e7702b5786222bb9c2708e8af5bff7f16c26
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x13629314348649ed8794b6a1c4372f4c46a7fa6e
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0xc31c3666043ca65dfd78ce5d2bde550ec7b99ed2
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0xe1e3c86f94a4c28f3650947a6cd3027dca26a54f
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0xac52f7ac7078e9d00df8042ea8e258ad53076e3b
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x9ed1acdc0165222b0953aaf711f2d56da0c4b18d
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x70ef85807523536a2565a0e6cfb932ed975ccfe4
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x2c3311bbf93300a199eb7ae6777ab24fc651e946
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x4d8f4bbc422e7d8510b77df45fa8f3eddcd0eba8
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x95e343297bf06616a43511a345294f7fac2ce7b9
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0xf9dafaf418ee86a110a6949a89f3168ac1dd291e
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x9bad4cca2435339e7b3dcb1941fb835cc53c6bbb
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x1a7bb7eacf0cf1ce093c35bcc6866fa9fb60ba06
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x68c67f07619d7b016212411317ca23ecdefd99c9
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0xdca31b979661e5752afd4b878f4f301b2cbefe58
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0xc961349113118b964f66feb0b8d8754699d861f1
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x6b9f24eff9afaaa8101e18766ea74a73d425f3c0
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x1187a507096932197fa6ea44b66bf8736337947c
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x51ef25f6bdfcde75aba7a7c8e7b0e8954df739f7
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x97fef2ec997c4ed862e85d2c72416333f95496a3
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0xa9cc702eb220abef183c95b311ddfd41aee1efa7
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x22f4194f6706e70abaa14ab352d0baa6c7ced24a
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x2e909729016eb1013a197e05210e35ce4435abc4
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x0684e49cbc62c57ffbfd133aaff7f53d5d356944
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x16e24af3a9a6ab709e8ef31f8b2ee303e51f0307
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0xa9cc702eb220abef183c95b311ddfd41aee1efa7
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x5e147de08414ea91f9b5432662e4952ef729a06e
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x7be8bd7226533e7c73199cd7244f92188e23323b
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x0608037fd563fa0d159adb934ffc9035df56fb88
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x1a7bb7eacf0cf1ce093c35bcc6866fa9fb60ba06
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x73b56aa56b35a9eb062ebb0e187fe0f2603dbd25
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0xff3dae5a61f57498f98261574a19e334a55bd48a
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x73b56aa56b35a9eb062ebb0e187fe0f2603dbd25
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x39be7870752834972269de945a1e61318d7f1dc1
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x33b2c1b566cce029eb17f2281012e14a4e600e40
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0xc99586f31162e1118fd1d9a5efb4bf206bcbee92
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x4d8f4bbc422e7d8510b77df45fa8f3eddcd0eba8
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x962db7eb0e2b911cb42ea4abfd75c02c04a2fc94
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x8efd5d0a5240637d1ae34a0f8646c366a199dd94
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x2c3311bbf93300a199eb7ae6777ab24fc651e946
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0xfe06e0ae440bc0bb6afbbd71e4d2287b591169d3
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x962db7eb0e2b911cb42ea4abfd75c02c04a2fc94
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x2b7cfa28270317396848981e7caa1aaf5a9939c2
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0xb5ca724cf2680c24226fad2a37b71cb342373b7e
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x80de4fd177a1f9c34dcce96449c75408c30fb61c
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x7664c437c6629c3e41971e5d2d080c3d5eb2d875
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0xdf223a269ce2a5b6845a0ef4a92ecc4fdae69dd5
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0xfeb60aa24400f45574002007366c68762477daee
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x7262c973e6b8c550e75e1c5ad87e371592d01aee
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x692782fc3e405c89b9b423183993b7c72cab3470
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x513786f9f620425dca3623bc3583d9fe095d1ecb
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x1904d4baf16d58a8ebe99db44854e888f94763d8
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x45fdab3008e8f85afa683b3dae84e73074e4b788
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0xa86de09c366626f1d0ffb0e7a85173e94e7bc7ed
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x59fb56e2f26e4c14d17f44225402982e73075205
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x33b2c1b566cce029eb17f2281012e14a4e600e40
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x73bbc753765a27f71ac0fb1d1ed7aecbafb316f3
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x8231f5d54870e69d26c6dc604a367a0c728262b9
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0xa86de09c366626f1d0ffb0e7a85173e94e7bc7ed
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0xa12bdcb79e7d54e21209e0380ba7354457092934
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x467a896b0ce13dbec109effd15a9bbd222558d0f
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0xc6acee4e9cbca7603dd8b72d36a5301e1f59bf0f
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x54a62bb1953573d6cfb3468aebf4c1e5320e26ad
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0xff138dabd420690d0f8530cd9b359ee73c0606cd
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x9c2f161c306cce103b442c993f2bb43098bd0161
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x1bb9847f4f76e37cd18bb916286746c9e848125f
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0xbb9b9b2a4ec98d27726c05f11b86dd90981f182e
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x10c35f160ccf7f650199fb9b59c80f9ea6d8d005
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0xb5ca724cf2680c24226fad2a37b71cb342373b7e
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x56563f3c49da8fda97940c99ea8c14be4ecf3f8f
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x47c1468eb8ce76e50484b6bcdf2275238787d9de
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0xedd5e266ea99e5808f8c3c67b82b8a08c20411e9
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0xd4a085bf7d6eb423d9c304dfe6104d5df35b8ebc
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x2544a0d4a881d5c5d7f4c212ef178b362ad6fc16
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0xdca31b979661e5752afd4b878f4f301b2cbefe58
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x513786f9f620425dca3623bc3583d9fe095d1ecb
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x70ef85807523536a2565a0e6cfb932ed975ccfe4
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0xd31d96be6a2414600fdba03e11f43833a362dd53
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x9fe9922150ba499a0db94e53a0897a8f65bba289
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0xae5e6a9998b031b3898535849baedb82225233e4
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0xe1e3c86f94a4c28f3650947a6cd3027dca26a54f
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x7c5f4dfcbe4d6a3e3dfbb5bfeb3ef9e6bf16aad7
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x7262c973e6b8c550e75e1c5ad87e371592d01aee
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x1bb9847f4f76e37cd18bb916286746c9e848125f
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0xf67206a12e8b01751b21ccb75144e052d883a63b
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x2544a0d4a881d5c5d7f4c212ef178b362ad6fc16
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x28bcee44db549d78951b97f759eb86572e5ebcd4
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x40d0e7702b5786222bb9c2708e8af5bff7f16c26
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0xd2b8ea2f32effd8a1371051805fe4cf58bd56623
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x61716ffa65f4f0f72e19eae45a9ff32c59615fae
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0xdf223a269ce2a5b6845a0ef4a92ecc4fdae69dd5
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x744cf9668ae90115ed0c1bc112c6bc8f9f4fe877
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0xe5c99e2c4e3b45a375c13844c93440aa5d2b12bb
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x10c35f160ccf7f650199fb9b59c80f9ea6d8d005
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0xfe06e0ae440bc0bb6afbbd71e4d2287b591169d3
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x92f457c4c051feceab44a3b5241232843d5659fd
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0xae5e6a9998b031b3898535849baedb82225233e4
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0xda5faaac36345d52e65a4a8bc26dc4058415bfe5
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x0608037fd563fa0d159adb934ffc9035df56fb88
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0xa21739fa05b019c16d324e6750c3c2f0b2f95d58
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x0684e49cbc62c57ffbfd133aaff7f53d5d356944
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x56563f3c49da8fda97940c99ea8c14be4ecf3f8f
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x0c530a7bd7f3263f93b985f0aa9393959d6fdf46
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0xc961349113118b964f66feb0b8d8754699d861f1
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0xd2b8ea2f32effd8a1371051805fe4cf58bd56623
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x5e147de08414ea91f9b5432662e4952ef729a06e
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x19b3e86d70a99d24c748ecbc473818c0d50dc7ba
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x6b091ec6c77ebafac15ff88f34c89a4b0b032791
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0xdb617a3167462c66f3950c8715a65c774403d5f4
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x47c1468eb8ce76e50484b6bcdf2275238787d9de
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0xda5faaac36345d52e65a4a8bc26dc4058415bfe5
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x7664c437c6629c3e41971e5d2d080c3d5eb2d875
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0xfeb60aa24400f45574002007366c68762477daee
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0xedd5e266ea99e5808f8c3c67b82b8a08c20411e9
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0xbb9b9b2a4ec98d27726c05f11b86dd90981f182e
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x19b3e86d70a99d24c748ecbc473818c0d50dc7ba
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x65e378b12846543d94ae82229c9f032b15c1cb06
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x1eb311e6f0ba79f703f6792e86b4c752210c9c71
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0xe59082534743d2afdd820d71c0a481f4840b5989
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0xa21739fa05b019c16d324e6750c3c2f0b2f95d58
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x744cf9668ae90115ed0c1bc112c6bc8f9f4fe877
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x7c5f4dfcbe4d6a3e3dfbb5bfeb3ef9e6bf16aad7
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x9fe9922150ba499a0db94e53a0897a8f65bba289
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x33c876509194625c8c2033dbf24edd3a15e9f1e5
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0xaaf89059e933e16990a83f19fde4a1f0c531459b
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x1187a507096932197fa6ea44b66bf8736337947c
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0xdb617a3167462c66f3950c8715a65c774403d5f4
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0xf9dafaf418ee86a110a6949a89f3168ac1dd291e
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x33c876509194625c8c2033dbf24edd3a15e9f1e5
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0xa23d0b843a1b617776700c002c8872e032cc7533
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0xa12bdcb79e7d54e21209e0380ba7354457092934
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x2ecb2608e07963236e184b3e109d619f5a794a11
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x8231f5d54870e69d26c6dc604a367a0c728262b9
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x0c530a7bd7f3263f93b985f0aa9393959d6fdf46
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x1c5176eb4a36b0a452231d858f08c4b9f8cdb747
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0xc31c3666043ca65dfd78ce5d2bde550ec7b99ed2
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0xff3dae5a61f57498f98261574a19e334a55bd48a
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x95e343297bf06616a43511a345294f7fac2ce7b9
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x1904d4baf16d58a8ebe99db44854e888f94763d8
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x22f4194f6706e70abaa14ab352d0baa6c7ced24a
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0xd31d96be6a2414600fdba03e11f43833a362dd53
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x65e378b12846543d94ae82229c9f032b15c1cb06
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x6b9f24eff9afaaa8101e18766ea74a73d425f3c0
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0xaaf89059e933e16990a83f19fde4a1f0c531459b
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0xac52f7ac7078e9d00df8042ea8e258ad53076e3b
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x54a62bb1953573d6cfb3468aebf4c1e5320e26ad
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x94e9c1dec01956416a710d3e72133beddeb84012
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0xe5c99e2c4e3b45a375c13844c93440aa5d2b12bb
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x68c67f07619d7b016212411317ca23ecdefd99c9
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0xff138dabd420690d0f8530cd9b359ee73c0606cd
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x7be8bd7226533e7c73199cd7244f92188e23323b
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x2b7cfa28270317396848981e7caa1aaf5a9939c2
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x692782fc3e405c89b9b423183993b7c72cab3470
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0xe59082534743d2afdd820d71c0a481f4840b5989
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x81ab9606a43e6726e6426e38085f1c4aae5f1226
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0xb02a4a98405daa4199e816136ea414b2207cfda4
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x92f457c4c051feceab44a3b5241232843d5659fd
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x36d790301a18138b0c78c90f2a116ca11e8e7d73
dataService.ts:319 [LP Detection] ✗ Not an LP pair: 0x8efd5d0a5240637d1ae34a0f8646c366a199dd94
dataService.ts:565 [LP Detection] Loaded 195 LP pairs from database
dataService.ts:566 [LP Detection] Looking for pairs with token: 0xa6d7137af64280e3eb8715ab6766740984dd35e7
dataService.ts:575 [LP Detection] Found 1 LP pairs for this token
dataService.ts:578 [LP Detection] Adding 1 LP pairs to visualization for FUCKPEPE
dataService.ts:565 [LP Detection] Loaded 195 LP pairs from database
dataService.ts:566 [LP Detection] Looking for pairs with token: 0xa6d7137af64280e3eb8715ab6766740984dd35e7
dataService.ts:575 [LP Detection] Found 1 LP pairs for this token
dataService.ts:578 [LP Detection] Adding 1 LP pairs to visualization for FUCKPEPE
dataService.ts:621 [LP Detection] ✓ Added LP pair: 0x1db15ee831d96663d214dabe73fd672e60aede06 with balance 1.14 FUCKPEPE
dataService.ts:626 [LP Detection] After add/update - Total wallets: 101, This wallet label: "LP Pool (DogeSwap)", isContract: true
dataService.ts:645 [LP Detection] Before recalc - Total: 101, Labeled: 3
dataService.ts:649   Labeled: 0x000000000000000000000000000000000000dead - "Burn Address"
dataService.ts:649   Labeled: 0xa6d7137af64280e3eb8715ab6766740984dd35e7 - "Token Contract"
dataService.ts:649   Labeled: 0x1db15ee831d96663d214dabe73fd672e60aede06 - "LP Pool (DogeSwap)"
dataService.ts:662 [LP Detection] After recalc - Total: 101, Labeled: 3
dataService.ts:666   Labeled: 0x000000000000000000000000000000000000dead - "Burn Address"
dataService.ts:666   Labeled: 0xa6d7137af64280e3eb8715ab6766740984dd35e7 - "Token Contract"
dataService.ts:666   Labeled: 0x1db15ee831d96663d214dabe73fd672e60aede06 - "LP Pool (DogeSwap)"
dataService.ts:621 [LP Detection] ✓ Added LP pair: 0x1db15ee831d96663d214dabe73fd672e60aede06 with balance 1.14 FUCKPEPE
dataService.ts:626 [LP Detection] After add/update - Total wallets: 101, This wallet label: "LP Pool (DogeSwap)", isContract: true
dataService.ts:645 [LP Detection] Before recalc - Total: 101, Labeled: 3
dataService.ts:649   Labeled: 0x000000000000000000000000000000000000dead - "Burn Address"
dataService.ts:649   Labeled: 0xa6d7137af64280e3eb8715ab6766740984dd35e7 - "Token Contract"
dataService.ts:649   Labeled: 0x1db15ee831d96663d214dabe73fd672e60aede06 - "LP Pool (DogeSwap)"
dataService.ts:662 [LP Detection] After recalc - Total: 101, Labeled: 3
dataService.ts:666   Labeled: 0x000000000000000000000000000000000000dead - "Burn Address"
dataService.ts:666   Labeled: 0xa6d7137af64280e3eb8715ab6766740984dd35e7 - "Token Contract"
dataService.ts:666   Labeled: 0x1db15ee831d96663d214dabe73fd672e60aede06 - "LP Pool (DogeSwap)"
dataService.ts:726 [LP Detection] Top 100: 100, Labeled wallets: 3, Additional labeled: 1, Final: 101
dataService.ts:731 [LP Detection] Labeled wallet: 0x000000000000000000000000000000000000dead - label: "Burn Address", isContract: false, balance: 76747.71657272516
dataService.ts:731 [LP Detection] Labeled wallet: 0xa6d7137af64280e3eb8715ab6766740984dd35e7 - label: "Token Contract", isContract: false, balance: 149.2196850472868
dataService.ts:731 [LP Detection] Labeled wallet: 0x1db15ee831d96663d214dabe73fd672e60aede06 - label: "LP Pool (DogeSwap)", isContract: true, balance: 1.1445286296577404
App.tsx:886 [App.tsx] fetchTokenHolders returned 101 wallets, 3 with labels
App.tsx:891 [App.tsx] Labeled: 0x000000000000000000000000000000000000dead - "Burn Address"
App.tsx:891 [App.tsx] Labeled: 0xa6d7137af64280e3eb8715ab6766740984dd35e7 - "Token Contract"
App.tsx:891 [App.tsx] Labeled: 0x1db15ee831d96663d214dabe73fd672e60aede06 - "LP Pool (DogeSwap)"
dataService.ts:726 [LP Detection] Top 100: 100, Labeled wallets: 3, Additional labeled: 1, Final: 101
dataService.ts:731 [LP Detection] Labeled wallet: 0x000000000000000000000000000000000000dead - label: "Burn Address", isContract: false, balance: 76747.71657272516
dataService.ts:731 [LP Detection] Labeled wallet: 0xa6d7137af64280e3eb8715ab6766740984dd35e7 - label: "Token Contract", isContract: false, balance: 149.2196850472868
dataService.ts:731 [LP Detection] Labeled wallet: 0x1db15ee831d96663d214dabe73fd672e60aede06 - label: "LP Pool (DogeSwap)", isContract: true, balance: 1.1445286296577404
App.tsx:886 [App.tsx] fetchTokenHolders returned 101 wallets, 3 with labels
App.tsx:891 [App.tsx] Labeled: 0x000000000000000000000000000000000000dead - "Burn Address"
App.tsx:891 [App.tsx] Labeled: 0xa6d7137af64280e3eb8715ab6766740984dd35e7 - "Token Contract"
App.tsx:891 [App.tsx] Labeled: 0x1db15ee831d96663d214dabe73fd672e60aede06 - "LP Pool (DogeSwap)"
