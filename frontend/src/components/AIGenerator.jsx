import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';

const MaterialIcon = ({ name, className = "" }) => (
  <span className={cn("material-symbols-outlined", className)}>
    {name}
  </span>
);

export default function AIGenerator() {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState(null);
  
  // AI Configuration State
  const [config, setConfig] = useState({
    geminiKey: '',
    huggingFaceKey: '',
    autoPrompt: true,
  });
  
  // Fake history for UI layout
  const [history, setHistory] = useState([
    { id: 1, prompt: "A luxurious ice cream sundae with gold flakes on a dark marble table", date: "Today, 10:42 AM", url: "https://images.unsplash.com/photo-1563805042-7684c8a9e9cb?q=80&w=400&auto=format&fit=crop" },
    { id: 2, prompt: "Pink strawberry milkshake with a huge swirl of whipped cream", date: "Yesterday, 3:15 PM", url: "https://images.unsplash.com/photo-1579954115545-a95591f28b24?q=80&w=400&auto=format&fit=crop" },
    { id: 3, prompt: "Artisan chocolate gelato scoop close up macro photography", date: "Mar 22, 11:20 AM", url: "https://images.unsplash.com/photo-1557142046-c704a3adf364?q=80&w=400&auto=format&fit=crop" },
  ]);

  const COST_PER_IMAGE = 1.15;

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    
    setIsGenerating(true);
    setGeneratedImage(null);
    
    // Simulate generation delay
    setTimeout(() => {
      const newImg = {
        id: Date.now(),
        prompt,
        date: "Just now",
        url: "https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?q=80&w=800&auto=format&fit=crop"
      };
      setGeneratedImage(newImg.url);
      setHistory([newImg, ...history]);
      setIsGenerating(false);
    }, 3500);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#fcf9f9] overflow-hidden">
      {/* Header */}
      <header className="px-8 py-6 flex items-center justify-between border-b border-gray-100 bg-white/50 backdrop-blur-xl shrink-0 z-10 sticky top-0">
        <div>
          <h1 className="text-2xl font-black text-atul-charcoal tracking-tight flex items-center gap-2">
             <MaterialIcon name="auto_awesome" className="text-atul-pink_primary text-[28px]" />
             AI Creation Studio
          </h1>
          <p className="text-sm font-bold text-gray-400 mt-1 uppercase tracking-widest">Powered by Google Gemini 3 & HuggingFace Models</p>
        </div>

        {/* Header Badges */}
        <div className="flex items-center gap-3">
           {config.autoPrompt && (
              <div className="bg-purple-50 text-purple-600 border border-purple-100 px-3 py-1.5 rounded-xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest hidden md:flex">
                 <MaterialIcon name="psychology" className="text-[14px]" />
                 Phi-3 Auto-Prompt Active
              </div>
           )}
           <div className="bg-atul-pink_soft/20 px-4 py-2 rounded-2xl flex items-center gap-3 border border-atul-pink_primary/10">
              <div className="size-8 rounded-full bg-white flex items-center justify-center shadow-sm">
                 <MaterialIcon name="account_balance_wallet" className="text-atul-pink_primary text-[18px]" />
              </div>
              <div>
                 <p className="text-[9px] uppercase font-black text-atul-pink_primary/60 tracking-widest leading-none">Generation Cost</p>
                 <div className="flex items-end gap-1 mt-0.5">
                    <span className="text-sm font-black text-atul-pink_primary">₹{COST_PER_IMAGE.toFixed(2)}</span>
                    <span className="text-[10px] font-bold text-atul-charcoal/40 mb-[1px]">/ image</span>
                 </div>
              </div>
           </div>
        </div>
      </header>

      {/* Main Layout Area */}
      <div className="flex-1 overflow-auto p-8 relative">
          <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-8">
             
             {/* Left Column: Generation Controls */}
             <div className="w-full lg:w-[480px] shrink-0 space-y-6 flex flex-col relative z-10">
                {/* Master Input Box */}
                <form onSubmit={handleGenerate} className="bg-white rounded-[2rem] p-6 shadow-xl shadow-gray-200/40 border border-[#E9EEF5]">
                   <div className="flex items-center justify-between mb-4">
                      <h2 className="text-xs font-black uppercase tracking-widest text-atul-charcoal flex items-center gap-2">
                         <div className="w-1 h-3 bg-atul-pink_primary rounded-full"></div>
                         Image Prompt
                      </h2>
                      <span className="text-[10px] font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded-md border border-gray-100 italic">
                         BE AS DESCRIPTIVE AS POSSIBLE
                      </span>
                   </div>
                   
                   <div className="relative group">
                      <div className="absolute inset-0 bg-gradient-to-r from-atul-pink_primary/[0.03] to-purple-500/[0.03] rounded-2xl opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none"></div>
                      <textarea 
                        value={prompt}
                        onChange={e => setPrompt(e.target.value)}
                        placeholder="e.g. A hyper-realistic luxury chocolate cake slice with dripping gold caramel sauce, dark moody studio lighting, 4k ultra detailed..."
                        className="w-full h-32 bg-[#fafbfc] border border-gray-200 rounded-2xl p-4 text-sm font-medium text-atul-charcoal resize-none outline-none focus:border-atul-pink_primary/40 focus:bg-white focus:ring-4 focus:ring-atul-pink_primary/5 transition-all shadow-inner"
                      />
                   </div>

                    {/* Parameters */}
                    <div className="mt-4 grid grid-cols-2 gap-3">
                       <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors cursor-pointer">
                          <label className="text-[9px] uppercase font-black tracking-widest text-gray-400 block mb-1">Image Engine</label>
                          <div className="flex items-center justify-between text-sm font-bold text-atul-charcoal">
                             {config.geminiKey ? 'Gemini Imagen 3' : 'FLUX.1-schnell'} <MaterialIcon name="expand_more" className="text-gray-400" />
                          </div>
                       </div>
                       <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors cursor-pointer flex flex-col justify-center">
                           <div className="flex items-center justify-between">
                              <label className="text-[9px] uppercase font-black tracking-widest text-gray-400">Smart Prompt</label>
                              <button 
                                 type="button"
                                 onClick={() => setConfig({...config, autoPrompt: !config.autoPrompt})}
                                 className={cn(
                                   "w-8 h-4 rounded-full transition-all relative flex items-center px-[2px] shadow-inner shrink-0",
                                   config.autoPrompt ? "bg-emerald-500" : "bg-gray-300"
                                 )}
                               >
                                  <motion.div 
                                    animate={{ x: config.autoPrompt ? 16 : 0 }}
                                    className="size-3 bg-white rounded-full shadow-sm"
                                  />
                               </button>
                           </div>
                           <p className="text-[10px] font-bold text-gray-500 mt-1">Phi-3-mini Enhancement</p>
                       </div>
                    </div>

                    {/* CTA */}
                   <div className="mt-6 pt-6 border-t border-gray-100">
                      <button 
                        type="submit"
                        disabled={isGenerating || !prompt.trim()}
                        className={cn(
                          "w-full py-4 rounded-xl flex items-center justify-center gap-2 text-sm font-black tracking-widest uppercase transition-all relative overflow-hidden group",
                          isGenerating || !prompt.trim() 
                            ? "bg-gray-100 text-gray-400 cursor-not-allowed" 
                            : "bg-atul-charcoal text-white hover:shadow-xl hover:-translate-y-0.5"
                        )}
                      >
                         {/* Sparkle background element */}
                         {(!isGenerating && prompt.trim()) && (
                            <div className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]"></div>
                         )}

                         {isGenerating ? (
                           <>
                              <MaterialIcon name="pending" className="animate-spin text-gray-500" />
                              Generating Magic...
                           </>
                         ) : (
                           <>
                              <MaterialIcon name="draw" className={prompt.trim() ? "text-atul-pink_primary" : ""} />
                              Create Imagery (₹{COST_PER_IMAGE})
                           </>
                         )}
                      </button>
                      <p className="text-center text-[10px] text-gray-400 font-bold mt-3 font-mono">
                         Estimated time: ~4s • Cost directly deducted
                      </p>
                   </div>
                </form>

                 {/* API Configuration Card */}
                 <div className="bg-white border text-left border-gray-200 rounded-[2rem] p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                       <h3 className="text-xs font-black uppercase tracking-widest text-atul-charcoal flex items-center gap-2">
                          <MaterialIcon name="vpn_key" className="text-atul-pink_primary text-[18px]" />
                          Provider Configuration
                       </h3>
                       <div className="text-[9px] font-black uppercase text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                          Secure Local Storage
                       </div>
                    </div>
                    
                    <div className="space-y-4">
                       <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5 flex justify-between">
                             <span>Google Gemini API Key</span>
                             <span className="text-purple-600 font-bold bg-purple-50 px-1 py-0 rounded leading-none flex items-center gap-1"><MaterialIcon name="star" className="text-[8px]"/> Primary</span>
                          </label>
                          <input 
                            type="password"
                            value={config.geminiKey}
                            onChange={e => setConfig({...config, geminiKey: e.target.value})}
                            placeholder="AIzaSyB........................."
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 font-mono text-sm outline-none focus:border-atul-pink_primary/40 focus:bg-white focus:ring-4 focus:ring-atul-pink_primary/5 transition-all text-gray-600 placeholder:text-gray-300"
                          />
                       </div>
                       
                       <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5 flex justify-between">
                             <span>Hugging Face Token</span>
                             <span className="text-gray-400 font-bold bg-gray-100 px-1 py-0 rounded leading-none flex items-center gap-1 border border-gray-200">Fallback</span>
                          </label>
                          <input 
                            type="password"
                            value={config.huggingFaceKey}
                            onChange={e => setConfig({...config, huggingFaceKey: e.target.value})}
                            placeholder="hf_........................."
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 font-mono text-sm outline-none focus:border-atul-pink_primary/40 focus:bg-white focus:ring-4 focus:ring-atul-pink_primary/5 transition-all text-gray-600 placeholder:text-gray-300"
                          />
                          <p className="text-[9px] text-gray-400 font-bold mt-2 leading-relaxed">Required for Phi-3 Auto-Prompting processing and free tier access.</p>
                       </div>
                    </div>
                 </div>

                 {/* Cost Tracking Internal Card */}
                 <div className="bg-gradient-to-br from-emerald-50/50 to-transparent border border-emerald-100 rounded-[2rem] p-5 relative overflow-hidden flex items-center justify-between">
                    <div>
                       <h3 className="text-[10px] font-black uppercase tracking-widest text-emerald-700/60 mb-1">Monthly Budget Tracker</h3>
                       <div className="flex items-baseline gap-1">
                          <span className="text-xl font-black text-emerald-600">₹102.35</span>
                          <span className="text-xs font-bold text-emerald-600/50 mt-1 uppercase tracking-widest">/ ₹500</span>
                       </div>
                    </div>
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm border border-emerald-100/50">
                       <MaterialIcon name="trending_up" className="text-emerald-500 text-xl" />
                    </div>
                 </div>
              </div>

             {/* Right Column: Results & History */}
             <div className="flex-1 flex flex-col gap-6">
                
                {/* Result Spotlight Area */}
                <div className="bg-white rounded-[2.5rem] p-2 shadow-xl shadow-gray-200/30 border border-[#E9EEF5] flex-1 flex flex-col min-h-[400px] relative overflow-hidden">
                   {/* Background Elements */}
                   <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-atul-pink_primary/[0.02] rounded-full blur-[80px] pointer-events-none"></div>

                   <AnimatePresence mode="wait">
                      {isGenerating ? (
                         <motion.div 
                           key="generating"
                           initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                           className="flex-1 flex flex-col items-center justify-center relative z-10 p-12 text-center"
                         >
                            <div className="relative size-24 mb-6">
                               <div className="absolute inset-0 rounded-full border-4 border-gray-100"></div>
                               <div className="absolute inset-0 rounded-full border-4 border-atul-pink_primary border-t-transparent animate-spin"></div>
                               <div className="absolute inset-0 flex items-center justify-center">
                                  <MaterialIcon name="auto_awesome" className="text-atul-pink_primary text-3xl animate-pulse" />
                               </div>
                            </div>
                            <h3 className="text-xl font-black text-atul-charcoal tracking-tight mb-2">Synthesizing Pixels</h3>
                            <p className="text-sm font-bold text-gray-400 max-w-sm">
                               Communicating with HuggingFace nodes. We are building your custom imagery right now...
                            </p>
                         </motion.div>
                      ) : generatedImage ? (
                         <motion.div 
                           key="result"
                           initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                           className="flex-1 rounded-[2rem] overflow-hidden relative group"
                         >
                            <img src={generatedImage} alt="Generated" className="w-full h-full object-cover" />
                            
                            {/* Overlay Controls */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-8">
                               <p className="text-white text-sm font-medium mb-4 line-clamp-2 leading-relaxed">"{prompt}"</p>
                               <div className="flex items-center gap-3">
                                  <button className="bg-white text-atul-charcoal px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-atul-pink_soft transition-colors flex items-center gap-2 shadow-xl">
                                     <MaterialIcon name="download" className="text-[16px]" /> Save Image
                                  </button>
                                  <button className="bg-white/20 hover:bg-white/30 text-white backdrop-blur-md px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-colors flex items-center gap-2 border border-white/10">
                                     <MaterialIcon name="add_to_drive" className="text-[16px]" /> Add to Catalog
                                  </button>
                               </div>
                            </div>
                            
                            <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-2">
                               <div className="size-1.5 bg-emerald-400 rounded-full shadow-[0_0_8px_rgba(52,211,153,0.8)]"></div>
                               <span className="text-[9px] font-black text-white uppercase tracking-widest">₹1.15 Deducted</span>
                            </div>
                         </motion.div>
                      ) : (
                         <motion.div 
                           key="idle"
                           initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                           className="flex-1 flex flex-col items-center justify-center p-12 text-center"
                         >
                            <div className="size-20 bg-gray-50 rounded-full flex items-center justify-center mb-4 border border-gray-100 shadow-inner">
                               <MaterialIcon name="image_search" className="text-gray-300 text-[32px]" />
                            </div>
                            <h3 className="text-lg font-black text-atul-charcoal/40 tracking-tight">Visualization Canvas</h3>
                            <p className="text-xs font-bold text-gray-400 max-w-xs mt-2">
                               Describe a highly detailed product in the prompt box and click Create to see the magic here.
                            </p>
                         </motion.div>
                      )}
                   </AnimatePresence>
                </div>

                {/* History Gallery Mini */}
                <div>
                   <h3 className="text-xs font-black uppercase tracking-widest text-atul-charcoal flex items-center gap-2 mb-4 px-1">
                      <MaterialIcon name="history" className="text-[16px]" />
                      Recent Activity
                   </h3>
                   <div className="grid grid-cols-3 gap-3">
                      {history.slice(0, 3).map((item) => (
                         <div key={item.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden group cursor-pointer hover:border-atul-pink_primary/30 hover:shadow-md transition-all">
                            <div className="aspect-square relative overflow-hidden bg-gray-100">
                               <img src={item.url} alt="History thumbnail" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                               <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <MaterialIcon name="visibility" className="text-white backdrop-blur-sm bg-white/20 size-8 rounded-full flex items-center justify-center shadow-lg" />
                               </div>
                            </div>
                            <div className="p-3">
                               <p className="text-[10px] font-extrabold text-atul-charcoal truncate mb-0.5">{item.prompt}</p>
                               <div className="flex items-center justify-between">
                                  <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">{item.date}</span>
                                  <span className="text-[8px] font-black text-atul-pink_primary bg-atul-pink_soft/20 px-1.5 py-0.5 rounded-[4px]">₹{COST_PER_IMAGE}</span>
                               </div>
                            </div>
                         </div>
                      ))}
                   </div>
                </div>

             </div>

          </div>
      </div>
    </div>
  );
}
