const db = require('../../config/db');

// Function for rendering the calendar
async function seizureCalendarEnglish(bot, chatId, messageId, monthOffset = 0, selectedDay = null) {
    try {
        const today = new Date();
        let currentMonth = today.getMonth() + monthOffset;
        let currentYear = today.getFullYear();

        if (currentMonth < 0) {
            currentYear--;
            currentMonth = 12 + currentMonth;
        } else if (currentMonth > 11) {
            currentYear++;
            currentMonth = currentMonth - 12;
        }

        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

        const result = await db.query(
            `SELECT * FROM calendar WHERE user_id = $1 AND EXTRACT(MONTH FROM date) = $2 AND EXTRACT(YEAR FROM date) = $3`,
            [chatId, currentMonth + 1, currentYear]
        );

        const calendarData = result.rows;

        const inlineKeyboard = [];
        let row = [];
        const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
        const dayOfWeek = (firstDayOfMonth.getDay() + 6) % 7;

        inlineKeyboard.push([
            {
                text: `${new Date(currentYear, currentMonth).toLocaleString('en-US', { month: 'long', year: 'numeric' })}`,
                callback_data: 'no_action'
            }
        ]);

        const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        inlineKeyboard.push(weekDays.map(day => ({ text: day, callback_data: 'no_action' })));

        for (let i = 0; i < dayOfWeek; i++) {
            row.push({ text: ' ', callback_data: 'no_action' });
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const dayRecord = calendarData.find(entry => new Date(entry.date).getDate() === day);
            let buttonLabel = `${day}`;

            if (dayRecord) {
                if (dayRecord.had_seizure) {
                    buttonLabel += '🔸';
                } else if (dayRecord.note && !dayRecord.had_seizure) {
                    buttonLabel += '✅';
                }
            }

            row.push({
                text: buttonLabel,
                callback_data: `calendar_${day}_${monthOffset}_en`
            });

            if (row.length === 7) {
                inlineKeyboard.push(row);
                row = [];
            }
        }

        while (row.length < 7) {
            row.push({ text: ' ', callback_data: 'no_action' });
        }
        if (row.length) {
            inlineKeyboard.push(row);
        }

        const navigationRow = [];
        navigationRow.push({ text: '⬅️', callback_data: `change_month_${monthOffset - 1}_en` });

        if (currentMonth < today.getMonth() || currentYear < today.getFullYear()) {
            navigationRow.push({ text: '➡️', callback_data: `change_month_${monthOffset + 1}_en` });
        } else {
            navigationRow.push({ text: '➡️', callback_data: 'no_action' });
        }

        inlineKeyboard.push(navigationRow);

        if (selectedDay) {
            const selectedDate = new Date(currentYear, currentMonth, selectedDay);
            const monthGenitive = selectedDate.toLocaleString('en-US', { month: 'long' });
            const tt = `${selectedDate.getFullYear()}-${(selectedDate.getMonth() + 1).toString().padStart(2, '0')}-${selectedDate.getDate().toString().padStart(2, '0')}`;

            inlineKeyboard.push([
                {
                    text: `Make a record on ${selectedDay} ${monthGenitive}`,
                    callback_data: `start_record_${tt}_en`
                }
            ]);
        }

        inlineKeyboard.push([{ text: 'Back to Profile', callback_data: 'back_to_profile' }]);

        await bot.editMessageText(
            `Your Seizure Calendar\n\nIf there is already a record in the calendar, the icon will show if you had a seizure:\n🔸 — Seizure Occurred\n✅ — Note Made`,
            {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: { inline_keyboard: inlineKeyboard }
            }
        );
    } catch (error) {
        console.error('Error rendering calendar:', error);
    }
}

// Handler for day press (English)
async function handleDayPressEnglish(bot, chatId, day, monthOffset, messageId) {
    await seizureCalendarEnglish(bot, chatId, messageId, parseInt(monthOffset), parseInt(day));
}

// Handler for month change (English)
async function handleChangeMonthEnglish(bot, chatId, monthOffset, messageId) {
    await seizureCalendarEnglish(bot, chatId, messageId, parseInt(monthOffset));
}

// Handler for starting record on selected date (English)
async function startRecordingEnglish(bot, chatId, date, messageId) {
    const dateObject = new Date(date);
    const formattedDate = `${dateObject.getFullYear()}-${(dateObject.getMonth() + 1).toString().padStart(2, '0')}-${dateObject.getDate().toString().padStart(2, '0')}`;

    const awaitingCustomDescriptionEnglish = new Set();
    const awaitingCustomTriggerEnglish = new Set();
    const awaitingNoteEnglish = new Set();

    try {
        await db.query(
            `INSERT INTO calendar (user_id, date, created_at, had_seizure) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, date) DO NOTHING`,
            [chatId, date, new Date(), null]
        );

        await bot.deleteMessage(chatId, messageId);

        await bot.sendMessage(chatId, `Did you have an epileptic seizure?`, {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: 'Yes', callback_data: `record_seizure_${formattedDate}_en` },
                        { text: 'No', callback_data: `record_no_seizure_${formattedDate}_en` }
                    ]
                ]
            }
        });

        const callbackHandlerEnglish = async (callbackQuery) => {
            const data = callbackQuery.data;
            const chatId = callbackQuery.message.chat.id;
            const messageId = callbackQuery.message.message_id;

            try {
                if (data === `record_no_seizure_${date}_en`) {
                    await bot.editMessageText(
                        `Record for ${dateObject.toLocaleString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}\n\nQuestion: Did you have an epileptic seizure?\nAnswer: No`,
                        {
                            chat_id: chatId,
                            message_id: callbackQuery.message.message_id
                        }
                    );

                    await db.query(
                        `UPDATE calendar 
                         SET had_seizure = $1 
                         WHERE user_id = $2 AND date = $3`,
                        [false, chatId, formattedDate]
                    );

                    await bot.sendMessage(chatId, `Would you like to add a note to the record?`, {
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    { text: 'Yes', callback_data: `add_note_no_seizure_${formattedDate}_en` },
                                    { text: 'No', callback_data: `no_note_no_seizure_${formattedDate}_en` }
                                ]
                            ]
                        }
                    });
                } else if (data === `no_note_no_seizure_${date}_en`) {
                    await bot.editMessageText(
                        `Note not added to the record.`,
                        {
                            chat_id: chatId,
                            message_id: callbackQuery.message.message_id
                        }
                    );

                    await db.query(
                        `UPDATE calendar 
                         SET note = false 
                         WHERE user_id = $1 AND date = $2`,
                        [chatId, formattedDate]
                    );

                    await bot.sendMessage(chatId, 'Record saved.', {
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    { text: 'Back', callback_data: 'back_to_profile' }
                                ]
                            ]
                        }
                    });
                    bot.removeListener('callback_query', callbackHandlerEnglish);
                }
                else if (data === `add_note_no_seizure_${date}_en`) {
                    await bot.editMessageText(
                        `Question: Would you like to add a note to the record?\nAnswer: Yes\n\nWrite your note:`,
                        {
                            chat_id: chatId,
                            message_id: callbackQuery.message.message_id
                        }
                    );

                    bot.once('message', async (msg) => {
                        if (msg.chat.id === chatId) {
                            const noteText = msg.text;

                            await db.query(
                                `UPDATE calendar 
                                 SET note = true, note_text = $1 
                                 WHERE user_id = $2 AND date = $3`,
                                [noteText, chatId, formattedDate]
                            );

                            await bot.sendMessage(chatId, `Note recorded:\n${noteText}`, {
                                reply_markup: {
                                    inline_keyboard: [
                                        [
                                            { text: 'Back', callback_data: 'back_to_profile' }
                                        ]
                                    ]
                                }
                            });
                            bot.removeListener('callback_query', callbackHandlerEnglish);
                        }
                    });
                }
                else if (data === `add_note_no_seizure_no_${formattedDate}_en`) {
                    await bot.editMessageText(
                        `Would you like to add a note to the record?\nNo`,
                        { chat_id: chatId, message_id: messageId }
                    );

                    awaitingNoteEnglish.delete(chatId);
                    bot.removeListener('callback_query', callbackHandlerEnglish);
                }
                else if (data === `record_seizure_${formattedDate}_en`) {
                    await bot.editMessageText(
                        `Did you have an epileptic seizure?\nYes`,
                        { chat_id: chatId, message_id: messageId }
                    );

                    await db.query(
                        `UPDATE calendar SET had_seizure = $1 WHERE user_id = $2 AND date = $3`,
                        [true, chatId, formattedDate]
                    );

                    await bot.sendMessage(chatId, "How did the seizure look?", {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: 'Convulsions', callback_data: `description_seizures_${formattedDate}_en` }],
                                [{ text: 'Loss of Consciousness', callback_data: `description_loss_${formattedDate}_en` }],
                                [{ text: 'Uncoordinated Movements', callback_data: `description_movement_${formattedDate}_en` }],
                                [{ text: 'Hallucinations', callback_data: `description_halluc_${formattedDate}_en` }],
                                [{ text: 'Custom Option', callback_data: `description_custom_${formattedDate}_en` }]
                            ]
                        }
                    });
                } else if (data.startsWith('description_') && data.endsWith('_en')) {
                    const [_, description, dateString] = data.split('_');
                    const descriptionMap = {
                        'seizures': 'Convulsions',
                        'loss': 'Loss of Consciousness',
                        'movement': 'Uncoordinated Movements',
                        'halluc': 'Hallucinations'
                    };

                    const seizureDescription = descriptionMap[description] || description;

                    await bot.editMessageText(
                        `How did the seizure look?\n${seizureDescription}`,
                        { chat_id: chatId, message_id: messageId }
                    );

                    if (description === 'custom') {
                        await bot.sendMessage(chatId, "Describe your option:");
                        awaitingCustomDescriptionEnglish.add(chatId);
                    } else {
                        await handleSeizureDescription(seizureDescription, dateString.replace('_en', ''), bot, chatId);
                    }
                } else if (data.startsWith('trigger_') && data.endsWith('_en')) {
                    const [_, triggerType, dateString] = data.split('_');
                    const triggerMap = {
                        'med': 'Missed Medication',
                        'light': 'Bright Light',
                        'sleep': 'Lack of Sleep',
                        'alcohol': 'Alcohol',
                        'stress': 'Stress'
                    };

                    const triggerText = triggerMap[triggerType] || triggerType;

                    await bot.editMessageText(
                        `Were there any seizure triggers?\n${triggerText}`,
                        { chat_id: chatId, message_id: messageId }
                    );

                    if (triggerType === 'custom') {
                        await bot.sendMessage(chatId, "Describe your trigger option:");
                        awaitingCustomTriggerEnglish.add(chatId);
                    } else {
                        await handleTriggerDescription(triggerText, dateString.replace('_en', ''), bot, chatId);
                    }
                } else if (data.startsWith('repeated_') && data.endsWith('_en')) {
                    const [_, count, dateString] = data.split('_');
                    const seizureCount = count === '6plus' ? '6+' : (count === 'no' ? 0 : count);

                    await db.query(
                        `UPDATE calendar SET repeated_seizures = $1 WHERE user_id = $2 AND date = $3`,
                        [seizureCount, chatId, dateString.replace('_en', '')]
                    );

                    await bot.editMessageText(
                        `Number of seizures:\n${seizureCount === 0 ? 'None' : seizureCount}`,
                        { chat_id: chatId, message_id: messageId }
                    );

                    await bot.sendMessage(chatId, `Would you like to add a note to the record?`, {
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    { text: 'Yes',callback_data: `add_note_${dateString}_en` },
                                    { text: 'No', callback_data: `no_note_${dateString}_en` }
                                ]
                            ]
                        }
                    });
                } else if (data.startsWith('no_note_') && data.endsWith('_en')) {
                    const dateString = data.split('_')[2];

                    await bot.editMessageText(
                        `Note not added to the record.`,
                        {
                            chat_id: chatId,
                            message_id: callbackQuery.message.message_id
                        }
                    );

                    await db.query(
                        `UPDATE calendar 
                         SET note = false 
                         WHERE user_id = $1 AND date = $2`,
                        [chatId, formattedDate]
                    );

                    await bot.sendMessage(chatId, 'Record saved.', {
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    { text: 'Back', callback_data: 'back_to_profile' }
                                ]
                            ]
                        }
                    });
                    bot.removeListener('callback_query', callbackHandlerEnglish);
                }
                else if (data.startsWith('add_note_') && data.endsWith('_en')) {
                    const dateString = data.split('_')[2];

                    await bot.editMessageText(
                        `Question: Would you like to add a note to the record?\nAnswer: Yes\n\nWrite your note:`,
                        {
                            chat_id: chatId,
                            message_id: callbackQuery.message.message_id
                        }
                    );

                    bot.once('message', async (msg) => {
                        if (msg.chat.id === chatId) {
                            const noteText = msg.text;

                            await db.query(
                                `UPDATE calendar 
                                 SET note = true, note_text = $1 
                                 WHERE user_id = $2 AND date = $3`,
                                [noteText, chatId, formattedDate]
                            );

                            await bot.sendMessage(chatId, `Note recorded:\n${noteText}`, {
                                reply_markup: {
                                    inline_keyboard: [
                                        [
                                            { text: 'Back', callback_data: 'back_to_profile' }
                                        ]
                                    ]
                                }
                            });
                            bot.removeListener('callback_query', callbackHandlerEnglish);
                        }
                    });
                }

            } catch (error) {
                console.error('Error in callback handler:', error);
            }
        };

        const handleSeizureDescription = async (description, dateString, botInstance, chatId) => {
            try {
                await db.query(
                    'UPDATE calendar SET seizure_description = $1 WHERE user_id = $2 AND date = $3',
                    [description, chatId, dateString]
                );

                await botInstance.sendMessage(chatId, "Were there any seizure triggers?", {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: 'Missed Medication', callback_data: `trigger_med_${dateString}_en` }],
                            [{ text: 'Bright Light', callback_data: `trigger_light_${dateString}_en` }],
                            [{ text: 'Lack of Sleep', callback_data: `trigger_sleep_${dateString}_en` }],
                            [{ text: 'Alcohol', callback_data: `trigger_alcohol_${dateString}_en` }],
                            [{ text: 'Stress', callback_data: `trigger_stress_${dateString}_en` }],
                            [{ text: 'Custom Option', callback_data: `trigger_custom_${dateString}_en` }]
                        ]
                    }
                });
            } catch (error) {
                console.error('Error in handleSeizureDescription:', error);
                await botInstance.sendMessage(chatId, 'An error occurred while saving the seizure description.');
            }
        };

        const handleTriggerDescription = async (trigger, dateString, botInstance, chatId) => {
            try {
                await db.query(
                    'UPDATE calendar SET trigger = $1 WHERE user_id = $2 AND date = $3',
                    [trigger, chatId, dateString]
                );

                await botInstance.sendMessage(chatId, "How many seizures occurred?", {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: '1', callback_data: `repeated_1_${dateString}_en` },
                                { text: '2', callback_data: `repeated_2_${dateString}_en` },
                                { text: '3', callback_data: `repeated_3_${dateString}_en` }
                            ],
                            [
                                { text: '4', callback_data: `repeated_4_${dateString}_en` },
                                { text: '5', callback_data: `repeated_5_${dateString}_en` },
                                { text: '6+', callback_data: `repeated_6plus_${dateString}_en` }
                            ],
                            [{ text: 'None', callback_data: `repeated_no_${dateString}_en` }]
                        ]
                    }
                });
            } catch (error) {
                console.error('Error in handleTriggerDescription:', error);
                await botInstance.sendMessage(chatId, 'An error occurred while saving the trigger.');
            }
        };

        bot.on('message', async (msg) => {
            if (msg.chat.id === chatId) {
                if (awaitingCustomDescriptionEnglish.has(chatId)) {
                    awaitingCustomDescriptionEnglish.delete(chatId);
                    if (msg.text && msg.text.trim() !== '') {
                        await handleSeizureDescription(msg.text, formattedDate, bot, chatId);
                    } else {
                        await bot.sendMessage(chatId, "Please enter a valid seizure description.");
                    }
                }

                if (awaitingCustomTriggerEnglish.has(chatId)) {
                    awaitingCustomTriggerEnglish.delete(chatId);
                    if (msg.text && msg.text.trim() !== '') {
                        await handleTriggerDescription(msg.text, formattedDate, bot, chatId);
                    } else {
                        await bot.sendMessage(chatId, "Please enter a valid seizure trigger.");
                    }
                }
                if (awaitingNoteEnglish.has(chatId)) {
                    awaitingNoteEnglish.delete(chatId);
                    if (msg.text && msg.text.trim() !== '') {
                        await db.query(
                            'UPDATE calendar SET note_text = $1, note = $2 WHERE user_id = $3 AND date = $4',
                            [msg.text, true, chatId, formattedDate]
                        );
                        await bot.sendMessage(chatId, "Note saved.");
                        bot.removeListener('callback_query', callbackHandlerEnglish);
                    } else {
                        await bot.sendMessage(chatId, "Please enter a valid note.");
                    }
                }
            }
        });

        bot.on('callback_query', callbackHandlerEnglish);

    } catch (error) {
        console.error('Error in startRecordingEnglish:', error);
        await bot.sendMessage(chatId, 'An error occurred while creating the record. Please try again.');
    }
}

module.exports = {
    seizureCalendarEnglish,
    handleChangeMonthEnglish,
    handleDayPressEnglish,
    startRecordingEnglish
};