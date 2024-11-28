const db = require('../../config/db');

let seizureStartTimesRussian = new Map();
let awaitingDescriptionRussian = new Set();
let awaitingCustomDescriptionRussian = new Set();
let awaitingTriggerRussian = new Set();
let awaitingCustomTriggerRussian = new Set();

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



async function startQuestionsFlowRussian(bot, chatId, messageId) {
    const message = "Как выглядел приступ?";
    const options = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: 'Судороги', callback_data: 'description_seizures' }
                ],
                [
                    { text: 'Потеря сознания', callback_data: 'description_loss_of_consciousness' }
                ],
                [
                    { text: 'Некоординированные движения', callback_data: 'description_uncoordinated_movements' }
                ],
                [
                    { text: 'Галлюцинации', callback_data: 'description_hallucinations' }
                ],
                [
                    { text: 'Свой вариант', callback_data: 'description_custom' }
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

async function handleSeizureDescriptionRussian(bot, chatId, messageId, description) {
    const currentDate = new Date().toISOString().split('T')[0];

    try {
        await db.query(
            'UPDATE calendar SET seizure_description = $1 WHERE user_id = $2 AND date = $3',
            [description, chatId, currentDate]
        );

        // Сохраняем текущее сообщение с описанием
        await bot.editMessageText(`Как выглядел приступ?\n${description}`, {
            chat_id: chatId,
            message_id: messageId
        });

        const message = "Были ли провокаторы приступа?";
        const options = {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: 'Пропуск препарата', callback_data: 'trigger_medication_skip' }
                    ],
                    [
                        { text: 'Яркий свет', callback_data: 'trigger_bright_light' }
                    ],
                    [
                        { text: 'Недостаток сна', callback_data: 'trigger_lack_of_sleep' }
                    ],
                    [
                        { text: 'Алкоголь', callback_data: 'trigger_alcohol' }
                    ],
                    [
                        { text: 'Стресс', callback_data: 'trigger_stress' }
                    ],
                    [
                        { text: 'Свой вариант', callback_data: 'trigger_custom' }
                    ]
                ]
            }
        };

        await bot.sendMessage(chatId, message, options);
    } catch (error) {
        console.error('Error saving seizure description:', error);
    }
}


async function handleTriggerDescriptionRussian(bot, chatId, messageId, trigger) {
    const currentDate = new Date().toISOString().split('T')[0];

    try {
        await db.query(
            'UPDATE calendar SET trigger = $1 WHERE user_id = $2 AND date = $3',
            [trigger, chatId, currentDate]
        );

        // Сохраняем текущее сообщение с триггером
        await bot.editMessageText(`Были ли провокаторы приступа?\n${trigger}`, {
            chat_id: chatId,
            message_id: messageId
        });

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
                    ],
                    [
                        { text: 'Не было', callback_data: 'repeated_no_russian' }
                    ]
                ]
            }
        };

        await bot.sendMessage(chatId, message, options);
    } catch (error) {
        console.error('Error saving trigger:', error);
    }
}


async function handleRepeatedSeizuresRussian(bot, chatId, messageId, count) {
    const currentDate = new Date().toISOString().split('T')[0];

    try {
        await db.query(
            'UPDATE calendar SET repeated_seizures = $1 WHERE user_id = $2 AND date = $3',
            [count, chatId, currentDate]
        );

        // Сохраняем текущее сообщение с количеством повторных приступов
        await bot.editMessageText(`Сколько было повторных приступов?\n${count === 0 ? 'Не было' : count}`, {
            chat_id: chatId,
            message_id: messageId
        });

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

        await bot.sendMessage(chatId, message, options);
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

function setupCallbackHandlerRussian(bot) {
    bot.on('message', async (msg) => {
        const chatId = msg.chat.id;

        if (awaitingCustomDescriptionRussian.has(chatId)) {
            const messageId = msg.message_id - 1; // Предыдущее сообщение
            try {
                // Добавляем проверку на пустое сообщение
                if (msg.text && msg.text.trim() !== '') {
                    await handleSeizureDescriptionRussian(bot, chatId, messageId, msg.text);
                } else {
                    await bot.sendMessage(chatId, "Пожалуйста, введите корректное описание приступа.");
                }
            } catch (error) {
                console.error('Error editing message for custom description:', error.message);
                // Отправляем сообщение пользователю с информацией об ошибке
                await bot.sendMessage(chatId, "Произошла ошибка при сохранении описания. Пожалуйста, попробуйте снова.");
            } finally {
                awaitingCustomDescriptionRussian.delete(chatId);
            }
            return;
        }

        if (awaitingCustomTriggerRussian.has(chatId)) {
            const messageId = msg.message_id - 1; // Предыдущее сообщение
            try {
                // Добавляем проверку на пустое сообщение
                if (msg.text && msg.text.trim() !== '') {
                    await handleTriggerDescriptionRussian(bot, chatId, messageId, msg.text);
                } else {
                    await bot.sendMessage(chatId, "Пожалуйста, введите корректный провокатор приступа.");
                }
            } catch (error) {
                console.error('Error editing message for custom trigger:', error.message);
                // Отправляем сообщение пользователю с информацией об ошибке
                await bot.sendMessage(chatId, "Произошла ошибка при сохранении провокатора. Пожалуйста, попробуйте снова.");
            } finally {
                awaitingCustomTriggerRussian.delete(chatId);
            }
            return;
        }
    });


    // Обработчик кнопок (дополнительные обработчики)
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const messageId = query.message.message_id;

        switch (query.data) {
            // Начало записи приступа
            case 'start_seizure_russian':
                await handleStartSeizureRussian(bot, chatId, messageId);
                break;

            case 'stop_seizure_russian':
                await handleStopSeizureRussian(bot, chatId, messageId);
                break;

            // Вопросы о приступе
            case 'yes_questions_russian':
                await startQuestionsFlowRussian(bot, chatId, messageId);
                break;

            case 'no_questions_russian':
                await handleNoQuestionsRussian(bot, chatId, messageId);
                break;

            // Описание приступа
            case 'description_seizures':
                await handleSeizureDescriptionRussian(bot, chatId, messageId, 'Судороги');
                break;

            case 'description_loss_of_consciousness':
                await handleSeizureDescriptionRussian(bot, chatId, messageId, 'Потеря сознания');
                break;

            case 'description_uncoordinated_movements':
                await handleSeizureDescriptionRussian(bot, chatId, messageId, 'Некоординированные движения');
                break;

            case 'description_hallucinations':
                await handleSeizureDescriptionRussian(bot, chatId, messageId, 'Галлюцинации');
                break;

            case 'description_custom':
                await bot.editMessageText("Опишите свой вариант:", {
                    chat_id: chatId,
                    message_id: messageId
                });
                awaitingCustomDescriptionRussian.add(chatId);
                break;

            // Триггеры приступа
            case 'trigger_medication_skip':
                await handleTriggerDescriptionRussian(bot, chatId, messageId, 'Пропуск препарата');
                break;

            case 'trigger_bright_light':
                await handleTriggerDescriptionRussian(bot, chatId, messageId, 'Яркий свет');
                break;

            case 'trigger_lack_of_sleep':
                await handleTriggerDescriptionRussian(bot, chatId, messageId, 'Недостаток сна');
                break;

            case 'trigger_alcohol':
                await handleTriggerDescriptionRussian(bot, chatId, messageId, 'Алкоголь');
                break;

            case 'trigger_stress':
                await handleTriggerDescriptionRussian(bot, chatId, messageId, 'Стресс');
                break;

            case 'trigger_custom':
                await bot.editMessageText("Опишите свой вариант провокатора:", {
                    chat_id: chatId,
                    message_id: messageId
                });
                awaitingCustomTriggerRussian.add(chatId);
                break;
            // Повторные приступы
            case 'repeated_1_russian':
                await handleRepeatedSeizuresRussian(bot, chatId, messageId, 1);
                break;

            case 'repeated_2_russian':
                await handleRepeatedSeizuresRussian(bot, chatId, messageId, 2);
                break;

            case 'repeated_3_russian':
                await handleRepeatedSeizuresRussian(bot, chatId, messageId, 3);
                break;

            case 'repeated_4_russian':
                await handleRepeatedSeizuresRussian(bot, chatId, messageId, 4);
                break;

            case 'repeated_5_russian':
                await handleRepeatedSeizuresRussian(bot, chatId, messageId, 5);
                break;

            case 'repeated_6plus_russian':
                await handleRepeatedSeizuresRussian(bot, chatId, messageId, '6+');
                break;

            case 'repeated_no_russian':
                await handleRepeatedSeizuresRussian(bot, chatId, messageId, 0);
                break;

            // Возврат в профиль
            case 'back_to_profile':
                // Добавьте вызов функции возврата в профиль, если она реализована
                break;
        }

        try {
            await bot.answerCallbackQuery(query.id);
        } catch (error) {
            console.error('Error answering callback query:', error);
        }
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