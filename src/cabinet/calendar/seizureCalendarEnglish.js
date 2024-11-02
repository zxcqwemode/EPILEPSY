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
                    buttonLabel += ' 🔸';
                } else if (dayRecord.note && !dayRecord.had_seizure) {
                    buttonLabel += ' ✅';
                }
            }

            row.push({
                text: buttonLabel,
                callback_data: `calendar_${day}_${monthOffset}`
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
        navigationRow.push({ text: '⬅️', callback_data: `change_month_${monthOffset - 1}` });

        if (currentMonth < today.getMonth() || currentYear < today.getFullYear()) {
            navigationRow.push({ text: '➡️', callback_data: `change_month_${monthOffset + 1}` });
        } else {
            navigationRow.push({ text: '➡️', callback_data: 'no_action' });
        }

        inlineKeyboard.push(navigationRow);

        if (selectedDay) {
            const selectedDate = new Date(currentYear, currentMonth, selectedDay);
            const tt = `${selectedDate.getFullYear()}-${(selectedDate.getMonth() + 1).toString().padStart(2, '0')}-${selectedDate.getDate().toString().padStart(2, '0')}`;
            inlineKeyboard.push([
                {
                    text: `Make an entry for ${selectedDate.toLocaleString('en-US', { month: 'long', day: 'numeric' })}`,
                    callback_data: `start_record_${tt}`
                }
            ]);
        }

        inlineKeyboard.push([{ text: 'Back to Profile', callback_data: 'back_to_profile' }]);

        await bot.editMessageText(
            `Your Seizure Calendar\n\nIf there's already an entry in the calendar, the icon will show if you had a seizure:\n🔸 — Had a seizure\n✅ — Made a note`,
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

async function handleDayPressEnglish(bot, chatId, day, monthOffset, messageId) {
    await seizureCalendarEnglish(bot, chatId, messageId, parseInt(monthOffset), parseInt(day));
}

async function handleChangeMonthEnglish(bot, chatId, monthOffset, messageId) {
    await seizureCalendarEnglish(bot, chatId, messageId, parseInt(monthOffset));
}

async function startRecordingEnglish(bot, chatId, date, messageId) {
    const dateObject = new Date(date);
    const formattedDate = date;

    try {
        await db.query(
            `INSERT INTO calendar (user_id, date, created_at) VALUES ($1, $2, $3) ON CONFLICT (user_id, date) DO NOTHING`,
            [chatId, formattedDate, new Date()]
        );

        await bot.deleteMessage(chatId, messageId);

        await bot.sendMessage(chatId, `Did you have an epileptic seizure?`, {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: 'Yes', callback_data: `record_seizure_${formattedDate}` },
                        { text: 'No', callback_data: `record_no_seizure_${formattedDate}` }
                    ]
                ]
            }
        });

        const callbackHandlerEnglish = async (callbackQuery) => {
            const data = callbackQuery.data;
            const chatId = callbackQuery.message.chat.id;

            try {
                if (data === `record_no_seizure_${date}`) {
                    await bot.editMessageText(
                        `Entry for ${dateObject.toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}\n\nQuestion: Did you have an epileptic seizure?\nAnswer: No`,
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

                    await bot.sendMessage(chatId, `Would you like to add a note to this entry?`, {
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    { text: 'Yes', callback_data: `add_note_no_seizure_${formattedDate}` },
                                    { text: 'No', callback_data: `no_note_no_seizure_${formattedDate}` }
                                ]
                            ]
                        }
                    });

                } else if (data === `record_seizure_${date}`) {
                    await bot.editMessageText(
                        `Entry for ${dateObject.toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}\n\nQuestion: Did you have an epileptic seizure?\nAnswer: Yes`,
                        {
                            chat_id: chatId,
                            message_id: callbackQuery.message.message_id
                        }
                    );

                    await db.query(
                        `UPDATE calendar 
                         SET had_seizure = $1 
                         WHERE user_id = $2 AND date = $3`,
                        [true, chatId, formattedDate]
                    );

                    await bot.sendMessage(chatId, `How many minutes did the seizure last?`, {
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    { text: '1', callback_data: `duration_1_${formattedDate}` },
                                    { text: '2', callback_data: `duration_2_${formattedDate}` },
                                    { text: '3', callback_data: `duration_3_${formattedDate}` },
                                    { text: '4', callback_data: `duration_4_${formattedDate}` },
                                    { text: '5', callback_data: `duration_5_${formattedDate}` },
                                    { text: 'More than 5', callback_data: `duration_more_${formattedDate}` }
                                ]
                            ]
                        }
                    });
                }

                else if (data.startsWith('duration_')) {
                    const [_, minutes, dateString] = data.split('_');
                    const duration = minutes === 'more' ? 'More than 5' : minutes;

                    await bot.editMessageText(
                        `Question: How many minutes did the seizure last?\nAnswer: ${duration} minutes`,
                        {
                            chat_id: chatId,
                            message_id: callbackQuery.message.message_id
                        }
                    );

                    await db.query(
                        `UPDATE calendar 
                         SET seizure_duration = $1 
                         WHERE user_id = $2 AND date = $3`,
                        [duration, chatId, dateString]
                    );

                    await bot.sendMessage(chatId,
                        `Describe the seizure. (e.g. convulsions, loss of consciousness, uncoordinated movements, hallucinations, etc.)`,
                        {
                            reply_markup: { force_reply: true }
                        }
                    );

                    bot.once('message', async (msg) => {
                        if (msg.chat.id === chatId) {
                            const seizureDescription = msg.text;

                            await db.query(
                                `UPDATE calendar 
                                 SET seizure_description = $1 
                                 WHERE user_id = $2 AND date = $3`,
                                [seizureDescription, chatId, dateString]
                            );

                            await bot.sendMessage(chatId, `Seizure description: ${seizureDescription}`);

                            await bot.sendMessage(chatId, `Were there any triggers for the seizure?`, {
                                reply_markup: {
                                    inline_keyboard: [
                                        [
                                            { text: 'Missed medication', callback_data: `trigger_missed_meds_${dateString}` },
                                            { text: 'Bright light', callback_data: `trigger_bright_light_${dateString}` }
                                        ],
                                        [
                                            { text: 'Lack of sleep', callback_data: `trigger_lack_sleep_${dateString}` },
                                            { text: 'Alcohol', callback_data: `trigger_alcohol_${dateString}` }
                                        ],
                                        [
                                            { text: 'Stress', callback_data: `trigger_stress_${dateString}` },
                                            { text: 'Other', callback_data: `trigger_other_${dateString}` }
                                        ]
                                    ]
                                }
                            });
                        }
                    });
                }

                else if (data.startsWith('trigger_')) {
                    const [_, triggerType, dateString] = data.split('_');
                    const triggerMap = {
                        'missed_meds': 'Missed medication',
                        'bright_light': 'Bright light',
                        'lack_sleep': 'Lack of sleep',
                        'alcohol': 'Alcohol',
                        'stress': 'Stress',
                        'other': 'Other'
                    };

                    const triggerText = triggerMap[triggerType] || triggerType;

                    await bot.editMessageText(
                        `Question: Were there any triggers for the seizure?\nAnswer: ${triggerText}`,
                        {
                            chat_id: chatId,
                            message_id: callbackQuery.message.message_id
                        }
                    );

                    await db.query(
                        `UPDATE calendar 
                         SET trigger = $1 
                         WHERE user_id = $2 AND date = $3`,
                        [triggerText, chatId, formattedDate]
                    );

                    await bot.sendMessage(chatId, `Were there any repeated seizures on the same day?`, {
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    { text: 'Yes', callback_data: `repeated_seizures_yes_${dateString}` },
                                    { text: 'No', callback_data: `repeated_seizures_no_${dateString}` }
                                ]
                            ]
                        }
                    });
                }

                else if (data.startsWith('repeated_seizures_')) {
                    const [_, answer, dateString] = data.split('_');

                    if (data.startsWith('repeated_seizures_yes')) {
                        // If answer is "Yes", ask how many repeated seizures
                        await bot.editMessageText(
                            `Question: Were there any repeated seizures on the same day?\nAnswer: Yes\n\n How many repeated seizures were there?`,
                            {
                                chat_id: chatId,
                                message_id: callbackQuery.message.message_id,
                                reply_markup: {
                                    inline_keyboard: [
                                        [
                                            { text: '1', callback_data: `seizure_count_1_${dateString}` },
                                            { text: '2', callback_data: `seizure_count_2_${dateString}` },
                                            { text: '3', callback_data: `seizure_count_3_${dateString}` }
                                        ],
                                        [
                                            { text: '4', callback_data: `seizure_count_4_${dateString}` },
                                            { text: '5', callback_data: `seizure_count_5_${dateString}` },
                                            { text: '6+', callback_data: `seizure_count_6plus_${dateString}` }
                                        ]
                                    ]
                                }
                            }
                        );
                    } else {
                        await bot.editMessageText(
                            `Question: Were there any repeated seizures on the same day?\nAnswer: No`,
                            {
                                chat_id: chatId,
                                message_id: callbackQuery.message.message_id
                            }
                        );

                        await db.query(
                            `UPDATE calendar 
                             SET repeated_seizures = $1 
                             WHERE user_id = $2 AND date = $3`,
                            ['No', chatId, formattedDate]
                        );

                        await bot.sendMessage(chatId, `Would you like to add a note to this entry?`, {
                            reply_markup: {
                                inline_keyboard: [
                                    [
                                        { text: 'Yes', callback_data: `add_note_${dateString}` },
                                        { text: 'No', callback_data: `no_note_${dateString}` }
                                    ]
                                ]
                            }
                        });
                    }
                }

                else if (data.startsWith('seizure_count_')) {
                    const [_, __, count, dateString] = data.split('_');
                    const seizureCount = count === '6plus' ? '6+' : count;

                    await bot.editMessageText(
                        `Question: How many repeated seizures were there?\nAnswer: ${seizureCount}`,
                        {
                            chat_id: chatId,
                            message_id: callbackQuery.message.message_id
                        }
                    );

                    await db.query(
                        `UPDATE calendar 
                         SET repeated_seizures = $1 
                         WHERE user_id = $2 AND date = $3`,
                        [seizureCount, chatId, formattedDate]
                    );

                    await bot.sendMessage(chatId, `Would you like to add a note to this entry?`, {
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    { text: 'Yes', callback_data: `add_note_${dateString}` },
                                    { text: 'No', callback_data: `no_note_${dateString}` }
                                ]
                            ]
                        }
                    });
                }

                else if (data.startsWith('add_note_')) {
                    const dateString = data.split('_')[2];

                    await bot.editMessageText(
                        `Question: Would you like to add a note to this entry?\nAnswer: Yes\n\nPlease enter your note:`,
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
                                            { text: 'Back to Profile', callback_data: 'back_to_profile' }
                                        ]
                                    ]
                                }
                            });
                            bot.removeListener('callback_query', callbackHandlerEnglish);
                        }
                    });
                }

                else if (data.startsWith('no_note_')) {
                    const dateString = data.split('_')[2];

                    await bot.editMessageText(
                        `Note not added to this entry.`,
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

                    await bot.sendMessage(chatId, `Entry saved.`, {
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    { text: 'Back to Profile', callback_data: 'back_to_profile' }
                                ]
                            ]
                        }
                    });
                    bot.removeListener('callback_query', callbackHandlerEnglish);
                }

            } catch (error) {
                bot.removeListener('callback_query', callbackHandlerEnglish);
                console.error('Error in callback handler:', error);

            }
        };

        bot.on('callback_query', callbackHandlerEnglish);

    } catch (error) {
        console.error('Error in startRecordingEnglish:', error);
        await bot.sendMessage(chatId,
            'An error occurred while creating an entry. Please try again.'
        );
    }
}

module.exports = {
    seizureCalendarEnglish,
    handleChangeMonthEnglish,
    handleDayPressEnglish,
    startRecordingEnglish
};