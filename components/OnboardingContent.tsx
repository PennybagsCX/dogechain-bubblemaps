/**
 * Onboarding content configuration
 * Defines all steps, content, and metadata for the onboarding flow
 */

import React from "react";
import { Sparkles, Layers, Share2, AlertTriangle, Coins, ShieldCheck } from "lucide-react";

/**
 * View states that can be highlighted during onboarding
 */
export type ViewState = "HOME" | "ANALYSIS" | "DASHBOARD" | null;

/**
 * Interface for a single onboarding step
 */
export interface OnboardingStep {
  id: string;
  title: string;
  icon: React.ReactNode;
  content: string;
  featureHighlight: ViewState | null;
  primaryAction: string;
  secondaryAction: string | null;
}

/**
 * Interface for complete onboarding content configuration
 */
export interface OnboardingContent {
  steps: OnboardingStep[];
  totalSteps: number;
}

/**
 * Complete onboarding flow content
 */
export const onboardingContent: OnboardingContent = {
  totalSteps: 6,
  steps: [
    {
      id: "welcome",
      title: "Welcome to Dogechain BubbleMaps",
      icon: <Sparkles size={48} className="text-purple-500" />,
      content:
        "Discover the hidden patterns of Dogechain's token ecosystem. Our advanced visualization tools reveal whale movements, wallet connections, and distribution insights invisible to most users.",
      featureHighlight: null,
      primaryAction: "Get Started",
      secondaryAction: "Skip Tour",
    },
    {
      id: "visualization",
      title: "Visualize Token Distributions",
      icon: <Layers size={48} className="text-blue-400" />,
      content:
        "See distribution patterns invisible to most users. Our interactive bubble maps show holder concentration, whale clusters, and token flow patterns in real-time.",
      featureHighlight: "ANALYSIS",
      primaryAction: "Next",
      secondaryAction: "Skip",
    },
    {
      id: "export",
      title: "Export & Share Your Analysis",
      icon: <Share2 size={48} className="text-green-400" />,
      content:
        "Save your findings and share them with your team. Export analysis data as CSV or generate shareable links for collaborative research and portfolio tracking.",
      featureHighlight: "ANALYSIS",
      primaryAction: "Next",
      secondaryAction: "Skip",
    },
    {
      id: "alerts",
      title: "Smart Whale Alerts",
      icon: <AlertTriangle size={48} className="text-amber-400" />,
      content:
        "Track whale movements and monitor wallets 24/7. Get instant notifications when large holders make moves or when specific wallets show activity.",
      featureHighlight: "DASHBOARD",
      primaryAction: "Next",
      secondaryAction: "Skip",
    },
    {
      id: "trending",
      title: "Trending Asset Discovery",
      icon: <Coins size={48} className="text-doge-500" />,
      content:
        "Find new opportunities through trending analysis. See what tokens and NFTs are gaining traction based on real-time search volume and community interest.",
      featureHighlight: "HOME",
      primaryAction: "Next",
      secondaryAction: "Skip",
    },
    {
      id: "getting-started",
      title: "You're Ready to Explore!",
      icon: <ShieldCheck size={48} className="text-purple-400" />,
      content:
        "Start by searching for a token address or wallet in the search bar above. Explore trending assets, set up alerts, and dive deep into on-chain data.\n\nAccess this guide anytime from the footer.",
      featureHighlight: null,
      primaryAction: "Start Exploring",
      secondaryAction: null,
    },
  ],
};
