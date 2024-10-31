const db = require('../../config/db');

let seizureStartTimesEnglish = new Map();
let awaitingDescriptionEnglish = new Set();
let awaitingTriggerEnglish = new Set();

module.exports = async function seizureEnglish(bot, chatId, messageId) {
    const message = "Press \"Start\" if you are having a seizure";
    const options = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: 'Start', callback_data: 'start_seizure_english' }
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

function setupCallbackHandlerEnglish(bot) {
    // Text message handler
    bot.on('message', async (msg) => {
        const chatId = msg.chat.id;

        if (awaitingDescriptionEnglish.has(chatId)) {
            await handleSeizureDescriptionEnglish(bot, chatId, msg.text);
            awaitingDescriptionEnglish.delete(chatId);
            return;
        }

        if (awaitingTriggerEnglish.has(chatId)) {
            await handleTriggerDescriptionEnglish(bot, chatId, msg.text);
            awaitingTriggerEnglish.delete(chatId);
            return;
        }
    });

    // Button handler
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const messageId = query.message.message_id;

        switch (query.data) {
            case 'start_seizure_english':
                await handleStartSeizureEnglish(bot, chatId, messageId);
                break;
            case 'stop_seizure_english':
                await handleStopSeizureEnglish(bot, chatId, messageId);
                break;
            case 'yes_questions_english':
                await startQuestionsFlowEnglish(bot, chatId, messageId);
                break;
            case 'no_questions_english':
                await handleNoQuestionsEnglish(bot, chatId, messageId);
                break;
            case 'repeated_yes':
                await showRepeatedSeizuresButtonsEnglish(bot, chatId, messageId);
                break;
            case 'repeated_no':
                await handleRepeatedSeizuresEnglish(bot, chatId, messageId, 'No');
                break;
            case 'repeated_1':
            case 'repeated_2':
            case 'repeated_3':
            case 'repeated_4':
            case 'repeated_5':
            case 'repeated_6plus':
                const count = query.data.replace('repeated_', '');
                await handleRepeatedSeizuresEnglish(bot, chatId, messageId, count);
                break;
            case 'back_to_profile':
                // Function to return to profile should be here
                break;
        }

        try {
            await bot.answerCallbackQuery(query.id);
        } catch (error) {
            console.error('Error answering callback query:', error);
        }
    });
}

async function startQuestionsFlowEnglish(bot, chatId, messageId) {
    const message = "Please describe how the seizure manifested (e.g., convulsions, loss of consciousness, uncoordinated movements, hallucinations, etc.):";

    await bot.editMessageText(message, {
        chat_id: chatId,
        message_id: messageId
    });

    awaitingDescriptionEnglish.add(chatId);
}

async function handleSeizureDescriptionEnglish(bot, chatId, description) {
    const currentDate = new Date().toISOString().split('T')[0];

    try {
        await db.query(
            'UPDATE calendar SET seizure_description = $1 WHERE user_id = $2 AND date = $3',
            [description, chatId, currentDate]
        );

        const message = "Were there any seizure triggers? (Missed medication, bright lights, lack of sleep, alcohol, stress, or your own variant):";
        await bot.sendMessage(chatId, message);

        awaitingTriggerEnglish.add(chatId);
    } catch (error) {
        console.error('Error saving seizure description:', error);
    }
}

async function handleTriggerDescriptionEnglish(bot, chatId, trigger) {
    const currentDate = new Date().toISOString().split('T')[0];

    try {
        await db.query(
            'UPDATE calendar SET trigger = $1 WHERE user_id = $2 AND date = $3',
            [trigger, chatId, currentDate]
        );

        const message = "Did you have any repeated seizures during the day?";
        const options = {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: 'Yes', callback_data: 'repeated_yes' },
                        { text: 'No', callback_data: 'repeated_no' }
                    ]
                ]
            }
        };

        await bot.sendMessage(chatId, message, options);
    } catch (error) {
        console.error('Error saving trigger:', error);
    }
}

async function showRepeatedSeizuresButtonsEnglish(bot, chatId, messageId) {
    const message = "How many repeated seizures did you have?";
    const options = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '1', callback_data: 'repeated_1' },
                    { text: '2', callback_data: 'repeated_2' },
                    { text: '3', callback_data: 'repeated_3' }
                ],
                [
                    { text: '4', callback_data: 'repeated_4' },
                    { text: '5', callback_data: 'repeated_5' },
                    { text: '6+', callback_data: 'repeated_6plus' }
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

async function handleRepeatedSeizuresEnglish(bot, chatId, messageId, count) {
    const currentDate = new Date().toISOString().split('T')[0];

    try {
        await db.query(
            'UPDATE calendar SET repeated_seizures = $1 WHERE user_id = $2 AND date = $3',
            [count, chatId, currentDate]
        );

        const message = "Thank you for your answers";
        const options = {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: 'Return to Profile', callback_data: 'back_to_profile' }
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

async function handleNoQuestionsEnglish(bot, chatId, messageId) {
    const message = "Thank you for your response";
    const options = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: 'Return to Profile', callback_data: 'back_to_profile' }
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

async function handleStartSeizureEnglish(bot, chatId, messageId) {
    seizureStartTimesEnglish.set(chatId, new Date());

    const message = "When the seizure ends, press the button";
    const options = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: 'Stop', callback_data: 'stop_seizure_english' }
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

async function handleStopSeizureEnglish(bot, chatId, messageId) {
    const startTime = seizureStartTimesEnglish.get(chatId);
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

        const message = `Your seizure lasted: ${durationMinutes} min. May I ask you a few questions?`;
        const options = {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: 'Yes', callback_data: 'yes_questions_english' },
                        { text: 'No', callback_data: 'no_questions_english' }
                    ]
                ]
            }
        };

        await bot.editMessageText(message, {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: options.reply_markup
        });

        seizureStartTimesEnglish.delete(chatId);
    }
}

module.exports.setupCallbackHandler = setupCallbackHandlerEnglish;