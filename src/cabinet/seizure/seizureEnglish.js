const db = require('../../config/db');

let seizureStartTimesEnglish = new Map();
let awaitingDescriptionEnglish = new Set();
let awaitingCustomDescriptionEnglish = new Set();
let awaitingTriggerEnglish = new Set();
let awaitingCustomTriggerEnglish = new Set();

module.exports = async function seizureEnglish(bot, chatId, messageId) {
    const message = "Press \"Start\" if you are having a seizure";
    const options = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: 'Start', callback_data: 'start_seizure_english' },
                    { text: 'Back to Profile', callback_data: 'back_to_profile' }
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

async function startQuestionsFlowEnglish(bot, chatId, messageId) {
    const message = "How did the seizure manifest?";
    const options = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: 'Convulsions', callback_data: 'description_seizures_english' }
                ],
                [
                    { text: 'Loss of consciousness', callback_data: 'description_loss_of_consciousness_english' }
                ],
                [
                    { text: 'Uncoordinated movements', callback_data: 'description_uncoordinated_movements_english' }
                ],
                [
                    { text: 'Hallucinations', callback_data: 'description_hallucinations_english' }
                ],
                [
                    { text: 'Custom description', callback_data: 'description_custom_english' }
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

async function handleSeizureDescriptionEnglish(bot, chatId, messageId, description) {
    const currentDate = new Date().toISOString().split('T')[0];

    try {
        await db.query(
            'UPDATE calendar SET seizure_description = $1 WHERE user_id = $2 AND date = $3',
            [description, chatId, currentDate]
        );

        // Save current description
        await bot.editMessageText(`How did the seizure manifest?\n${description}`, {
            chat_id: chatId,
            message_id: messageId
        });

        const message = "Were there any seizure triggers?";
        const options = {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: 'Missed medication', callback_data: 'trigger_medication_skip_english' }
                    ],
                    [
                        { text: 'Bright light', callback_data: 'trigger_bright_light_english' }
                    ],
                    [
                        { text: 'Lack of sleep', callback_data: 'trigger_lack_of_sleep_english' }
                    ],
                    [
                        { text: 'Alcohol', callback_data: 'trigger_alcohol_english' }
                    ],
                    [
                        { text: 'Stress', callback_data: 'trigger_stress_english' }
                    ],
                    [
                        { text: 'Custom trigger', callback_data: 'trigger_custom_english' }
                    ]
                ]
            }
        };

        await bot.sendMessage(chatId, message, options);
    } catch (error) {
        console.error('Error saving seizure description:', error);
    }
}

async function handleTriggerDescriptionEnglish(bot, chatId, messageId, trigger) {
    const currentDate = new Date().toISOString().split('T')[0];

    try {
        await db.query(
            'UPDATE calendar SET trigger = $1 WHERE user_id = $2 AND date = $3',
            [trigger, chatId, currentDate]
        );

        // Save current trigger
        await bot.editMessageText(`Were there any seizure triggers?\n${trigger}`, {
            chat_id: chatId,
            message_id: messageId
        });

        const message = "How many repeated seizures did you have?";
        const options = {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '1', callback_data: 'repeated_1_english' },
                        { text: '2', callback_data: 'repeated_2_english' },
                        { text: '3', callback_data: 'repeated_3_english' }
                    ],
                    [
                        { text: '4', callback_data: 'repeated_4_english' },
                        { text: '5', callback_data: 'repeated_5_english' },
                        { text: '6+', callback_data: 'repeated_6plus_english' }
                    ],
                    [
                        { text: 'None', callback_data: 'repeated_no_english' }
                    ]
                ]
            }
        };

        await bot.sendMessage(chatId, message, options);
    } catch (error) {
        console.error('Error saving trigger:', error);
    }
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

        // Удаляем старое сообщение, отправляем новое
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

function setupCallbackHandlerEnglish(bot) {
    bot.on('message', async (msg) => {
        const chatId = msg.chat.id;

        if (awaitingCustomDescriptionEnglish.has(chatId)) {
            const messageId = msg.message_id - 1; // Previous message
            try {
                if (msg.text && msg.text.trim() !== '') {
                    await handleSeizureDescriptionEnglish(bot, chatId, messageId, msg.text);
                } else {
                    await bot.sendMessage(chatId, "Please provide a valid seizure description.");
                }
            } catch (error) {
                console.error('Error editing message for custom description:', error.message);
                await bot.sendMessage(chatId, "An error occurred while saving the description. Please try again.");
            } finally {
                awaitingCustomDescriptionEnglish.delete(chatId);
            }
            return;
        }

        if (awaitingCustomTriggerEnglish.has(chatId)) {
            const messageId = msg.message_id - 1; // Previous message
            try {
                if (msg.text && msg.text.trim() !== '') {
                    await handleTriggerDescriptionEnglish(bot, chatId, messageId, msg.text);
                } else {
                    await bot.sendMessage(chatId, "Please provide a valid seizure trigger.");
                }
            } catch (error) {
                console.error('Error editing message for custom trigger:', error.message);
                await bot.sendMessage(chatId, "An error occurred while saving the trigger. Please try again.");
            } finally {
                awaitingCustomTriggerEnglish.delete(chatId);
            }
            return;
        }
    });

    // Callback handler for buttons
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

            case 'description_seizures_english':
                await handleSeizureDescriptionEnglish(bot, chatId, messageId, 'Convulsions');
                break;

            case 'description_loss_of_consciousness_english':
                await handleSeizureDescriptionEnglish(bot, chatId, messageId, 'Loss of consciousness');
                break;

            case 'description_uncoordinated_movements_english':
                await handleSeizureDescriptionEnglish(bot, chatId, messageId, 'Uncoordinated movements');
                break;

            case 'description_hallucinations_english':
                await handleSeizureDescriptionEnglish(bot, chatId, messageId, 'Hallucinations');
                break;

            case 'description_custom_english':
                await bot.editMessageText("Describe your custom seizure:", {
                    chat_id: chatId,
                    message_id: messageId
                });
                awaitingCustomDescriptionEnglish.add(chatId);
                break;

            case 'trigger_medication_skip_english':
                await handleTriggerDescriptionEnglish(bot, chatId, messageId, 'Missed medication');
                break;

            case 'trigger_bright_light_english':
                await handleTriggerDescriptionEnglish(bot, chatId, messageId, 'Bright light');
                break;

            case 'trigger_lack_of_sleep_english':
                await handleTriggerDescriptionEnglish(bot, chatId, messageId, 'Lack of sleep');
                break;

            case 'trigger_alcohol_english':
                await handleTriggerDescriptionEnglish(bot, chatId, messageId, 'Alcohol');
                break;

            case 'trigger_stress_english':
                await handleTriggerDescriptionEnglish(bot, chatId, messageId, 'Stress');
                break;

            case 'trigger_custom_english':
                await bot.editMessageText("Describe your custom trigger:", {
                    chat_id: chatId,
                    message_id: messageId
                });
                awaitingCustomTriggerEnglish.add(chatId);
                break;

            case 'repeated_1_english':
                await handleRepeatedSeizuresEnglish(bot, chatId, messageId, 1);
                break;

            case 'repeated_2_english':
                await handleRepeatedSeizuresEnglish(bot, chatId, messageId, 2);
                break;

            case 'repeated_3_english':
                await handleRepeatedSeizuresEnglish(bot, chatId, messageId, 3);
                break;

            case 'repeated_4_english':
                await handleRepeatedSeizuresEnglish(bot, chatId, messageId, 4);
                break;

            case 'repeated_5_english':
                await handleRepeatedSeizuresEnglish(bot, chatId, messageId, 5);
                break;

            case 'repeated_6plus_english':
                await handleRepeatedSeizuresEnglish(bot, chatId, messageId, '6+');
                break;

            case 'repeated_no_english':
                await handleRepeatedSeizuresEnglish(bot, chatId, messageId, 0);
                break;

            case 'back_to_profile':
                // Return to profile function can be added here
                break;
        }

        try {
            await bot.answerCallbackQuery(query.id);
        } catch (error) {
            console.error('Error answering callback query:', error);
        }
    });
}

module.exports.setupCallbackHandler = setupCallbackHandlerEnglish;
