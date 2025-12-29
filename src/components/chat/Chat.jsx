import React, { useState, useRef, useEffect } from 'react';
import { BedrockAgentRuntimeClient, InvokeAgentCommand } from "@aws-sdk/client-bedrock-agent-runtime";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, DeleteCommand, PutCommand } from "@aws-sdk/lib-dynamodb"; // Added PutCommand
import ReactMarkdown from 'react-markdown';
import './Chat.css';
import './../explore/modal/RecipeModal.css';
import SplashTransition from '../SplashTransition';
import { useLocation, useNavigate } from 'react-router-dom';

// AWS Clients
const client = new BedrockAgentRuntimeClient({
    region: import.meta.env.VITE_AWS_REGION,
    credentials: {
        accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID,
        secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY,
    },
});

const dbClient = new DynamoDBClient({
    region: import.meta.env.VITE_AWS_REGION,
    credentials: {
        accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID,
        secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY,
    },
});
const docClient = DynamoDBDocumentClient.from(dbClient);

function Chat() {
    const location = useLocation();
    const navigate = useNavigate();
    const [sessionId] = useState(() => `session-${Math.random().toString(36).substr(2, 9)}`);
    
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [messages, setMessages] = useState([]);
    const [activeRecipeId, setActiveRecipeId] = useState(null);
    
    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const recipeContextRef = useRef(null);

    // FIX: Initialize with empty strings to keep inputs "Controlled" from the start
    const [stagingRecipe, setStagingRecipe] = useState({
        title: '',
        ingredients: '',
        instructions: '',
        recipeId: null
    });
    const [isConfirmingSave, setIsConfirmingSave] = useState(false);

    useEffect(() => {
        const loadContext = async () => {
            if (location.state?.recipeToImprove) {
                const { recipeToImprove, saveMode } = location.state;
                const name = recipeToImprove.title || "Recipe";

                if (saveMode === 'UPDATE') {
                    setActiveRecipeId(recipeToImprove.recipeId);
                }

                // Store the context locally
                recipeContextRef.current = recipeToImprove;

                setLoading(true);
                try {
                    // FIX: Explicitly pass the recipe data in this initial prompt
                    const introMessage = `The user wants to ${saveMode === 'UPDATE' ? 'edit' : 'make a copy of'} this recipe:
                    Title: ${recipeToImprove.title}
                    Ingredients: ${recipeToImprove.ingredients}
                    Instructions: ${recipeToImprove.instructions}

                    Please display this full recipe in Markdown now so the user can review it. Then ask what changes they would like to make.`;

                    const botResponse = await callAgent(introMessage);
                    setMessages([{ role: 'assistant', content: botResponse }]);
                } catch (error) {
                    console.error("Error loading recipe context:", error);
                    setMessages([{ role: 'assistant', content: `I've loaded **${name}**, but had trouble displaying it. What would you like to change?` }]);
                } finally {
                    setLoading(false);
                }
            } else {
                setMessages([{ role: 'assistant', content: 'Hello! I am your Culinary Architect. Tell me about a recipe you want to refine or save.' }]);
            }
        };

        loadContext();
    }, [location.state]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const readFileAsBytes = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(new Uint8Array(reader.result));
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    };

    const handleFileSelect = (e) => {
        if (e.target.files && e.target.files[0]) setSelectedFile(e.target.files[0]);
    };

    const callAgent = async (textToSend, file = null) => {
        const payload = {
            agentId: import.meta.env.VITE_AGENT_ID,
            agentAliasId: import.meta.env.VITE_AGENT_ALIAS_ID,
            sessionId: sessionId,
            inputText: textToSend,
        };

        if (file) {
            const fileBytes = await readFileAsBytes(file);
            payload.sessionState = {
                files: [{
                    name: file.name,
                    source: { sourceType: 'BYTE_CONTENT', byteContent: fileBytes },
                    useCase: 'CHAT'
                }]
            };
        }

        const command = new InvokeAgentCommand(payload);
        const response = await client.send(command);
        
        let fullResponse = "";
        if (response.completion) {
            for await (const chunk of response.completion) {
                if (chunk.chunk?.bytes) {
                    fullResponse += new TextDecoder().decode(chunk.chunk.bytes);
                }
            }
        }
        return fullResponse;
    };

    const sendMessage = async () => {
        if (!input.trim() && !selectedFile) return;

        const displayInput = input;
        const displayFile = selectedFile;
        
        setMessages(prev => [...prev, { 
            role: 'user', 
            content: displayFile ? `[Attached: ${displayFile.name}] ${displayInput}` : displayInput 
        }]);
        
        setInput('');
        setSelectedFile(null);
        setLoading(true);

        try {
            let agentInput = displayInput || "Please analyze the attached file.";
            
            if (recipeContextRef.current) {
                const r = recipeContextRef.current;
                agentInput = `The user is working on this recipe:
                Name: ${r.title}
                Ingredients: ${r.ingredients}
                Instructions: ${r.instructions}
                
                User's Request: ${agentInput}`;
                recipeContextRef.current = null;
            }

            const botResponse = await callAgent(agentInput, displayFile);
            setMessages(prev => [...prev, { role: 'assistant', content: botResponse }]);
        } catch (error) {
            console.error("Error:", error);
            setMessages(prev => [...prev, { role: 'error', content: "Error connecting to Agent." }]);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveCommand = async () => {
        setLoading(true);
        try {
            const botResponse = await callAgent(
                "Please prepare the final version of this recipe for the review modal. " + 
                "Use the tags TITLE:, INGREDIENTS:, and INSTRUCTIONS:. " +
                "Crucially, use vertical bars '|' to separate the recipe, the emoji, and your closing remarks. " +
                "Format exactly like this:\n" +
                "...end of instructions... | [Insert 1 Emoji Here] | [Closing remarks]"
            );
            
            // 2. Split by Pipe
            const parts = botResponse.split('|');

            // Part 0: Recipe Data
            const cleanRecipeData = parts[0];

            // Part 1: The Emoji (Middle of the sandwich)
            let rawEmoji = (parts.length > 1) ? parts[1] : null;

            const aiEmoji = rawEmoji ? rawEmoji.trim() : '🥘';

            // 3. Parse the Recipe Text (Part 0)
            const nameMatch = cleanRecipeData.match(/(?:TITLE|RECIPE_NAME):\s*(.*)/i);
            const ingMatch = cleanRecipeData.match(/(?:INGREDIENTS|RECIPE_INGREDIENTS):\s*([\s\S]*?)(?=INSTRUCTIONS|RECIPE_INSTRUCTIONS|$)/i);
            const insMatch = cleanRecipeData.match(/(?:INSTRUCTIONS|RECIPE_INSTRUCTIONS):\s*([\s\S]*)/i);

            if (nameMatch && ingMatch && insMatch) {
                setStagingRecipe({
                    title: nameMatch[1].trim(),
                    ingredients: ingMatch[1].trim(),
                    instructions: insMatch[1].trim(),
                    emoji: aiEmoji, 
                    recipeId: activeRecipeId 
                });
                setIsConfirmingSave(true);
            } else {
                console.warn("⚠️ Regex parsing failed on Part 0");
                setMessages(prev => [...prev, { role: 'assistant', content: botResponse }]);
            }
        } catch (error) {
            console.error("❌ Save Error:", error);
        } finally {
            setLoading(false);
        }
    };

    const commitSave = async (finalRecipe) => {
        try {
            const finalItem = {
                title: finalRecipe.title,
                emoji: finalRecipe.emoji || '🥘',
                ingredients: finalRecipe.ingredients,
                instructions: finalRecipe.instructions,
                recipeId: finalRecipe.recipeId || `recipe-${Date.now()}`
            };

            await docClient.send(new PutCommand({
                TableName: "CulinaryCraftBackendStack-RecipesTable058A1F33-1GRXYSW38KE1I",
                Item: finalItem
            }));

            // Replacement logic: Delete old if we have an activeRecipeId
            if (activeRecipeId && activeRecipeId !== finalItem.recipeId) {
                await docClient.send(new DeleteCommand({
                    TableName: "CulinaryCraftBackendStack-RecipesTable058A1F33-1GRXYSW38KE1I",
                    Key: { recipeId: activeRecipeId }
                }));
            }

            // Redirect to explore after successful save
            navigate('/explore');
            
        } catch (err) {
            console.error("Commit Save Error:", err);
            alert("Final save failed.");
        }
    };

    return (
        <SplashTransition>
            <div className="chat-container">
                <header className="chat-header">
                    <button onClick={() => navigate('/')} className="back-btn">← Home</button>
                    <h1>Culinary Craft</h1>
                </header>
                
                <div className="messages-area">
                    {messages.map((msg, idx) => (
                        <div key={idx} className={`message ${msg.role}`}>
                            <div className="message-bubble">
                                <ReactMarkdown>{msg.content}</ReactMarkdown>
                            </div>
                        </div>
                    ))}
                    {loading && <div className="message assistant"><div className="typing-indicator">Thinking...</div></div>}
                    <div ref={messagesEndRef} />
                </div>

                <div className="input-area">
                    <input type="file" ref={fileInputRef} onChange={handleFileSelect} style={{ display: 'none' }} accept="image/*,.pdf,.txt,.csv" />
                    <button className={`icon-button ${selectedFile ? 'active' : ''}`} onClick={() => fileInputRef.current.click()}>
                        <span className='btn-text'>Upload Recipe</span>
                        <span className="btn-icon">📎</span>
                    </button>
                    {messages.length > 0 && (
                        <button className="save-btn" onClick={handleSaveCommand} disabled={loading} style={{backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '20px', padding: '0 15px', cursor: 'pointer', height: '40px'}}>
                            Save
                        </button>
                    )}

                    <input value={input} onChange={(e) => setInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && sendMessage()} placeholder={selectedFile ? `File: ${selectedFile.name}` : "Type instructions..."} />
                    <button onClick={sendMessage} disabled={loading}>Send</button>
                </div>
            </div>

            {isConfirmingSave && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h2 style={{padding: '5px', margin: '0px', fontSize: '30px'}}>Review & Name Your Recipe</h2>
                        <input 
                            className="edit-input-title"
                            value={stagingRecipe.title || ''} // Fallback to empty string
                            onChange={(e) => setStagingRecipe({...stagingRecipe, title: e.target.value})}
                        />
                        <textarea 
                            className="edit-textarea"
                            value={stagingRecipe.ingredients || ''} // Fallback to empty string
                            onChange={(e) => setStagingRecipe({...stagingRecipe, ingredients: e.target.value})}
                        />
                        <textarea 
                            className="edit-textarea"
                            value={stagingRecipe.instructions || ''} // Fallback to empty string
                            onChange={(e) => setStagingRecipe({...stagingRecipe, instructions: e.target.value})}
                        />
                        <div style={{display: 'flex', gap: '10px', marginTop: '30px'}}>
                            <button className="save-btn" onClick={() => commitSave(stagingRecipe)}>🚀 Save & Go to Explore</button>
                            <button className="cancel-btn" onClick={() => setIsConfirmingSave(false)}>Keep Chatting</button>
                        </div>
                    </div>
                </div>
            )}
        </SplashTransition>
    );
}

export default Chat;