const path = require('path');
const fs = require('fs');

// Configuration of materials
const materials = {
    'neurons': {
        title: 'Principles of Neuron Function',
        message: 'Principles of Neuron Function:',
//\nVideo material on this topic: [Watch Video](https://www.youtube.com/watch?v=YqHECLCoOzo&list=PL_VDgqjcR4c1llliw8L2zbilbvyfPzY23&index=2&pp=iAQB)',
        pdfFile: 'neurons.pdf'
    },
    'brain': {
        title: 'Brain Structure',
        message: 'Brain Structure:',
//\nVideo material on this topic: [Watch Video](https://www.youtube.com/watch?v=-f1mwnnuqHI&list=PL_VDgqjcR4c1llliw8L2zbilbvyfPzY23&index=3&pp=iAQB)',
        pdfFile: 'brain.pdf'
    },
    'seizures': {
        title: 'Causes of Seizures',
        message: 'Causes of Seizures:',
//\nVideo material on this topic: [Watch Video](https://www.youtube.com/watch?v=nKiI0jr-tLw&list=PL_VDgqjcR4c1llliw8L2zbilbvyfPzY23&index=4&pp=iAQB)',
        pdfFile: 'seizures.pdf'
    },
    'diagnosis': {
        title: 'Epilepsy Diagnosis Methods',
        message: 'Epilepsy Diagnosis Methods:',
//\nVideo material on this topic: [Watch Video](https://www.youtube.com/watch?v=aaNWEOvOf2E&list=PL_VDgqjcR4c1llliw8L2zbilbvyfPzY23&index=5&pp=iAQB)',
        pdfFile: 'diagnosis.pdf'
    },
    'treatment': {
        title: 'Epilepsy Treatment',
        message: 'Epilepsy Treatment:',
//\nVideo material on this topic: [Watch Video](https://www.youtube.com/watch?v=JM1WKpFpgc8&list=PL_VDgqjcR4c1llliw8L2zbilbvyfPzY23&index=6&pp=iAQB)',
        pdfFile: 'treatment.pdf'
    },
    'memo': {
        title: 'Epilepsy Memo',
        message: 'Epilepsy Memo:',
//\nVideo material on this topic: [Watch Video](https://www.youtube.com/watch?v=W-ihjVWu6qk&list=PL_VDgqjcR4c1llliw8L2zbilbvyfPzY23&index=7&pp=iAQB)',
        pdfFile: 'memo.pdf'
    },
    'ilae': {
        title: 'ILAE Website',
        message: 'Official website of the International League Against Epilepsy:\n[Go to Website](https://www.ilae.org)',
    },
    'rpel': {
        title: 'RLAE Website',
        message: 'Official website of the Russian Anti-Epileptic League:\n[Go to Website](https://rlae.ru)',
    }
};

// Main message with description
const mainMessage = "Select the topic you are interested in, and you will be able to read or watch a video on the topic. You can also visit the official website of the International League Against Epilepsy (ILAE) and the Russian Anti-Epileptic League (RLAE).";

// Create a keyboard with topics
const mainKeyboard = {
    inline_keyboard: [
        [{ text: 'Principles of Neuron Function', callback_data: 'info_neurons' }],
        [{ text: 'Brain Structure', callback_data: 'info_brain' }],
        [{ text: 'Causes of Seizures', callback_data: 'info_seizures' }],
        [{ text: 'Epilepsy Diagnosis Methods', callback_data: 'info_diagnosis' }],
        [{ text: 'Epilepsy Treatment', callback_data: 'info_treatment' }],
        [{ text: 'Epilepsy Memo', callback_data: 'info_memo' }],
        [{ text: 'ILAE Website', callback_data: 'info_ilae' }],
        [{ text: 'RLAE Website', callback_data: 'info_rpel' }],
        [{ text: 'Return to Profile', callback_data: 'back_to_profile' }]
    ]
};

// Keyboard for returning to the list of topics
const backKeyboard = {
    inline_keyboard: [
        [{ text: 'Go Back', callback_data: 'back_to_topics' }]
    ]
};

let isHandlerRegistered = false;

module.exports = async function informationEnglish(bot, chatId, messageId) {
    // Path to the public folder
    const pdfFolderPath = path.join(process.cwd(), 'public');

    // Register the handler only once
    if (!isHandlerRegistered) {
        bot.on('callback_query', async (query) => {
            const data = query.data;

            if (data === 'back_to_topics') {
                // Return to the main list of topics
                await bot.editMessageText(mainMessage, {
                    chat_id: query.message.chat.id,
                    message_id: query.message.message_id,
                    reply_markup: mainKeyboard,
                    parse_mode: 'Markdown'
                });
            }
            else if (data.startsWith('info_')) {
                const topic = data.replace('info_', '');
                const material = materials[topic];

                if (material) {
                    // Send message with topic information
                    await bot.editMessageText(material.message, {
                        chat_id: query.message.chat.id,
                        message_id: query.message.message_id,
                        reply_markup: backKeyboard,
                        parse_mode: 'Markdown'
                    });

                    // Send PDF file only if it exists in the material
                    if (material.pdfFile) {
                        try {
                            const filePath = path.join(pdfFolderPath, material.pdfFile);
                            if (fs.existsSync(filePath)) {
                                await bot.sendDocument(query.message.chat.id, filePath);
                            } else {
                                console.error(`PDF file not found: ${filePath}`);
                            }
                        } catch (error) {
                            console.error(`Error sending file ${material.pdfFile}:`, error);
                        }
                    }
                }
            }
        });

        isHandlerRegistered = true;
    }

    // Send initial message with list of topics
    await bot.editMessageText(mainMessage, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: mainKeyboard
    });
};