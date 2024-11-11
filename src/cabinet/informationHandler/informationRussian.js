const path = require('path');
const fs = require('fs');

// Конфигурация материалов
const materials = {
    'neurons': {
        title: 'Принципы работы нейронов',
        message: 'Принципы работы нейронов:\nВидеоматериал по данной теме: [Смотреть видео](https://www.youtube.com/watch?v=YqHECLCoOzo&list=PL_VDgqjcR4c1llliw8L2zbilbvyfPzY23&index=2&pp=iAQB)',
        pdfFile: 'neurons.pdf'
    },
    'brain': {
        title: 'Строение головного мозга',
        message: 'Строение головного мозга:\nВидеоматериал по данной теме: [Смотреть видео](https://www.youtube.com/watch?v=-f1mwnnuqHI&list=PL_VDgqjcR4c1llliw8L2zbilbvyfPzY23&index=3&pp=iAQB)',
        pdfFile: 'brain.pdf'
    },
    'seizures': {
        title: 'Причины развития приступов',
        message: 'Причины развития приступов:\nВидеоматериал по данной теме: [Смотреть видео](https://www.youtube.com/watch?v=nKiI0jr-tLw&list=PL_VDgqjcR4c1llliw8L2zbilbvyfPzY23&index=4&pp=iAQB)',
        pdfFile: 'seizures.pdf'
    },
    'diagnosis': {
        title: 'Методы диагностики эпилепсии',
        message: 'Методы диагностики эпилепсии:\nВидеоматериал по данной теме: [Смотреть видео](https://www.youtube.com/watch?v=aaNWEOvOf2E&list=PL_VDgqjcR4c1llliw8L2zbilbvyfPzY23&index=5&pp=iAQB)',
        pdfFile: 'diagnosis.pdf'
    },
    'treatment': {
        title: 'Лечение эпилепсии',
        message: 'Лечение эпилепсии:\nВидеоматериал по данной теме: [Смотреть видео](https://www.youtube.com/watch?v=JM1WKpFpgc8&list=PL_VDgqjcR4c1llliw8L2zbilbvyfPzY23&index=6&pp=iAQB)',
        pdfFile: 'treatment.pdf'
    },
    'memo': {
        title: 'Памятка для людей с эпилепсией',
        message: 'Памятка для людей с эпилепсией:\nВидеоматериал по данной теме: [Смотреть видео](https://www.youtube.com/watch?v=W-ihjVWu6qk&list=PL_VDgqjcR4c1llliw8L2zbilbvyfPzY23&index=7&pp=iAQB)',
        pdfFile: 'memo.pdf'
    },
    'ilae': {
        title: 'Сайт ILAE',
        message: 'Официальный сайт Международной Лиги по борьбе с эпилепсией:\n[Перейти на сайт](https://www.ilae.org)',
    },
    'rpel': {
        title: 'Сайт РПЭЛ',
        message: 'Официальный сайт Российской противоэпилептической лиги:\n[Перейти на сайт](https://rlae.ru)',
    }
};

// Основное сообщение с описанием
const mainMessage = "Выберете тему, которая вам интересна и вы сможете прочитать или посмотреть видео на интересующую вас тему. Так же вы можете посетить официальный сайт международной лиги по борьбе с эпилепсией (ILAE) и Российской противоэпилептической лиги (РПЭЛ)";

// Создаем клавиатуру с темами
const mainKeyboard = {
    inline_keyboard: [
        [{ text: 'Принципы работы нейронов', callback_data: 'info_ru_neurons' }],
        [{ text: 'Строение головного мозга', callback_data: 'info_ru_brain' }],
        [{ text: 'Причины развития приступов', callback_data: 'info_ru_seizures' }],
        [{ text: 'Методы диагностики эпилепсии', callback_data: 'info_ru_diagnosis' }],
        [{ text: 'Лечение эпилепсии', callback_data: 'info_ru_treatment' }],
        [{ text: 'Памятка для людей с эпилепсией', callback_data: 'info_ru_memo' }],
        [{ text: 'Сайт ILAE', callback_data: 'info_ru_ilae' }],
        [{ text: 'Сайт РПЭЛ', callback_data: 'info_ru_rpel' }],
        [{ text: 'Вернуться в профиль', callback_data: 'back_to_profile' }]
    ]
};

const backKeyboard = {
    inline_keyboard: [
        [{ text: 'Вернуться назад', callback_data: 'back_to_topics_ru' }]
    ]
};

// Store bot instance
let botInstance = null;
let isHandlerRegistered = false;

// Main function to initialize the Russian information handler
module.exports = async function informationRussian(bot, chatId, messageId) {
    // Store bot instance for use in callback handler
    botInstance = bot;

    // Register callback handler only once
    if (!isHandlerRegistered) {
        // Remove previous handlers
        bot.removeListener('callback_query', handleRussianCallbacks);

        // Register new handler with bound bot instance
        bot.on('callback_query', (query) => handleRussianCallbacks(query, bot));

        isHandlerRegistered = true;
    }

    // Send initial message with topic list
    await bot.editMessageText(mainMessage, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: mainKeyboard
    });
};

// Callback handler with bot instance parameter
async function handleRussianCallbacks(query, bot) {
    const data = query.data;

    // Check if this is a Russian language callback
    if (!data.includes('_ru_') && !data.includes('back_to_topics_ru')) {
        return; // Ignore callbacks for other languages
    }

    try {
        if (data === 'back_to_topics_ru') {
            // Return to main topic list
            await bot.editMessageText(mainMessage, {
                chat_id: query.message.chat.id,
                message_id: query.message.message_id,
                reply_markup: mainKeyboard,
                parse_mode: 'Markdown'
            });
        }
        else if (data.startsWith('info_ru_')) {
            const topic = data.replace('info_ru_', '');
            const material = materials[topic];

            if (material) {
                // Send topic information message
                await bot.editMessageText(material.message, {
                    chat_id: query.message.chat.id,
                    message_id: query.message.message_id,
                    reply_markup: backKeyboard,
                    parse_mode: 'Markdown'
                });

                // Send PDF file if available
                if (material.pdfFile) {
                    try {
                        const filePath = path.join(process.cwd(), 'public', material.pdfFile);
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
    } catch (error) {
        console.error('Error handling callback:', error);
    }
}