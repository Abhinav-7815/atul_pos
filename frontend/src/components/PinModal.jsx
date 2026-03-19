import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Delete } from 'lucide-react';

export default function PinModal({ isOpen, onClose, onConfirm, title = "Enter PIN" }) {
    const [pin, setPin] = useState("");
    const [error, setError] = useState("");

    const handleNumberClick = (n) => {
        if (pin.length < 4) {
            setPin(prev => prev + n);
            setError("");
        }
    };

    const handleDelete = () => {
        setPin(prev => prev.slice(0, -1));
    };

    const handleConfirm = async () => {
        if (pin.length === 4) {
            const success = await onConfirm(pin);
            if (!success) {
                setError("Invalid PIN");
                setPin("");
            }
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[200] flex items-center justify-center bg-atul-charcoal/60 backdrop-blur-md p-6"
            >
                <motion.div 
                    initial={{ scale: 0.9, y: 20 }} 
                    animate={{ scale: 1, y: 0 }} 
                    exit={{ scale: 0.9, y: 20 }}
                    className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm overflow-hidden border border-white/20 p-8 flex flex-col items-center"
                >
                    <div className="w-full flex justify-between items-center mb-8">
                        <div className="size-10 bg-atul-pink_soft/30 rounded-2xl flex items-center justify-center text-atul-pink_primary">
                            <span className="material-symbols-rounded text-xl">lock_open</span>
                        </div>
                        <h2 className="text-xl font-extrabold text-atul-charcoal tracking-tight">{title}</h2>
                        <button onClick={onClose} className="size-10 bg-gray-50 rounded-2xl flex items-center justify-center text-atul-gray hover:text-atul-charcoal hover:bg-gray-100 transition-all">
                            <X size={20}/>
                        </button>
                    </div>

                    {/* PIN Display */}
                    <div className="flex gap-4 mb-8">
                        {[0,1,2,3].map(i => (
                            <div key={i} className={`size-4 rounded-full border-2 transition-all duration-300 \${pin.length > i ? 'bg-atul-pink_primary border-atul-pink_primary scale-125 shadow-lg shadow-atul-pink_primary/40' : 'border-gray-200'}`} />
                        ))}
                    </div>

                    {error && <p className="text-red-500 text-xs font-bold mb-6 animate-bounce">{error}</p>}

                    {/* Number Pad */}
                    <div className="grid grid-cols-3 gap-4 mb-8">
                        {[1,2,3,4,5,6,7,8,9].map(n => (
                            <button 
                                key={n} 
                                onClick={() => handleNumberClick(n.toString())}
                                className="size-16 rounded-2xl bg-gray-50 text-xl font-black text-atul-charcoal hover:bg-atul-pink_primary hover:text-white hover:shadow-xl hover:shadow-atul-pink_primary/40 transition-all active:scale-90"
                            >
                                {n}
                            </button>
                        ))}
                        <button className="size-16 rounded-2xl flex items-center justify-center text-atul-gray/30">
                           <span className="material-symbols-rounded">fingerprint</span>
                        </button>
                        <button 
                            onClick={() => handleNumberClick("0")}
                            className="size-16 rounded-2xl bg-gray-50 text-xl font-black text-atul-charcoal hover:bg-atul-pink_primary hover:text-white transition-all active:scale-90"
                        >
                            0
                        </button>
                        <button 
                            onClick={handleDelete}
                            className="size-16 rounded-2xl bg-gray-50 text- Atul-gray hover:text-red-500 hover:bg-red-50 transition-all active:scale-90 flex items-center justify-center"
                        >
                            <Delete size={24}/>
                        </button>
                    </div>

                    <button 
                        disabled={pin.length !== 4}
                        onClick={handleConfirm}
                        className="w-full bg-atul-charcoal text-white py-5 rounded-[1.5rem] font-extrabold text-sm tracking-[0.2em] uppercase shadow-xl hover:bg-black transition-all active:scale-95 disabled:opacity-30 disabled:grayscale"
                    >
                        Switch Now
                    </button>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
