import { ArrowRight, Layers, MessageSquareText, Sparkles } from 'lucide-react';

interface WelcomeLandingViewProps {
  onGetStarted: () => void;
}

const CAPABILITY_PILLARS = [
  {
    icon: MessageSquareText,
    title: 'Multi-Dimensional Parsing',
    description:
      'Separates overall sentiment, tone, emotion, communication intent, sarcasm, negation, and dynamic aspects.',
  },
  {
    icon: Layers,
    title: 'Conversation & Batch Scale',
    description:
      'Processes chronological dialogue threads, CSV datasets, semantic similarity search, and topic clusters.',
  },
  {
    icon: Sparkles,
    title: 'Verifiable Evaluation',
    description:
      'Pairs transparent span attribution and persistent SQLite history with local TF-IDF model benchmarking.',
  },
];

export function WelcomeLandingView({ onGetStarted }: WelcomeLandingViewProps) {
  return (
    <div className="min-h-screen bg-[#070B14] text-slate-100 relative overflow-hidden flex flex-col">
      {/* Subtle Blue & Violet Atmospheric Gradients */}
      <div
        className="pointer-events-none absolute -top-40 -left-32 w-[560px] h-[560px] rounded-full bg-blue-600/12 blur-[120px]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute top-1/4 -right-40 w-[520px] h-[520px] rounded-full bg-violet-600/12 blur-[130px]"
        aria-hidden="true"
      />

      {/* Minimal Top Bar */}
      <header className="relative z-10 w-full max-w-6xl mx-auto px-6 sm:px-10 h-20 flex items-center justify-between gap-8">
        <span className="font-display text-base font-bold tracking-wider text-slate-100 whitespace-nowrap shrink-0">
          ASPECTIQ
        </span>

        <button
          type="button"
          onClick={onGetStarted}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-200 bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <span>Workspaces</span>
          <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
        </button>
      </header>

      {/* Main Hero & Neural Topology Visual */}
      <main className="relative z-10 flex-1 w-full max-w-6xl mx-auto px-6 sm:px-10 py-10 lg:py-16 flex flex-col justify-center gap-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Hero Copy */}
          <div className="lg:col-span-7 space-y-6 animate-enter">
            <p className="text-xs font-medium tracking-widest uppercase text-blue-400">
              Domain-Independent NLP Intelligence Platform
            </p>

            <div className="space-y-3">
              <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white">
                ASPECTIQ
              </h1>
              <p className="font-display text-xl sm:text-2xl font-medium bg-gradient-to-r from-blue-300 via-slate-100 to-violet-300 bg-clip-text text-transparent text-balance">
                Understand Language. Discover Meaning.
              </p>
            </div>

            <p className="text-base text-slate-300 leading-relaxed max-w-xl">
              AspectIQ is a domain-independent NLP intelligence platform built for understanding
              sentiment, emotions, pragmatic intent, dynamic aspects, conversational tone, and
              multi-turn dialogue across arbitrary natural language.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={onGetStarted}
                className="inline-flex items-center gap-2.5 px-6 py-3.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 rounded-xl shadow-lg shadow-blue-950/40 transition-all duration-150 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070B14]"
              >
                <span>Get Started</span>
                <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
              </button>

              <span className="text-xs text-slate-400">
                Six integrated NLP workspaces · No setup required
              </span>
            </div>
          </div>

          {/* Right Abstract Connected-Node Language Graph */}
          <div
            className="lg:col-span-5 animate-enter-delay-1"
            aria-hidden="true"
          >
            <div className="relative rounded-2xl border border-slate-800/80 bg-[#0D1322]/90 p-6 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-600/8 via-transparent to-violet-600/10" />
              <svg
                viewBox="0 0 420 340"
                className="relative w-full h-auto"
                fill="none"
              >
                <defs>
                  <linearGradient id="edgeBlueViolet" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.65" />
                    <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.65" />
                  </linearGradient>
                  <radialGradient id="nodeGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#60A5FA" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#60A5FA" stopOpacity="0" />
                  </radialGradient>
                </defs>

                {/* Subtle grid lines */}
                <g stroke="#1E293B" strokeWidth="0.75" opacity="0.55">
                  <line x1="20" y1="70" x2="400" y2="70" />
                  <line x1="20" y1="170" x2="400" y2="170" />
                  <line x1="20" y1="270" x2="400" y2="270" />
                  <line x1="110" y1="20" x2="110" y2="320" />
                  <line x1="210" y1="20" x2="210" y2="320" />
                  <line x1="310" y1="20" x2="310" y2="320" />
                </g>

                {/* Semantic connection edges */}
                <g stroke="url(#edgeBlueViolet)" strokeWidth="1.5">
                  <path d="M72 96 L195 72 L328 112" />
                  <path d="M72 96 L150 178 L272 192 L328 112" />
                  <path d="M195 72 L272 192" />
                  <path d="M150 178 L90 264 L214 278 L272 192" />
                  <path d="M214 278 L345 248 L328 112" />
                  <path d="M195 72 L150 178" />
                </g>

                {/* Ambient hub halo */}
                <circle cx="195" cy="170" r="95" fill="url(#nodeGlow)" />

                {/* Nodes */}
                {[
                  { x: 72, y: 96, r: 6, color: '#60A5FA', label: 'Aspect' },
                  { x: 195, y: 72, r: 7, color: '#818CF8', label: 'Sentiment' },
                  { x: 328, y: 112, r: 6, color: '#A78BFA', label: 'Intent' },
                  { x: 150, y: 178, r: 8, color: '#38BDF8', label: 'Context' },
                  { x: 272, y: 192, r: 7, color: '#8B5CF6', label: 'Emotion' },
                  { x: 90, y: 264, r: 5, color: '#60A5FA', label: 'Negation' },
                  { x: 214, y: 278, r: 6, color: '#A78BFA', label: 'Tone' },
                  { x: 345, y: 248, r: 5, color: '#3B82F6', label: 'Topics' },
                ].map((node) => (
                  <g key={node.label}>
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={node.r + 5}
                      fill="#0D1322"
                      stroke={node.color}
                      strokeOpacity="0.35"
                      strokeWidth="1"
                    />
                    <circle cx={node.x} cy={node.y} r={node.r} fill={node.color} />
                    <text
                      x={node.x}
                      y={node.y - node.r - 10}
                      textAnchor="middle"
                      fill="#CBD5E1"
                      fontSize="11"
                      fontFamily="IBM Plex Mono, monospace"
                    >
                      {node.label}
                    </text>
                  </g>
                ))}
              </svg>
            </div>
          </div>
        </div>

        {/* Restrained 3-Column Capability Strip */}
        <section
          aria-label="Platform Capabilities"
          className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-6 border-t border-slate-800/80 animate-enter-delay-2"
        >
          {CAPABILITY_PILLARS.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <div
                key={pillar.title}
                className="rounded-xl border border-slate-800/80 bg-[#0D1322]/75 p-5 space-y-2.5"
              >
                <div className="flex items-center gap-2.5 text-slate-100">
                  <Icon className="w-4 h-4 text-blue-400 shrink-0" aria-hidden="true" />
                  <h2 className="font-display text-sm font-semibold">{pillar.title}</h2>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">{pillar.description}</p>
              </div>
            );
          })}
        </section>
      </main>
    </div>
  );
}
