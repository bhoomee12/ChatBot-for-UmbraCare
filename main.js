document.addEventListener("DOMContentLoaded", function () {
    const inputField = document.querySelector("#user-input");
    const sendButton = document.querySelector("#send-btn");
    const chatBox = document.querySelector(".chat");
    const closeButton = document.querySelector(".close");
    const voiceSearchButton = document.querySelector(".voice-search");
    
    // ✅ Store Last Conversation Topic
    let lastTopic = "";

    // ✅ Initialize Speech Recognition (Once)
    let recognition;
    if ("webkitSpeechRecognition" in window) {
        recognition = new webkitSpeechRecognition();
        recognition.lang = "en-US";
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
    } else {
        console.warn("Speech recognition is not supported in this browser.");
    }

    // ✅ Function to Check for Doctor Queries
    function isDoctorQuery(userMessage) {
        return /doctor|specialist|hospital|clinic|treatment/i.test(userMessage);
    }

    // ✅ Function to Search for Doctors Online
    async function searchDoctorsOnline(userMessage) {
        const query = encodeURIComponent(userMessage);
        const searchUrl = `https://www.google.com/search?q=${query}`;
        return `
            <p>Here are some top doctors based on your query:</p>
            <ul>
                <li><a href="${searchUrl}" target="_blank">Click here to view search results</a></li>
            </ul>
        `;
    }

    // ✅ Function to Call Gemini API (Only if it's NOT a doctor query)
    async function callGeminiAPI(userMessage) {
        if (isDoctorQuery(userMessage)) {
            return searchDoctorsOnline(userMessage);
        }

        const apiKey = CONFIG.GEMINI_API_KEY; // Replace with actual API key
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

        if (userMessage.toLowerCase().includes("more info") && lastTopic) {
            userMessage = `Give me more details about ${lastTopic}`;
        } else {
            lastTopic = userMessage;
        }

        const requestBody = {
            contents: [{ parts: [{ text: userMessage }] }],
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 400,
                topK: 40
            }
        };

        try {
            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requestBody)
            });

            const data = await response.json();
            console.log("Gemini API Response:", data);

            if (data.candidates && data.candidates.length > 0) {
                return formatResponse(data.candidates[0].content.parts[0].text);
            } else {
                return "<p>Sorry, I couldn't generate a response.</p>";
            }
        } catch (error) {
            console.error("Error calling Gemini API:", error);
            return "<p>Error connecting to AI service.</p>";
        }
    }

    // ✅ Function to Format AI Response (Max 10 Bullet Points, Relevant & Crisp)
    function formatResponse(responseText) {
        const lines = responseText.split("\n").filter(line => line.trim());
        let formatted = "<ul>";
        let count = 0;

        for (let line of lines) {
            if (count >= 10) break;

            if (line.includes(":")) {
                const parts = line.split(":");
                const header = parts[0].trim();
                const body = parts.slice(1).join(":").trim();
                formatted += `<li><span class="highlight">${header}</span>: ${body}</li>`;
            } else {
                formatted += `<li>${line.trim()}</li>`;
            }

            count++;
        }

        return formatted + "</ul>";
    }

    // ✅ Typing Effect (Ensures Completion of Full Response)
    async function typeResponse(element, formattedHTML) {
        element.innerHTML = "";

        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = formattedHTML;
        const items = tempDiv.querySelectorAll("li");

        for (let i = 0; i < items.length; i++) {
            const newItem = document.createElement("li");
            newItem.innerHTML = "";
            element.appendChild(newItem);
            chatBox.scrollTop = chatBox.scrollHeight;

            const text = items[i].innerHTML;
            let words = text.split(" ");
            let tempText = "";

            for (let j = 0; j < words.length; j++) {
                tempText += words[j] + " ";
                newItem.innerHTML = tempText.trim();
                chatBox.scrollTop = chatBox.scrollHeight;

                await new Promise(resolve => setTimeout(resolve, 30));
            }
            await new Promise(resolve => setTimeout(resolve, 300));
        }
    }

    // ✅ Send User Message
    async function sendMessage() {
        const userMessage = inputField.value.trim();
        if (!userMessage) return;

        chatBox.insertAdjacentHTML("beforeend", `
            <div class="user">
                <p>${userMessage}</p>
                <div class="user-icon"></div>
            </div>
        `);
        inputField.value = "";
        chatBox.scrollTop = chatBox.scrollHeight;

        const loadingMessage = document.createElement("div");
        loadingMessage.className = "model";
        loadingMessage.innerHTML = `
            <div class="bot-icon"></div>
            <ul><li>...</li></ul>
        `;
        chatBox.appendChild(loadingMessage);
        chatBox.scrollTop = chatBox.scrollHeight;

        const botResponse = await callGeminiAPI(userMessage);

        await typeResponse(loadingMessage.querySelector("ul"), botResponse);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    // ✅ Voice Search Functionality
    function startVoiceRecognition() {
        if (!recognition) {
            alert("Your browser doesn't support speech recognition. Please use Chrome.");
            return;
        }

        recognition.onstart = function () {
            console.log("Listening...");
        };

        recognition.onresult = function (event) {
            let transcript = event.results[0][0].transcript;
            inputField.value = transcript;
            sendMessage();
        };

        recognition.onerror = function (event) {
            console.error("Speech recognition error:", event.error);
        };

        recognition.start();
    }

    // ✅ Event Listeners
    sendButton.removeEventListener("click", sendMessage);
    sendButton.addEventListener("click", sendMessage);

    inputField.addEventListener("keypress", (e) => {
        if (e.key === "Enter") sendMessage();
    });

    closeButton.addEventListener("click", () => {
        document.querySelector(".chat-window").style.display = "none";
    });

    voiceSearchButton.addEventListener("click", startVoiceRecognition);
});
