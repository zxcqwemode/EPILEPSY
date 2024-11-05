const db = require('../../config/db');

let seizureStartTimesRussian = new Map();
let awaitingDescriptionRussian = new Set();
let awaitingTriggerRussian = new Set();

module.exports = async function seizureRussian(bot, chatId, messageId) {
    const message = "Нажмите \"Старт\", если у вас начался приступ";
    const options = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: 'Старт', callback_data: 'start_seizure_russian' },
                    { text: 'Назад в профиль', callback_data: 'back_to_profile' }
                ]
            ]
        }
    };

    await bot.editMessageText(message, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: options.reply_markup
    });
};

function setupCallbackHandlerRussian(bot) {
    // Обработчик текстовых сообщений
    bot.on('message', async (msg) => {
        const chatId = msg.chat.id;

        if (awaitingDescriptionRussian.has(chatId)) {
            await handleSeizureDescriptionRussian(bot, chatId, msg.text);
            awaitingDescriptionRussian.delete(chatId);
            return;
        }

        if (awaitingTriggerRussian.has(chatId)) {
            await handleTriggerDescriptionRussian(bot, chatId, msg.text);
            awaitingTriggerRussian.delete(chatId);
            return;
        }
    });

    // Обработчик кнопок
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const messageId = query.message.message_id;

        switch (query.data) {
            case 'start_seizure_russian':
                await handleStartSeizureRussian(bot, chatId, messageId);
                break;
            case 'stop_seizure_russian':
                await handleStopSeizureRussian(bot, chatId, messageId);
                break;
            case 'yes_questions_russian':
                await startQuestionsFlowRussian(bot, chatId, messageId);
                break;
            case 'no_questions_russian':
                await handleNoQuestionsRussian(bot, chatId, messageId);
                break;
            case 'repeated_yes_russian':
                await showRepeatedSeizuresButtonsRussian(bot, chatId, messageId);
                break;
            case 'repeated_no_russian':
                await handleRepeatedSeizuresRussian(bot, chatId, messageId, 'No');
                break;
            case 'repeated_1_russian':
            case 'repeated_2_russian':
            case 'repeated_3_russian':
            case 'repeated_4_russian':
            case 'repeated_5_russian':
            case 'repeated_6plus_russian':
                const count = query.data.replace('repeated_', '').replace('_russian', '');
                await handleRepeatedSeizuresRussian(bot, chatId, messageId, count);
                break;
            case 'back_to_profile_russian':
                // Здесь должна быть функция возврата в профиль
                break;
        }

        try {
            await bot.answerCallbackQuery(query.id);
        } catch (error) {
            console.error('Error answering callback query:', error);
        }
    });
}

async function startQuestionsFlowRussian(bot, chatId, messageId) {
    const message = "Опишите, как выглядел приступ (например, судороги, потеря сознания, некоординированные движения, галлюцинации и т. д.):";

    await bot.editMessageText(message, {
        chat_id: chatId,
        message_id: messageId
    });

    awaitingDescriptionRussian.add(chatId);
}

async function handleSeizureDescriptionRussian(bot, chatId, description) {
    const currentDate = new Date().toISOString().split('T')[0];

    try {
        await db.query(
            'UPDATE calendar SET seizure_description = $1 WHERE user_id = $2 AND date = $3',
            [description, chatId, currentDate]
        );

        const message = "Были ли провакаторы приступа? (Пропуск приема препарата, яркий свет, недостаток сна, алкоголь, стресс или свой вариант):";
        await bot.sendMessage(chatId, message);

        awaitingTriggerRussian.add(chatId);
    } catch (error) {
        console.error('Error saving seizure description:', error);
    }
}

async function handleTriggerDescriptionRussian(bot, chatId, trigger) {
    const currentDate = new Date().toISOString().split('T')[0];

    try {
        await db.query(
            'UPDATE calendar SET trigger = $1 WHERE user_id = $2 AND date = $3',
            [trigger, chatId, currentDate]
        );

        const message = "Были ли повторные приступы в течение одного дня?";
        const options = {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: 'Да', callback_data: 'repeated_yes_russian' },
                        { text: 'Нет', callback_data: 'repeated_no_russian' }
                    ]
                ]
            }
        };

        await bot.sendMessage(chatId, message, options);
    } catch (error) {
        console.error('Error saving trigger:', error);
    }
}

async function showRepeatedSeizuresButtonsRussian(bot, chatId, messageId) {
    const message = "Сколько было повторных приступов?";
    const options = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '1', callback_data: 'repeated_1_russian' },
                    { text: '2', callback_data: 'repeated_2_russian' },
                    { text: '3', callback_data: 'repeated_3_russian' }
                ],
                [
                    { text: '4', callback_data: 'repeated_4_russian' },
                    { text: '5', callback_data: 'repeated_5_russian' },
                    { text: '6+', callback_data: 'repeated_6plus_russian' }
                ]
            ]
        }
    };

    await bot.editMessageText(message, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: options.reply_markup
    });
}

async function handleRepeatedSeizuresRussian(bot, chatId, messageId, count) {
    const currentDate = new Date().toISOString().split('T')[0];

    try {
        await db.query(
            'UPDATE calendar SET repeated_seizures = $1 WHERE user_id = $2 AND date = $3',
            [count, chatId, currentDate]
        );

        const message = "Спасибо за ваши ответы";
        const options = {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: 'Вернуться в профиль', callback_data: 'back_to_profile' }
                    ]
                ]
            }
        };

        await bot.editMessageText(message, {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: options.reply_markup
        });
    } catch (error) {
        console.error('Error saving repeated seizures:', error);
    }
}

async function handleNoQuestionsRussian(bot, chatId, messageId) {
    const message = "Спасибо за ответ";
    const options = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: 'Вернуться в профиль', callback_data: 'back_to_profile' }
                ]
            ]
        }
    };

    await bot.editMessageText(message, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: options.reply_markup
    });
}

async function handleStartSeizureRussian(bot, chatId, messageId) {
    seizureStartTimesRussian.set(chatId, new Date());

    const message = "Когда приступ закончится, нажмите кнопку";
    const options = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: 'Стоп', callback_data: 'stop_seizure_russian' }
                ]
            ]
        }
    };

    await bot.editMessageText(message, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: options.reply_markup
    });
}

async function handleStopSeizureRussian(bot, chatId, messageId) {
    const startTime = seizureStartTimesRussian.get(chatId);
    if (startTime) {
        const duration = new Date() - startTime;
        const durationMinutes = Math.ceil(duration / 60000);
        const currentDate = new Date().toISOString().split('T')[0];

        try {
            await db.query(
                'INSERT INTO calendar (user_id, date, had_seizure, seizure_duration) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, date) DO UPDATE SET had_seizure = $3, seizure_duration = $4',
                [chatId, currentDate, true, durationMinutes]
            );
        } catch (error) {
            console.error('Error saving seizure data:', error);
        }

        const message = `Ваш приступ длился: ${durationMinutes} мин. Могу ли я задать пару вопросов?`;
        const options = {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: 'Да', callback_data: 'yes_questions_russian' },
                        { text: 'Нет', callback_data: 'no_questions_russian' }
                    ]
                ]
            }
        };

        await bot.editMessageText(message, {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: options.reply_markup
        });

        seizureStartTimesRussian.delete(chatId);
    }
}

module.exports.setupCallbackHandler = setupCallbackHandlerRussian;