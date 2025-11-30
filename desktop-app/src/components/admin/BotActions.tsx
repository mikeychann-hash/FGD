// desktop-app/src/components/admin/BotActions.tsx

import React, { useState } from "react";
import { api } from "../../lib/api";
import { useToast } from "@/hooks/use-toast";

interface BotActionsProps {
    botId: string;
}

export const BotActions: React.FC<BotActionsProps> = ({ botId }) => {
    const { toast } = useToast();
    const [block, setBlock] = useState<string>("stone");
    const [count, setCount] = useState<number>(1);
    const [recipe, setRecipe] = useState<string>("planks");
    const [targetId, setTargetId] = useState<string>("");
    const [radius, setRadius] = useState<number>(20);

    const handleMine = async () => {
        try {
            await api.mineBot(botId, block, count);
            toast({ title: "Success", description: `Mining ${count} ${block}` });
        } catch (e) {
            toast({ variant: "destructive", title: "Error", description: `Mine failed: ${(e as Error).message}` });
        }
    };

    const handleCraft = async () => {
        try {
            await api.craftBot(botId, recipe, count);
            toast({ title: "Success", description: `Crafted ${count} ${recipe}` });
        } catch (e) {
            toast({ variant: "destructive", title: "Error", description: `Craft failed: ${(e as Error).message}` });
        }
    };

    const handleAttack = async () => {
        try {
            await api.combatBot(botId, "attack", { targetId });
            toast({ title: "Success", description: `Attacking ${targetId}` });
        } catch (e) {
            toast({ variant: "destructive", title: "Error", description: `Attack failed: ${(e as Error).message}` });
        }
    };

    const handleExplore = async () => {
        try {
            await api.executeCommand(`explore ${botId} ${radius}`);
            toast({ title: "Success", description: `Exploring radius ${radius}` });
        } catch (e) {
            toast({ variant: "destructive", title: "Error", description: `Explore failed: ${(e as Error).message}` });
        }
    };

    const handleBuild = async () => {
        try {
            // For simplicity, send a static blueprint; in a real UI this would be editable.
            await api.executeCommand(`build ${botId}`);
            toast({ title: "Success", description: `Build command sent` });
        } catch (e) {
            toast({ variant: "destructive", title: "Error", description: `Build failed: ${(e as Error).message}` });
        }
    };

    return (
        <div className="p-4 bg-gray-100 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold mb-2">High‑Level Bot Actions</h3>
            <div className="grid grid-cols-2 gap-4">
                {/* Mine */}
                <div>
                    <label className="block text-sm font-medium">Block</label>
                    <input
                        type="text"
                        value={block}
                        onChange={(e) => setBlock(e.target.value)}
                        className="mt-1 block w-full border rounded p-1"
                    />
                    <label className="block text-sm font-medium mt-2">Count</label>
                    <input
                        type="number"
                        min={1}
                        value={count}
                        onChange={(e) => setCount(parseInt(e.target.value) || 1)}
                        className="mt-1 block w-full border rounded p-1"
                    />
                    <button
                        onClick={handleMine}
                        className="mt-2 w-full bg-blue-600 text-white py-1 rounded"
                    >
                        Mine
                    </button>
                </div>
                {/* Craft */}
                <div>
                    <label className="block text-sm font-medium">Recipe</label>
                    <input
                        type="text"
                        value={recipe}
                        onChange={(e) => setRecipe(e.target.value)}
                        className="mt-1 block w-full border rounded p-1"
                    />
                    <label className="block text-sm font-medium mt-2">Count</label>
                    <input
                        type="number"
                        min={1}
                        value={count}
                        onChange={(e) => setCount(parseInt(e.target.value) || 1)}
                        className="mt-1 block w-full border rounded p-1"
                    />
                    <button
                        onClick={handleCraft}
                        className="mt-2 w-full bg-green-600 text-white py-1 rounded"
                    >
                        Craft
                    </button>
                </div>
                {/* Attack */}
                <div>
                    <label className="block text-sm font-medium">Target Entity ID</label>
                    <input
                        type="text"
                        value={targetId}
                        onChange={(e) => setTargetId(e.target.value)}
                        className="mt-1 block w-full border rounded p-1"
                    />
                    <button
                        onClick={handleAttack}
                        className="mt-2 w-full bg-red-600 text-white py-1 rounded"
                    >
                        Attack
                    </button>
                </div>
                {/* Explore */}
                <div>
                    <label className="block text-sm font-medium">Radius</label>
                    <input
                        type="number"
                        min={5}
                        value={radius}
                        onChange={(e) => setRadius(parseInt(e.target.value) || 20)}
                        className="mt-1 block w-full border rounded p-1"
                    />
                    <button
                        onClick={handleExplore}
                        className="mt-2 w-full bg-purple-600 text-white py-1 rounded"
                    >
                        Explore
                    </button>
                </div>
                {/* Build (placeholder) */}
                <div className="col-span-2">
                    <button
                        onClick={handleBuild}
                        className="w-full bg-indigo-600 text-white py-1 rounded"
                    >
                        Build (custom blueprint)
                    </button>
                </div>
            </div>
        </div>
    );
};
